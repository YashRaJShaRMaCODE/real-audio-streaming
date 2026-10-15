import { useEffect } from "react";

export default function App() {
  useEffect(() => {
    const ws = new WebSocket(import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws/audio");
    ws.binaryType = "arraybuffer";

    ws.onopen = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);

      source.connect(processor);
      processor.connect(ctx.destination);

      processor.onaudioprocess = e => {
        ws.send(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
    };
  }, []);

  return <h2>🎙️ Mic Streaming Active</h2>;
}
