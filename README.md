# Babelfish WebRTC UI

A WebRTC-based voice interface for the Babelfish backend. This SPA connects to the babelfish-backend WebRTC API, enabling real-time speech-to-text and text-to-speech communication.

## Features

- Single-page application with a scenario picker + connect/disconnect button
- Pick which scenario to converse with before connecting (`GET /scenarios`)
- JWT auth: exchanges client credentials at `POST /token`, sends the bearer token on `POST /offer`
- WebRTC audio streaming to babelfish-backend; receives TTS audio responses
- Real-time audio visualization while connected

## Prerequisites

- Node.js 18.0 or higher
- pnpm package manager
- [babelfish-backend](../babelfish-backend) running on `localhost:8080`

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Install Playwright (for browser tests)

```bash
pnpm pre_install
```

### 3. Start the Backend

Ensure the babelfish-backend is running:

```bash
cd ~/PycharmProjects/babelfish-backend
uv run python -m babelfish.webrtc
```

The backend should be listening on `http://localhost:8080`.

### 4. Start the Development Server

```bash
pnpm dev
```

The app will be available at `http://localhost:5173`.

## Usage

1. Open `http://localhost:5173` in your browser
2. Pick a **scenario** from the dropdown (loaded from the backend's `GET /scenarios`)
3. Click the green **Connect** button (disabled until a scenario is selected)
4. Allow microphone access when prompted
5. The button turns red and audio visualization appears
6. Speak into your microphone - the backend will transcribe and respond
7. Click the red **Disconnect** button to end the session

> **Microphone requires a secure context.** Browsers expose the mic only over
> HTTPS or `localhost`. On a plain-HTTP LAN origin (e.g. `http://192.168.1.25:8080`)
> Connect fails with a "secure context" message — use the HTTPS origin instead
> (see [Deployment](#deployment-taichi-on-prem)).

## Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server with HMR |
| `pnpm build` | Build for production |
| `pnpm start` | Start the production server |
| `pnpm test` | Run all tests |
| `pnpm test:cov` | Run tests with coverage report |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm lint` | Run oxlint code linting |
| `pnpm lint:strict` | Run lint treating warnings as errors |
| `pnpm format` | Format code with Biome |
| `pnpm format:check` | Check code formatting |
| `pnpm check` | Run typecheck, tests, and format check |

### Running Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:cov

# Run specific test type
pnpm vitest --project=unit     # Unit tests only
pnpm vitest --project=browser  # Browser tests only

# Watch mode
pnpm vitest
```

### Test File Naming

- `tests/*.unit.test.{ts,tsx}` - Unit tests (Node.js environment)
- `tests/*.browser.test.{ts,tsx}` - Browser tests (Playwright/Chromium)

## Project Structure

```
babelfish-webrtc-ui/
├── app/
│   ├── components/           # React components
│   │   ├── AudioVisualizer.tsx
│   │   └── Babelfish.tsx
│   ├── lib/
│   │   ├── audio/           # Audio utilities
│   │   │   └── useAudioAnalyzer.ts
│   │   ├── webrtc/          # WebRTC connection management
│   │   │   └── useWebRTC.ts
│   │   └── api/             # API utilities
│   ├── routes/              # Route components
│   │   └── home.tsx
│   ├── app.css              # Global styles
│   ├── root.tsx             # Root component
│   └── routes.ts            # Route configuration
├── tests/                   # Test files
├── public/                  # Static assets
└── docs/                    # Documentation
```

## Technology Stack

### Frameworks & Libraries
- **React 19.2** - UI library
- **React Router 7.9** - Routing
- **TypeScript 5.9** - Type-safe development
- **Vite 6.3** - Build tool
- **Tailwind CSS 4.1** - CSS framework

### Testing
- **Vitest 3.2** - Test runner
- **@vitest/browser** - Browser testing
- **Playwright 1.56** - Browser automation

### Development Tools
- **Biome** - Code formatter
- **Oxlint** - Code linter
- **pnpm** - Package manager

## Configuration

All config is build-time `VITE_*` env (Vite inlines it into the bundle). Copy
`.env.example` to `.env` and set values for the target. See `.env.example` for
the full list.

| Var | Purpose | Default |
|-----|---------|---------|
| `VITE_SIGNALING_URL` | Full `/offer` URL. **Leave unset for same-origin deploys** (Caddy serves the SPA and `/api` on one host); the app then derives `/api/offer` from `window.location.origin`. Set it only for dev, where the SPA (`:5173`) and backend (`:8080`) are different origins. | same-origin `/api/offer`; dev fallback `http://localhost:8080/offer` |
| `VITE_CLIENT_ID` / `VITE_CLIENT_SECRET` | `BabelfishClient` credentials for the `POST /token` exchange. Provisioned with the backend's `create_client` command. Baked into the bundle — acceptable for an internal LAN tool. | — (token fails if unset) |
| `VITE_BASE_URL` | Base URL for the OpenAPI-generated client (`custom-fetch.ts`). | `http://localhost:8080` |

`/token` and `/scenarios` are derived from `VITE_SIGNALING_URL` (strip the trailing `/offer`), so one variable drives every endpoint.

```bash
# Dev (SPA on :5173, backend on :8080):
VITE_SIGNALING_URL=http://localhost:8080/offer
VITE_CLIENT_ID=dev-client
VITE_CLIENT_SECRET=...

# TAICHI on-prem (same-origin — VITE_SIGNALING_URL omitted on purpose):
VITE_CLIENT_ID=babelfish-spa
VITE_CLIENT_SECRET=...
```

## Deployment (TAICHI on-prem)

The SPA is served by the backend's Caddy from `spa-dist/`. Caddy exposes two
listeners on the same origin model: `:8080` HTTP (picker works, mic does not)
and `:443` HTTPS via an internal CA (mic works). Build on the dev box and rsync:

```bash
cd ~/PycharmProjects/babelfish-webrtc-ui
# .env with VITE_CLIENT_ID/SECRET only (same-origin: no VITE_SIGNALING_URL)
pnpm build
# Source is build/client/ (React Router 7 SPA output), NOT build/.
rsync -a --delete build/client/ shane.cousins@192.168.1.25:~/babelfish/backend/spa-dist/
ssh shane.cousins@192.168.1.25 'cd ~/babelfish/backend && docker compose restart caddy'
pnpm smoke:taichi
```

**To use the microphone, browse `https://192.168.1.25`** and trust Caddy's
internal root CA once per device (a page click-through is not enough — the
SPA's `fetch` calls to the HTTPS API would otherwise fail the TLS handshake):

```bash
ssh shane.cousins@192.168.1.25 'docker exec ford-caddy cat /data/caddy/pki/authorities/local/root.crt' > caddy-root.crt
# Linux (Chrome/Chromium NSS store):
certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n "Caddy TAICHI" -i caddy-root.crt
# macOS: Keychain → trust "Always". Windows: import to Trusted Root CAs.
```

## Troubleshooting

### Microphone Access Denied
- Ensure your browser has permission to access the microphone
- Check browser settings for site permissions

### Connection Failed
- Verify babelfish-backend is running on port 8080
- Check browser console for detailed error messages
- Ensure no firewall is blocking the connection

### Port Conflicts
```bash
# Start dev server on different port
pnpm dev -- --port 3000
```

### Dependency Issues
```bash
# Clean reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## License

MIT
