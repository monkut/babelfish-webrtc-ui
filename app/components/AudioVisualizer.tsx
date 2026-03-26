import { useAudioAnalyzer } from "../lib/audio/useAudioAnalyzer";

interface AudioVisualizerProps {
  stream: MediaStream | null;
  isActive: boolean;
  className?: string;
}

export function AudioVisualizer({ stream, isActive, className = "" }: AudioVisualizerProps) {
  const canvasRef = useAudioAnalyzer(stream, isActive);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-48 rounded-lg ${className}`}
      style={{ imageRendering: "pixelated" }}
    />
  );
}
