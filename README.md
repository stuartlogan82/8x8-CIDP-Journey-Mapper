# 8x8 Customer Journey Viewer

> **Disclaimer:** This project is provided **as-is** for demonstration and proof-of-concept purposes only. It is not designed, tested, or supported for production use. It is not built to scale and comes with no guarantees around performance, security hardening, or reliability. Use it as a starting point or reference implementation — further development and review will be required before deploying in any production environment.

A developer tool for visualising end-to-end customer journeys from the [8x8 CIDP Journey API](https://developer.8x8.com/). Select a journey to see every transition — STARTED → WAITING → TALKING → FINISHED — on an interactive horizontal timeline, and play back the associated call recordings inline.

---

## Features

- **Interactive timeline** — horizontally scrollable, time-proportional node layout; hover any node to expand full details (duration, agent, queue, media type)
- **Joined recording playback** — CC and UC recordings stitched into a single player with a visual seam at the transfer point
- **Live playhead** — recording track overlaid on the timeline shows exactly which transition is active during playback
- **Auto OAuth** — enter your Client ID and Secret once; the app fetches and caches the bearer token automatically (no Postman needed)
- **Demo mode** — works out of the box with sample data, no credentials required
- **Dark / light theme**

---

## Try it without credentials

Click **Load demo** in the top-right corner. Six sample journeys load instantly, including a transfer journey with a joined CC + UC recording player.

---

## Getting started

### Prerequisites

- Node.js 18+
- An 8x8 XCaaS account with API access

### Install

```bash
git clone https://github.com/YOUR_ORG/cidp-journey-viewer.git
cd cidp-journey-viewer
npm install
```

### Configure credentials

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env
```

```env
VITE_8X8_API_KEY=eght_...          # Journey API key
VITE_8X8_CLIENT_ID=...             # OAuth Client ID  (for recording playback)
VITE_8X8_CLIENT_SECRET=...         # OAuth Client Secret
```

> These values pre-populate the credential fields on first load. They are never committed — `.env` is gitignored.

### Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Where to find your credentials

| Credential | Location in 8x8 Admin Console |
|---|---|
| **API Key** | **Developer** → **API Keys** → Create key with `CIDP Journey` scope |
| **Client ID** | **Developer** → **OAuth Clients** → Create client |
| **Client Secret** | Shown once at OAuth client creation — store it securely |

OAuth tokens are fetched automatically using the `client_credentials` grant and cached for 30 minutes. You will not be prompted for a bearer token.

---

## Security

- `.env` is listed in `.gitignore` and will never be committed
- Credentials are stored in `localStorage` for convenience — clear browser storage to remove them from a shared machine
- All API calls are proxied through the Vite dev server (`/proxy/*`) to avoid CORS; no credentials are exposed in network requests to third-party origins
- The Postman collection in this repo contains no real credentials

---

## API reference

This tool uses two 8x8 APIs:

| API | Docs |
|---|---|
| CIDP Journey API | [developer.8x8.com/analytics](https://developer.8x8.com/analytics) |
| Cloud Storage Service (CSS) | [developer.8x8.com/storage](https://developer.8x8.com/storage) |
| OAuth | [developer.8x8.com/analytics/docs/oauth-authentication-for-8x8-xcaas-apis](https://developer.8x8.com/analytics/docs/oauth-authentication-for-8x8-xcaas-apis) |

---

## Stack

- [React 19](https://react.dev) + [Vite](https://vite.dev)
- [Tailwind CSS v4](https://tailwindcss.com)
- [Framer Motion](https://motion.dev)
- [Lucide icons](https://lucide.dev)
