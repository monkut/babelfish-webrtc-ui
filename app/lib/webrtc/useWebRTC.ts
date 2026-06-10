// Thin React wrapper around the framework-free WebRTCSession (./session.ts):
// owns the component state (connection state, streams, errors) and translates
// session events into state updates.

import { useCallback, useRef, useState } from "react";
import { SIGNALING_URL } from "../api/config";
import { WebRTCSession } from "./session";

export type ConnectionState = "disconnected" | "connecting" | "connected" | "failed";

interface WebRTCConfig {
  signalingUrl: string;
  onAudioStream?: (stream: MediaStream) => void;
  onRemoteAudioStream?: (stream: MediaStream) => void;
}

const ENDED_PC_STATES: RTCPeerConnectionState[] = ["failed", "disconnected", "closed"];

export function useWebRTC(config?: Partial<WebRTCConfig>) {
  const signalingUrl = config?.signalingUrl ?? SIGNALING_URL;
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
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
      const session = new WebRTCSession(signalingUrl, {
        onLocalStream: (stream) => {
          setLocalStream(stream);
          config?.onAudioStream?.(stream);
        },
        onRemoteStream: (stream) => {
          setRemoteStream(stream);
          config?.onRemoteAudioStream?.(stream);
        },
        onConnectionStateChange: (state) => {
          if (state === "connected") setConnectionState("connected");
          else if (ENDED_PC_STATES.includes(state)) {
            setConnectionState("disconnected");
            cleanup();
          }
        },
      });
      sessionRef.current = session;
      try {
        setSessionId(await session.start(scenarioSlug));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Connection failed");
        setConnectionState("failed");
        cleanup();
      }
    },
    [connectionState, signalingUrl, config, cleanup],
  );

  return { connectionState, sessionId, error, connect, disconnect, localStream, remoteStream };
}
