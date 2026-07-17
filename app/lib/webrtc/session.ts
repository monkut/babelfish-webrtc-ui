// Framework-free WebRTC session: secure-context check, token acquisition, mic
// capture, and the offer/answer negotiation with the signaling endpoint. No
// React imports — `useWebRTC` wraps this class with component state/lifecycle.

import { getAccessToken } from "../api/auth";

export const SECURE_CONTEXT_ERROR =
  "Microphone needs a secure context. Open this page over HTTPS (https://192.168.1.25) rather than http.";

// The backend caps concurrent sessions (`MAX_CONCURRENT_SESSIONS`, issue #137);
// for the phone screener it is 1, so a second caller gets `POST /offer` → 503.
// Surface that as a plain "line busy" message rather than a raw status code —
// it is expected and transient, not a fault the user can fix.
export const LINE_IN_USE_ERROR =
  "The line is in use — this phone screener handles one call at a time. Please try again in a moment.";

// One finalized line of conversation text from the backend's `transcript`
// DataChannel: caller = STT result, responder = the text handed to TTS
// (greeting, disclosure, and each reply). Mirrors the backend's
// TranscriptEvent model (conversations/definitions.py).
export interface TranscriptEvent {
  role: "caller" | "responder";
  text: string;
}

export interface WebRTCSessionEvents {
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onTranscript?: (event: TranscriptEvent) => void;
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
  // 503 on /offer means the concurrent-session cap was hit (the only 503 this
  // endpoint raises) — the line is busy. Everything else is a real error.
  if (res.status === 503) throw new Error(LINE_IN_USE_ERROR);
  if (!res.ok) throw new Error(`Signaling server error: ${res.status}`);
  return res.json();
}

const TRANSCRIPT_CHANNEL_LABEL = "transcript";

function parseTranscriptEvent(data: unknown): TranscriptEvent | null {
  if (typeof data !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(data);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "role" in parsed &&
      "text" in parsed &&
      (parsed.role === "caller" || parsed.role === "responder") &&
      typeof parsed.text === "string"
    ) {
      return { role: parsed.role, text: parsed.text };
    }
  } catch {
    // fall through — malformed frame is dropped below
  }
  return null;
}

function createPeerConnection(stream: MediaStream, events: WebRTCSessionEvents): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: [] });
  stream.getTracks().forEach((track) => pc.addTrack(track, stream));
  pc.ontrack = (e) => e.streams[0] && events.onRemoteStream?.(e.streams[0]);
  pc.onconnectionstatechange = () => events.onConnectionStateChange?.(pc.connectionState);
  // Backend-initiated DataChannels: `transcript` carries conversation text
  // (this UI's transcript panel); other labels (`screener-actions`) are for
  // the phone client and are ignored here.
  pc.ondatachannel = (e) => {
    if (e.channel.label !== TRANSCRIPT_CHANNEL_LABEL) return;
    e.channel.onmessage = (msg) => {
      const event = parseTranscriptEvent(msg.data);
      if (event) events.onTranscript?.(event);
    };
  };
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
