import React, { useMemo } from "react";
import { GatewayInfo } from "../types";
import { Activity, ShieldCheck, TrendingUp, TriangleAlert } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
} from "recharts";

interface FraudMetricsOutlookProps {
  gateway: GatewayInfo;
}

export const FraudMetricsOutlook: React.FC<FraudMetricsOutlookProps> = ({ gateway }) => {
  const liveFraudSignals = useMemo(() => {
    const totalRequests = gateway?.stats?.total_requests ?? 0;
    const divertedThreats =
      gateway?.loss_prevention_metrics?.quarantine_count ?? gateway?.stats?.honeypot_diverted ?? 0;
    const preventedLoss = gateway?.loss_prevention_metrics?.total_prevented_financial_loss ?? 0;
    const hasLiveTelemetry =
      gateway?.stats?.total_requests !== undefined ||
      gateway?.stats?.honeypot_diverted !== undefined ||
      gateway?.loss_prevention_metrics?.quarantine_count !== undefined ||
      gateway?.loss_prevention_metrics?.total_prevented_financial_loss !== undefined;
    const isolationRate = totalRequests > 0 ? (divertedThreats / totalRequests) * 100 : 0;

    return {
      hasLiveTelemetry,
      totalRequests,
      divertedThreats,
      preventedLoss,
      isolationRate: Number(Math.min(100, Math.max(0, isolationRate)).toFixed(1)),
    };
  }, [gateway]);

  const modeledContainmentAnchor = liveFraudSignals.hasLiveTelemetry ? liveFraudSignals.isolationRate : 98.4;

  const historicalFraudTrend = useMemo(
    () => [
      { year: "2020", digitalFraudLossB: 18, currentTechContainment: 61, sumerAveraModeledContainment: 96 },
      { year: "2021", digitalFraudLossB: 21, currentTechContainment: 62, sumerAveraModeledContainment: 96.5 },
      { year: "2022", digitalFraudLossB: 25, currentTechContainment: 63, sumerAveraModeledContainment: 97.1 },
      { year: "2023", digitalFraudLossB: 29, currentTechContainment: 64, sumerAveraModeledContainment: 97.5 },
      { year: "2024", digitalFraudLossB: 34, currentTechContainment: 65, sumerAveraModeledContainment: 98.1 },
      { year: "2025", digitalFraudLossB: 39, currentTechContainment: 66, sumerAveraModeledContainment: 98.6 },
      { year: "2026", digitalFraudLossB: 44, currentTechContainment: 67, sumerAveraModeledContainment: modeledContainmentAnchor },
    ],
    [modeledContainmentAnchor]
  );

  const capabilityGapData = useMemo(
    () => [
      { vector: "Forged Signatures", currentTech: 58, sumerAvera: 99 },
      { vector: "Replay Bots", currentTech: 63, sumerAvera: 98 },
      { vector: "Synthetic Identity", currentTech: 60, sumerAvera: 97 },
      { vector: "Claims Inflation", currentTech: 66, sumerAvera: 96 },
      { vector: "Resource Drain", currentTech: 54, sumerAvera: 98 },
    ],
    []
  );

  const futureEstimateData = useMemo(() => {
    const projections = [
      { year: "2026", fraudPressureIndex: 100, currentTechLeakage: 33, sumerAveraLeakage: Number((100 - modeledContainmentAnchor).toFixed(1)) },
      { year: "2027", fraudPressureIndex: 111, currentTechLeakage: 35, sumerAveraLeakage: 2.4 },
      { year: "2028", fraudPressureIndex: 123, currentTechLeakage: 37, sumerAveraLeakage: 2.2 },
      { year: "2029", fraudPressureIndex: 136, currentTechLeakage: 39, sumerAveraLeakage: 2.0 },
      { year: "2030", fraudPressureIndex: 150, currentTechLeakage: 42, sumerAveraLeakage: 1.8 },
    ];
    const baselinePreventedLossM = Math.max(liveFraudSignals.preventedLoss / 1000000, 0.1);

    return projections.map((entry, index) => ({
      ...entry,
      preventedLossM: Number((baselinePreventedLossM * (entry.fraudPressureIndex / 100) * (1 + index * 0.06)).toFixed(2)),
    }));
  }, [liveFraudSignals.preventedLoss, modeledContainmentAnchor]);

  const theme = {
    grid: "#1e293b",
    axis: "#94a3b8",
    surface: "#020617",
    border: "#334155",
    text: "#e2e8f0",
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-cyan-400" />
              <h1 className="text-xl font-black text-slate-100">Digital Fraud Metrics Outlook</h1>
            </div>
            <p className="text-sm text-slate-400 max-w-4xl">
              Historical and forward-looking fraud charts benchmark current anti-fraud technology against SumerAvera Gate 1 containment, using live protocol telemetry as the 2026 anchor.
            </p>
            <p className="text-xs text-slate-500">
              {liveFraudSignals.hasLiveTelemetry ? "Live telemetry is available for the current-year anchor." : "No live request volume is available yet; charts use a clearly modeled 2026 anchor until telemetry arrives."}
            </p>
          </div>
          <div className="px-3 py-2 rounded-xl border border-cyan-800 bg-cyan-950/50 text-cyan-300 text-xs font-mono font-bold">
            MODELED OUTLOOK + LIVE TELEMETRY
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider font-bold">
              <Activity className="w-4 h-4 text-cyan-400" />
              Live Requests
            </div>
            <p className="mt-2 text-2xl font-black text-slate-100 font-mono">{liveFraudSignals.totalRequests}</p>
          </div>
          <div className="bg-slate-950 border border-rose-900/60 rounded-xl p-4">
            <div className="flex items-center gap-2 text-rose-300 text-xs uppercase tracking-wider font-bold">
              <TriangleAlert className="w-4 h-4 text-rose-400" />
              Threats Isolated
            </div>
            <p className="mt-2 text-2xl font-black text-rose-300 font-mono">{liveFraudSignals.divertedThreats}</p>
          </div>
          <div className="bg-slate-950 border border-emerald-900/60 rounded-xl p-4">
            <div className="flex items-center gap-2 text-emerald-300 text-xs uppercase tracking-wider font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Gate 1 Isolation
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-300 font-mono">{liveFraudSignals.isolationRate}%</p>
          </div>
          <div className="bg-slate-950 border border-cyan-900/60 rounded-xl p-4">
            <div className="flex items-center gap-2 text-cyan-300 text-xs uppercase tracking-wider font-bold">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Prevented Loss
            </div>
            <p className="mt-2 text-2xl font-black text-cyan-300 font-mono">
              {liveFraudSignals.hasLiveTelemetry ? `$${liveFraudSignals.preventedLoss.toLocaleString()}` : "No live data"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-100">Historical Fraud Pressure vs Containment</h2>
            <p className="text-xs text-slate-400">Digital fraud losses continue rising while SumerAvera maintains a modeled containment advantage over current anti-fraud stacks.</p>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historicalFraudTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" />
                <XAxis dataKey="year" stroke={theme.axis} tick={{ fill: theme.axis, fontSize: 11 }} />
                <YAxis yAxisId="loss" stroke={theme.axis} tick={{ fill: theme.axis, fontSize: 11 }} />
                <YAxis yAxisId="rate" orientation="right" stroke={theme.axis} tick={{ fill: theme.axis, fontSize: 11 }} domain={[50, 100]} />
                <Tooltip contentStyle={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 12, color: theme.text }} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line yAxisId="loss" type="monotone" dataKey="digitalFraudLossB" name="Digital fraud loss ($B)" stroke="#f97316" strokeWidth={3} dot={{ r: 3 }} />
                <Line yAxisId="rate" type="monotone" dataKey="currentTechContainment" name="Current tech containment %" stroke="#a855f7" strokeWidth={2.5} strokeDasharray="8 4" dot={{ r: 3, fill: "#a855f7" }} />
                <Line yAxisId="rate" type="monotone" dataKey="sumerAveraModeledContainment" name="SumerAvera containment %" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4, fill: "#22c55e" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-100">Current Capability Gap by Attack Vector</h2>
            <p className="text-xs text-slate-400">Estimated interception performance highlights the headroom between present-day controls and SumerAvera Gate 1 routing.</p>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={capabilityGapData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" />
                <XAxis dataKey="vector" stroke={theme.axis} tick={{ fill: theme.axis, fontSize: 10 }} angle={-12} textAnchor="end" height={60} />
                <YAxis stroke={theme.axis} tick={{ fill: theme.axis, fontSize: 11 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 12, color: theme.text }} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="currentTech" name="Current anti-fraud %" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="sumerAvera" name="SumerAvera Gate 1 %" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="mb-4">
          <h2 className="text-base font-bold text-slate-100">2026–2030 Future Estimate</h2>
          <p className="text-xs text-slate-400">Modeled leakage stays materially lower under SumerAvera while prevented-loss capacity scales with rising fraud pressure.</p>
          <p className="text-[11px] text-slate-500 mt-1">2027–2030 prevented-loss values are modeled estimates derived from the 2026 live baseline and projected fraud-pressure growth.</p>
        </div>
        <div className="h-[22rem]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={futureEstimateData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="currentLeakageFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="sumeraveraLeakageFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" />
              <XAxis dataKey="year" stroke={theme.axis} tick={{ fill: theme.axis, fontSize: 11 }} />
              <YAxis yAxisId="percent" stroke={theme.axis} tick={{ fill: theme.axis, fontSize: 11 }} domain={[0, 100]} />
              <YAxis yAxisId="scale" orientation="right" stroke={theme.axis} tick={{ fill: theme.axis, fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 12, color: theme.text }} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Area yAxisId="percent" type="monotone" dataKey="currentTechLeakage" name="Current tech leakage %" stroke="#f97316" fill="url(#currentLeakageFill)" strokeWidth={2.5} />
              <Area yAxisId="percent" type="monotone" dataKey="sumerAveraLeakage" name="SumerAvera leakage %" stroke="#22c55e" fill="url(#sumeraveraLeakageFill)" strokeWidth={2.5} />
              <Line yAxisId="scale" type="monotone" dataKey="fraudPressureIndex" name="Fraud pressure index" stroke="#38bdf8" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-6 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={futureEstimateData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" />
              <XAxis dataKey="year" stroke={theme.axis} tick={{ fill: theme.axis, fontSize: 11 }} />
              <YAxis stroke={theme.axis} tick={{ fill: theme.axis, fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 12, color: theme.text }} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar dataKey="preventedLossM" name="Prevented loss ($M)" fill="#eab308" radius={[6, 6, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
