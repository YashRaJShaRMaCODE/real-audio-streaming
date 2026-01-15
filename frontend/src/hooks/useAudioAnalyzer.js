import { useEffect, useRef } from "react";

export function useAudioAnalyzer() {
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);

  useEffect(() => {
    async function init() {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      source.connect(analyser);

      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;
    }

    init();
  }, []);

  return { analyserRef, dataArrayRef };
}
