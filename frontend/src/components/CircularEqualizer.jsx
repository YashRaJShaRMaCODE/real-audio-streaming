import { useEffect, useRef } from "react";
import { useAudioAnalyzer } from "../hooks/useAudioAnalyzer";

export default function CircularEqualizer() {
  const canvasRef = useRef(null);
  const { analyserRef, dataArrayRef } = useAudioAnalyzer();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let frameId;

    function draw() {
      frameId = requestAnimationFrame(draw);

      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArrayRef.current);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const radius = 90;
      const bars = dataArrayRef.current.length;

      for (let i = 0; i < bars; i++) {
        const value = dataArrayRef.current[i];
        const angle = (i / bars) * Math.PI * 2;
        const barHeight = value * 0.6;

        const x1 = cx + radius * Math.cos(angle);
        const y1 = cy + radius * Math.sin(angle);
        const x2 = cx + (radius + barHeight) * Math.cos(angle);
        const y2 = cy + (radius + barHeight) * Math.sin(angle);

        ctx.strokeStyle = `hsl(${i * 4}, 100%, 50%)`;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    draw();
    return () => cancelAnimationFrame(frameId);
  }, [analyserRef, dataArrayRef]);

  return <canvas ref={canvasRef} width={400} height={400} />;
}
