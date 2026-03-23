const REGIONS = {
  us: '/proxy/us',
  eu: '/proxy/eu',
};

async function post(region, apiKey, path, body) {
  const res = await fetch(`${REGIONS[region]}${path}`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ errors: [{ message: res.statusText }] }));
    const msg = err.errors?.[0]?.message || res.statusText;
    throw new Error(`${res.status}: ${msg}`);
  }

  return res.json();
}

export function searchJourneys(region, apiKey, params) {
  return post(region, apiKey, '/v1/journeys/search', params);
}

export function searchTransitions(region, apiKey, params) {
  return post(region, apiKey, '/v1/transitions/search', params);
}
