import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

export default function App() {
  const [status, setStatus] = useState("ready");
  const [error, setError] = useState("");
  const [framesSent, setFramesSent] = useState(0);
  const [framesEchoed, setFramesEchoed] = useState(0);
  const [framesDropped, setFramesDropped] = useState(0);
  const [microphones, setMicrophones] = useState([]);
  const [microphoneId, setMicrophoneId] = useState("");
  const waveformRef = useRef(null);
  const sessionRef = useRef(0);
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const contextRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const muteRef = useRef(null);

  const refreshMicrophones = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const inputs = (await navigator.mediaDevices.enumerateDevices())
      .filter(device => device.kind === "audioinput");
    setMicrophones(inputs);
    if (microphoneId && !inputs.some(device => device.deviceId === microphoneId)) {
      setMicrophoneId("");
    }
  }, [microphoneId]);

  const release = useCallback(() => {
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    muteRef.current?.disconnect();
    contextRef.current?.close().catch(() => {});
    streamRef.current?.getTracks().forEach(track => track.stop());
    waveformRef.current?.style.setProperty("--level", "0");
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

  useEffect(() => {
    const media = navigator.mediaDevices;
    refreshMicrophones().catch(() => {});
    media?.addEventListener("devicechange", refreshMicrophones);
    return () => media?.removeEventListener("devicechange", refreshMicrophones);
  }, [refreshMicrophones]);

  const start = useCallback(async () => {
    const session = ++sessionRef.current;
    setError("");
    setFramesSent(0);
    setFramesEchoed(0);
    setFramesDropped(0);
    setStatus("connecting");
    try {
      const defaultSocketUrl = import.meta.env.DEV
        ? "ws://localhost:8080/ws/audio"
        : "wss://real-audio-streaming.onrender.com/ws/audio";
      const socketUrl = import.meta.env.VITE_WS_URL || defaultSocketUrl;
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access needs a secure browser context.");
      }
      const context = new AudioContext();
      contextRef.current = context;
      await context.resume();
      if (session !== sessionRef.current) return;
      const audio = microphoneId ? { deviceId: { exact: microphoneId } } : true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio });
      await refreshMicrophones().catch(() => {});
      if (session !== sessionRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      const socket = new WebSocket(socketUrl);
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;
      socket.onopen = async () => {
        if (session !== sessionRef.current || socketRef.current !== socket) return;
        try {
          if (context.state !== "running") await context.resume();
          if (session !== sessionRef.current || socketRef.current !== socket) return;
          const source = context.createMediaStreamSource(stream);
          const processor = context.createScriptProcessor(4096, 1, 1);
          const mute = context.createGain();
          mute.gain.value = 0;
          processor.onaudioprocess = event => {
            const samples = event.inputBuffer.getChannelData(0);
            let energy = 0;
            let count = 0;
            for (let i = 0; i < samples.length; i += 8) {
              energy += samples[i] * samples[i];
              count += 1;
            }
            waveformRef.current?.style.setProperty("--level", String(Math.min(0.5, Math.sqrt(energy / count) * 3)));
            if (socket.readyState === WebSocket.OPEN) {
              if (socket.bufferedAmount >= 262144) {
                setFramesDropped(total => total + 1);
              } else {
                try {
                  socket.send(samples);
                  setFramesSent(total => total + 1);
                } catch {
                  setFramesDropped(total => total + 1);
                }
              }
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
          setFramesEchoed(count => count + 1);
        }
      };
      socket.onerror = () => {
        if (session !== sessionRef.current || socketRef.current !== socket) return;
        release();
        setError("Audio server connection failed. Check the server URL and try again.");
        setStatus("error");
      };
      socket.onclose = event => {
        if (session === sessionRef.current && socketRef.current === socket) {
          release();
          setError(event.code === 1008
            ? "Audio server closed the session because its frame-rate limit was exceeded."
            : "Audio server closed the session unexpectedly. Check the connection and try again.");
          setStatus("error");
        }
      };
    } catch (reason) {
      if (session !== sessionRef.current) return;
      release();
      setError(reason.message || "Microphone could not be started.");
      setStatus("error");
    }
  }, [microphoneId, refreshMicrophones, release]);

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <a className="studio-mark" href="/" aria-label="Signal Room home">SR</a>
        <span>Audio loop test</span>
        <span className="header-index">NO AUDIO STORAGE</span>
      </header>
      <section className="studio-panel" aria-labelledby="studio-title">
        <div className={`signal-orb signal-${status}`} aria-hidden="true">
          <div className="signal-wave" ref={waveformRef}>
            <span /><span /><span /><span /><span /><span /><span />
          </div>
        </div>
        <p className="studio-kicker">Microphone · WebSocket</p>
        <h1 id="studio-title">Check the audio path.</h1>
        <p className="studio-copy">Send microphone frames to the configured echo server. Audio is not played back or stored.</p>
        <div className="microphone-control">
          <label htmlFor="microphone">Microphone</label>
          <select
            id="microphone"
            value={microphoneId}
            onChange={event => setMicrophoneId(event.target.value)}
            disabled={status === "connecting" || status === "live"}
          >
            <option value="">Default microphone</option>
            {microphones.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${index + 1}`}
              </option>
            ))}
          </select>
          <p className="microphone-help">Device names appear after you grant microphone access.</p>
        </div>
        <div className={`connection-status status-${status}`} role="status" aria-live="polite">
          <span className="status-dot" />
          {status === "live" ? `Live · ${framesEchoed} frames echoed` : status === "connecting" ? "Connecting to microphone and server…" : status === "error" ? "Connection needs attention" : "Ready when you are"}
        </div>
        <dl className="session-stats" aria-label="Audio session frame counts">
          <div><dt>Sent</dt><dd>{framesSent}</dd></div>
          <div><dt>Echoed</dt><dd>{framesEchoed}</dd></div>
          <div><dt>Queue drops</dt><dd>{framesDropped}</dd></div>
        </dl>
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
