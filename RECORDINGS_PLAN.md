# Joined Recording Playback — Design Plan
**Status:** Ready to implement (blocked pending CSS API access)
**Date:** 2026-03-23

---

## Problem

When a call transfers from 8x8 Contact Center (CC) to Unified Communications (UC), two separate recordings are created — one per system. They appear with no obvious link in the 8x8 UI, making it very hard to reconstruct the full customer interaction. The CIDP Journey API surfaces these journeys with `transfersCompleted > 0`, but provides no recording references.

**Goal:** Within the journey detail view, fetch both recordings from the 8x8 Cloud Storage Service (CSS) API, correlate them to the selected journey, and present them as a single continuous playback experience with a visual seam marker at the transfer point.

---

## UX Design

```
┌─ Recordings (6m 45s) ───────────────────────────────────────────────┐
│                                                                      │
│  ▶  00:00 ─────────────────────●──────────────────────────── 06:45  │
│                        ↑ transfer                                    │
│          [CC  0:00–2:15]       [UC  2:15–6:45]                      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

- Single play/pause button
- One progress bar spanning the full combined duration
- Seam marker(s) at each recording boundary, labelled with segment type (CC / UC)
- Segment labels below the bar showing time ranges
- Auto-advances from one segment to the next on `ended` event
- Graceful "No recordings found" state if CSS API returns nothing

---

## Architecture

### New: `src/cssApi.js`

Handles all Cloud Storage Service API calls.

```js
const CSS_REGIONS = {
  us: '/proxy/css-us',
  eu: '/proxy/css-eu',
};

async function cssGet(region, bearerToken, path, params) {
  // GET with Authorization: Bearer {bearerToken}
  // Throws on non-OK response
}

export function fetchRecordings(region, bearerToken, startMs, endMs)
// GET /v3/objects?filter=type==callcenterrecording,callrecording
//   &createdTime>={startMs}&createdTime<={endMs}
// Returns array of recording objects sorted by createdTime asc

export function getRecordingUrl(region, bearerToken, objectId)
// GET /v3/objects/{objectId}/download → returns signed audio URL
```

**Auth:** `Authorization: Bearer {bearerToken}`
The existing `eght_...` API key may work directly as a Bearer token. If not, a separate OAuth token is needed from the 8x8 Admin Console.

---

### Modified: `vite.config.js`

Add two new proxy entries alongside the existing CIDP proxies:

```js
'/proxy/css-us': {
  target: 'https://api.8x8.com/storage/us',
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/proxy\/css-us/, ''),
},
'/proxy/css-eu': {
  target: 'https://api.8x8.com/storage/eu',
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/proxy\/css-eu/, ''),
},
```

---

### Modified: `src/App.jsx`

#### App component (top-level)
- Add `cssToken` state: `useState(() => localStorage.getItem('cidp_css_token') || '')`
- Persist on blur: `localStorage.setItem('cidp_css_token', cssToken)`
- Add "CSS Token" password input field in the controls bar (same row as API Key)
- Pass `cssToken` down to `JourneyDetail`

#### JourneyDetail component
Add alongside the existing transitions section:

```js
const [recordings, setRecordings] = useState(null);
const [recordingsLoading, setRecordingsLoading] = useState(false);
const [recordingsError, setRecordingsError] = useState(null);

const loadRecordings = useCallback(async () => {
  setRecordingsLoading(true);
  setRecordingsError(null);
  try {
    const startMs = new Date(journey.time).getTime();
    // Use journey.endTime if available, otherwise +24h (same pattern as transitions)
    const endMs = journey.endTime
      ? new Date(journey.endTime).getTime()
      : startMs + 86400000;

    const objects = await fetchRecordings(region, cssToken, startMs, endMs);

    // Secondary filter: match against contact phone number if available
    const phone = journey.contact?.phoneNumber;
    const matched = phone
      ? objects.filter(o => JSON.stringify(o.tags || {}).includes(phone))
      : objects;

    // Resolve download URLs for each matched recording
    const segments = await Promise.all(
      matched.map(async (o) => ({
        id: o.id,
        type: o.type === 'callcenterrecording' ? 'CC' : 'UC',
        startTime: o.createdTime,  // unix ms
        duration: o.storedBytes,   // placeholder — real duration from metadata or audio
        url: await getRecordingUrl(region, cssToken, o.id),
      }))
    );

    // Sort chronologically
    segments.sort((a, b) => a.startTime - b.startTime);
    setRecordings(segments);
  } catch (e) {
    setRecordingsError(e.message);
  } finally {
    setRecordingsLoading(false);
  }
}, [journey, region, cssToken]);
```

Render in JSX (mirrors the transitions section structure):
```jsx
<div className="recordings-section">
  <div className="recordings-header">
    <h3>Recordings</h3>
    {!recordings && !recordingsLoading && cssToken && (
      <button className="btn-secondary" onClick={loadRecordings}>Load</button>
    )}
    {!cssToken && <span className="muted">Add a CSS token to load recordings</span>}
  </div>
  {recordingsLoading && <div className="loading-sm">Loading...</div>}
  {recordingsError && <div className="error-sm">{recordingsError}</div>}
  {recordings && recordings.length === 0 && (
    <div className="muted">No recordings found for this journey.</div>
  )}
  {recordings && recordings.length > 0 && (
    <RecordingPlayer segments={recordings} />
  )}
</div>
```

#### New: RecordingPlayer component

```jsx
function RecordingPlayer({ segments }) {
  // segments: [{ id, type, url, startTime, duration }]
  // duration in ms from audio metadata (loaded via onLoadedMetadata)

  const audioRef = useRef(null);
  const [durations, setDurations] = useState({}); // objectId → seconds
  const [currentSegIdx, setCurrentSegIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds into current segment

  // Total duration = sum of all known durations
  // Offset of segment N = sum of durations[0..N-1]
  // Progress position = offset[currentSegIdx] + elapsed
  // Seam positions = [offset[1], offset[2], ...]

  // On segment ended → advance index, auto-play next
  // Interval tick → update elapsed from audioRef.current.currentTime
  // Play/pause → audioRef.current.play() / .pause()
}
```

---

### Modified: `src/App.css`

New styles needed:

```css
/* Recordings section (mirrors transitions-section) */
.recordings-section { ... }
.recordings-header { display: flex; align-items: center; gap: 8px; }

/* Player container */
.recording-player { padding: 12px 0; }

/* Controls row */
.player-controls { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.player-play-btn { ... } /* circular play/pause button */
.player-time { font-size: 12px; color: #9ca3af; font-variant-numeric: tabular-nums; }

/* Progress bar */
.player-bar {
  position: relative;
  height: 6px;
  background: #1f2937;
  border-radius: 3px;
  cursor: pointer;
}
.player-progress {
  height: 100%;
  background: #6366f1;
  border-radius: 3px;
  pointer-events: none;
}
.player-seam {
  position: absolute;
  top: -4px;
  width: 2px;
  height: 14px;
  background: #f59e0b;
  border-radius: 1px;
}

/* Segment labels */
.player-segments { display: flex; margin-top: 8px; }
.player-segment-label {
  font-size: 11px;
  color: #9ca3af;
  padding: 2px 6px;
  border-radius: 3px;
  background: #1f2937;
  margin-right: 4px;
}
.player-segment-label.cc { border-left: 2px solid #6366f1; }
.player-segment-label.uc { border-left: 2px solid #10b981; }
```

---

## Files Changed

| File | Change |
|------|--------|
| `vite.config.js` | Add CSS API proxy entries |
| `src/cssApi.js` | **New file** — CSS API client |
| `src/App.jsx` | Add cssToken state/input; extend JourneyDetail; add RecordingPlayer |
| `src/App.css` | Add player styles |

---

## Risks & Unknowns

| Risk | Mitigation |
|------|-----------|
| `eght_...` key not accepted as CSS Bearer token | Add clear error message; document where to get OAuth token from 8x8 Admin Console |
| CSS filter syntax differs from documented | Try with type filter only, fallback to unfiltered then client-side filter by time window |
| UC recording type is not `callrecording` | Log all returned types; label by actual type value not assumed constant |
| No `endTime` on journey object | Use `journey.time + 24h` (same pattern already used for transitions) |
| Recording URL requires re-auth per request | Request URL just before playback starts, not at load time |
| Audio duration not in CSS metadata | Use HTML5 audio `onLoadedMetadata` event to get real duration, show spinner until known |

---

## Verification Checklist

1. Search journeys, select one with `transfersCompleted > 0`
2. Verify "Add a CSS token to load recordings" hint shows when no token set
3. Enter CSS token → "Load" button appears in Recordings section
4. Click Load → check DevTools Network for CSS API request with correct time range
5. Verify two segments appear (CC and UC) with correct labels
6. Press Play → audio plays, progress bar advances in real time
7. Confirm auto-advance to second segment at seam; seam marker visible
8. Test with a journey with no transfer → single recording, no seam marker
9. Test with no recordings returned → "No recordings found" message
10. Verify CSS token persists across page reload via localStorage
