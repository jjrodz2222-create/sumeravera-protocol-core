import React from "react";
import { SumerAveraStatus } from "../types";
import { Shield, ShieldAlert, Cpu, Activity, RefreshCw, Play, Pause, Layers, Radio } from "lucide-react";

interface HeaderProps {
  status: SumerAveraStatus | null;
  autoStep: boolean;
  setAutoStep: (val: boolean) => void;
  onManualStep: () => void;
  onReset: () => void;
  loading: boolean;
}


export const Header: React.FC<HeaderProps> = ({
  status,
  autoStep,
  setAutoStep,
  onManualStep,
  onReset,
  loading,
}) => {
  const kernel = status?.kernel;
  const ledger = status?.ledger;

  const statusColor =
    kernel?.homeostasis_status === "STABLE"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      : kernel?.homeostasis_status === "DEGRADED"
      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
      : "bg-rose-500/10 text-rose-400 border-rose-500/30";

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40 backdrop-blur-md bg-slate-900/90 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Title & Protocol Status */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-950 border border-cyan-800/60 rounded-xl text-cyan-400 shadow-lg shadow-cyan-950/50">
            <Cpu className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
                SumerAvera Protocol
              </h1>
              <span className="text-xs font-mono px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 rounded">
                v2.4 Core Framework
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              SumerAvera Operational Management Console
            </p>
          </div>
        </div>

        {/* Real-time Status Badges & Simulation Controls */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Homeostasis Status */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold font-mono ${statusColor}`}>
            <Activity className="w-4 h-4" />
            <span>
              STATUS: {kernel?.homeostasis_status || "INITIALIZING"}
            </span>
          </div>

          {/* Ledger Integrity */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/70 text-xs font-mono text-slate-300">
            {ledger?.integrity ? (
              <Shield className="w-4 h-4 text-emerald-400" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-400 animate-bounce" />
            )}
            <span>
              SECURE LEDGER: {ledger?.integrity ? "SECURE" : "CORRUPTED"} ({ledger?.length || 0} BLOCKS)
            </span>
          </div>

          {/* Live Ingress Ingress Route Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/80 border border-cyan-800/80 text-xs font-mono text-cyan-300">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>INGRESS: /ws/ingress &bull; /api/v1/ingress</span>
          </div>

          {/* Lotka Volterra Time Step */}

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/70 text-xs font-mono text-cyan-300">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>T={kernel?.time_step || 0} STEPS</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
            <button
              id="header-manual-step-btn"
              onClick={onManualStep}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-medium text-xs shadow-md transition disabled:opacity-50"
              title="Advance State"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Step</span>
            </button>

            <button
              id="header-autostep-toggle-btn"
              onClick={() => setAutoStep(!autoStep)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium text-xs transition ${
                autoStep
                  ? "bg-emerald-600/20 border-emerald-500/50 text-emerald-300"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {autoStep ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Auto Live</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-slate-400" />
                  <span>Auto Off</span>
                </>
              )}
            </button>

            <button
              id="header-reset-btn"
              onClick={onReset}
              disabled={loading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition"
              title="Reset Core State to Genesis"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
