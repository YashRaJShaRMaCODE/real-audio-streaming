import { useCallback, useEffect, useRef, useState } from "react";
import { audioCloseMessage, microphoneErrorMessage } from "./audio-diagnostics.js";
import "./App.css";

const CONNECTION_TIMEOUT_MS = 75_000;

export default function App() {
  const [status, setStatus] = useState("ready");
  const [error, setError] = useState("");
  const [framesSent, setFramesSent] = useState(0);
  const [framesEchoed, setFramesEchoed] = useState(0);
  const [framesDropped, setFramesDropped] = useState(0);
  const [inputSignal, setInputSignal] = useState("waiting");
  const [microphones, setMicrophones] = useState([]);
  const [microphoneId, setMicrophoneId] = useState("");
  const [networkOnline, setNetworkOnline] = useState(true);
  const waveformRef = useRef(null);
  const sessionRef = useRef(0);
  const inputSignalRef = useRef("waiting");
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const contextRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const muteRef = useRef(null);
  const connectionTimeoutRef = useRef(null);

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
    if (connectionTimeoutRef.current !== null) window.clearTimeout(connectionTimeoutRef.current);
    connectionTimeoutRef.current = null;
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    muteRef.current?.disconnect();
    contextRef.current?.close().catch(() => {});
    streamRef.current?.getTracks().forEach(track => {
      track.onended = null;
      track.stop();
    });
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
    inputSignalRef.current = "waiting";
    setInputSignal("waiting");
    setStatus("ready");
  }, [release]);

  useEffect(() => {
    const updateConnection = () => {
      const online = navigator.onLine;
      setNetworkOnline(online);
      if (!online && (status === "connecting" || status === "live")) {
        sessionRef.current += 1;
        release();
        inputSignalRef.current = "waiting";
        setInputSignal("waiting");
        setError("Internet connection lost. Audio stopped; reconnect, then press Try again.");
        setStatus("error");
      } else if (online && error.startsWith("Internet connection lost")) {
        setError("Connection restored. Press Try again to restart the audio check.");
      }
    };
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, [error, release, status]);

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
    inputSignalRef.current = "waiting";
    setInputSignal("waiting");
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio }).catch(reason => {
        throw new Error(microphoneErrorMessage(reason));
      });
      await refreshMicrophones().catch(() => {});
      if (session !== sessionRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.onended = () => {
          if (session !== sessionRef.current || streamRef.current !== stream) return;
          release();
          inputSignalRef.current = "waiting";
          setInputSignal("waiting");
          setError("Microphone stopped unexpectedly. Check the device or choose another input, then try again.");
          setStatus("error");
        };
      }
      const socket = new WebSocket(socketUrl);
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;
      connectionTimeoutRef.current = window.setTimeout(() => {
        if (session !== sessionRef.current || socketRef.current !== socket || socket.readyState !== WebSocket.CONNECTING) return;
        release();
        setError("Audio server did not respond within 75 seconds. The free server can take about a minute to wake; check the connection and try again.");
        setStatus("error");
      }, CONNECTION_TIMEOUT_MS);
      socket.onopen = async () => {
        if (session !== sessionRef.current || socketRef.current !== socket) return;
        if (connectionTimeoutRef.current !== null) window.clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
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
            const rms = Math.sqrt(energy / count);
            waveformRef.current?.style.setProperty("--level", String(Math.min(0.5, rms * 3)));
            const previousSignal = inputSignalRef.current;
            const signal = previousSignal === "quiet" && rms < 0.012
              ? "quiet"
              : previousSignal === "low" && rms >= 0.005 && rms < 0.045
                ? "low"
                : previousSignal === "clear" && rms >= 0.025
                  ? "clear"
                  : rms < 0.008 ? "quiet" : rms < 0.035 ? "low" : "clear";
            if (signal !== inputSignalRef.current) {
              inputSignalRef.current = signal;
              setInputSignal(signal);
            }
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
          setError(audioCloseMessage(event.code));
          setStatus("error");
        }
      };
    } catch (reason) {
      if (session !== sessionRef.current) return;
      release();
      setError(reason instanceof Error ? reason.message : "Audio could not be started. Check the microphone and connection.");
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
        <p className={`input-signal input-signal-${inputSignal}`} role="status" aria-live="polite">
          <span aria-hidden="true" />
          {inputSignal === "waiting" ? "Waiting for microphone signal" : inputSignal === "quiet" ? "No microphone signal detected · check mute and input level" : inputSignal === "low" ? "Low microphone signal · speak closer or raise input level" : "Microphone signal detected"}
        </p>
        {!networkOnline && <p className="network-help" role="status">Offline · audio has been stopped. Reconnect and press Try again.</p>}
        <dl className="session-stats" aria-label="Audio session frame counts">
          <div><dt>Sent</dt><dd>{framesSent}</dd></div>
          <div><dt>Echoed</dt><dd>{framesEchoed}</dd></div>
          <div><dt>Queue drops</dt><dd>{framesDropped}</dd></div>
        </dl>
        {error && <p className="error-message" role="alert">{error}</p>}
        <div className="studio-actions">
          <button className="start-button" onClick={start} disabled={!networkOnline || status === "connecting" || status === "live"}>
            {!networkOnline ? "Offline" : status === "connecting" ? "Connecting…" : status === "error" ? "Try again" : "Start audio"}
          </button>
          <button className="stop-button" onClick={stop} disabled={status !== "connecting" && status !== "live"}>Stop</button>
        </div>
        <p className="privacy-note">Your browser will ask for microphone access. Audio is sent only after you press Start; Stop ends the stream and releases the microphone. Reconnection is always manual.</p>
      </section>
      <footer className="studio-footer"><span>Signal Room</span><span>Audio is not stored by this prototype.</span></footer>
    </main>
  );
}
