import { useRef, useEffect } from "react";
import { useWebRTC, type ConnectionState } from "../lib/webrtc/useWebRTC";
import { AudioVisualizer } from "./AudioVisualizer";

function ConnectionButton({
  connectionState,
  onClick,
}: {
  connectionState: ConnectionState;
  onClick: () => void;
}) {
  const isConnected = connectionState === "connected";
  const isConnecting = connectionState === "connecting";
  const isFailed = connectionState === "failed";

  const buttonColor = isConnected
    ? "bg-red-600 hover:bg-red-700"
    : isFailed
      ? "bg-orange-600 hover:bg-orange-700"
      : "bg-green-600 hover:bg-green-700";

  const buttonText = isConnecting
    ? "Connecting..."
    : isConnected
      ? "Disconnect"
      : isFailed
        ? "Retry"
        : "Connect";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isConnecting}
      className={`w-40 h-40 rounded-full font-bold text-xl text-white transition-all duration-300 ease-in-out shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed ${buttonColor}`}
    >
      {buttonText}
    </button>
  );
}

function StatusIndicator({ connectionState }: { connectionState: ConnectionState }) {
  const statusConfig = {
    connected: { color: "bg-green-500 animate-pulse", text: "Connected" },
    connecting: { color: "bg-yellow-500 animate-pulse", text: "Connecting..." },
    failed: { color: "bg-red-500", text: "Connection failed" },
    disconnected: { color: "bg-gray-500", text: "Disconnected" },
  };

  const config = statusConfig[connectionState];

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${config.color}`} />
      <span className="text-gray-400 text-sm">{config.text}</span>
    </div>
  );
}

export function Babelfish() {
  const { connectionState, error, connect, disconnect, localStream, remoteStream } = useWebRTC();
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (remoteStream && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  const handleClick = () => {
    if (connectionState === "connected" || connectionState === "connecting") {
      disconnect();
    } else {
      connect();
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-950">
      <div className="w-full max-w-md flex flex-col items-center gap-8">
        <h1 className="text-3xl font-bold text-white">Babelfish</h1>
        <ConnectionButton connectionState={connectionState} onClick={handleClick} />
        <StatusIndicator connectionState={connectionState} />
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg px-4 py-3 text-red-200 text-sm">
            {error}
          </div>
        )}
        <div className="w-full flex flex-col gap-4">
          <div>
            <p className="text-gray-500 text-xs mb-1">Microphone</p>
            <AudioVisualizer stream={localStream} isActive={connectionState === "connected"} />
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Response</p>
            <AudioVisualizer stream={remoteStream} isActive={connectionState === "connected"} />
          </div>
        </div>
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      </div>
    </main>
  );
}
