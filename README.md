# Real-Time Audio Streaming App

A full-stack real-time audio streaming application built using **React (Vite)** and **Spring Boot WebSockets**.

## Features
- Real-time microphone audio capture
- WebSocket-based audio streaming
- Binary audio transmission
- Low-latency architecture
- Full-stack setup (Frontend + Backend)

The current backend echoes binary frames for a local prototype. It does not record, transcode, or persist audio. Configure `AUDIO_ALLOWED_ORIGINS` to the exact frontend origins before deployment; the default only permits the local Vite origin.

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
