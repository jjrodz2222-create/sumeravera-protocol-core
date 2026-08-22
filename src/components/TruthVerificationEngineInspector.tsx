import React, { useState } from "react";
import { TruthVerificationEngine, FraudPreventionEngine, CoreSmartContract, IngressRouter, IngressPayload, Gate1ProcessingResult, TelemetryStatus } from "../data/TruthVerificationEngine";
import { ShieldCheck, ShieldAlert, Lock, Terminal, Play, RefreshCw, DollarSign, Activity, CheckCircle2, AlertTriangle, Layers, Cpu, Calculator, FileCode, Route } from "lucide-react";

export const TruthVerificationEngineInspector: React.FC = () => {
  const [engine] = useState<TruthVerificationEngine>(() => new TruthVerificationEngine(0.05));
  const [fraudEngine] = useState<FraudPreventionEngine>(() => new FraudPreventionEngine("0xSumerAveraFraudPool_0x2222"));
  const [smartContract] = useState<CoreSmartContract>(() => new CoreSmartContract("SUMERAVERA_SMART_CONTRACT_V1", fraudEngine));
  const [ingressRouter] = useState<IngressRouter>(() => new IngressRouter());
  const [telemetry, setTelemetry] = useState<TelemetryStatus>(() => engine.get_telemetry_status());
  const [lastResult, setLastResult] = useState<{ committed: boolean; data: Gate1ProcessingResult } | null>(null);

  // IngressRouter test state
  const [anomalyScoreInput, setAnomalyScoreInput] = useState<number>(180);
  const [routerDollarValueInput, setRouterDollarValueInput] = useState<number>(15000.00);
  const [routeResult, setRouteResult] = useState<any>(null);

  const runRoutePayload = () => {
    const res = ingressRouter.route_payload(anomalyScoreInput, routerDollarValueInput);
    setRouteResult(res);
  };

  // FraudPreventionEngine test state
  const [grossAmountInput, setGrossAmountInput] = useState<number>(1000.00);
  const [fraudPoolTargetInput, setFraudPoolTargetInput] = useState<string>("0xSumerAveraFraudPool_0x2222");
  const [fraudExtractionResult, setFraudExtractionResult] = useState<any>(null);
  const [fraudError, setFraudError] = useState<string | null>(null);

  // CoreSmartContract test state
  const [contractSender, setContractSender] = useState<string>("0xAgent_Alice_0x1111");
  const [contractRecipient, setContractRecipient] = useState<string>("0xVault_Bob_0x9999");
  const [contractAmount, setContractAmount] = useState<number>(5000.00);
  const [contractExecutionResult, setContractExecutionResult] = useState<any>(null);
  const [contractError, setContractError] = useState<string | null>(null);

  const runFraudExtraction = () => {
    try {
      setFraudError(null);
      fraudEngine.fraud_pool_address = fraudPoolTargetInput;
      const res = fraudEngine.process_extraction(grossAmountInput);
      setFraudExtractionResult(res);
    } catch (err: any) {
      setFraudError(err.message || "Extraction Failed");
      setFraudExtractionResult(null);
    }
  };

  const runSmartContractExecution = () => {
    try {
      setContractError(null);
      const res = smartContract.execute_payload(
        contractSender,
        contractRecipient,
        contractAmount,
        (sender, recipient, netVal) => {
          // Dummy state mutation payload function
          return [true, { action: "STATE_MUTATION_TRANSFER", netValAllocated: netVal, recipient }];
        }
      );
      setContractExecutionResult(res);
    } catch (err: any) {
      setContractError(err.message || "Smart Contract Execution Failed");
      setContractExecutionResult(null);
    }
  };

  // Custom payload form state
  const [payloadId, setPayloadId] = useState<string>("TX_001_ONLINE");
  const [riskScore, setRiskScore] = useState<number>(0.12);
  const [claimedValue, setClaimedValue] = useState<number>(12000);
  const [flaggedFraud, setFlaggedFraud] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<string>("a1b2c3d4e5f6");

  const processPayload = (overridePayload?: IngressPayload) => {
    const payloadToProcess: IngressPayload = overridePayload || {
      payload_id: payloadId,
      risk_score: riskScore,
      claimed_value: claimedValue,
      flagged_fraud: flaggedFraud,
      tx_hash: txHash,
    };

    const [committed, result] = engine.process_ingress_payload(payloadToProcess);
    setLastResult({ committed, data: result });
    setTelemetry(engine.get_telemetry_status());
  };

  const runPreset = (type: "VALID" | "FRAUD_HIGH" | "FRAUD_FLAGGED") => {
    if (type === "VALID") {
      const p: IngressPayload = {
        payload_id: `TX_${Math.floor(Math.random() * 899 + 100)}`,
        risk_score: 0.05,
        claimed_value: 1500,
        flagged_fraud: false,
        tx_hash: `0x${Math.random().toString(16).slice(2, 10)}`
      };
      setPayloadId(p.payload_id as string);
      setRiskScore(0.05);
      setClaimedValue(1500);
      setFlaggedFraud(false);
      processPayload(p);
    } else if (type === "FRAUD_HIGH") {
      const p: IngressPayload = {
        payload_id: `TX_${Math.floor(Math.random() * 899 + 100)}_FRAUD`,
        risk_score: 0.98,
        claimed_value: 85000,
        flagged_fraud: false,
        tx_hash: `0x${Math.random().toString(16).slice(2, 10)}`
      };
      setPayloadId(p.payload_id as string);
      setRiskScore(0.98);
      setClaimedValue(85000);
      setFlaggedFraud(false);
      processPayload(p);
    } else {
      const p: IngressPayload = {
        payload_id: `TX_${Math.floor(Math.random() * 899 + 100)}_FLAGGED`,
        risk_score: 0.45,
        claimed_value: 120000,
        flagged_fraud: true,
        tx_hash: `0x${Math.random().toString(16).slice(2, 10)}`
      };
      setPayloadId(p.payload_id as string);
      setRiskScore(0.45);
      setClaimedValue(120000);
      setFlaggedFraud(true);
      processPayload(p);
    }
  };

  const handleReset = () => {
    engine.chain = [];
    engine.quarantine_zone = [];
    engine.step_counter = 0;
    engine.total_fees_extracted = 0;
    // Re-Genesis
    engine["_create_block"]({ event: "GENESIS_INITIALIZATION" }, "0".repeat(64));
    setTelemetry(engine.get_telemetry_status());
    setLastResult(null);
  };

  return (
    <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-5 shadow-xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-amber-400" />
            <h2 className="text-lg font-black font-mono text-slate-100 tracking-tight">
              TRUTH VERIFICATION ENGINE &amp; GAIN-SHARE CALCULATOR
            </h2>
          </div>
          <p className="text-xs text-slate-400 font-mono">
            Gate 1 Ingress Validator &bull; 0% Cross-Bleed Quarantine &bull; 5% Contingency Gain-Share Extraction
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-3 py-1 bg-amber-950 border border-amber-800 text-amber-300 font-black rounded-lg">
            CONTINGENCY FEE: 5.0%
          </span>
          <button
            id="tve-reset-btn"
            onClick={handleReset}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg border border-slate-700 transition flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Engine</span>
          </button>
        </div>
      </div>

      {/* Telemetry Dashboard Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-bold block">Current Step (T)</span>
          <span className="text-lg font-black text-cyan-400 block">{telemetry.current_step} Steps</span>
          <span className="text-[9px] text-slate-500 block">Gate 1 Ingress Ticks</span>
        </div>

        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-bold block">Secure Blocks</span>
          <span className="text-lg font-black text-emerald-400 block">{telemetry.secure_blocks} Blocks</span>
          <span className="text-[9px] text-slate-500 block">SHA-256 Ledger Chain</span>
        </div>

        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-bold block">Quarantined Payload</span>
          <span className="text-lg font-black text-rose-400 block">{telemetry.quarantined_payloads} Isolated</span>
          <span className="text-[9px] text-slate-500 block">0% State Cross-Bleed</span>
        </div>

        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-bold block">Gain-Share Capital</span>
          <span className="text-lg font-black text-amber-400 block">${telemetry.accumulated_gain_share_capital.toLocaleString()}</span>
          <span className="text-[9px] text-slate-500 block">5% Extracted on Loss Prevented</span>
        </div>
      </div>

      {/* FraudPreventionEngine Strict 5% Micro-Fee Extraction Tester */}
      <div className="p-4 bg-slate-950 border border-amber-900/60 rounded-xl font-mono text-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="font-extrabold text-amber-300 flex items-center gap-2 text-xs">
            <Calculator className="w-4 h-4 text-amber-400" />
            FraudPreventionEngine Tester
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Gross Ingress Amount ($)</label>
            <input
              type="number"
              step="0.01"
              value={grossAmountInput}
              onChange={(e) => setGrossAmountInput(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-amber-200 font-mono focus:border-amber-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Fraud Pool Address</label>
            <input
              type="text"
              value={fraudPoolTargetInput}
              onChange={(e) => setFraudPoolTargetInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-300 font-mono focus:border-amber-500 outline-none text-[11px]"
            />
          </div>

          <div className="flex items-end">
            <button
              id="run-fraud-extraction-btn"
              onClick={runFraudExtraction}
              className="w-full py-1.5 px-3 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black rounded-lg transition flex items-center justify-center gap-1.5"
            >
              <DollarSign className="w-4 h-4" />
              <span>Process 5% Extraction</span>
            </button>
          </div>
        </div>

        {fraudError && (
          <div className="p-2.5 bg-rose-950/80 border border-rose-800 text-rose-300 rounded text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Error: {fraudError}</span>
          </div>
        )}

        {fraudExtractionResult && (
          <div className="p-3 bg-slate-900 border border-emerald-800/80 rounded-xl space-y-2 text-slate-200 text-xs">
            <div className="flex justify-between items-center text-emerald-400 font-bold border-b border-slate-800 pb-1.5">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                VERIFIED EXTRACTION RESULT
              </span>
              <span className="text-[10px] bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded text-emerald-300">
                ROUND_HALF_UP Verified
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div>
                <span className="text-[9px] text-slate-500 block">Gross Amount:</span>
                <span className="font-bold text-slate-100">${fraudExtractionResult.gross_amount.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">5% Fraud Fee:</span>
                <span className="font-bold text-amber-400">${fraudExtractionResult.fraud_fee.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">Net Payload:</span>
                <span className="font-bold text-cyan-300">${fraudExtractionResult.net_payload.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">Target Pool:</span>
                <span className="font-mono text-[10px] text-slate-400 truncate block max-w-[120px]">{fraudExtractionResult.fraud_pool_target}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CoreSmartContract Interface & State Shift Proof Tester */}
      <div className="p-4 bg-slate-950 border border-cyan-900/60 rounded-xl font-mono text-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="font-extrabold text-cyan-300 flex items-center gap-2 text-xs">
            <FileCode className="w-4 h-4 text-cyan-400" />
            CoreSmartContract Interface &amp; State Mutation Engine
          </span>
          <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded font-black">
            Version #{smartContract.state_version}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Sender Address</label>
            <input
              type="text"
              value={contractSender}
              onChange={(e) => setContractSender(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono text-[11px] focus:border-cyan-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Recipient Address</label>
            <input
              type="text"
              value={contractRecipient}
              onChange={(e) => setContractRecipient(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono text-[11px] focus:border-cyan-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              value={contractAmount}
              onChange={(e) => setContractAmount(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-200 font-mono focus:border-cyan-500 outline-none"
            />
          </div>
        </div>

        <button
          id="execute-smart-contract-btn"
          onClick={runSmartContractExecution}
          className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black rounded-lg transition shadow flex items-center justify-center gap-2"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Execute Smart Contract Payload (5% Fee + 95% Allocation + Proof)</span>
        </button>

        {contractError && (
          <div className="p-2.5 bg-rose-950/80 border border-rose-800 text-rose-300 rounded text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Contract Reverted: {contractError}</span>
          </div>
        )}

        {contractExecutionResult && (
          <div className="p-3 bg-slate-900 border border-cyan-800/80 rounded-xl space-y-2 text-slate-200 text-xs">
            <div className="flex justify-between items-center text-cyan-400 font-bold border-b border-slate-800 pb-1.5">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                {contractExecutionResult.status}
              </span>
              <span className="text-[10px] bg-cyan-950 border border-cyan-800 px-2 py-0.5 rounded text-cyan-300 font-mono">
                State Version #{contractExecutionResult.state_version}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div>
                <span className="text-[9px] text-slate-500 block">Gross Processed:</span>
                <span className="font-bold text-slate-100">${contractExecutionResult.gross_processed}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">5% Extracted Fee:</span>
                <span className="font-bold text-amber-400">${contractExecutionResult.fee_extracted_5pct}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">95% Net Executed:</span>
                <span className="font-bold text-emerald-400">${contractExecutionResult.net_executed_95pct}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">Contract ID:</span>
                <span className="font-bold text-cyan-300 truncate block">{contractExecutionResult.contract_id}</span>
              </div>
            </div>

            <div className="pt-1 border-t border-slate-800 flex justify-between items-center text-[10px]">
              <span className="text-slate-400">Cryptographic Proof Hash (SHA-256):</span>
              <span className="font-mono text-emerald-400 text-[10px] truncate max-w-[280px]">{contractExecutionResult.proof_hash}</span>
            </div>
          </div>
        )}
      </div>

      {/* Homeostatic Gate 1 Ingress Router Tester */}
      <div className="p-4 bg-slate-950 border border-indigo-900/60 rounded-xl font-mono text-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="font-extrabold text-indigo-300 flex items-center gap-2 text-xs">
            <Route className="w-4 h-4 text-indigo-400" />
            IngressRouter: Homeostatic Gate 1 Anomaly Classifier &amp; Status Code Router
          </span>
          <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded font-black">
            Total Ingress: {ingressRouter.total_ingress} | Prevented: {ingressRouter.prevented_loss ? `$${ingressRouter.prevented_loss.toFixed(2)}` : "$0.00"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Lotka-Volterra Anomaly Index (0 - 1000)</label>
            <input
              type="number"
              min="0"
              max="1000"
              value={anomalyScoreInput}
              onChange={(e) => setAnomalyScoreInput(parseInt(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-indigo-200 font-mono focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Ingress Dollar Value ($)</label>
            <input
              type="number"
              step="0.01"
              value={routerDollarValueInput}
              onChange={(e) => setRouterDollarValueInput(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono focus:border-indigo-500 outline-none"
            />
          </div>

          <div className="flex items-end">
            <button
              id="route-payload-btn"
              onClick={runRoutePayload}
              className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-lg transition flex items-center justify-center gap-1.5"
            >
              <Route className="w-4 h-4" />
              <span>Route Payload</span>
            </button>
          </div>
        </div>

        {routeResult && (
          <div className="p-3 bg-slate-900 border border-indigo-800/80 rounded-xl space-y-2 text-slate-200 text-xs">
            <div className="flex justify-between items-center font-bold border-b border-slate-800 pb-1.5">
              <span className="flex items-center gap-1.5 text-indigo-300">
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                ROUTE EVALUATION: {routeResult.label}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-black border ${
                routeResult.status_code === 200 ? "bg-emerald-950 text-emerald-300 border-emerald-800" :
                routeResult.status_code === 202 ? "bg-amber-950 text-amber-300 border-amber-800" :
                "bg-rose-950 text-rose-300 border-rose-800"
              }`}>
                HTTP {routeResult.status_code}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div>
                <span className="text-[9px] text-slate-500 block">Status Code:</span>
                <span className="font-bold text-slate-100">{routeResult.status_code} ({routeResult.label})</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">Total Ingress Counter:</span>
                <span className="font-bold text-cyan-300">{routeResult.total_ingress}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">Accumulated Prevented Loss:</span>
                <span className="font-bold text-rose-300">{routeResult.prevented_loss}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">Category Counters:</span>
                <span className="font-mono text-[10px] text-slate-300 block">
                  200:{ingressRouter.stable_200} | 202:{ingressRouter.rebalancing_202} | 403:{ingressRouter.quarantine_403}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Payload Testing Console */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 font-mono text-xs">
        {/* Left Form */}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-slate-200 text-xs flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              Ingress Payload Controls
            </span>
            <div className="flex gap-1.5 text-[10px]">
              <button
                id="preset-valid-btn"
                onClick={() => runPreset("VALID")}
                className="px-2 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded font-bold transition"
              >
                + Valid Payload
              </button>
              <button
                id="preset-fraud-btn"
                onClick={() => runPreset("FRAUD_HIGH")}
                className="px-2 py-1 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded font-bold transition"
              >
                + Fraud Risk (0.98)
              </button>
              <button
                id="preset-flagged-btn"
                onClick={() => runPreset("FRAUD_FLAGGED")}
                className="px-2 py-1 bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-300 rounded font-bold transition"
              >
                + Flagged Fraud
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Payload ID</label>
              <input
                type="text"
                value={payloadId}
                onChange={(e) => setPayloadId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono focus:border-cyan-500 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Claimed Value ($)</label>
              <input
                type="number"
                value={claimedValue}
                onChange={(e) => setClaimedValue(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono focus:border-cyan-500 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Risk Score (0.00 - 1.00)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={riskScore}
                onChange={(e) => setRiskScore(parseFloat(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono focus:border-cyan-500 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Flagged Fraud</label>
              <button
                type="button"
                onClick={() => setFlaggedFraud(!flaggedFraud)}
                className={`w-full py-1.5 px-3 rounded border font-bold text-center transition ${
                  flaggedFraud
                    ? "bg-rose-950 border-rose-800 text-rose-300"
                    : "bg-slate-900 border-slate-700 text-slate-400"
                }`}
              >
                {flaggedFraud ? "FLAGGED FRAUD = TRUE" : "FLAGGED FRAUD = FALSE"}
              </button>
            </div>
          </div>

          <button
            id="tve-process-btn"
            onClick={() => processPayload()}
            className="w-full py-2 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-slate-950 font-black rounded-lg transition shadow flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Process Ingress Payload (Gate 1 Validation)</span>
          </button>
        </div>

        {/* Right Execution Result */}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
          <span className="font-bold text-slate-200 text-xs flex items-center gap-2 border-b border-slate-800 pb-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            Gate 1 Process Evaluation Output
          </span>

          {lastResult ? (
            <div className="space-y-3 text-xs">
              <div
                className={`p-3 rounded-xl border flex items-center justify-between ${
                  lastResult.committed
                    ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                    : "bg-rose-950/60 border-rose-800 text-rose-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  {lastResult.committed ? (
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="w-5 h-5 text-rose-400" />
                  )}
                  <div>
                    <span className="font-extrabold text-sm block">{lastResult.data.status}</span>
                    <span className="text-[10px] text-slate-400">Step {lastResult.data.step} Execution</span>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded text-[10px] font-black uppercase bg-slate-900 border border-slate-700">
                  {lastResult.committed ? "HTTP 200 COMMITTED" : "HTTP 403 ISOLATED"}
                </span>
              </div>

              {!lastResult.committed && (
                <div className="p-3 bg-amber-950/40 border border-amber-800/80 rounded-xl text-amber-200 space-y-1">
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <span>Prevented Loss Value:</span>
                    <span className="text-rose-300">${lastResult.data.prevented_loss?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] font-bold border-t border-amber-900/60 pt-1">
                    <span>5% Gain-Share Extracted:</span>
                    <span className="text-amber-400 font-extrabold">+${lastResult.data.fee_extracted?.toLocaleString()}</span>
                  </div>
                  <span className="text-[9px] text-amber-400/80 block pt-1">
                    Isolation Integrity: {lastResult.data.isolation_integrity} (0% State Bleed)
                  </span>
                </div>
              )}

              {lastResult.committed && (
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1 text-slate-300">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Block Index:</span>
                    <span className="font-bold text-cyan-400">#{lastResult.data.block_index}</span>
                  </div>
                  <div className="flex justify-between text-[11px] truncate">
                    <span className="text-slate-400">SHA-256 Hash:</span>
                    <span className="font-mono text-emerald-400 text-[10px] truncate max-w-[200px]">{lastResult.data.block_hash}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic py-6 text-center">
              No payload executed yet. Click a preset or submit a custom payload.
            </p>
          )}
        </div>
      </div>

      {/* Ledger Chain & Quarantine Stream */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
        {/* Ledger Chain */}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              Immutable SHA-256 Ledger ({engine.chain.length} Blocks)
            </span>
            <span className="text-[10px] text-emerald-400 font-bold">STATUS: STABLE</span>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {engine.chain.map((blk) => (
              <div key={blk.index} className="p-2 bg-slate-900 border border-slate-800 rounded text-[11px] flex justify-between items-center">
                <div>
                  <span className="font-bold text-cyan-300">Block #{blk.index}</span>
                  <span className="text-[9px] text-slate-500 block truncate max-w-[220px]">Hash: {blk.hash}</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 bg-slate-950 text-slate-400 rounded border border-slate-800">
                  {blk.data.event || `Payload #${blk.data.payload_id}`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quarantine Zone */}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              Quarantine Zone ({engine.quarantine_zone.length} Isolated)
            </span>
            <span className="text-[10px] text-rose-400 font-bold">ISOLATION: 100.0%</span>
          </div>
          {engine.quarantine_zone.length === 0 ? (
            <p className="text-xs text-slate-600 italic py-6 text-center">Zero quarantined fraud payloads.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {engine.quarantine_zone.map((q, idx) => (
                <div key={idx} className="p-2 bg-rose-950/40 border border-rose-900/60 rounded text-[11px] flex justify-between items-center text-rose-200">
                  <div>
                    <span className="font-bold">Step {q.step}: Payload #{q.payload_id}</span>
                    <span className="text-[9px] text-rose-400/80 block">Loss Prevented: ${q.prevented_loss_value.toLocaleString()}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 rounded text-[10px] font-black">
                    +${(q.prevented_loss_value * 0.05).toLocaleString()} Fee
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
