// Thin React wrapper around the framework-free WebRTCSession (./session.ts):
// owns the component state (connection state, streams, errors) and translates
// session events into state updates.

import { useCallback, useRef, useState } from "react";
import { SIGNALING_URL } from "../api/config";
import { WebRTCSession, type TranscriptEvent } from "./session";

// A rendered transcript line — TranscriptEvent plus a stable list key.
export interface TranscriptLine extends TranscriptEvent {
  id: number;
}

// Accumulates transcript lines for the current conversation; `reset` starts a
// fresh transcript on each new connection.
function useTranscript() {
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const seq = useRef(0);
  const append = useCallback((event: TranscriptEvent) => {
    seq.current += 1;
    const line = { ...event, id: seq.current };
    setLines((prev) => [...prev, line]);
  }, []);
  const reset = useCallback(() => setLines([]), []);
  return { lines, append, reset };
}

export type ConnectionState = "disconnected" | "connecting" | "connected" | "failed";

interface WebRTCConfig {
  signalingUrl: string;
  onAudioStream?: (stream: MediaStream) => void;
  onRemoteAudioStream?: (stream: MediaStream) => void;
}

const ENDED_PC_STATES: RTCPeerConnectionState[] = ["failed", "disconnected", "closed"];

// Translate WebRTCSession events into hook state updates. Extracted from the
// hook body so `useWebRTC` stays focused on state + lifecycle.
function buildSessionEvents(deps: {
  config?: Partial<WebRTCConfig>;
  onTranscript: (event: TranscriptEvent) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setConnectionState: (state: ConnectionState) => void;
  cleanup: () => void;
}) {
  return {
    onTranscript: deps.onTranscript,
    onLocalStream: (stream: MediaStream) => {
      deps.setLocalStream(stream);
      deps.config?.onAudioStream?.(stream);
    },
    onRemoteStream: (stream: MediaStream) => {
      deps.setRemoteStream(stream);
      deps.config?.onRemoteAudioStream?.(stream);
    },
    onConnectionStateChange: (state: RTCPeerConnectionState) => {
      if (state === "connected") deps.setConnectionState("connected");
      else if (ENDED_PC_STATES.includes(state)) {
        deps.setConnectionState("disconnected");
        deps.cleanup();
      }
    },
  };
}

export function useWebRTC(config?: Partial<WebRTCConfig>) {
  const signalingUrl = config?.signalingUrl ?? SIGNALING_URL;
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const { lines: transcript, append: onTranscript, reset: resetTranscript } = useTranscript();
  const sessionRef = useRef<WebRTCSession | null>(null);

  const cleanup = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setSessionId(null);
  }, []);

  const disconnect = useCallback(() => {
    cleanup();
    setConnectionState("disconnected");
    setError(null);
  }, [cleanup]);

  const connect = useCallback(
    async (scenarioSlug?: string) => {
      if (connectionState === "connecting" || connectionState === "connected") return;
      setConnectionState("connecting");
      setError(null);
      resetTranscript(); // each connection is a fresh conversation
      const session = new WebRTCSession(
        signalingUrl,
        buildSessionEvents({
          config,
          onTranscript,
          setLocalStream,
          setRemoteStream,
          setConnectionState,
          cleanup,
        }),
      );
      sessionRef.current = session;
      try {
        setSessionId(await session.start(scenarioSlug));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Connection failed");
        setConnectionState("failed");
        cleanup();
      }
    },
    [connectionState, signalingUrl, config, cleanup, resetTranscript, onTranscript],
  );

  return {
    connectionState,
    sessionId,
    error,
    connect,
    disconnect,
    localStream,
    remoteStream,
    transcript,
  };
}
