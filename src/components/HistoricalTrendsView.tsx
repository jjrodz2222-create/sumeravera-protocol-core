import React, { useState, useEffect, useCallback, useMemo } from "react";
import { KernelState, HistoricalDataPoint, HistoricalTimeframe } from "../types";
import {
  Globe,
  Droplets,
  Flame,
  Sparkles,
  Feather,
  TrendingUp,
  Clock,
  Download,
  RefreshCw,
  Activity,
  Layers,
  Filter,
  CheckCircle2,
  Sliders,
  ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

interface HistoricalTrendsViewProps {
  kernel: KernelState;
  onStep?: (dt?: number) => void;
  loading?: boolean;
}

const QUINTET_SERIES_CONFIG = [
  { key: "bio", label: "Node Alpha (Node-A)", color: "#10b981", icon: Globe },
  { key: "art", label: "Node Beta (Node-B)", color: "#ec4899", icon: Feather },
  { key: "spirit", label: "Node Gamma (Node-C)", color: "#a855f7", icon: Sparkles },
  { key: "water", label: "Node Delta (Node-D)", color: "#06b6d4", icon: Droplets },
  { key: "energy", label: "Node Epsilon (Node-E)", color: "#f59e0b", icon: Flame },
  { key: "H_overall_index", label: "H Overall Index", color: "#6366f1", icon: Activity, dashed: true },
];

export const HistoricalTrendsView: React.FC<HistoricalTrendsViewProps> = ({
  kernel,
  onStep,
  loading = false,
}) => {
  const [timeframe, setTimeframe] = useState<HistoricalTimeframe>("hour");
  const [dataPoints, setDataPoints] = useState<HistoricalDataPoint[]>([]);
  const [sessionPoints, setSessionPoints] = useState<HistoricalDataPoint[]>([]);
  const [isFetchingHistory, setIsFetchingHistory] = useState<boolean>(false);
  const [selectedFacets, setSelectedFacets] = useState<Record<string, boolean>>({
    bio: true,
    art: true,
    spirit: true,
    water: true,
    energy: true,
    H_overall_index: true,
  });
  const [showThresholds, setShowThresholds] = useState<boolean>(true);

  // Generate synthetic fallback history when offline
  const generateFallbackHistory = useCallback(
    (period: HistoricalTimeframe): HistoricalDataPoint[] => {
      const now = Date.now();
      let count = 60;
      let stepMs = 60 * 1000;

      if (period === "day") {
        count = 24;
        stepMs = 60 * 60 * 1000;
      } else if (period === "week") {
        count = 28;
        stepMs = 6 * 60 * 60 * 1000;
      } else if (period === "session") {
        return sessionPoints.length > 0
          ? sessionPoints
          : [
              {
                timestamp: Math.floor(now / 1000),
                timeFormatted: new Date().toLocaleTimeString(),
                timeLabel: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                E: kernel.E,
                bio: kernel.Quintet.bio,
                art: kernel.Quintet.art,
                spirit: kernel.Quintet.spirit,
                water: kernel.Quintet.water,
                energy: kernel.Quintet.energy,
                H_overall_index: kernel.H_overall_index,
                time_step: kernel.time_step,
              },
            ];
      }

      const points: HistoricalDataPoint[] = [];
      const baseE = kernel.E;
      const baseH = kernel.Quintet;

      for (let i = count - 1; i >= 0; i--) {
        const tsMs = now - i * stepMs;
        const d = new Date(tsMs);
        let timeLabel = "";

        if (period === "week") {
          timeLabel = `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${d.getHours()}:00`;
        } else if (period === "day") {
          timeLabel = `${d.getHours().toString().padStart(2, "0")}:00`;
        } else {
          timeLabel = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        }

        const offset = i * 0.18;
        const eVal = Math.max(
          kernel.E_floor + 10,
          Math.min(kernel.E_capacity - 10, Number((baseE + Math.sin(offset) * 22 + Math.cos(offset * 0.5) * 14 - i * 0.3).toFixed(2)))
        );

        const bio = Math.max(10, Math.min(98, Number((baseH.bio + Math.sin(offset * 0.8) * 5.2).toFixed(2))));
        const art = Math.max(10, Math.min(98, Number((baseH.art + Math.cos(offset * 0.7) * 4.1).toFixed(2))));
        const spirit = Math.max(10, Math.min(98, Number((baseH.spirit + Math.sin(offset * 0.9 + 1) * 4.5).toFixed(2))));
        const water = Math.max(10, Math.min(98, Number((baseH.water + Math.cos(offset * 1.1) * 5.8).toFixed(2))));
        const energy = Math.max(10, Math.min(98, Number((baseH.energy + Math.sin(offset * 0.6 + 2) * 4.9).toFixed(2))));
        const hOverall = Number(((bio + art + spirit + water + energy) / 5).toFixed(2));

        points.push({
          timestamp: Math.floor(tsMs / 1000),
          timeFormatted: d.toLocaleString(),
          timeLabel,
          E: eVal,
          bio,
          art,
          spirit,
          water,
          energy,
          H_overall_index: hOverall,
          time_step: Math.max(0, kernel.time_step - i),
        });
      }

      return points;
    },
    [kernel, sessionPoints]
  );

  // Fetch historical data from API
  const fetchHistory = useCallback(
    async (period: HistoricalTimeframe) => {
      if (period === "session") {
        setDataPoints(sessionPoints);
        return;
      }

      setIsFetchingHistory(true);
      try {
        const res = await fetch(`/api/history?period=${period}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && Array.isArray(data.history) && data.history.length > 0) {
          setDataPoints(data.history);
        } else {
          setDataPoints(generateFallbackHistory(period));
        }
      } catch (err) {
        console.warn("History fetch API fallback notice:", err);
        setDataPoints(generateFallbackHistory(period));
      } finally {
        setIsFetchingHistory(false);
      }
    },
    [generateFallbackHistory, sessionPoints]
  );

  useEffect(() => {
    fetchHistory(timeframe);
  }, [timeframe, fetchHistory]);

  // Keep live session history appended as kernel changes
  useEffect(() => {
    const newPoint: HistoricalDataPoint = {
      timestamp: Math.floor(Date.now() / 1000),
      timeFormatted: new Date().toLocaleTimeString(),
      timeLabel: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      E: kernel.E,
      bio: kernel.Quintet.bio,
      art: kernel.Quintet.art,
      spirit: kernel.Quintet.spirit,
      water: kernel.Quintet.water,
      energy: kernel.Quintet.energy,
      H_overall_index: kernel.H_overall_index,
      time_step: kernel.time_step,
    };

    setSessionPoints((prev) => {
      // Don't append exact duplicate timestamps
      if (prev.length > 0 && prev[prev.length - 1].time_step === newPoint.time_step) {
        return prev;
      }
      const updated = [...prev, newPoint];
      // Keep up to last 100 live session steps
      return updated.slice(-100);
    });
  }, [kernel]);

  const activePoints = useMemo(() => {
    if (timeframe === "session") {
      return sessionPoints.length > 0 ? sessionPoints : [
        {
          timestamp: Math.floor(Date.now() / 1000),
          timeFormatted: new Date().toLocaleTimeString(),
          timeLabel: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          E: kernel.E,
          bio: kernel.Quintet.bio,
          art: kernel.Quintet.art,
          spirit: kernel.Quintet.spirit,
          water: kernel.Quintet.water,
          energy: kernel.Quintet.energy,
          H_overall_index: kernel.H_overall_index,
          time_step: kernel.time_step,
        }
      ];
    }
    return dataPoints;
  }, [timeframe, dataPoints, sessionPoints, kernel]);

  // Key Statistics over selected period
  const stats = useMemo(() => {
    if (!activePoints || activePoints.length === 0) {
      return {
        eAvg: kernel.E,
        eMin: kernel.E,
        eMax: kernel.E,
        eDelta: 0,
        hAvg: kernel.H_overall_index,
        hMin: kernel.H_overall_index,
        hMax: kernel.H_overall_index,
        hDelta: 0,
      };
    }

    const eValues = activePoints.map((p) => p.E);
    const hValues = activePoints.map((p) => p.H_overall_index);

    const firstE = eValues[0];
    const lastE = eValues[eValues.length - 1];
    const eDelta = firstE !== 0 ? ((lastE - firstE) / firstE) * 100 : 0;

    const firstH = hValues[0];
    const lastH = hValues[hValues.length - 1];
    const hDelta = firstH !== 0 ? ((lastH - firstH) / firstH) * 100 : 0;

    const eAvg = eValues.reduce((a, b) => a + b, 0) / eValues.length;
    const hAvg = hValues.reduce((a, b) => a + b, 0) / hValues.length;

    return {
      eAvg: Number(eAvg.toFixed(1)),
      eMin: Number(Math.min(...eValues).toFixed(1)),
      eMax: Number(Math.max(...eValues).toFixed(1)),
      eDelta: Number(eDelta.toFixed(2)),
      hAvg: Number(hAvg.toFixed(1)),
      hMin: Number(Math.min(...hValues).toFixed(1)),
      hMax: Number(Math.max(...hValues).toFixed(1)),
      hDelta: Number(hDelta.toFixed(2)),
    };
  }, [activePoints, kernel]);

  const toggleFacet = (key: string) => {
    setSelectedFacets((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleExportCSV = () => {
    if (!activePoints || activePoints.length === 0) return;
    const headers = ["Timestamp", "Formatted_Time", "Time_Step", "Earth_Capacity_E", "Bio", "Art", "Spirit", "Water", "Energy", "H_Overall_Index"];
    const csvRows = [headers.join(",")];

    activePoints.forEach((pt) => {
      csvRows.push([
        pt.timestamp,
        `"${pt.timeFormatted}"`,
        pt.time_step ?? "",
        pt.E,
        pt.bio,
        pt.art,
        pt.spirit,
        pt.water,
        pt.energy,
        pt.H_overall_index,
      ].join(","));
    });

    const csvBlob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(csvBlob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `SumerAvera_Historical_Trends_${timeframe}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header & Timeframe Selector Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Historical Trajectories &amp; Multi-Facet Trend Analytics
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Continuous time-series tracking of Operational Capacity and System Metrics.
          </p>
        </div>

        {/* Timeframe Buttons & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-950 p-1 border border-slate-800 rounded-xl flex items-center text-xs font-mono">
            {(
              [
                { id: "hour", label: "Last Hour (60m)" },
                { id: "day", label: "Last Day (24h)" },
                { id: "week", label: "Last Week (7d)" },
                { id: "session", label: `Live Session (${sessionPoints.length})` },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setTimeframe(item.id)}
                className={`px-3 py-1.5 rounded-lg transition font-bold flex items-center gap-1 cursor-pointer ${
                  timeframe === item.id
                    ? "bg-cyan-600 text-slate-950 shadow font-black"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchHistory(timeframe)}
            disabled={isFetchingHistory}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition border border-slate-700 cursor-pointer disabled:opacity-50"
            title="Refresh Historical Data"
          >
            <RefreshCw className={`w-4 h-4 ${isFetchingHistory ? "animate-spin text-cyan-400" : ""}`} />
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            title="Export CSV Dataset"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
        {/* E Avg & Delta */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>E(t) Mean Capacity</span>
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="my-1.5 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-slate-50">{stats.eAvg.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400">E_units</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-1.5 mt-1">
            <span>Range: {stats.eMin} - {stats.eMax}</span>
            <span className={`font-bold ${stats.eDelta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {stats.eDelta >= 0 ? "+" : ""}{stats.eDelta}%
            </span>
          </div>
        </div>

        {/* H Avg & Delta */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>H(t) Equilibrium Index</span>
            <Activity className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="my-1.5 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-purple-300">{stats.hAvg}</span>
            <span className="text-[10px] text-slate-400">/ 100</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-1.5 mt-1">
            <span>Range: {stats.hMin} - {stats.hMax}</span>
            <span className={`font-bold ${stats.hDelta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {stats.hDelta >= 0 ? "+" : ""}{stats.hDelta}%
            </span>
          </div>
        </div>

        {/* Active Timeframe Span */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Sampled Period</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="my-1.5 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-slate-100">{activePoints.length}</span>
            <span className="text-[10px] text-slate-400">Data Points</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-1.5 mt-1">
            <span>Window: {timeframe.toUpperCase()}</span>
            <span className="text-cyan-400 font-bold">100% Synced</span>
          </div>
        </div>

        {/* Step Trigger Card */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg flex flex-col justify-between">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Simulation Step</span>
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <button
            onClick={() => onStep && onStep(1.0)}
            disabled={loading}
            className="w-full py-2 my-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black rounded-lg transition shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Advance Step (+1 dt)</span>
          </button>
          <div className="text-[10px] text-slate-500 text-center truncate">
            Current Step: #{kernel.time_step}
          </div>
        </div>
      </div>

      {/* CHART 1: Earth Carrying Capacity E(t) Line & Area Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-100 font-mono">
                Earth Carrying Capacity <span className="text-cyan-400">E(t)</span> Historical Trend
              </h3>
              <p className="text-xs text-slate-400">
                System capacity metrics against ecological floor ({kernel.E_floor}) and limit ({kernel.E_capacity})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 flex items-center gap-1.5 cursor-pointer font-mono">
              <input
                type="checkbox"
                checked={showThresholds}
                onChange={(e) => setShowThresholds(e.target.checked)}
                className="rounded border-slate-700 text-cyan-600 focus:ring-0 bg-slate-950"
              />
              <span>Show Thresholds &amp; Mean</span>
            </label>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activePoints} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="eCapacityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis dataKey="timeLabel" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis domain={[0, 2000]} stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", color: "#f8fafc" }}
                formatter={(val: number) => [`${val.toFixed(1)} E_units`, "Earth Capacity E(t)"]}
                labelFormatter={(lbl, items) => {
                  const pt = items && items[0] ? (items[0].payload as HistoricalDataPoint) : null;
                  return pt ? `${pt.timeFormatted} (Step #${pt.time_step ?? "?"})` : lbl;
                }}
              />
              {showThresholds && (
                <>
                  <ReferenceLine y={kernel.E_capacity} label={{ value: "Max Capacity (2,000)", fill: "#22d3ee", fontSize: 10, position: "top" }} stroke="#0891b2" strokeDasharray="4 4" />
                  <ReferenceLine y={kernel.E_floor} label={{ value: "Ecological Floor (100)", fill: "#f43f5e", fontSize: 10, position: "bottom" }} stroke="#f43f5e" strokeDasharray="4 4" />
                  <ReferenceLine y={stats.eAvg} label={{ value: `Mean (${stats.eAvg})`, fill: "#94a3b8", fontSize: 10, position: "insideRight" }} stroke="#64748b" strokeDasharray="2 2" />
                </>
              )}
              <Area type="monotone" dataKey="E" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#eCapacityGrad)" name="Earth Capacity E(t)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* CHART 2: Quintet of Equilibrium H(t) Multi-Series Line Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-100 font-mono">
                Quintet of Equilibrium <span className="text-purple-400">H(t)</span> Multi-Series Trajectories
              </h3>
              <p className="text-xs text-slate-400">
                Comparative historical performance across all 5 interlocked equilibrium facets (Scale: 0 - 100)
              </p>
            </div>
          </div>

          {/* Facet Toggles */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-mono text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-cyan-400" /> Toggle:
            </span>
            {QUINTET_SERIES_CONFIG.map((cfg) => {
              const active = selectedFacets[cfg.key];
              return (
                <button
                  key={cfg.key}
                  onClick={() => toggleFacet(cfg.key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                    active
                      ? "bg-slate-800 text-slate-100 border-slate-700 shadow"
                      : "bg-slate-950 text-slate-500 border-slate-900 opacity-60"
                  }`}
                  style={{ borderColor: active ? cfg.color : undefined }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: active ? cfg.color : "#64748b" }} />
                  <span>{cfg.label.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={activePoints} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis dataKey="timeLabel" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", color: "#f8fafc" }}
                formatter={(val: number, name: string) => [`${val.toFixed(1)} / 100`, name]}
                labelFormatter={(lbl, items) => {
                  const pt = items && items[0] ? (items[0].payload as HistoricalDataPoint) : null;
                  return pt ? `${pt.timeFormatted} (Step #${pt.time_step ?? "?"})` : lbl;
                }}
              />
              <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }} />
              <ReferenceLine y={75} label={{ value: "Target Equilibrium (75)", fill: "#a855f7", fontSize: 10, position: "top" }} stroke="#a855f7" strokeDasharray="3 3" />

              {QUINTET_SERIES_CONFIG.map((cfg) => {
                if (!selectedFacets[cfg.key]) return null;
                return (
                  <Line
                    key={cfg.key}
                    type="monotone"
                    dataKey={cfg.key}
                    name={cfg.label}
                    stroke={cfg.color}
                    strokeWidth={cfg.key === "H_overall_index" ? 3 : 2}
                    strokeDasharray={cfg.dashed ? "4 4" : undefined}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* CHART GRID 3: Individual Facet Isolated Sparkline Cards */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-purple-400" />
          <span>Isolated Component Trend Breakdowns</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {QUINTET_SERIES_CONFIG.filter((c) => c.key !== "H_overall_index").map((cfg) => {
            const Icon = cfg.icon;
            const currentVal = kernel.Quintet[cfg.key as keyof typeof kernel.Quintet] || 0;
            const facetValues = activePoints.map((p) => (p[cfg.key as keyof HistoricalDataPoint] as number) || 0);
            const minVal = facetValues.length > 0 ? Math.min(...facetValues).toFixed(1) : currentVal.toFixed(1);
            const maxVal = facetValues.length > 0 ? Math.max(...facetValues).toFixed(1) : currentVal.toFixed(1);
            const firstVal = facetValues.length > 0 ? facetValues[0] : currentVal;
            const delta = firstVal !== 0 ? (((currentVal - firstVal) / firstVal) * 100).toFixed(1) : "0.0";

            return (
              <div
                key={cfg.key}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between font-mono space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{cfg.key}</span>
                    <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-2xl font-black text-slate-100">{currentVal.toFixed(1)}</span>
                    <span className={`text-xs font-bold ${Number(delta) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {Number(delta) >= 0 ? "+" : ""}{delta}%
                    </span>
                  </div>
                </div>

                {/* Sparkline Chart */}
                <div className="h-20 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={activePoints}>
                      <Line type="monotone" dataKey={cfg.key} stroke={cfg.color} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-800 pt-2">
                  <span>Min: {minVal}</span>
                  <span>Max: {maxVal}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
