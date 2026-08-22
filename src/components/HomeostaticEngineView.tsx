import React, { useState, useEffect } from "react";
import { KernelState, AgentInfo } from "../types";
import { Globe, Droplets, Flame, Sparkles, Feather, HeartHandshake, TrendingUp, Sliders, Zap, Scale, Activity, RefreshCw, AlertTriangle, ShieldAlert, Bell, Settings, Volume2 } from "lucide-react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { HistoricalTrendsView } from "./HistoricalTrendsView";
import { EThresholdConfigModal, EThresholdConfig, DEFAULT_E_THRESHOLDS } from "./EThresholdConfigModal";
import { KernelHealthSummaryRow } from "./KernelHealthSummaryRow";

interface HomeostaticEngineViewProps {
  kernel: KernelState;
  onStep: (dt?: number) => void;
  loading: boolean;
  registeredAgents?: AgentInfo[];
}

const QUINTET_CONFIG = [
  { key: "bio", label: "Primary Node Alpha (Node-A)", icon: Globe, color: "#10b981", bgClass: "from-emerald-500/20 to-emerald-950/30 border-emerald-500/30" },
  { key: "art", label: "Primary Node Beta (Node-B)", icon: Feather, color: "#ec4899", bgClass: "from-pink-500/20 to-pink-950/30 border-pink-500/30" },
  { key: "spirit", label: "Primary Node Gamma (Node-C)", icon: Sparkles, color: "#a855f7", bgClass: "from-purple-500/20 to-purple-950/30 border-purple-500/30" },
  { key: "water", label: "Primary Node Delta (Node-D)", icon: Droplets, color: "#06b6d4", bgClass: "from-cyan-500/20 to-cyan-950/30 border-cyan-500/30" },
  { key: "energy", label: "Primary Node Epsilon (Node-E)", icon: Flame, color: "#f59e0b", bgClass: "from-amber-500/20 to-amber-950/30 border-amber-500/30" },
];

export const HomeostaticEngineView: React.FC<HomeostaticEngineViewProps> = ({
  kernel,
  onStep,
  loading,
  registeredAgents = [],
}) => {
  const [pulsing, setPulsing] = useState<boolean>(false);
  const [pulseMessage, setPulseMessage] = useState<string | null>(null);

  // E Value Alert Threshold State & LocalStorage Persistence
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const [thresholds, setThresholds] = useState<EThresholdConfig>(() => {
    try {
      const saved = localStorage.getItem("sumeravera_e_thresholds");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // fallback
    }
    return DEFAULT_E_THRESHOLDS;
  });

  const handleSaveThresholds = (newConfig: EThresholdConfig) => {
    setThresholds(newConfig);
    try {
      localStorage.setItem("sumeravera_e_thresholds", JSON.stringify(newConfig));
    } catch (e) {
      console.warn("Could not save thresholds to localStorage", e);
    }
  };

  const balancer = kernel.balancer || {
    quintet_variance: 22.8,
    quintet_stdev: 4.77,
    homeostatic_pressure: 1.14,
    coupling_synergy_index: 84.5,
    auto_rebalance_active: true,
    coupling_factor: 1.0,
    dampening_rate: 0.025,
    cross_facet_matrix: {
      water: { bio: 0.14, energy: 0.08 },
      energy: { water: 0.12, bio: 0.06 },
      bio: { spirit: 0.10, water: 0.08 },
      art: { spirit: 0.16, bio: 0.05 },
      spirit: { art: 0.12, spirit: 0.02 },
    },
  };

  const handleEqualizerPulse = async () => {
    setPulsing(true);
    setPulseMessage(null);
    try {
      const res = await fetch("/api/balancer/rebalance", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setPulseMessage(`Equalizer pulse applied! Shifts: ${data.equalizer_result?.equalizer_shifts_applied || 5}`);
      }
      onStep();
    } catch (err: any) {
      console.warn("Equalizer pulse offline fallback");
      setPulseMessage("Equalizer pulse simulated (counter-balancing feedback vector executed).");
      onStep();
    } finally {
      setTimeout(() => setPulsing(false), 800);
    }
  };

  const handleToggleAutoRebalance = async () => {
    try {
      await fetch("/api/balancer/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_rebalance_enabled: !balancer.auto_rebalance_active }),
      });
      onStep();
    } catch (err) {
      console.warn("Balancer config update offline notice");
      onStep();
    }
  };

  // E Value Threshold Calculations
  const ePercent = Math.min(100, Math.max(0, (kernel.E / kernel.E_capacity) * 100));
  const warningE = (thresholds.warningPercent / 100) * kernel.E_capacity;
  const criticalE = (thresholds.criticalPercent / 100) * kernel.E_capacity;
  const lowFloorE = kernel.E_floor + thresholds.lowFloorMargin;

  const isCritical = kernel.E >= criticalE;
  const isWarning = kernel.E >= warningE && !isCritical;
  const isLowFloor = kernel.E <= lowFloorE;

  const radarData = Object.entries(kernel.Quintet).map(([key, val]) => {
    const config = QUINTET_CONFIG.find((c) => c.key === key);
    return {
      facet: config?.label.split(" ")[0] || key,
      value: val,
      fullMark: 100,
    };
  });

  const barData = Object.entries(kernel.Quintet).map(([key, val]) => {
    const config = QUINTET_CONFIG.find((c) => c.key === key);
    return {
      name: config?.label.split(" ")[0] || key,
      value: val,
      color: config?.color || "#3b82f6",
    };
  });

  return (
    <div className="space-y-6">
      {/* Real-Time Core Health Metrics Summary Row */}
      <KernelHealthSummaryRow
        kernel={kernel}
        registeredAgents={registeredAgents}
        loading={loading}
      />

      {/* High-Visibility Visual Warning Banner when Thresholds Breached */}
      {thresholds.enableVisualAlerts && (isCritical || isWarning || isLowFloor) && (
        <div
          className={`p-4 rounded-2xl border font-mono text-xs shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-fade-in ${
            isCritical
              ? "bg-rose-950/80 border-rose-500/80 text-rose-200 shadow-rose-950/40 animate-pulse"
              : isWarning
              ? "bg-amber-950/80 border-amber-500/80 text-amber-200 shadow-amber-950/30"
              : "bg-cyan-950/80 border-cyan-500/80 text-cyan-200 shadow-cyan-950/30"
          }`}
        >
          <div className="flex items-start md:items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border shrink-0 ${
                isCritical
                  ? "bg-rose-500/20 border-rose-500 text-rose-400"
                  : isWarning
                  ? "bg-amber-500/20 border-amber-500 text-amber-400"
                  : "bg-cyan-500/20 border-cyan-500 text-cyan-400"
              }`}
            >
              {isCritical ? (
                <ShieldAlert className="w-6 h-6 text-rose-400 animate-bounce" />
              ) : isWarning ? (
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              ) : (
                <Bell className="w-6 h-6 text-cyan-400" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold uppercase tracking-wider text-sm">
                  {isCritical
                    ? "CRITICAL CAPACITY ALERT EXCEEDED"
                    : isWarning
                    ? "SYSTEM CAPACITY WARNING LEVEL"
                    : "OPERATIONAL FLOOR MARGIN WARNING"}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isCritical
                      ? "bg-rose-500 text-slate-950"
                      : isWarning
                      ? "bg-amber-400 text-slate-950"
                      : "bg-cyan-400 text-slate-950"
                  }`}
                >
                  E = {kernel.E.toFixed(1)} / {kernel.E_capacity} ({ePercent.toFixed(1)}%)
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 font-sans">
                {isCritical
                  ? `System E value has breached the user-configured critical threshold of ${thresholds.criticalPercent}% (${criticalE.toFixed(0)} E_units). Immediate load dampening or rebalancing advised.`
                  : isWarning
                  ? `System E value has reached warning threshold level of ${thresholds.warningPercent}% (${warningE.toFixed(0)} E_units).`
                  : `System E capacity is approaching operational floor margin (${lowFloorE.toFixed(0)} E_units).`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
            <button
              onClick={handleEqualizerPulse}
              disabled={pulsing}
              className="px-3.5 py-2 bg-gradient-to-r from-purple-600 via-cyan-600 to-purple-600 hover:from-purple-500 hover:to-cyan-500 text-white font-mono text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Equalizer Rebalance</span>
            </button>

            <button
              onClick={() => setIsConfigModalOpen(true)}
              className="px-3.5 py-2 bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-200 font-mono text-xs font-medium rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-cyan-400" />
              <span>Adjust Thresholds</span>
            </button>
          </div>
        </div>
      )}

      {/* Upper Grid: Earth Carrying Capacity & Quintet Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Earth Carrying Capacity E(t) Card */}
        <div
          className={`lg:col-span-5 bg-slate-900 border rounded-2xl p-5 shadow-xl flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${
            isCritical
              ? "border-rose-500/80 bg-rose-950/20 shadow-rose-950/40 animate-pulse"
              : isWarning
              ? "border-amber-500/80 bg-amber-950/20 shadow-amber-950/30"
              : isLowFloor
              ? "border-cyan-500/80 bg-cyan-950/20"
              : "border-slate-800"
          }`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-cyan-400" />
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span>Core Capacity Metric <span className="font-mono text-cyan-400">E(t)</span></span>
                  {isCritical && (
                    <span className="px-2 py-0.5 bg-rose-500/20 border border-rose-500/50 text-rose-300 text-[10px] font-mono font-bold rounded animate-pulse">
                      CRITICAL BREACH
                    </span>
                  )}
                  {isWarning && (
                    <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[10px] font-mono font-bold rounded">
                      WARNING LEVEL
                    </span>
                  )}
                </h2>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  id="btn-configure-e-thresholds"
                  onClick={() => setIsConfigModalOpen(true)}
                  className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500 text-cyan-300 text-xs font-mono font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Configure E(t) Alert Thresholds"
                >
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Alert Thresholds</span>
                </button>
              </div>
            </div>

            {/* Giant Metric Display */}
            <div className="my-4 flex items-baseline gap-3">
              <span
                className={`text-4xl sm:text-5xl font-black font-mono tracking-tight ${
                  isCritical ? "text-rose-300" : isWarning ? "text-amber-300" : "text-slate-50"
                }`}
              >
                {kernel.E.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </span>
              <span className="text-sm font-semibold font-mono text-slate-400">
                / {kernel.E_capacity} E_units
              </span>
            </div>

            {/* Capacity Progress Bar with Threshold Markers */}
            <div className="space-y-1.5 mb-5">
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span>Operational Floor ({kernel.E_floor})</span>
                <span className={`font-semibold ${isCritical ? "text-rose-400" : isWarning ? "text-amber-400" : "text-cyan-400"}`}>
                  {ePercent.toFixed(1)}% Capacity
                </span>
              </div>

              <div className="h-3.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800 relative">
                <div
                  className={`h-full rounded-full transition-all duration-500 shadow-sm ${
                    isCritical
                      ? "bg-rose-500"
                      : isWarning
                      ? "bg-amber-400"
                      : "bg-gradient-to-r from-emerald-500 via-cyan-400 to-amber-400"
                  }`}
                  style={{ width: `${ePercent}%` }}
                />

                {/* Threshold Marker Overlays on Bar */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-amber-400/80 z-10"
                  style={{ left: `${thresholds.warningPercent}%` }}
                  title={`Warn Threshold: ${thresholds.warningPercent}%`}
                />
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-rose-500/80 z-10"
                  style={{ left: `${thresholds.criticalPercent}%` }}
                  title={`Critical Threshold: ${thresholds.criticalPercent}%`}
                />
              </div>

              <div className="flex justify-between text-[10px] font-mono text-slate-500 pt-0.5">
                <span>Floor: {kernel.E_floor}</span>
                <span className="text-amber-400/90">Warn: {thresholds.warningPercent}% ({warningE.toFixed(0)} E)</span>
                <span className="text-rose-400/90">Crit: {thresholds.criticalPercent}% ({criticalE.toFixed(0)} E)</span>
                <span>Max: {kernel.E_capacity}</span>
              </div>
            </div>

            {/* Clean Capacity Summary */}
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 flex justify-between items-center">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-cyan-400" />
                <span>E(t) Threshold Alert System</span>
              </span>
              <button
                onClick={() => setIsConfigModalOpen(true)}
                className="text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer"
              >
                Warn @ {thresholds.warningPercent}% | Crit @ {thresholds.criticalPercent}%
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">System State Trajectory</span>
            <button
              onClick={() => onStep(1.0)}
              disabled={loading}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs rounded-lg transition shadow flex items-center gap-1.5"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Step Dynamics (+1 dt)</span>
            </button>
          </div>
        </div>

        {/* Quintet of Equilibrium H(t) Multi-Metric Radar & Gauge */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <HeartHandshake className="w-5 h-5 text-purple-400" />
              <h2 className="text-base font-bold text-slate-100">System Equilibrium Vector <span className="font-mono text-purple-400">H(t)</span></h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2.5 py-1 bg-purple-950/80 border border-purple-800/60 text-purple-300 rounded-lg font-bold">
                Overall Index: {kernel.H_overall_index} / 100
              </span>
            </div>
          </div>

          {/* Charts Row: Radar + Bar visualizer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center py-2">
            {/* Radar Chart */}
            <div className="h-56 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="facet" stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" tick={{ fill: "#64748b", fontSize: 9 }} />
                  <Radar name="Quintet Facet" dataKey="value" stroke="#a855f7" fill="#a855f7" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Bar Chart Breakdown */}
            <div className="h-56 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <XAxis type="number" domain={[0, 100]} stroke="#475569" tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" stroke="#94a3b8" tick={{ fill: "#cbd5e1", fontSize: 11 }} width={75} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", color: "#f8fafc" }}
                    formatter={(val: number) => [`${val.toFixed(1)} / 100`, "Equilibrium Index"]}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="text-xs font-mono text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <span>Equilibrium Status</span>
            <span className="text-purple-300">5 Facets Monitored</span>
          </div>
        </div>
      </div>

      {/* Quintet Facet Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {QUINTET_CONFIG.map((config) => {
          const Icon = config.icon;
          const val = kernel.Quintet[config.key as keyof typeof kernel.Quintet] || 0;
          return (
            <div
              key={config.key}
              className={`bg-gradient-to-b ${config.bgClass} bg-slate-900 border rounded-xl p-4 shadow-md flex flex-col justify-between relative`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{config.key}</span>
                  <Icon className="w-4 h-4" style={{ color: config.color }} />
                </div>
                <div className="text-2xl font-black font-mono text-slate-100">
                  {val.toFixed(1)} <span className="text-xs font-normal text-slate-400">/ 100</span>
                </div>
              </div>

              <div className="mt-3">
                <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${val}%`, backgroundColor: config.color }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 truncate">{config.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded Balancer Dynamics & Cross-Facet Coupling Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold font-mono text-slate-100 uppercase tracking-wider">
                System Balancer Dynamics &amp; Cross-Facet Coupling
              </h3>
              <p className="text-xs text-slate-400 font-sans">
                Inter-facet feedback matrix &bull; System pressure dampener &bull; Dynamic equilibrium equalizer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleAutoRebalance}
              className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer ${
                balancer.auto_rebalance_active
                  ? "bg-emerald-950/80 border-emerald-700 text-emerald-300"
                  : "bg-slate-950 border-slate-800 text-slate-400"
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Auto-Rebalance: {balancer.auto_rebalance_active ? "ENABLED" : "DISABLED"}</span>
            </button>

            <button
              onClick={handleEqualizerPulse}
              disabled={pulsing}
              className="px-4 py-1.5 bg-gradient-to-r from-purple-600 via-cyan-600 to-purple-600 hover:from-purple-500 hover:to-cyan-500 text-white font-mono text-xs font-black rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {pulsing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5 fill-current" />
              )}
              <span>Trigger Equalizer Pulse</span>
            </button>
          </div>
        </div>

        {pulseMessage && (
          <div className="p-2.5 bg-cyan-950/80 border border-cyan-800 text-cyan-200 text-xs font-mono rounded-xl animate-fade-in">
            {pulseMessage}
          </div>
        )}

        {/* 4 Balancer Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Quintet Variance / StDev</span>
            <p className="text-base font-black text-slate-100 mt-1">
              {balancer.quintet_variance.toFixed(1)} <span className="text-xs font-normal text-slate-400">(σ = {balancer.quintet_stdev.toFixed(2)})</span>
            </p>
            <span className="text-[10px] text-slate-500 mt-1 block">Spread between 5 facets</span>
          </div>

          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">System Pressure</span>
            <p className="text-base font-black text-amber-400 mt-1">
              {balancer.homeostatic_pressure.toFixed(2)} <span className="text-xs font-normal text-slate-400">P_units</span>
            </p>
            <span className="text-[10px] text-slate-500 mt-1 block">Entropy dampening force</span>
          </div>

          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Synergy Coupling Index</span>
            <p className="text-base font-black text-cyan-400 mt-1">
              {balancer.coupling_synergy_index.toFixed(1)} <span className="text-xs font-normal text-slate-400">/ 100</span>
            </p>
            <span className="text-[10px] text-slate-500 mt-1 block">Cross-facet alignment</span>
          </div>

          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Coupling &amp; Dampening</span>
            <p className="text-base font-black text-purple-400 mt-1">
              κ = {balancer.coupling_factor.toFixed(2)} &bull; μ = {balancer.dampening_rate.toFixed(3)}
            </p>
            <span className="text-[10px] text-slate-500 mt-1 block">Feedback coefficients</span>
          </div>
        </div>

        {/* Cross-Facet Coupling Matrix Breakdown */}
        <div className="space-y-2">
          <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-cyan-400" />
            <span>Cross-Facet Coupling Matrix (Interdependencies):</span>
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 font-mono text-xs">
            {Object.entries(balancer.cross_facet_matrix || {}).map(([source, targets]) => (
              <div key={source} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                <span className="text-cyan-400 font-bold uppercase text-[11px] block border-b border-slate-800 pb-1">
                  {source} → Facet
                </span>
                <div className="space-y-1 text-[11px]">
                  {Object.entries(targets).map(([target, weight]) => (
                    <div key={target} className="flex justify-between text-slate-300">
                      <span className="text-slate-400">{target}:</span>
                      <span className="text-emerald-400 font-bold">+{(weight * 100).toFixed(0)}% coupling</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Historical Data Trends & Line Chart Visualizations */}
      <div className="pt-4 border-t border-slate-800">
        <HistoricalTrendsView kernel={kernel} onStep={onStep} loading={loading} />
      </div>

      {/* Configuration Modal for Core Engine E Value Thresholds */}
      <EThresholdConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        eCapacity={kernel.E_capacity}
        eFloor={kernel.E_floor}
        currentE={kernel.E}
        thresholds={thresholds}
        onSave={handleSaveThresholds}
      />
    </div>
  );
};
