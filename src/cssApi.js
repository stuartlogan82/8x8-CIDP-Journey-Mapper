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
