import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

export default function App() {
  const [status, setStatus] = useState("ready");
  const [error, setError] = useState("");
  const [frames, setFrames] = useState(0);
  const sessionRef = useRef(0);
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const contextRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const muteRef = useRef(null);

  const release = useCallback(() => {
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    muteRef.current?.disconnect();
    contextRef.current?.close().catch(() => {});
    streamRef.current?.getTracks().forEach(track => track.stop());
    processorRef.current = null;
    sourceRef.current = null;
    muteRef.current = null;
    contextRef.current = null;
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    release();
    setStatus("ready");
  }, [release]);

  useEffect(() => () => {
    sessionRef.current += 1;
    release();
  }, [release]);

  const start = useCallback(async () => {
    const session = ++sessionRef.current;
    setError("");
    setFrames(0);
    setStatus("connecting");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access needs a secure browser context.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (session !== sessionRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      const socket = new WebSocket(import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws/audio");
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;
      socket.onopen = async () => {
        if (session !== sessionRef.current || socketRef.current !== socket) return;
        try {
          const context = new AudioContext();
          contextRef.current = context;
          await context.resume();
          if (session !== sessionRef.current || socketRef.current !== socket) return;
          const source = context.createMediaStreamSource(stream);
          const processor = context.createScriptProcessor(4096, 1, 1);
          const mute = context.createGain();
          mute.gain.value = 0;
          processor.onaudioprocess = event => {
            if (socket.readyState === WebSocket.OPEN && socket.bufferedAmount < 262144) {
              socket.send(event.inputBuffer.getChannelData(0));
            }
          };
          source.connect(processor);
          processor.connect(mute);
          mute.connect(context.destination);
          sourceRef.current = source;
          processorRef.current = processor;
          muteRef.current = mute;
          setStatus("live");
        } catch {
          if (socketRef.current !== socket) return;
          release();
          setError("Audio could not start. Check microphone access and try again.");
          setStatus("error");
        }
      };
      socket.onmessage = () => {
        if (session === sessionRef.current && socketRef.current === socket) {
          setFrames(count => count + 1);
        }
      };
      socket.onerror = () => {
        if (session !== sessionRef.current || socketRef.current !== socket) return;
        release();
        setError("Audio server connection failed. Check the server URL and try again.");
        setStatus("error");
      };
      socket.onclose = () => {
        if (session === sessionRef.current && socketRef.current === socket) {
          release();
          setStatus("ready");
        }
      };
    } catch (reason) {
      if (session !== sessionRef.current) return;
      release();
      setError(reason.message || "Microphone could not be started.");
      setStatus("error");
    }
  }, [release]);

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <a className="studio-mark" href="/" aria-label="Signal Room home">SR</a>
        <span>Audio loop test</span>
        <span className="header-index">LOCAL SESSION</span>
      </header>
      <section className="studio-panel" aria-labelledby="studio-title">
        <div className={`signal-orb signal-${status}`} aria-hidden="true"><span /></div>
        <p className="studio-kicker">Microphone · WebSocket</p>
        <h1 id="studio-title">Check the audio path.</h1>
        <p className="studio-copy">Send microphone frames to the configured echo server. Audio is not played back or stored.</p>
        <div className={`connection-status status-${status}`} role="status" aria-live="polite">
          <span className="status-dot" />
          {status === "live" ? `Live · ${frames} frames echoed` : status === "connecting" ? "Connecting to microphone and server…" : status === "error" ? "Connection needs attention" : "Ready when you are"}
        </div>
        {error && <p className="error-message" role="alert">{error}</p>}
        <div className="studio-actions">
          <button className="start-button" onClick={start} disabled={status === "connecting" || status === "live"}>
            {status === "connecting" ? "Connecting…" : "Start audio"}
          </button>
          <button className="stop-button" onClick={stop} disabled={status !== "connecting" && status !== "live"}>Stop</button>
        </div>
        <p className="privacy-note">Your browser will ask for microphone access. Stop ends the stream and releases the microphone.</p>
      </section>
      <footer className="studio-footer"><span>Signal Room</span><span>Audio is not stored by this prototype.</span></footer>
    </main>
  );
}
