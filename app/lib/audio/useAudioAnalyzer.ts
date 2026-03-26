import { useEffect, useRef, useCallback } from "react";

interface AudioAnalyzerRefs {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  analyzerRef: React.RefObject<AnalyserNode | null>;
  animationFrameRef: React.MutableRefObject<number>;
}

function drawVisualization(refs: AudioAnalyzerRefs): void {
  const { canvasRef, analyzerRef, animationFrameRef } = refs;
  const canvas = canvasRef.current;
  const analyzer = analyzerRef.current;
  if (!canvas || !analyzer) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const bufferLength = analyzer.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyzer.getByteFrequencyData(dataArray);

  const { width, height } = canvas;
  ctx.fillStyle = "rgb(17, 24, 39)";
  ctx.fillRect(0, 0, width, height);

  const barWidth = (width / bufferLength) * 2.5;
  let x = 0;
  for (let i = 0; i < bufferLength; i++) {
    const barHeight = (dataArray[i] / 255) * height;
    ctx.fillStyle = `hsl(${160 + (dataArray[i] / 255) * 40}, 80%, 50%)`;
    ctx.fillRect(x, height - barHeight, barWidth, barHeight);
    x += barWidth + 1;
  }
  animationFrameRef.current = requestAnimationFrame(() => drawVisualization(refs));
}

function useCanvasResize(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
      }
    });
    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [canvasRef]);
}

export function useAudioAnalyzer(stream: MediaStream | null, isActive: boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const analyzerRef = useRef<AnalyserNode | null>(null);

  const startVisualization = useCallback(
    (audioContext: AudioContext) => {
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 256;
      analyzerRef.current = analyzer;
      audioContext.createMediaStreamSource(stream!).connect(analyzer);
      drawVisualization({ canvasRef, analyzerRef, animationFrameRef });
    },
    [stream],
  );

  useEffect(() => {
    if (!stream || !isActive) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }
    const audioContext = new AudioContext();
    startVisualization(audioContext);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      audioContext.close();
    };
  }, [stream, isActive, startVisualization]);

  useCanvasResize(canvasRef);
  return canvasRef;
}
