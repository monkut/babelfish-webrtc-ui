import { useRef, useEffect, useState } from "react";
import { useWebRTC, type ConnectionState } from "../lib/webrtc/useWebRTC";
import { fetchScenarios, type ScenarioSummary } from "../lib/api/scenarios";
import { AudioVisualizer } from "./AudioVisualizer";

function ConnectionButton({
  connectionState,
  onClick,
  disabled,
}: {
  connectionState: ConnectionState;
  onClick: () => void;
  disabled?: boolean;
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
      disabled={isConnecting || disabled}
      className={`w-40 h-40 rounded-full font-bold text-xl text-white transition-all duration-300 ease-in-out shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed ${buttonColor}`}
    >
      {buttonText}
    </button>
  );
}

function ScenarioPicker({
  scenarios,
  selected,
  onChange,
  disabled,
  error,
}: {
  scenarios: ScenarioSummary[];
  selected: string;
  onChange: (slug: string) => void;
  disabled: boolean;
  error: string | null;
}) {
  return (
    <div className="w-full flex flex-col gap-1">
      <label htmlFor="scenario" className="text-gray-500 text-xs">
        Scenario
      </label>
      <select
        id="scenario"
        value={selected}
        disabled={disabled || scenarios.length === 0}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg bg-gray-900 border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="" disabled>
          {error
            ? "Failed to load scenarios"
            : scenarios.length === 0
              ? "Loading scenarios…"
              : "Select a scenario…"}
        </option>
        {scenarios.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.name}
            {s.version ? ` (${s.version})` : ""}
          </option>
        ))}
      </select>
    </div>
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

function useScenarioList() {
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchScenarios()
      .then(setScenarios)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load scenarios"),
      );
  }, []);

  return { scenarios, selected, setSelected, error };
}

export function Babelfish() {
  const { connectionState, error, connect, disconnect, localStream, remoteStream } = useWebRTC();
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const {
    scenarios,
    selected: selectedScenario,
    setSelected: setSelectedScenario,
    error: scenarioError,
  } = useScenarioList();

  useEffect(() => {
    if (remoteStream && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  const isLive = connectionState === "connected" || connectionState === "connecting";

  const handleClick = () => {
    if (isLive) {
      disconnect();
    } else {
      connect(selectedScenario);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-950">
      <div className="w-full max-w-md flex flex-col items-center gap-8">
        <h1 className="text-3xl font-bold text-white">Babelfish</h1>
        <ScenarioPicker
          scenarios={scenarios}
          selected={selectedScenario}
          onChange={setSelectedScenario}
          disabled={isLive}
          error={scenarioError}
        />
        <ConnectionButton
          connectionState={connectionState}
          onClick={handleClick}
          disabled={!isLive && !selectedScenario}
        />
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
