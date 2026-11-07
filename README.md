# Real-Time Audio Streaming App

A full-stack real-time audio streaming application built using **React (Vite)** and **Spring Boot WebSockets**.

**Live frontend:** [real-audio-streaming.vercel.app](https://real-audio-streaming.vercel.app/) · **WebSocket endpoint:** `wss://real-audio-streaming.onrender.com/ws/audio`

## Features
- Real-time microphone audio capture
- WebSocket-based audio streaming
- Binary audio transmission
- Low-latency architecture
- Full-stack setup (Frontend + Backend)

The current backend echoes binary frames for a prototype. It does not record, transcode, or persist audio. It limits frames to 32 KiB and 30 frames per second per connection. The Render blueprint sets `AUDIO_ALLOWED_ORIGINS` to the production frontend and uses `/health` for service checks; local development defaults to `http://localhost:5173`. The origin allowlist is a browser policy, not client authentication.

## Tech Stack
- Frontend: React, Vite, Web Audio API
- Backend: Spring Boot, WebSockets
- Java 17+
- Maven

## How to Run

### Backend
```bash
cd backend
mvnw spring-boot:run
