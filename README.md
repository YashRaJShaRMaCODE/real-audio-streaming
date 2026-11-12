# Signal Room

Signal Room checks the path from a browser microphone to a WebSocket echo server. Choose an input, start a session, and watch the live signal and echoed-frame count.

**Live app:** [real-audio-streaming.vercel.app](https://real-audio-streaming.vercel.app/)

**Backend health:** [real-audio-streaming.onrender.com/health](https://real-audio-streaming.onrender.com/health)

**WebSocket:** `wss://real-audio-streaming.onrender.com/ws/audio`

## What it does

- Requests microphone access only after you select **Start audio**.
- Lets you choose an input device after permission is granted.
- Streams mono audio frames over a binary WebSocket and counts the frames echoed back.
- Shows sent, echoed and locally dropped frames so a slow connection or busy browser audio queue is easier to diagnose.
- Stops the stream and releases the microphone when you select **Stop** or leave the page.
- Honors reduced-motion preferences and shows connection state to assistive technology.

## Audio and privacy

The backend echoes audio frames for connectivity testing. It does not play the audio back, record it, transcode it, or persist it. Audio is transmitted to the configured server while a session is active; only use non-sensitive test audio. The browser asks for microphone permission before capture starts.

The server accepts frames up to 32 KiB and closes a connection that exceeds 30 frames per second. The origin allowlist controls which browser origins may connect; it is not user authentication or access control. Do not expose this demo as a secure audio service.

## Run locally

Requirements: Java 17+ and Node.js with npm.

Start the backend in one terminal:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

Start the frontend in another terminal:

```powershell
cd frontend
npm ci
npm run dev
```

The frontend defaults to `ws://localhost:8080/ws/audio` in development. The backend allows `http://localhost:5173` by default.

## Checks

```powershell
cd backend
.\mvnw.cmd test

cd ..\frontend
npm run lint
npm run build
```

## Deployment

- **Frontend:** Vercel, with `frontend` as the root directory. `VITE_WS_URL` can override the production WebSocket endpoint.
- **Backend:** Render Blueprint from `render.yaml`. Set `AUDIO_ALLOWED_ORIGINS` to the exact frontend origin; `/health` is the health check.

The production frontend uses HTTPS and connects over WSS. Its Content Security Policy only permits same-origin styles and the configured WebSocket host.
