import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEST_SIGNALING_URL, jsonResponse, stubApiEnv } from "./helpers";
import type { WebRTCSessionEvents } from "../app/lib/webrtc/session";

const ANSWER = { session_id: "sess-1", sdp: "answer-sdp" };

class FakeDataChannel {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  constructor(readonly label: string) {}
}

class FakePeerConnection {
  static instances: FakePeerConnection[] = [];
  iceGatheringState: RTCIceGatheringState = "complete";
  connectionState: RTCPeerConnectionState = "new";
  localDescription: { sdp: string } | null = null;
  remoteDescription: { sdp: string; type: string } | null = null;
  ontrack: ((e: { streams: MediaStream[] }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  ondatachannel: ((e: { channel: FakeDataChannel }) => void) | null = null;
  addedTracks: MediaStreamTrack[] = [];
  closed = false;

  constructor() {
    FakePeerConnection.instances.push(this);
  }

  addTrack(track: MediaStreamTrack): void {
    this.addedTracks.push(track);
  }

  async createOffer(): Promise<{ type: "offer"; sdp: string }> {
    return { type: "offer", sdp: "offer-sdp" };
  }

  async setLocalDescription(desc: { sdp: string }): Promise<void> {
    this.localDescription = { sdp: desc.sdp };
  }

  async setRemoteDescription(desc: { sdp: string; type: string }): Promise<void> {
    this.remoteDescription = { sdp: desc.sdp, type: desc.type };
  }

  addEventListener(): void {}
  removeEventListener(): void {}

  close(): void {
    this.closed = true;
  }
}

class FakeSessionDescription {
  sdp: string;
  type: string;

  constructor(init: { sdp: string; type: string }) {
    this.sdp = init.sdp;
    this.type = init.type;
  }
}

function makeFakeMic() {
  const track = { stop: vi.fn() } as unknown as MediaStreamTrack;
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  return { stream, track };
}

function stubFetchRoutes() {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) =>
    url.endsWith("/token")
      ? jsonResponse({ access_token: "tok-1", expires_in: 3600 })
      : jsonResponse(ANSWER),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function importSession() {
  return import("../app/lib/webrtc/session");
}

describe("WebRTCSession", () => {
  beforeEach(() => {
    vi.resetModules();
    stubApiEnv();
    FakePeerConnection.instances = [];
    vi.stubGlobal("RTCPeerConnection", FakePeerConnection);
    vi.stubGlobal("RTCSessionDescription", FakeSessionDescription);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("start() negotiates: token, mic, POST offer, apply answer", async () => {
    const fetchMock = stubFetchRoutes();
    const { stream } = makeFakeMic();
    const getUserMedia = vi.fn(async () => stream);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    const events: Required<WebRTCSessionEvents> = {
      onLocalStream: vi.fn(),
      onRemoteStream: vi.fn(),
      onConnectionStateChange: vi.fn(),
      onTranscript: vi.fn(),
    };
    const { WebRTCSession } = await importSession();
    const session = new WebRTCSession(TEST_SIGNALING_URL, events);

    await expect(session.start("demo-scenario")).resolves.toBe("sess-1");

    expect(events.onLocalStream).toHaveBeenCalledExactlyOnceWith(stream);
    expect(getUserMedia).toHaveBeenCalledExactlyOnceWith({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });

    // The offer POST carries the bearer token and the chosen scenario.
    const offerCall = fetchMock.mock.calls.find(([url]) => url === TEST_SIGNALING_URL);
    expect(offerCall).toBeDefined();
    const init = offerCall?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok-1");
    expect(JSON.parse(init.body as string)).toEqual({
      sdp: "offer-sdp",
      type: "offer",
      scenario_slug: "demo-scenario",
    });

    // The backend's answer is applied to the peer connection.
    const pc = FakePeerConnection.instances[0];
    expect(pc.remoteDescription).toEqual({ sdp: "answer-sdp", type: "answer" });

    // Peer-connection events flow through to the session events.
    const remote = { id: "remote" } as unknown as MediaStream;
    pc.ontrack?.({ streams: [remote] });
    expect(events.onRemoteStream).toHaveBeenCalledExactlyOnceWith(remote);
    pc.connectionState = "connected";
    pc.onconnectionstatechange?.();
    expect(events.onConnectionStateChange).toHaveBeenCalledExactlyOnceWith("connected");
  });

  test("transcript DataChannel events reach onTranscript; other labels and junk are ignored", async () => {
    stubFetchRoutes();
    const { stream } = makeFakeMic();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn(async () => stream) } });
    const onTranscript = vi.fn();
    const { WebRTCSession } = await importSession();
    const session = new WebRTCSession(TEST_SIGNALING_URL, { onTranscript });
    await session.start("demo-scenario");
    const pc = FakePeerConnection.instances[0];

    // Backend-initiated channels arrive via ondatachannel.
    const transcript = new FakeDataChannel("transcript");
    pc.ondatachannel?.({ channel: transcript });
    const actions = new FakeDataChannel("screener-actions");
    pc.ondatachannel?.({ channel: actions });

    transcript.onmessage?.({
      data: JSON.stringify({ role: "caller", text: "山田さんをお願いします" }),
    });
    transcript.onmessage?.({
      data: JSON.stringify({ role: "responder", text: "お電話ありがとうございます。" }),
    });
    transcript.onmessage?.({ data: "not json" }); // malformed frame is dropped
    transcript.onmessage?.({ data: JSON.stringify({ role: "operator", text: "x" }) }); // unknown role dropped
    expect(actions.onmessage).toBeNull(); // non-transcript labels get no handler

    expect(onTranscript).toHaveBeenCalledTimes(2);
    expect(onTranscript).toHaveBeenNthCalledWith(1, {
      role: "caller",
      text: "山田さんをお願いします",
    });
    expect(onTranscript).toHaveBeenNthCalledWith(2, {
      role: "responder",
      text: "お電話ありがとうございます。",
    });
  });

  test("start() rejects with the secure-context error over plain HTTP", async () => {
    const fetchMock = stubFetchRoutes();
    // Insecure contexts have no navigator.mediaDevices at all.
    vi.stubGlobal("navigator", {});
    const { WebRTCSession, SECURE_CONTEXT_ERROR } = await importSession();
    const session = new WebRTCSession(TEST_SIGNALING_URL);

    await expect(session.start()).rejects.toThrow(SECURE_CONTEXT_ERROR);
    expect(SECURE_CONTEXT_ERROR).toBe(
      "Microphone needs a secure context. Open this page over HTTPS (https://192.168.1.25) rather than http.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("start() rejects on a signaling server error", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith("/token")
        ? jsonResponse({ access_token: "tok-1", expires_in: 3600 })
        : jsonResponse({}, 502),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { stream } = makeFakeMic();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: async () => stream } });
    const { WebRTCSession } = await importSession();
    const session = new WebRTCSession(TEST_SIGNALING_URL);

    await expect(session.start()).rejects.toThrow("Signaling server error: 502");
  });

  test("close() closes the peer connection and stops the mic tracks", async () => {
    stubFetchRoutes();
    const { stream, track } = makeFakeMic();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: async () => stream } });
    const { WebRTCSession } = await importSession();
    const session = new WebRTCSession(TEST_SIGNALING_URL);
    await session.start();

    session.close();

    expect(FakePeerConnection.instances[0].closed).toBe(true);
    expect(track.stop).toHaveBeenCalledTimes(1);
  });
});
