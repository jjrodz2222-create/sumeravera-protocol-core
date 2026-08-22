import React, { useState, useEffect, useRef, useCallback } from "react";
import { SystemLog } from "../types";
import { Terminal, Search, Trash2, Wifi, WifiOff, RefreshCw, Radio } from "lucide-react";

interface SystemLogsTerminalProps {
  logs: SystemLog[];
  loading: boolean;
}

export const SystemLogsTerminal: React.FC<SystemLogsTerminalProps> = ({ logs, loading }) => {
  const [filterModule, setFilterModule] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [liveLogs, setLiveLogs] = useState<SystemLog[]>([]);
  const [wsStatus, setWsStatus] = useState<"CONNECTED" | "CONNECTING" | "DISCONNECTED">("DISCONNECTED");
  
  const socketRef = useRef<WebSocket | null>(null);

  const isMountedRef = useRef<boolean>(true);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Compute WebSocket URL dynamically based on environment
  const host = typeof window !== "undefined" ? window.location.host : "localhost:3000";
  const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${host}/ws/ingress`;

  // WebSocket Subscription Lifecycle
  const connectWebSocket = useCallback(() => {
    if (!isMountedRef.current) return;

    try {
      if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }

      setWsStatus("CONNECTING");
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setWsStatus("CONNECTED");
        
        // Record WebSocket active subscription log event
        const connectLog: SystemLog = {
          id: `WS-CONN-${Date.now()}`,
          timestamp: Date.now() / 1000,
          time_formatted: new Date().toLocaleTimeString(),
          module: "INGRESS",
          level: "SUCCESS",
          message: "[/ws/ingress] Persistent WebSocket feed active. Real-time validation event stream connected.",
        };
        setLiveLogs((prev) => [connectLog, ...prev.slice(0, 199)]);
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const data = JSON.parse(event.data);

          if (data.type === "INGRESS_EVENT" || data.type === "VALIDATION_EVENT") {
            const isIntercept = data.status === "GATE_1_INTERCEPT";
            const isDiverted = data.status === "REJECTED_HONEYPOT";
            
            const level = isIntercept ? "CRITICAL" : isDiverted ? "WARN" : "SUCCESS";
            const moduleName = isIntercept ? "VERIFICATION" : isDiverted ? "HONEYPOT" : "INGRESS";
            
            const newLog: SystemLog = {
              id: `WS-EVT-${data.id || Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              timestamp: (data.timestamp ? data.timestamp / 1000 : Date.now() / 1000),
              time_formatted: new Date(data.timestamp || Date.now()).toLocaleTimeString(),
              module: moduleName,
              level: level,
              message: `[${data.status || "VALIDATION_EVENT"}] ${data.reason || "Real-time ingress validation event recorded"}${
                data.block_hash ? ` | Hash: ${String(data.block_hash).substring(0, 18)}...` : ""
              }`,
            };
            setLiveLogs((prev) => [newLog, ...prev.slice(0, 199)]);
          } else if (data.type === "VECTOR_BATCH_INGRESS_EVENT") {
            const batchLog: SystemLog = {
              id: `WS-BATCH-${data.id || Date.now()}`,
              timestamp: (data.timestamp ? data.timestamp / 1000 : Date.now() / 1000),
              time_formatted: new Date(data.timestamp || Date.now()).toLocaleTimeString(),
              module: "INGRESS",
              level: "SUCCESS",
              message: `[VECTOR_BATCH_INGRESS] Committed batch of ${data.batch_size} vectors (Block #${data.block_id}, Total: ${data.total_processed?.toLocaleString()}) | Hash: ${String(data.block_hash || "").substring(0, 18)}...`,
            };
            setLiveLogs((prev) => [batchLog, ...prev.slice(0, 199)]);
          } else if (data.type === "RUN_MILLION_BURST_EVENT" || data.type === "RUN_BILLION_BURST_EVENT") {
            const burstLog: SystemLog = {
              id: `WS-BURST-${data.id || Date.now()}`,
              timestamp: (data.timestamp ? data.timestamp / 1000 : Date.now() / 1000),
              time_formatted: new Date(data.timestamp || Date.now()).toLocaleTimeString(),
              module: "INGRESS",
              level: "SUCCESS",
              message: `[STREAM_BURST_COMPLETED] Processed ${data.total_vectors?.toLocaleString()} vectors at ${data.throughput_vps?.toLocaleString()} VPS in ${data.elapsed_time_seconds}s. Root: ${data.final_state_root ? String(data.final_state_root).substring(0, 16) + '...' : 'N/A'}`,
            };
            setLiveLogs((prev) => [burstLog, ...prev.slice(0, 199)]);
          } else if (data.type === "CONNECTED" || data.type === "STATS_UPDATE") {
            if (data.active_connections !== undefined) {
              const statLog: SystemLog = {
                id: `WS-STAT-${Date.now()}`,
                timestamp: Date.now() / 1000,
                time_formatted: new Date().toLocaleTimeString(),
                module: "VERIFICATION",
                level: "INFO",
                message: `[WS /ws/ingress] Active socket connections: ${data.active_connections}`,
              };
              setLiveLogs((prev) => [statLog, ...prev.slice(0, 199)]);
            }
          }
        } catch (e) {
          console.warn("SystemLogsTerminal WS parse warning:", e);
        }
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setWsStatus("DISCONNECTED");
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            connectWebSocket();
          }
        }, 3000);
      };

      ws.onerror = () => {
        if (!isMountedRef.current) return;
        setWsStatus("DISCONNECTED");
      };
    } catch (err) {
      console.warn("SystemLogsTerminal WS connection failed:", err);
      if (isMountedRef.current) {
        setWsStatus("DISCONNECTED");
      }
    }
  }, [wsUrl]);

  useEffect(() => {
    isMountedRef.current = true;
    connectWebSocket();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connectWebSocket]);

  // Combine live WebSocket events with props logs, deduplicating by ID
  const allLogsMap = new Map<string, SystemLog>();
  [...liveLogs, ...logs].forEach((log) => {
    if (!allLogsMap.has(log.id)) {
      allLogsMap.set(log.id, log);
    }
  });

  const combinedLogs = Array.from(allLogsMap.values()).sort((a, b) => b.timestamp - a.timestamp);

  const filteredLogs = combinedLogs.filter((log) => {
    const matchesModule = filterModule === "ALL" || log.module === filterModule;
    const matchesSearch =
      !searchTerm ||
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.module.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesModule && matchesSearch;
  });

  const handleClearLiveLogs = () => {
    setLiveLogs([]);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Header & WebSocket Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-slate-100">Live System Execution Logs</h2>
          </div>

          {/* WebSocket Ingress Feed Status Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono">
            {wsStatus === "CONNECTED" ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="text-emerald-400 font-bold">/ws/ingress LIVE</span>
              </>
            ) : wsStatus === "CONNECTING" ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span className="text-amber-400">CONNECTING...</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-rose-400">OFFLINE</span>
              </>
            )}
          </div>

          <span className="text-xs font-mono px-2 py-0.5 bg-slate-800 text-slate-300 rounded">
            {filteredLogs.length} events
          </span>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {["ALL", "VERIFICATION", "INGRESS", "KERNEL", "HONEYPOT", "LEDGER"].map((mod) => (
            <button
              key={mod}
              onClick={() => setFilterModule(mod)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
                filterModule === mod
                  ? "bg-cyan-600 text-white font-bold"
                  : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {mod}
            </button>
          ))}

          {liveLogs.length > 0 && (
            <button
              onClick={handleClearLiveLogs}
              title="Clear live feed buffer"
              className="p-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Search Filter Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
        <input
          id="system-logs-search-filter-input"
          aria-label="Filter logs by keyword"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter logs by keyword or module..."
          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* Terminal Output Stream View */}
      <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-4 font-mono text-xs max-h-96 overflow-y-auto space-y-2">
        {filteredLogs.length === 0 ? (
          <div className="text-slate-500 text-center py-8 flex flex-col items-center gap-2">
            <Radio className="w-5 h-5 text-slate-600 animate-pulse" />
            <span>No matching execution logs found in /ws/ingress stream.</span>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const levelColor =
              log.level === "SUCCESS"
                ? "text-emerald-400"
                : log.level === "WARN" || log.level === "WARNING"
                ? "text-amber-400"
                : log.level === "CRITICAL"
                ? "text-rose-400 font-bold"
                : "text-cyan-300";

            return (
              <div key={log.id} className="flex items-start gap-2.5 leading-relaxed hover:bg-slate-900/60 p-1.5 rounded transition">
                <span className="text-slate-500 shrink-0 select-none">[{log.time_formatted}]</span>
                <span className="px-1.5 py-0.2 bg-slate-900 border border-slate-800 text-[10px] text-slate-300 rounded shrink-0 font-bold">
                  {log.module}
                </span>
                <span className={`${levelColor} break-all`}>{log.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

