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
  eu: '/proxy/css-eu',
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
  const data = await cssGet(region, bearerToken, '/v3/objects', {
    filter: 'type==callcenterrecording,callrecording',
    'createdTime>=': startMs,
    'createdTime<=': endMs,
    limit: 50,
  });
  const items = data.objects || data.items || data.data || [];
  return items.sort((a, b) => (a.createdTime ?? 0) - (b.createdTime ?? 0));
}

export async function getRecordingUrl(region, bearerToken, objectId) {
  const data = await cssGet(region, bearerToken, `/v3/objects/${objectId}/download`);
  return data.url || data.downloadUrl || data.signedUrl || '';
}
