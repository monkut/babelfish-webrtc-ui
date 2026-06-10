// Framework-free WebRTC session: secure-context check, token acquisition, mic
// capture, and the offer/answer negotiation with the signaling endpoint. No
// React imports — `useWebRTC` wraps this class with component state/lifecycle.

import { getAccessToken } from "../api/auth";

export const SECURE_CONTEXT_ERROR =
  "Microphone needs a secure context. Open this page over HTTPS (https://192.168.1.25) rather than http.";

export interface WebRTCSessionEvents {
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
}

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

function createPeerConnection(stream: MediaStream, events: WebRTCSessionEvents): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: [] });
  stream.getTracks().forEach((track) => pc.addTrack(track, stream));
  pc.ontrack = (e) => e.streams[0] && events.onRemoteStream?.(e.streams[0]);
  pc.onconnectionstatechange = () => events.onConnectionStateChange?.(pc.connectionState);
  return pc;
}

// One connect attempt: `start()` runs the full token → mic → offer/answer
// round-trip and resolves with the backend session id; `close()` releases the
// peer connection and the captured microphone.
export class WebRTCSession {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;

  constructor(
    private readonly signalingUrl: string,
    private readonly events: WebRTCSessionEvents = {},
  ) {}

  async start(scenarioSlug?: string): Promise<string> {
    // Browsers expose `navigator.mediaDevices` only in a secure context
    // (HTTPS or localhost). Over plain HTTP it is undefined — surface a clear
    // reason instead of a cryptic "reading 'getUserMedia'" TypeError.
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(SECURE_CONTEXT_ERROR);
    }
    // Token before mic, so an auth failure never leaves a hot capture running.
    const token = await getAccessToken();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.localStream = stream;
    this.events.onLocalStream?.(stream);

    const pc = createPeerConnection(stream, this.events);
    this.pc = pc;
    await pc.setLocalDescription(await pc.createOffer());
    await waitForIceGathering(pc);
    const answer = await sendOffer(
      this.signalingUrl,
      pc.localDescription?.sdp ?? "",
      token,
      scenarioSlug,
    );
    await pc.setRemoteDescription(new RTCSessionDescription({ sdp: answer.sdp, type: "answer" }));
    return answer.session_id;
  }

  close(): void {
    this.pc?.close();
    this.pc = null;
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
  }
}
