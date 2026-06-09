import { useState, useCallback, useRef } from "react";
import { getAccessToken } from "../api/auth";
import { SIGNALING_URL } from "../api/config";

export type ConnectionState = "disconnected" | "connecting" | "connected" | "failed";

interface WebRTCConfig {
  signalingUrl: string;
  onAudioStream?: (stream: MediaStream) => void;
  onRemoteAudioStream?: (stream: MediaStream) => void;
}

const DEFAULT_SIGNALING_URL = SIGNALING_URL;

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

async function sendOffer(
  url: string,
  sdp: string,
  token: string,
  scenarioSlug?: string,
): Promise<{ session_id: string; sdp: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    // `scenario_slug` picks the scenario for this session, overriding the
    // client's bound default. Omitted when no scenario was selected.
    body: JSON.stringify({ sdp, type: "offer", scenario_slug: scenarioSlug }),
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

interface NegotiateOptions {
  stream: MediaStream;
  signalingUrl: string;
  token: string;
  scenarioSlug?: string;
  onRemote: (s: MediaStream) => void;
  onState: (state: RTCPeerConnectionState) => void;
}

// Full offer/answer round-trip: build the peer connection, gather ICE, POST the
// offer, and apply the answer. Returns the live pc and the backend session id.
async function negotiate(
  opts: NegotiateOptions,
): Promise<{ pc: RTCPeerConnection; sessionId: string }> {
  const pc = createPeerConnection(opts.stream, opts.onRemote, opts.onState);
  await pc.setLocalDescription(await pc.createOffer());
  await waitForIceGathering(pc);
  const answer = await sendOffer(
    opts.signalingUrl,
    pc.localDescription?.sdp ?? "",
    opts.token,
    opts.scenarioSlug,
  );
  await pc.setRemoteDescription(new RTCSessionDescription({ sdp: answer.sdp, type: "answer" }));
  return { pc, sessionId: answer.session_id };
}

interface SessionDeps {
  signalingUrl: string;
  scenarioSlug?: string;
  config?: Partial<WebRTCConfig>;
  cleanup: () => void;
  pcRef: { current: RTCPeerConnection | null };
  setConnectionState: (s: ConnectionState) => void;
  setError: (e: string | null) => void;
  setLocalStream: (s: MediaStream | null) => void;
  setRemoteStream: (s: MediaStream | null) => void;
  setSessionId: (s: string | null) => void;
}

// Acquire a token, capture the mic, negotiate the session, and drive the
// hook's state through the attempt. Extracted from the hook so the React body
// stays small; all effects flow back through the injected setters.
async function startSession(deps: SessionDeps, scenarioSlug?: string): Promise<void> {
  const { signalingUrl, config, cleanup } = deps;
  deps.setConnectionState("connecting");
  deps.setError(null);
  try {
    // Browsers expose `navigator.mediaDevices` only in a secure context
    // (HTTPS or localhost). Over plain HTTP it is undefined — surface a clear
    // reason instead of a cryptic "reading 'getUserMedia'" TypeError.
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        "Microphone needs a secure context. Open this page over HTTPS (https://192.168.1.25) rather than http.",
      );
    }
    // Token before mic, so an auth failure never leaves a hot capture running.
    const token = await getAccessToken();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    deps.setLocalStream(stream);
    config?.onAudioStream?.(stream);

    const onState = (s: RTCPeerConnectionState) => {
      if (s === "connected") deps.setConnectionState("connected");
      else if (["failed", "disconnected", "closed"].includes(s)) {
        deps.setConnectionState("disconnected");
        cleanup();
      }
    };
    const onRemote = (s: MediaStream) => {
      deps.setRemoteStream(s);
      config?.onRemoteAudioStream?.(s);
    };
    const { pc, sessionId } = await negotiate({
      stream,
      signalingUrl,
      token,
      scenarioSlug,
      onRemote,
      onState,
    });
    deps.pcRef.current = pc;
    deps.setSessionId(sessionId);
  } catch (err) {
    deps.setError(err instanceof Error ? err.message : "Connection failed");
    deps.setConnectionState("failed");
    cleanup();
  }
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

  const connect = useCallback(
    async (scenarioSlug?: string) => {
      if (connectionState === "connecting" || connectionState === "connected") return;
      await startSession(
        {
          signalingUrl,
          config,
          cleanup,
          pcRef,
          setConnectionState,
          setError,
          setLocalStream,
          setRemoteStream,
          setSessionId,
        },
        scenarioSlug,
      );
    },
    [connectionState, signalingUrl, config, cleanup],
  );

  return { connectionState, sessionId, error, connect, disconnect, localStream, remoteStream };
}
