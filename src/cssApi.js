import { unzip } from 'fflate';

const _tokenCache = {};

export async function getAccessToken(clientId, clientSecret) {
  const cached = _tokenCache[clientId];
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  const res = await fetch('/proxy/oauth', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`OAuth token request failed (${res.status}) — check your Client ID and Secret`);
  const data = await res.json();
  _tokenCache[clientId] = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return _tokenCache[clientId].value;
}

const CSS_REGIONS = {
  us: '/proxy/css-us',
  eu: '/proxy/css-uk', // CIDP uses "eu" but 8x8 storage for UK tenants is the "uk" region
  uk: '/proxy/css-uk',
};

async function cssGet(region, bearerToken, path, params = {}) {
  const url = new URL(`${CSS_REGIONS[region]}${path}`, window.location.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.message || err.errors?.[0]?.message || res.statusText;
    throw new Error(`${res.status}: ${msg}`);
  }

  return res.json();
}

export async function fetchRecordings(region, bearerToken, startMs, endMs) {
  const startIso = new Date(startMs).toISOString();
  const endIso   = new Date(endMs).toISOString();

  const timeFilter = `createdTime=ge=${startIso};createdTime=le=${endIso}`;
  const filter = `(type==callcenterrecording,type==callrecording);${timeFilter}`;

  const data = await cssGet(region, bearerToken, '/v3/objects', { filter, limit: 50 });
  const items = data.content || data.objects || data.items || data.data || [];

  // If the typed query returned nothing, run a diagnostic query without the type
  // filter to see what objects (if any) actually exist in this time window.
  if (items.length === 0) {
    try {
      const allData = await cssGet(region, bearerToken, '/v3/objects', {
        filter: timeFilter,
        limit: 10,
      });
      const allItems = allData.content || allData.objects || allData.items || allData.data || [];
      if (allItems.length > 0) {
        const types = [...new Set(allItems.map(o => o.type))];
        console.warn('[recordings] type-filtered query returned 0, but unfiltered found', allItems.length,
          'object(s) with type(s):', types,
          '— update the type filter to match one of these values');
      } else {
        console.warn('[recordings] no objects at all in this time window — recording may not be enabled for this tenant');
      }
    } catch (e) {
      console.warn('[recordings] diagnostic unfiltered query also failed:', e.message);
    }
  }

  return items.sort((a, b) => (a.createdTime ?? 0) - (b.createdTime ?? 0));
}

/**
 * Fetch recordings via the CSS bulk-download API:
 *   1. POST /v3/bulk/download/start  → { zipName }
 *   2. Poll GET /v3/bulk/download/status/{zipName} until "DONE"
 *   3. GET /v3/bulk/download/{zipName} → binary zip
 *   4. Unzip in-browser, match files to objects by objectName basename
 *
 * Returns a Map<objectId, blobUrl>.
 */
export async function fetchRecordingUrls(region, bearerToken, objects, onStatus) {
  const base = CSS_REGIONS[region];
  const authHeader = { Authorization: `Bearer ${bearerToken}` };

  // Step 1: Start bulk download
  onStatus?.('Requesting download…');
  const startRes = await fetch(
    new URL(`${base}/v3/bulk/download/start`, window.location.origin).toString(),
    {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(objects.map(o => o.id)),
    }
  );
  if (!startRes.ok) {
    const err = await startRes.json().catch(() => ({}));
    throw new Error(`Bulk download start failed (${startRes.status}): ${err.message || startRes.statusText}`);
  }
  const { zipName } = await startRes.json();
  console.log('[recordings] bulk download started, zipName:', zipName);

  // Step 2: Poll status
  const POLL_INTERVAL_MS = 3000;
  const MAX_POLLS = 40; // ~2 minutes
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    onStatus?.(`Preparing zip… (${(i + 1) * 3}s)`);

    const statusRes = await fetch(
      new URL(`${base}/v3/bulk/download/status/${zipName}`, window.location.origin).toString(),
      { headers: authHeader }
    );
    if (!statusRes.ok) {
      const err = await statusRes.json().catch(() => ({}));
      throw new Error(`Status check failed (${statusRes.status}): ${err.message || statusRes.statusText}`);
    }
    const { status } = await statusRes.json();
    console.log('[recordings] zip status:', status);
    if (status === 'DONE') break;
    if (i === MAX_POLLS - 1) throw new Error('Timed out waiting for recording zip to be ready');
  }

  // Step 3: Download the zip
  onStatus?.('Downloading…');
  const zipRes = await fetch(
    new URL(`${base}/v3/bulk/download/${zipName}`, window.location.origin).toString(),
    { headers: authHeader }
  );
  if (!zipRes.ok) {
    const err = await zipRes.json().catch(() => ({}));
    throw new Error(`Zip download failed (${zipRes.status}): ${err.message || zipRes.statusText}`);
  }
  const zipBuffer = new Uint8Array(await zipRes.arrayBuffer());

  // Step 4: Unzip and match files to objects by filename
  const blobUrls = await new Promise((resolve, reject) => {
    unzip(zipBuffer, (err, files) => {
      if (err) return reject(new Error(`Unzip failed: ${err.message}`));

      const urlMap = new Map(); // objectId → blobUrl
      for (const obj of objects) {
        // objectName may be a full path; match on the basename
        const basename = obj.objectName.split('/').pop().split(':').pop();
        const matchedKey = Object.keys(files).find(k => k.endsWith(basename) || k === obj.objectName);
        if (matchedKey) {
          const blob = new Blob([files[matchedKey]], { type: obj.mimeType || 'audio/mpeg' });
          urlMap.set(obj.id, URL.createObjectURL(blob));
        } else {
          console.warn('[recordings] no zip entry matched objectName:', obj.objectName, '— keys:', Object.keys(files));
        }
      }
      resolve(urlMap);
    });
  });

  return blobUrls;
}
