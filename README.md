# Babelfish WebRTC UI

A WebRTC-based voice interface for the Babelfish backend. This SPA connects to the babelfish-backend WebRTC API, enabling real-time speech-to-text and text-to-speech communication.

## Features

- Single-page application with connect/disconnect button
- WebRTC audio streaming to babelfish-backend
- Real-time audio visualization while connected
- Receives TTS audio responses from the backend

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
2. Click the green **Connect** button
3. Allow microphone access when prompted
4. The button turns red and audio visualization appears
5. Speak into your microphone - the backend will transcribe and respond
6. Click the red **Disconnect** button to end the session

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

### WebRTC Server URL

By default, the app connects to `http://localhost:8080/offer`. To change this, modify the `DEFAULT_SIGNALING_URL` in `app/lib/webrtc/useWebRTC.ts` or pass a custom URL to the hook:

```typescript
const { connect, disconnect } = useWebRTC({
  signalingUrl: "http://your-server:8080/offer"
});
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
