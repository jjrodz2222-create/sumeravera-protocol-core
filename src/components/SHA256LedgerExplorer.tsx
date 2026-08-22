import React, { useState } from "react";
import { LedgerInfo, LedgerBlock } from "../types";
import { Layers, ShieldCheck, ShieldAlert, Key, Search, ArrowRight, Database, Code, Check } from "lucide-react";

interface SHA256LedgerExplorerProps {
  ledger: LedgerInfo;
  loading: boolean;
}

export const SHA256LedgerExplorer: React.FC<SHA256LedgerExplorerProps> = ({
  ledger,
  loading,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedBlock, setSelectedBlock] = useState<LedgerBlock | null>(null);

  const latest = ledger?.latest_block;

  return (
    <div className="space-y-6">
      {/* Ledger Header & Integrity Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-950 border border-cyan-800 rounded-xl text-cyan-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">Secure State Ledger &amp; Cryptographic Chain Explorer</h2>
            <p className="text-xs text-slate-400">
              Immutable state ledger hashing every system transition using cryptographic chain links.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-300">
            <span className="text-slate-500">CHAIN HEIGHT:</span> <span className="font-bold text-cyan-400">{ledger?.length || 0} Blocks</span>
          </div>

          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-2 ${
              ledger?.integrity
                ? "bg-emerald-950/80 border-emerald-800/80 text-emerald-400"
                : "bg-rose-950/80 border-rose-800/80 text-rose-400"
            }`}
          >
            {ledger?.integrity ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <ShieldAlert className="w-4 h-4 text-rose-400" />}
            <span>{ledger?.integrity ? "SHA-256 INTEGRITY VERIFIED" : "CHAIN CORRUPTION DETECTED"}</span>
          </div>
        </div>
      </div>

      {/* Latest Block Card */}
      {latest && (
        <div className="bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border border-cyan-900/60 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-md text-xs font-mono font-bold">
                LATEST BLOCK #{latest.index}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {new Date(latest.timestamp * 1000).toLocaleString()}
              </span>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
              Agent: <strong className="text-emerald-400">{latest.agent_id}</strong>
            </span>
          </div>

          <div className="space-y-2 font-mono text-xs">
            <div>
              <span className="text-slate-400">Current SHA-256 Hash:</span>
              <p className="text-cyan-300 bg-slate-950 p-2 rounded-lg border border-slate-800/80 mt-1 break-all font-bold">
                {latest.hash}
              </p>
            </div>
            <div>
              <span className="text-slate-500">Previous Block Hash (prev_hash):</span>
              <p className="text-slate-400 bg-slate-950 p-2 rounded-lg border border-slate-800/80 mt-1 break-all">
                {latest.prev_hash}
              </p>
            </div>
            <div className="pt-1 flex justify-between text-slate-400 text-[11px]">
              <span>Action: <strong className="text-slate-200">{latest.action_type}</strong></span>
              <span>Details: <strong className="text-slate-200">{latest.details}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
        <input
          id="ledger-search-filter-input"
          aria-label="Filter ledger blocks by agent ID, action type, or SHA-256 hash"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter ledger blocks by agent ID, action type, or SHA-256 hash..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* Block List Inspector */}
      {latest && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <span>Block Chain History Timeline</span>
          </h3>

          <div className="space-y-3">
            {[latest].map((block) => (
              <div
                key={block.index}
                className="p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs space-y-2 hover:border-slate-700 transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-slate-800 text-cyan-400 rounded font-bold">
                      Block #{block.index}
                    </span>
                    <span className="text-slate-300 font-bold">{block.action_type}</span>
                    <span className="text-slate-500 text-[11px]">
                      {new Date(block.timestamp * 1000).toLocaleTimeString()}
                    </span>
                  </div>
                  <span className="text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60 text-[10px]">
                    SHA-256 SIGNED
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500">Hash:</span>
                    <p className="text-cyan-300 break-all">{block.hash}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Prev Hash:</span>
                    <p className="text-slate-400 break-all">{block.prev_hash}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap justify-between items-center text-[11px] text-slate-400">
                  <span>Agent: <strong className="text-slate-200">{block.agent_id}</strong></span>
                  <span>State Snapshot: <strong className="text-cyan-400">E={block.state_snapshot?.E}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
