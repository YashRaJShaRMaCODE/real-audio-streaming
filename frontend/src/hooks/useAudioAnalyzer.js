import { useEffect, useRef } from "react";

export function useAudioAnalyzer(stream) {
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);

  useEffect(() => {
    if (!stream) return;
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;
    dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
    return () => {
      source.disconnect();
      analyser.disconnect();
      analyserRef.current = null;
      dataArrayRef.current = null;
      audioContext.close().catch(() => {});
    };
  }, [stream]);

  return { analyserRef, dataArrayRef };
}
