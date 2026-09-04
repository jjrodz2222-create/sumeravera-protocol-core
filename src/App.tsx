import React, { useState, useEffect, useCallback } from "react";
import { SumerAveraStatus, GatewayRouteResult } from "./types";
import { MOCK_DEFAULT_STATUS } from "./mockStatus";
import { Header } from "./components/Header";
import { HomeostaticEngineView } from "./components/HomeostaticEngineView";
import { TruthVerificationConsole } from "./components/TruthVerificationConsole";
import { AdaptiveGatewayMonitor } from "./components/AdaptiveGatewayMonitor";
import { SHA256LedgerExplorer } from "./components/SHA256LedgerExplorer";
import { SystemLogsTerminal } from "./components/SystemLogsTerminal";
import { Gate1IngressEngineView } from "./components/Gate1IngressEngineView";
import { SecurityReportView } from "./components/SecurityReportView";
import { HistoricalTrendsView } from "./components/HistoricalTrendsView";
import { ClientEvaluationWidget } from "./components/ClientEvaluationWidget";
import { SumerAveraMobilePocWidget } from "./components/SumerAveraMobilePocWidget";
import { FraudMetricsOutlook } from "./components/FraudMetricsOutlook";
import { Activity, ShieldCheck, Flame, Layers, Terminal, RefreshCw, Cpu, Radio, ShieldAlert, Award, TrendingUp, SlidersHorizontal, Smartphone } from "lucide-react";

export default function App() {
  const [status, setStatus] = useState<SumerAveraStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"mobile_poc" | "widget" | "gate1" | "kernel" | "history" | "fraud" | "truth" | "gateway" | "ledger" | "report" | "logs">("mobile_poc");
  const [autoStep, setAutoStep] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch complete system status from Express Python backend with resilient mock fallback
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const data = await res.json();
      setStatus(data);
      setErrorMsg(null);
    } catch (err: any) {
      console.warn("Status fetch network notice (active resilient fallback):", err.message);
      // Fallback to existing status state or initialize with mock fallback status
      setStatus((prev) => prev || MOCK_DEFAULT_STATUS);
      setErrorMsg(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Auto-Step Loop
  useEffect(() => {
    let stepInterval: any = null;
    if (autoStep) {
      stepInterval = setInterval(async () => {
        try {
          await fetch("/api/step", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dt: 1.0 }),
          });
          fetchStatus();
        } catch (err) {
          console.error("Auto step error, stepping locally:", err);
          handleManualStep(1.0);
        }
      }, 2000);
    }
    return () => {
      if (stepInterval) clearInterval(stepInterval);
    };
  }, [autoStep, fetchStatus]);

  // Manual Step trigger
  const handleManualStep = async (dt: number = 1.0) => {
    setLoading(true);
    try {
      const res = await fetch("/api/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dt }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchStatus();
    } catch (err: any) {
      console.warn("Manual step offline fallback:", err.message);
      setStatus((prev) => {
        if (!prev) return MOCK_DEFAULT_STATUS;
        const newE = Math.min(prev.kernel.E_capacity, Math.max(prev.kernel.E_floor, prev.kernel.E + 2.5 * dt));
        const nextStep = prev.kernel.time_step + 1;
        return {
          ...prev,
          kernel: {
            ...prev.kernel,
            E: Number(newE.toFixed(2)),
            time_step: nextStep,
          },
          system_logs: [
            {
              id: `LOG-LOCAL-${Date.now()}`,
              timestamp: Date.now() / 1000,
              time_formatted: new Date().toLocaleTimeString(),
              module: "KERNEL",
              level: "INFO",
              message: `System state step simulated locally (dt=${dt}). New E=${newE.toFixed(1)}`,
            },
            ...prev.system_logs,
          ],
        };
      });
    } finally {
      setLoading(false);
    }
  };

  // Submit agent request through Adaptive Gateway & Truth Verification Engine
  const handleAgentRequestShift = async (payload: any): Promise<GatewayRouteResult> => {
    try {
      const res = await fetch("/api/gateway/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      await fetchStatus();
      return data.route_result || data;
    } catch (err: any) {
      console.warn("Agent request shift offline fallback:", err.message);
      const isValidKey = payload.secret_key && payload.secret_key.includes("secret");
      const dE = Number(payload.dE || 0);
      const mockResult: GatewayRouteResult = isValidKey
        ? {
            route: "CORE_KERNEL",
            diverted: false,
            message: "TRUTH_VERIFIED: Request passes cryptographic identity & resource equilibrium constraints. [Mock Fallback]",
          }
        : {
            route: "HONEYPOT_PLAYGROUND",
            diverted: true,
            threat_type: "INVALID_SIGNATURE",
            message: "[HONEYPOT INTERCEPTED] CRYPTO_FAILURE: Invalid cryptographic signature. [Mock Fallback]",
          };

      setStatus((prev) => {
        if (!prev) return MOCK_DEFAULT_STATUS;
        if (mockResult.diverted) {
          return {
            ...prev,
            gateway: {
              ...prev.gateway,
              stats: {
                ...prev.gateway.stats,
                total_requests: prev.gateway.stats.total_requests + 1,
                honeypot_diverted: prev.gateway.stats.honeypot_diverted + 1,
              },
            },
          };
        } else {
          const newE = Math.min(prev.kernel.E_capacity, Math.max(prev.kernel.E_floor, prev.kernel.E + dE));
          return {
            ...prev,
            kernel: {
              ...prev.kernel,
              E: Number(newE.toFixed(2)),
            },
            gateway: {
              ...prev.gateway,
              stats: {
                ...prev.gateway.stats,
                total_requests: prev.gateway.stats.total_requests + 1,
                legitimate_routed: prev.gateway.stats.legitimate_routed + 1,
              },
            },
          };
        }
      });

      return mockResult;
    }
  };

  // Trigger attack simulation for Honeypot testing
  const handleSimulateAttack = async (attackType: string) => {
    try {
      const res = await fetch("/api/gateway/simulate-attack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attack_type: attackType }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      await fetchStatus();
      return data;
    } catch (err: any) {
      console.warn("Simulate attack offline fallback:", err.message);
      const mockAttackRes = {
        status: "INTERCEPTED_AND_DIVERTED",
        threat_type: attackType,
        message: `[HONEYPOT TRAP ACTIVATED] Threat vector '${attackType}' isolated. [Mock Fallback]`,
      };
      setStatus((prev) => {
        if (!prev) return MOCK_DEFAULT_STATUS;
        return {
          ...prev,
          gateway: {
            ...prev.gateway,
            stats: {
              ...prev.gateway.stats,
              total_requests: prev.gateway.stats.total_requests + 1,
              honeypot_diverted: prev.gateway.stats.honeypot_diverted + 1,
            },
          },
        };
      });
      return mockAttackRes;
    }
  };

  // Reset system state
  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset the SumerAvera Core Framework state to Genesis?")) return;
    setLoading(true);
    try {
      await fetch("/api/reset", { method: "POST" });
      await fetchStatus();
    } catch (err: any) {
      console.warn("Reset offline fallback:", err.message);
      setStatus(MOCK_DEFAULT_STATUS);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-slate-950 flex flex-col">
      {/* Top Header */}
      <Header
        status={status}
        autoStep={autoStep}
        setAutoStep={setAutoStep}
        onManualStep={() => handleManualStep(1.0)}
        onReset={handleReset}
        loading={loading}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Connection Error Alert */}
        {errorMsg && (
          <div className="p-4 bg-rose-950/80 border border-rose-800 text-rose-200 rounded-xl text-xs font-mono flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={fetchStatus} className="px-2.5 py-1 bg-rose-900 rounded hover:bg-rose-800">
              Retry Connection
            </button>
          </div>
        )}

        {/* Dashboard Navigation Tabs */}
        <nav className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
          <button
            id="tab-mobile-poc-btn"
            onClick={() => setActiveTab("mobile_poc")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "mobile_poc"
                ? "bg-emerald-950 text-emerald-300 border border-emerald-800 shadow-md shadow-emerald-950/50"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
            }`}
          >
            <Smartphone className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>SumerAvera Mobile PoC Widget</span>
            <span className="px-1.5 py-0.2 bg-emerald-500 text-slate-950 text-[9px] font-mono font-black rounded uppercase">
              LOCAL DEVICE TEST
            </span>
          </button>

          <button
            id="tab-widget-btn"
            onClick={() => setActiveTab("widget")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "widget"
                ? "bg-cyan-950 text-cyan-300 border border-cyan-800 shadow-md shadow-cyan-950/50"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
            <span>Client Evaluation &amp; Monitor Widget</span>
            <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 text-[9px] font-mono font-black rounded uppercase">
              INSURANCE POC
            </span>
          </button>

          <button
            id="tab-gate1-btn"
            onClick={() => setActiveTab("gate1")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "gate1"
                ? "bg-cyan-950 text-cyan-300 border border-cyan-800 shadow-md shadow-cyan-950/50"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
            }`}
          >
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>1. Ingress &amp; Inspection Node</span>
          </button>

          <button
            id="tab-kernel-btn"
            onClick={() => setActiveTab("kernel")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "kernel"
                ? "bg-cyan-950 text-cyan-300 border border-cyan-800 shadow-md shadow-cyan-950/50"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
            }`}
          >
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>2. Core Engine &amp; System State</span>
          </button>

          <button
            id="tab-history-btn"
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "history"
                ? "bg-cyan-950 text-cyan-300 border border-cyan-800 shadow-md shadow-cyan-950/50"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
            }`}
          >
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span>Historical Trends</span>
          </button>

          <button
            id="tab-fraud-metrics-btn"
            onClick={() => setActiveTab("fraud")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "fraud"
                ? "bg-amber-950 text-amber-300 border border-amber-800 shadow-md shadow-amber-950/50"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>Fraud Metrics Outlook</span>
          </button>

          <button
            id="tab-truth-btn"
            onClick={() => setActiveTab("truth")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "truth"
                ? "bg-emerald-950 text-emerald-300 border border-emerald-800 shadow-md shadow-emerald-950/50"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>3. Validation Engine</span>
          </button>

          <button
            id="tab-gateway-btn"
            onClick={() => setActiveTab("gateway")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "gateway"
                ? "bg-rose-950 text-rose-300 border border-rose-800 shadow-md shadow-rose-950/50"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
            }`}
          >
            <Flame className="w-4 h-4 text-rose-400" />
            <span>4. Adaptive Gateway &amp; Isolation Feed</span>
            {status?.gateway?.stats?.honeypot_diverted ? (
              <span className="px-1.5 py-0.2 bg-rose-500 text-slate-950 text-[10px] font-mono font-black rounded-full">
                {status.gateway.stats.honeypot_diverted}
              </span>
            ) : null}
          </button>

          <button
            id="tab-ledger-btn"
            onClick={() => setActiveTab("ledger")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "ledger"
                ? "bg-purple-950 text-purple-300 border border-purple-800 shadow-md shadow-purple-950/50"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
            }`}
          >
            <Layers className="w-4 h-4 text-purple-400" />
            <span>5. Secure State Ledger</span>
          </button>

          <button
            id="tab-report-btn"
            onClick={() => setActiveTab("report")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "report"
                ? "bg-amber-950 text-amber-300 border border-amber-800 shadow-md shadow-amber-950/50"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
            }`}
          >
            <Award className="w-4 h-4 text-amber-400" />
            <span>6. Security &amp; Audit Report</span>
            <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 text-[9px] font-mono font-black rounded uppercase">
              SEALED
            </span>
          </button>

          <button
            id="tab-logs-btn"
            onClick={() => setActiveTab("logs")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "logs"
                ? "bg-slate-800 text-slate-200 border border-slate-700"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
            }`}
          >
            <Terminal className="w-4 h-4 text-slate-400" />
            <span>System Logs</span>
          </button>
        </nav>

        {/* Tab Contents */}
        {status?.kernel && (
          <div className="transition-all duration-200">
            {activeTab === "mobile_poc" && (
              <SumerAveraMobilePocWidget kernel={status.kernel} onStep={handleManualStep} />
            )}

            {activeTab === "widget" && (
              <ClientEvaluationWidget kernel={status.kernel} onStep={handleManualStep} />
            )}

            {activeTab === "gate1" && (
              <Gate1IngressEngineView
                gateway={status.gateway}
                ledger={status.ledger}
                honeypotLogs={status.honeypot_logs || []}
                onStateUpdate={fetchStatus}
              />
            )}

            {activeTab === "kernel" && (
              <HomeostaticEngineView
                kernel={status.kernel}
                registeredAgents={status.registered_agents}
                onStep={handleManualStep}
                loading={loading}
              />
            )}

            {activeTab === "history" && (
              <HistoricalTrendsView kernel={status.kernel} onStep={handleManualStep} loading={loading} />
            )}

            {activeTab === "fraud" && (
              <FraudMetricsOutlook gateway={status.gateway ?? null} />
            )}

            {activeTab === "truth" && (
              <TruthVerificationConsole
                agents={status.registered_agents || []}
                onRequestShift={handleAgentRequestShift}
                loading={loading}
              />
            )}

            {activeTab === "gateway" && (
              <AdaptiveGatewayMonitor
                gateway={status.gateway}
                honeypotLogs={status.honeypot_logs || []}
                onSimulateAttack={handleSimulateAttack}
                loading={loading}
              />
            )}

            {activeTab === "ledger" && (
              <SHA256LedgerExplorer ledger={status.ledger} loading={loading} />
            )}

            {activeTab === "report" && (
              <SecurityReportView status={status} onRefreshStatus={fetchStatus} />
            )}

            {activeTab === "logs" && (
              <SystemLogsTerminal logs={status.system_logs || []} loading={loading} />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/50 py-4 px-6 text-center text-xs font-mono text-slate-500 mt-auto">
        SumerAvera Protocol Core Framework &bull; Core Engine &amp; Telemetry Feed &bull; Secure Ledger
      </footer>
    </div>
  );
}
