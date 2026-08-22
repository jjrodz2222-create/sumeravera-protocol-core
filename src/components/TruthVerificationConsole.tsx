import React, { useState } from "react";
import { AgentInfo, GatewayRouteResult } from "../types";
import { ShieldCheck, ShieldAlert, Key, Zap, CheckCircle2, XCircle, FileCode, AlertTriangle } from "lucide-react";

interface TruthVerificationConsoleProps {
  agents: AgentInfo[];
  onRequestShift: (payload: any) => Promise<GatewayRouteResult>;
  loading: boolean;
}

export const TruthVerificationConsole: React.FC<TruthVerificationConsoleProps> = ({
  agents,
  onRequestShift,
  loading,
}) => {
  const [selectedAgent, setSelectedAgent] = useState<string>("agent_bio_1");
  const [dE, setDE] = useState<number>(25.0);
  const [facetShifts, setFacetShifts] = useState<Record<string, number>>({
    bio: 10.0,
    water: 5.0,
  });
  const [signature, setSignature] = useState<string>("sumer_secret_bio_9982");
  const [auditResult, setAuditResult] = useState<GatewayRouteResult | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const activeAgentInfo = agents.find((a) => a.id === selectedAgent);

  const handleAgentChange = (agentId: string) => {
    setSelectedAgent(agentId);
    if (agentId === "agent_bio_1") {
      setSignature("sumer_secret_bio_9982");
      setFacetShifts({ bio: 10.0, water: 5.0 });
    } else if (agentId === "agent_art_1") {
      setSignature("sumer_secret_art_4431");
      setFacetShifts({ art: 8.0, spirit: 6.0 });
    } else if (agentId === "agent_energy_1") {
      setSignature("sumer_secret_energy_1102");
      setFacetShifts({ energy: 12.0, water: -2.0 });
    } else if (agentId === "agent_eco_guard") {
      setSignature("sumer_secret_gaia_7700");
      setFacetShifts({ bio: 5.0, art: 5.0, spirit: 5.0, water: 5.0, energy: 5.0 });
    } else {
      setSignature("invalid_unauthorized_token_123");
      setFacetShifts({ bio: -50.0 });
    }
  };

  const handleFacetChange = (facet: string, val: number) => {
    setFacetShifts((prev) => ({
      ...prev,
      [facet]: val,
    }));
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setAuditResult(null);

    try {
      const payload = {
        agent_id: selectedAgent,
        dE: dE,
        dH: facetShifts,
        signature: signature,
      };

      const res = await onRequestShift(payload);
      setAuditResult(res);
    } catch (err) {
      console.error("Shift error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* State Shift Dispatcher Form */}
      <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <div>
            <h2 className="text-base font-bold text-slate-100">Validation Engine &amp; Node Shift Console</h2>
            <p className="text-xs text-slate-400">Validates identity signatures, resource constraints &amp; node boundaries.</p>
          </div>
        </div>

        <form onSubmit={handleSubmitRequest} className="space-y-5">
          {/* Agent Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              1. Select Agent Identity
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => handleAgentChange(agent.id)}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    selectedAgent === agent.id
                      ? "bg-cyan-950/80 border-cyan-500/80 text-cyan-200 ring-1 ring-cyan-500/50"
                      : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <span className="font-bold text-xs">{agent.name}</span>
                  <span className="text-[11px] text-slate-400 font-mono mt-0.5">{agent.role}</span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => handleAgentChange("unregistered_rogue_agent")}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  selectedAgent === "unregistered_rogue_agent"
                    ? "bg-rose-950/80 border-rose-500/80 text-rose-200 ring-1 ring-rose-500/50"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-rose-900/50"
                }`}
              >
                <span className="font-bold text-xs text-rose-400">Rogue / Unregistered Agent</span>
                <span className="text-[11px] text-slate-500 font-mono mt-0.5">Tests Threat Interception</span>
              </button>
            </div>
          </div>

          {/* Capacity Shift (dE) */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center mb-2">
              <label htmlFor="de-carrying-capacity-input" className="text-xs font-semibold text-slate-300">
                2. Requested Capacity Delta <span className="font-mono text-cyan-400">(dE)</span>
              </label>
              <span className={`font-mono text-sm font-bold ${dE >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {dE > 0 ? `+${dE}` : dE} E_units
              </span>
            </div>
            <input
              id="de-carrying-capacity-input"
              type="range"
              min="-300"
              max="300"
              step="5"
              value={dE}
              onChange={(e) => setDE(Number(e.target.value))}
              className="w-full accent-cyan-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
              <span>-300 (Depletion)</span>
              <span>0 (Neutral)</span>
              <span>+300 (Regeneration)</span>
            </div>
          </div>

          {/* Facet Deltas (dH) */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              3. Requested Facet Shifts <span className="font-mono text-purple-400">(dH)</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {["bio", "art", "spirit", "water", "energy"].map((facet) => (
                <div key={facet} className="flex flex-col">
                  <label htmlFor={`facet-shift-input-${facet}`} className="text-[10px] font-mono text-slate-400 uppercase cursor-pointer">
                    {facet}
                  </label>
                  <input
                    id={`facet-shift-input-${facet}`}
                    type="number"
                    step="0.5"
                    value={facetShifts[facet] || 0}
                    onChange={(e) => handleFacetChange(facet, Number(e.target.value))}
                    className="mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Identity Signature */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="crypto-signature-input" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 cursor-pointer">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>4. Cryptographic Identity Signature / Secret Key</span>
              </label>
            </div>
            <input
              id="crypto-signature-input"
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
              placeholder="Enter SHA-256 HMAC or secret key..."
            />
          </div>

          {/* Submit Button */}
          <button
            id="truth-verification-submit-btn"
            type="submit"
            disabled={submitting || loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>{submitting ? "VERIFYING CONSTRAINTS..." : "DISPATCH STATE SHIFT TO TRUTH ENGINE"}</span>
          </button>
        </form>
      </div>

      {/* Truth Verification Real-Time Audit Receipt */}
      <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <FileCode className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold text-slate-100">Verification Engine Audit Receipt</h2>
            </div>
            {auditResult && (
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  auditResult.diverted ? "bg-rose-950 text-rose-400 border border-rose-800" : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                }`}
              >
                {auditResult.diverted ? "HONEYPOT DIVERTED" : "STATE COMMITTED"}
              </span>
            )}
          </div>

          {!auditResult ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <ShieldCheck className="w-12 h-12 mx-auto text-slate-700 animate-pulse" />
              <p className="text-xs">Dispatch a state shift request to inspect the live Truth Verification Engine output.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Verdict Banner */}
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 ${
                  auditResult.diverted
                    ? "bg-rose-950/40 border-rose-800 text-rose-200"
                    : "bg-emerald-950/40 border-emerald-800 text-emerald-200"
                }`}
              >
                {auditResult.diverted ? (
                  <XCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className="font-bold text-xs sm:text-sm uppercase tracking-wide">
                    {auditResult.diverted ? "REJECTED BY TRUTH ENGINE" : "VERIFIED & APPROVED"}
                  </h3>
                  <p className="text-xs mt-0.5 opacity-90">{auditResult.message}</p>
                </div>
              </div>

              {/* Verified Details Box */}
              {!auditResult.diverted && auditResult.ledger_block && (
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
                  <div className="text-slate-400 flex justify-between">
                    <span>Block Index:</span>
                    <span className="text-cyan-400 font-bold">#{auditResult.ledger_block.index}</span>
                  </div>
                  <div className="text-slate-400">
                    <span>SHA-256 Block Hash:</span>
                    <p className="text-slate-200 break-all text-[11px] bg-slate-900 p-1.5 rounded mt-1 border border-slate-800">
                      {auditResult.ledger_block.hash}
                    </p>
                  </div>
                  <div className="text-slate-400 flex justify-between">
                    <span>Agent:</span>
                    <span className="text-emerald-400 font-bold">{auditResult.ledger_block.agent_id}</span>
                  </div>
                </div>
              )}

              {/* Diverted / Malicious Details Box */}
              {auditResult.diverted && (
                <div className="p-3.5 bg-slate-950 rounded-xl border border-rose-900/50 space-y-2 text-xs font-mono">
                  <div className="text-rose-400 flex justify-between">
                    <span>Interception Vector:</span>
                    <span className="font-bold">{auditResult.threat_type || "SECURITY_VIOLATION"}</span>
                  </div>
                  <div className="text-slate-400">
                    <span>Synthetic Decoy Sent:</span>
                    <p className="text-amber-300 text-[11px] bg-slate-900 p-1.5 rounded mt-1 border border-slate-800">
                      Attacker diverted to Honeypot Synthetic Playground. Core kernel untouched.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 font-mono">
          Strict verification ensures non-repudiation and prevents ecological breakdown.
        </div>
      </div>
    </div>
  );
};
