import { useState, useCallback, useRef } from "react";

export type ConnectionState = "disconnected" | "connecting" | "connected" | "failed";

interface WebRTCConfig {
  signalingUrl: string;
  onAudioStream?: (stream: MediaStream) => void;
  onRemoteAudioStream?: (stream: MediaStream) => void;
}

const DEFAULT_SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || "http://localhost:8080/offer";

function waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 2000): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener("icegatheringstatechange", checkState);
      resolve();
    };
    const checkState = () => pc.iceGatheringState === "complete" && done();
    pc.addEventListener("icegatheringstatechange", checkState);
    setTimeout(done, timeoutMs);
  });
}

async function sendOffer(url: string, sdp: string): Promise<{ session_id: string; sdp: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sdp, type: "offer" }),
  });
  if (!res.ok) throw new Error(`Signaling server error: ${res.status}`);
  return res.json();
}

function createPeerConnection(
  stream: MediaStream,
  onRemote: (s: MediaStream) => void,
  onStateChange: (state: RTCPeerConnectionState) => void,
): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: [] });
  stream.getTracks().forEach((track) => pc.addTrack(track, stream));
  pc.ontrack = (e) => e.streams[0] && onRemote(e.streams[0]);
  pc.onconnectionstatechange = () => onStateChange(pc.connectionState);
  return pc;
}

export function useWebRTC(config?: Partial<WebRTCConfig>) {
  const signalingUrl = config?.signalingUrl ?? DEFAULT_SIGNALING_URL;
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    setRemoteStream(null);
    setSessionId(null);
  }, [localStream]);

  const disconnect = useCallback(() => {
    cleanup();
    setConnectionState("disconnected");
    setError(null);
  }, [cleanup]);

  const connect = useCallback(async () => {
    if (connectionState === "connecting" || connectionState === "connected") return;
    setConnectionState("connecting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      setLocalStream(stream);
      config?.onAudioStream?.(stream);

      const handleState = (s: RTCPeerConnectionState) => {
        if (s === "connected") setConnectionState("connected");
        else if (["failed", "disconnected", "closed"].includes(s)) {
          setConnectionState("disconnected");
          cleanup();
        }
      };
      const handleRemote = (s: MediaStream) => {
        setRemoteStream(s);
        config?.onRemoteAudioStream?.(s);
      };
      const pc = createPeerConnection(stream, handleRemote, handleState);
      pcRef.current = pc;

      await pc.setLocalDescription(await pc.createOffer());
      await waitForIceGathering(pc);
      const answer = await sendOffer(signalingUrl, pc.localDescription?.sdp ?? "");
      setSessionId(answer.session_id);
      await pc.setRemoteDescription(new RTCSessionDescription({ sdp: answer.sdp, type: "answer" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setConnectionState("failed");
      cleanup();
    }
  }, [connectionState, signalingUrl, config, cleanup]);

  return { connectionState, sessionId, error, connect, disconnect, localStream, remoteStream };
}
