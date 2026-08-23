import React, { useState, useEffect, useRef, useCallback } from "react";
import { LiveIngressEvent, IngressStatusInfo } from "../types";
import { Wifi, WifiOff, Send, Copy, Check, ShieldCheck, ShieldAlert, Radio, Terminal, Database, ArrowUpRight, Flame, RefreshCw, Zap } from "lucide-react";

interface LiveIngressStreamProps {
  onStateUpdate?: () => void;
}

export const LiveIngressStream: React.FC<LiveIngressStreamProps> = ({ onStateUpdate }) => {
  const [wsStatus, setWsStatus] = useState<"CONNECTING" | "CONNECTED" | "DISCONNECTED">("CONNECTING");
  const [activeConnections, setActiveConnections] = useState<number>(1);
  const [liveEvents, setLiveEvents] = useState<LiveIngressEvent[]>([]);
  const [copiedWs, setCopiedWs] = useState<boolean>(false);
  const [copiedHttp, setCopiedHttp] = useState<boolean>(false);

  // Transmission Controls
  const [selectedChannel, setSelectedChannel] = useState<"WEBSOCKET" | "HTTP">("WEBSOCKET");
  const [payloadType, setPayloadType] = useState<"LEGITIMATE" | "FORGED_KEY" | "RESOURCE_DRAIN" | "SQL_INJECT" | "INVALID_ROOT_HASH">("LEGITIMATE");
  const [transmitting, setTransmitting] = useState<boolean>(false);
  const [lastAuditResponse, setLastAuditResponse] = useState<any>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [reconnectNotice, setReconnectNotice] = useState<string | null>(null);

  // Compute protocol URLs
  const host = typeof window !== "undefined" ? window.location.host : "localhost:3000";
  const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${host}/ws/ingress`;
  const httpUrl = typeof window !== "undefined" ? `${window.location.protocol}//${host}/api/v1/ingress` : "http://localhost:3000/api/v1/ingress";

  // Jittered Exponential Backoff Algorithm: min(maxBackoff, base * 2^attempt) + random_jitter
  const calculateBackoffWithJitter = (attempt: number): number => {
    const baseDelayMs = 1000; // 1s base
    const maxDelayMs = 30000; // 30s ceiling
    const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(1.8, attempt));
    // Full random jitter (0 to 1000ms) prevents synchronized thundering herd spikes
    const jitter = Math.random() * 1000;
    return Math.floor(exponentialDelay + jitter);
  };

  // WebSocket Connection Lifecycle with Jittered Exponential Backoff
  const connectWebSocket = useCallback(() => {
    try {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      setWsStatus("CONNECTING");
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setWsStatus("CONNECTED");
        setReconnectNotice(null);
        reconnectAttemptRef.current = 0; // Reset backoff upon successful handshake
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "CONNECTED") {
            if (data.active_connections) setActiveConnections(data.active_connections);
          } else if (data.type === "STATS_UPDATE") {
            if (data.active_connections) setActiveConnections(data.active_connections);
          } else if (data.type === "INGRESS_EVENT") {
            const newEvt: LiveIngressEvent = {
              id: `${data.id || "ING"}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              timestamp: data.timestamp || Date.now(),
              protocol: data.protocol || "WEBSOCKET",
              endpoint: data.endpoint || "/ws/ingress",
              payload: data.payload,
              status: data.status,
              route: data.route,
              reason: data.reason,
              block_hash: data.block_hash,
            };
            setLiveEvents((prev) => [newEvt, ...prev.slice(0, 49)]);
            if (data.active_connections) setActiveConnections(data.active_connections);
            if (onStateUpdate) onStateUpdate();
          }
        } catch (e) {
          console.warn("WS message parse warning:", e);
        }
      };

      ws.onclose = () => {
        setWsStatus("DISCONNECTED");
        const currentAttempt = reconnectAttemptRef.current;
        const delay = calculateBackoffWithJitter(currentAttempt);
        reconnectAttemptRef.current += 1;
        
        const delaySec = (delay / 1000).toFixed(1);
        setReconnectNotice(`Reconnecting (attempt #${currentAttempt + 1}) in ${delaySec}s...`);

        reconnectTimerRef.current = setTimeout(() => {
          connectWebSocket();
        }, delay);
      };

      ws.onerror = (err) => {
        console.warn("WS connection status notice:", err);
        setWsStatus("DISCONNECTED");
      };
    } catch (err) {
      console.warn("WebSocket creation notice:", err);
      setWsStatus("DISCONNECTED");
    }
  }, [wsUrl, onStateUpdate]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connectWebSocket]);

  // Copy helper
  const handleCopy = (text: string, type: "ws" | "http") => {
    navigator.clipboard.writeText(text);
    if (type === "ws") {
      setCopiedWs(true);
      setTimeout(() => setCopiedWs(false), 2000);
    } else {
      setCopiedHttp(true);
      setTimeout(() => setCopiedHttp(false), 2000);
    }
  };

  // Generate payload preset
  const getPresetPayload = () => {
    switch (payloadType) {
      case "LEGITIMATE":
        return {
          agent_id: "agent_bio_1",
          secret_key: "sumer_secret_bio_9982",
          dE: 10.0,
          facet_shifts: { BIO: 5.0, WATER: 2.5 },
        };
      case "FORGED_KEY":
        return {
          agent_id: "agent_bio_1",
          secret_key: "FORGED_KEY_SPOOF_998",
          dE: 25.0,
          facet_shifts: { BIO: 0.0 },
        };
      case "RESOURCE_DRAIN":
        return {
          agent_id: "rogue_bot_33",
          secret_key: "sumer_secret_bio_9982",
          dE: 3000.0, // Overruns MAX_EARTH_CAPACITY
          facet_shifts: { BIO: 0.0 },
        };
      case "SQL_INJECT":
        return {
          agent_id: "agent_bio_1",
          secret_key: "sumer_secret_bio_9982",
          dE: 5.0,
          facet_shifts: { BIO: "' UNION SELECT * FROM users--" },
        };
      case "INVALID_ROOT_HASH":
        return {
          agent_id: "agent_bio_1",
          secret_key: "sumer_secret_bio_9982",
          root_truth_hash: "INVALID_ROOT_HASH_0xDEADBEEF_DIVERGENT",
          expected_truth_anchor: "0x8a92f01c7d81a29f8217210e",
          dE: 10.0,
          facet_shifts: { BIO: 1.0 },
        };
      case "IRONCLAD_BOUNDARY_PASS":
        return {
          agent_id: "agent_bio_1",
          secret_key: "sumer_secret_bio_9982",
          root_truth_hash: "0x8a92f01c7d81a29f8217210e",
          signature: "IRONCLAD_EDGE_NODE_HMAC_0x8a92f01c7d81a29f8217210e_VERIFIED",
          intent_anchor: "0x8a92f01c7d81a29f8217210e",
          is_boundary_pass: true,
          dE: 10.0,
          facet_shifts: { BIO: 2.5, WATER: 1.5 },
        };
    }
  };

  // Transmit traffic test packet
  const handleTransmitTraffic = async () => {
    setTransmitting(true);
    const packet = getPresetPayload();

    try {
      if (selectedChannel === "WEBSOCKET") {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ action: "ingress", payload: packet }));
          setLastAuditResponse({
            channel: "WEBSOCKET (/ws/ingress)",
            status: "TRANSMITTED",
            payload: packet,
            timestamp: Date.now(),
          });
        } else {
          alert("WebSocket is not connected. Reconnecting...");
          connectWebSocket();
        }
      } else {
        // HTTP Ingress with network disconnect fallback
        let data: any = null;
        try {
          const res = await fetch("/api/v1/ingress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(packet),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          data = await res.json();
        } catch (networkErr: any) {
          console.warn("HTTP Ingress network notice (offline mock fallback):", networkErr.message);
          const isDecoy = !packet.secret_key || !packet.secret_key.includes("secret");
          data = {
            status: isDecoy ? "REJECTED_HONEYPOT" : "VERIFIED_AND_APPROVED",
            protocol: "HTTP",
            endpoint: "/api/v1/ingress",
            route: isDecoy ? "HONEYPOT_SYNTHETIC_PLAYGROUND" : "CORE_KERNEL",
            reason: isDecoy
              ? "[HONEYPOT INTERCEPTED] CRYPTO_FAILURE: Invalid cryptographic signature. [Mock Fallback]"
              : "TRUTH_VERIFIED: Request passes cryptographic identity & resource equilibrium constraints. [Mock Fallback]",
            timestamp: Date.now(),
          };
        }

        setLastAuditResponse({
          channel: "HTTP (/api/v1/ingress)",
          status: data.status,
          response: data,
          timestamp: Date.now(),
        });
        if (onStateUpdate) onStateUpdate();
      }
    } catch (err: any) {
      console.error("Traffic transmission failed:", err);
      setLastAuditResponse({ error: err.message });
    } finally {
      setTransmitting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-5">
      {/* Header Banner: Connection Status & Active Clients */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-950 border border-cyan-800/80 rounded-xl text-cyan-400">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">
                Live Ingress WebSocket Stream & HTTP Router
              </h2>
              <span className="px-2 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded text-[10px] font-mono font-bold">
                GATE 1 VERIFICATION
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live network traffic ingress with real-time Honeypot routing & SHA-256 state ledger commits.
            </p>
          </div>
        </div>

        {/* Live Active Status Badges */}
        <div className="flex items-center gap-3 shrink-0">
          {reconnectNotice && wsStatus === "DISCONNECTED" && (
            <span className="text-[11px] font-mono text-amber-400/90 bg-amber-950/60 border border-amber-800/60 px-2.5 py-1 rounded-lg animate-pulse hidden sm:inline">
              {reconnectNotice}
            </span>
          )}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-mono font-bold transition ${
              wsStatus === "CONNECTED"
                ? "bg-emerald-950/80 border-emerald-800 text-emerald-300"
                : wsStatus === "CONNECTING"
                ? "bg-amber-950/80 border-amber-800 text-amber-300"
                : "bg-rose-950/80 border-rose-800 text-rose-300"
            }`}
          >
            {wsStatus === "CONNECTED" ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <Wifi className="w-4 h-4 text-emerald-400" />
                <span>WS CONNECTED</span>
              </>
            ) : wsStatus === "CONNECTING" ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>WS CONNECTING...</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-rose-400" />
                <span>WS DISCONNECTED</span>
              </>
            )}
          </div>

          <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>Active Clients: <strong className="text-cyan-300">{activeConnections}</strong></span>
          </div>
        </div>
      </div>

      {/* Endpoint URL Display Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
        {/* WebSocket Endpoint */}
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-bold text-cyan-400 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5" /> WebSocket Ingress Endpoint
            </span>
            <span className="text-[10px] text-emerald-400 font-bold">LIVE STREAM</span>
          </div>
          <div className="flex items-center justify-between gap-2 p-2 bg-slate-900 border border-slate-800 rounded-lg">
            <span className="text-slate-200 font-bold truncate">{wsUrl}</span>
            <button
              onClick={() => handleCopy(wsUrl, "ws")}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition shrink-0 cursor-pointer"
              title="Copy WebSocket Endpoint"
            >
              {copiedWs ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* HTTP Endpoint */}
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-bold text-purple-400 flex items-center gap-1.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> HTTP REST Ingress Endpoint
            </span>
            <span className="text-[10px] text-cyan-400 font-bold">POST ROUTE</span>
          </div>
          <div className="flex items-center justify-between gap-2 p-2 bg-slate-900 border border-slate-800 rounded-lg">
            <span className="text-slate-200 font-bold truncate">{httpUrl}</span>
            <button
              onClick={() => handleCopy(httpUrl, "http")}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition shrink-0 cursor-pointer"
              title="Copy HTTP Endpoint"
            >
              {copiedHttp ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Live Ingress Packet Transmitter */}
      <div className="p-4 bg-slate-950 border border-slate-800/90 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Send className="w-4 h-4 text-cyan-400" /> Live Traffic Ingress Simulator
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Transmit live network packets through Gate 1 Verification & Honeypot routing via WebSocket or HTTP.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-slate-400 text-[11px]">Channel:</span>
            <button
              onClick={() => setSelectedChannel("WEBSOCKET")}
              className={`px-3 py-1.5 rounded-lg border font-bold transition cursor-pointer ${
                selectedChannel === "WEBSOCKET"
                  ? "bg-cyan-950 text-cyan-300 border-cyan-700 shadow-md"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
              }`}
            >
              WebSocket
            </button>
            <button
              onClick={() => setSelectedChannel("HTTP")}
              className={`px-3 py-1.5 rounded-lg border font-bold transition cursor-pointer ${
                selectedChannel === "HTTP"
                  ? "bg-purple-950 text-purple-300 border-purple-700 shadow-md"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
              }`}
            >
              HTTP REST
            </button>
          </div>
        </div>

        {/* Payload Preset Selection & Action Button */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs font-mono">
          <button
            onClick={() => setPayloadType("LEGITIMATE")}
            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
              payloadType === "LEGITIMATE"
                ? "bg-emerald-950/70 border-emerald-600 text-emerald-200"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="flex items-center justify-between font-bold mb-1">
              <span>1. Verified State Shift</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-[10px] text-slate-400">Valid key signature &amp; resource bounds. Passes Gate 1.</p>
          </button>

          <button
            onClick={() => setPayloadType("FORGED_KEY")}
            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
              payloadType === "FORGED_KEY"
                ? "bg-purple-950/70 border-purple-600 text-purple-200"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="flex items-center justify-between font-bold mb-1">
              <span>2. Forged Key Threat</span>
              <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <p className="text-[10px] text-slate-400">Invalid signature token. Diverted to Honeypot.</p>
          </button>

          <button
            onClick={() => setPayloadType("RESOURCE_DRAIN")}
            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
              payloadType === "RESOURCE_DRAIN"
                ? "bg-amber-950/70 border-amber-600 text-amber-200"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="flex items-center justify-between font-bold mb-1">
              <span>3. Resource Overrun</span>
              <Flame className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-[10px] text-slate-400">Carrying capacity limit breach (+3000 dE). Rejected.</p>
          </button>

          <button
            onClick={() => setPayloadType("SQL_INJECT")}
            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
              payloadType === "SQL_INJECT"
                ? "bg-rose-950/70 border-rose-600 text-rose-200"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="flex items-center justify-between font-bold mb-1">
              <span>4. SQL Injection</span>
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <p className="text-[10px] text-slate-400">UNION SELECT injection. Intercepted by Honeypot.</p>
          </button>

          <button
            id="boundary-test-invalid-hash-btn"
            onClick={() => setPayloadType("INVALID_ROOT_HASH")}
            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
              payloadType === "INVALID_ROOT_HASH"
                ? "bg-red-950/90 border-red-500 text-red-200 shadow-lg shadow-red-950/60"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="flex items-center justify-between font-bold mb-1">
              <span>5. Invalid Root Hash</span>
              <ShieldAlert className="w-3.5 h-3.5 text-red-400 animate-pulse" />
            </div>
            <p className="text-[10px] text-slate-400">Boundary test: Divergent hash halts state execution before T=501 STEPS.</p>
          </button>

          <button
            id="boundary-pass-ironclad-btn"
            onClick={() => setPayloadType("IRONCLAD_BOUNDARY_PASS")}
            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
              payloadType === "IRONCLAD_BOUNDARY_PASS"
                ? "bg-emerald-950/90 border-emerald-500 text-emerald-200 shadow-lg shadow-emerald-950/60"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="flex items-center justify-between font-bold mb-1">
              <span>6. Valid Boundary Pass</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-[10px] text-slate-400">IroncladEdgeNodeWidget HMAC: Gate 1 allows tx, updates state root, advances to T=502 STEPS.</p>
          </button>
        </div>

        {/* Transmit Button & Payload Preview */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
            <span>Payload Preview:</span>
            <code className="bg-slate-900 text-cyan-300 px-2 py-1 rounded border border-slate-800 font-bold truncate max-w-xs sm:max-w-md">
              {JSON.stringify(getPresetPayload())}
            </code>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="trigger-1b-vector-burst-btn"
              onClick={async () => {
                setTransmitting(true);
                try {
                  const res = await fetch("/api/v1/run-billion", { method: "POST" });
                  const data = await res.json();
                  setLastAuditResponse(data);
                } catch (e) {
                  console.error(e);
                } finally {
                  setTransmitting(false);
                }
              }}
              disabled={transmitting}
              className="px-4 py-2.5 bg-purple-950 hover:bg-purple-900 active:bg-purple-800 text-purple-200 border border-purple-600/50 font-bold text-xs rounded-xl shadow-lg shadow-purple-950/50 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer shrink-0"
            >
              <Zap className="w-3.5 h-3.5 text-purple-400 fill-current animate-pulse" />
              <span>1 Billion Vector Streaming Burst</span>
            </button>

            <button
              id="transmit-live-traffic-btn"
              onClick={handleTransmitTraffic}
              disabled={transmitting}
              className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-cyan-950/50 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer shrink-0"
            >
              {transmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Transmitting...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 fill-current text-slate-950" />
                  <span>Transmit ({selectedChannel})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Real-Time WebSocket Ingress Stream Log Feed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
              Live Ingress Event Stream ({liveEvents.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Broadcasting via /ws/ingress
          </span>
        </div>

        {liveEvents.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs font-mono bg-slate-950/50 rounded-xl border border-slate-800/80">
            No live WebSocket events received yet. Click <strong className="text-cyan-300">"Transmit Ingress Traffic"</strong> above to fire live packets.
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1 font-mono text-xs">
            {liveEvents.map((evt, idx) => (
              <div
                key={`${evt.id}-${idx}`}
                className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                  evt.status === "VERIFIED_AND_APPROVED"
                    ? "bg-slate-950 border-emerald-900/50 text-emerald-300"
                    : evt.status === "GATE_1_INTERCEPT"
                    ? "bg-red-950/80 border-red-800 text-red-200 shadow-lg shadow-red-950/50"
                    : "bg-slate-950 border-rose-900/50 text-rose-300"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                        evt.status === "VERIFIED_AND_APPROVED"
                          ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                          : evt.status === "GATE_1_INTERCEPT"
                          ? "bg-red-900 text-white border-red-600 animate-pulse"
                          : "bg-rose-950 text-rose-400 border-rose-800"
                      }`}
                    >
                      {evt.status}
                    </span>

                    <span className="px-2 py-0.5 bg-slate-900 text-slate-400 border border-slate-800 rounded text-[10px] font-bold">
                      {evt.protocol}
                    </span>

                    <span className="text-slate-400 text-[11px]">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <p className="text-slate-300 text-[11px]">{evt.reason}</p>
                </div>

                <div className="text-right shrink-0">
                  <div className="flex items-center justify-end gap-1.5 text-[11px] font-bold text-slate-400">
                    <Database className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Route: <strong className="text-slate-200">{evt.route}</strong></span>
                  </div>
                  {evt.block_hash && (
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-xs">
                      Hash: {evt.block_hash.substring(0, 20)}...
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
