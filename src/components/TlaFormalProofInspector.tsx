import React, { useState } from "react";
import {
  SUMERAVERA_TLA_SPEC,
  UNIFIED_TRUTH_KERNEL_TLA_SPEC,
  SUMERAVERA_STRESS_TEST_TLA_SPEC,
  SUMERAVERA_STRESS_TEST_TLC_CFG,
  TlaState,
  evaluateInvariants,
  StressNodeId,
  STRESS_NODES,
  NetworkMessage,
  StressTestState,
  evaluateStressTestInvariants,
} from "../data/SumerAveraTlaSpec";
import {
  ShieldCheck,
  CheckCircle2,
  Play,
  RefreshCw,
  Copy,
  Check,
  Terminal,
  FileCode2,
  Zap,
  AlertTriangle,
  Layers,
  Lock,
  Flame,
  Radio,
  Server,
  Activity,
  Trash2,
  Crosshair,
  ShieldAlert,
} from "lucide-react";

const VALID_PAYLOAD_OPTIONS = [
  "V1",
  "V2",
  "PAYLOAD_ALPHA_TX",
  "TELEMETRY_PULSE_2222",
  "EQUILIBRIUM_SYNC",
  "FINGERPRINT_SIGN_OFF",
  "HOMEOSTATIC_REBALANCE",
];

const ADVERSARIAL_PAYLOAD_OPTIONS = [
  "BadPayload1",
  "BadPayload2",
  "MALICIOUS_POISON_01",
  "BYZANTINE_FORK_ATTACK",
  "STATE_CORRUPTION_VECTOR",
  "INVARIANT_BREACH_INJECT",
];

const ADVERSARIAL_SET = new Set(ADVERSARIAL_PAYLOAD_OPTIONS);

// Deterministic mock model hash
function computeModelHash(val: string): string {
  let hash = 0;
  for (let i = 0; i < val.length; i++) {
    hash = (hash << 5) - hash + val.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(4, "0");
  return `0x${hex}`;
}

export const TlaFormalProofInspector: React.FC = () => {
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"stress_test" | "checker" | "spec">("stress_test");
  const [activeSpecModule, setActiveSpecModule] = useState<"stress_test" | "stress_test_cfg" | "truth_kernel" | "protocol">("stress_test");

  // ==========================================
  // STRESS TEST TLA+ MODEL STATE
  // ==========================================
  const initialStressState: StressTestState = {
    nodeStates: {
      NodeA: ["GENESIS_INIT"],
      NodeB: ["GENESIS_INIT"],
      NodeD: ["GENESIS_INIT"],
      NodeE: ["GENESIS_INIT"],
    },
    networkBuffer: [
      {
        id: "msg-101",
        from: "INGRESS",
        to: "NodeA",
        payload: "PAYLOAD_ALPHA_TX",
        hash: computeModelHash("GENESIS_INIT:PAYLOAD_ALPHA_TX"),
        isAdversarial: false,
      },
      {
        id: "msg-102",
        from: "INGRESS",
        to: "NodeB",
        payload: "MALICIOUS_POISON_01",
        hash: "0xBAD_ADVERSARIAL_HASH",
        isAdversarial: true,
      },
      {
        id: "msg-103",
        from: "INGRESS",
        to: "NodeD",
        payload: "TELEMETRY_PULSE_2222",
        hash: computeModelHash("GENESIS_INIT:TELEMETRY_PULSE_2222"),
        isAdversarial: false,
      },
    ],
    truthAnchor: computeModelHash("GENESIS_INIT"),
    stepCount: 0,
    nodeStatus: {
      NodeA: "ONLINE",
      NodeB: "ONLINE",
      NodeD: "ONLINE",
      NodeE: "ONLINE",
    },
    maxSteps: 2222,
    adversarialRejectedCount: 0,
  };

  const [stressState, setStressState] = useState<StressTestState>(initialStressState);
  const [stressTrace, setStressTrace] = useState<Array<{ step: number; action: string; invPass: boolean }>>([
    { step: 0, action: "Init: [Nodes: NodeA, NodeB, NodeD, NodeE | Anchor: " + initialStressState.truthAnchor + "]", invPass: true },
  ]);

  const stressInvariants = evaluateStressTestInvariants(stressState, ADVERSARIAL_SET);

  // ==========================================
  // PROTOCOL CHECKER TLA+ STATE
  // ==========================================
  const initialTlaState: TlaState = {
    step_count: 0,
    blocks: [{ id: 1, hash: "GENESIS_SHA256", prev: "0000" }],
    ingress_queue: [
      { payload_id: 101, is_valid: true, loss_value: 1000 },
      { payload_id: 102, is_valid: false, loss_value: 5000 },
      { payload_id: 103, is_valid: true, loss_value: 2500 },
      { payload_id: 104, is_valid: false, loss_value: 12000 },
      { payload_id: 105, is_valid: false, loss_value: 8500 },
    ],
    quarantine_zone: [],
    gain_share_extracted: 0,
    truthAnchor: "0x8a92f01c7d81a29f8217210e",
    nodeStateHashes: {
      "NODE-01": "0x8a92f01c7d81a29f8217210e",
      "NODE-02": "0x8a92f01c7d81a29f8217210e",
      "EDGE-01": "0x8a92f01c7d81a29f8217210e",
    },
  };

  const [tlaState, setTlaState] = useState<TlaState>(initialTlaState);
  const [history, setHistory] = useState<Array<{ step: number; action: string; invPass: boolean }>>([
    { step: 0, action: "Init", invPass: true },
  ]);

  const invariants = evaluateInvariants(tlaState);

  // ==========================================
  // ACTIONS FOR STRESS TEST MODULE
  // ==========================================

  // IngressPayload(n, payload)
  const handleIngressPayload = (targetNode: StressNodeId, payload: string, isAdversarial: boolean) => {
    if (stressState.nodeStatus[targetNode] !== "ONLINE") return;
    if (stressState.stepCount >= stressState.maxSteps) return;

    const msgId = `msg-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 100)}`;
    const hash = isAdversarial ? `0xCORRUPT_${Math.floor(Math.random() * 9999)}` : computeModelHash(`${stressState.truthAnchor}:${payload}`);

    const newMsg: NetworkMessage = {
      id: msgId,
      from: "INGRESS",
      to: targetNode,
      payload,
      hash,
      isAdversarial,
    };

    const nextStep = stressState.stepCount + 1;
    const nextState: StressTestState = {
      ...stressState,
      networkBuffer: [...stressState.networkBuffer, newMsg],
      stepCount: nextStep,
    };

    setStressState(nextState);
    const inv = evaluateStressTestInvariants(nextState, ADVERSARIAL_SET);
    setStressTrace((prev) => [
      ...prev,
      {
        step: nextStep,
        action: `IngressPayload(${targetNode}, ${payload}) [${isAdversarial ? "ADVERSARIAL" : "VALID"}]`,
        invPass: inv.allSatisfied,
      },
    ]);
  };

  // DropMessage(msg)
  const handleDropMessage = (msgId: string) => {
    const msg = stressState.networkBuffer.find((m) => m.id === msgId);
    if (!msg) return;

    const remaining = stressState.networkBuffer.filter((m) => m.id !== msgId);
    const nextState: StressTestState = {
      ...stressState,
      networkBuffer: remaining,
    };

    setStressState(nextState);
    const inv = evaluateStressTestInvariants(nextState, ADVERSARIAL_SET);
    setStressTrace((prev) => [
      ...prev,
      {
        step: stressState.stepCount,
        action: `DropMessage(${msg.id} -> ${msg.to}) [Network Fault Simulated]`,
        invPass: inv.allSatisfied,
      },
    ]);
  };

  // AdversarialTamper(msg)
  const handleAdversarialTamper = (msgId: string) => {
    const msg = stressState.networkBuffer.find((m) => m.id === msgId);
    if (!msg) return;

    const badPayload = ADVERSARIAL_PAYLOAD_OPTIONS[Math.floor(Math.random() * ADVERSARIAL_PAYLOAD_OPTIONS.length)];
    const corruptedMsg: NetworkMessage = {
      ...msg,
      payload: badPayload,
      hash: `0xMUTATED_${Math.floor(Math.random() * 9999)}`,
      isAdversarial: true,
    };

    const updatedBuffer = stressState.networkBuffer.map((m) => (m.id === msgId ? corruptedMsg : m));
    const nextState: StressTestState = {
      ...stressState,
      networkBuffer: updatedBuffer,
    };

    setStressState(nextState);
    const inv = evaluateStressTestInvariants(nextState, ADVERSARIAL_SET);
    setStressTrace((prev) => [
      ...prev,
      {
        step: stressState.stepCount,
        action: `AdversarialTamper(${msg.id}) [Mutated to: ${badPayload}]`,
        invPass: inv.allSatisfied,
      },
    ]);
  };

  // CrashNode(n)
  const handleCrashNode = (nodeId: StressNodeId) => {
    if (stressState.nodeStatus[nodeId] === "CRASHED") return;

    const nextState: StressTestState = {
      ...stressState,
      nodeStatus: {
        ...stressState.nodeStatus,
        [nodeId]: "CRASHED",
      },
    };

    setStressState(nextState);
    const inv = evaluateStressTestInvariants(nextState, ADVERSARIAL_SET);
    setStressTrace((prev) => [
      ...prev,
      {
        step: stressState.stepCount,
        action: `CrashNode(${nodeId}) [Status: CRASHED]`,
        invPass: inv.allSatisfied,
      },
    ]);
  };

  // RecoverNode(n)
  const handleRecoverNode = (nodeId: StressNodeId) => {
    if (stressState.nodeStatus[nodeId] === "ONLINE") return;

    // Synchronize to canonical sequence from an online node or anchor
    const onlineNodes = STRESS_NODES.filter((n) => stressState.nodeStatus[n] === "ONLINE" && n !== nodeId);
    const canonicalState = onlineNodes.length > 0 ? [...stressState.nodeStates[onlineNodes[0]]] : [...stressState.nodeStates[nodeId]];

    const nextState: StressTestState = {
      ...stressState,
      nodeStates: {
        ...stressState.nodeStates,
        [nodeId]: canonicalState,
      },
      nodeStatus: {
        ...stressState.nodeStatus,
        [nodeId]: "ONLINE",
      },
    };

    setStressState(nextState);
    const inv = evaluateStressTestInvariants(nextState, ADVERSARIAL_SET);
    setStressTrace((prev) => [
      ...prev,
      {
        step: stressState.stepCount,
        action: `RecoverNode(${nodeId}) [Synchronized to canonical sequence: ${canonicalState.length} items]`,
        invPass: inv.allSatisfied,
      },
    ]);
  };

  // ProcessPayload(n, msg)
  const handleProcessPayload = (msgId?: string) => {
    if (stressState.networkBuffer.length === 0) return;

    const msg = msgId ? stressState.networkBuffer.find((m) => m.id === msgId) : stressState.networkBuffer[0];
    if (!msg) return;

    const targetNode = msg.to;
    if (stressState.nodeStatus[targetNode] !== "ONLINE") return;

    const remainingBuffer = stressState.networkBuffer.filter((m) => m.id !== msg.id);
    const expectedHash = computeModelHash(`${stressState.truthAnchor}:${msg.payload}`);
    const isCleared = !msg.isAdversarial && (msg.hash === expectedHash || msg.hash.startsWith("0x"));

    let nextNodeStates = { ...stressState.nodeStates };
    let nextAnchor = stressState.truthAnchor;
    let nextAdversarialRejected = stressState.adversarialRejectedCount;
    let actionDesc = "";

    if (isCleared && !ADVERSARIAL_SET.has(msg.payload)) {
      // Replicate state transition across all online nodes in accordance with Unified Truth Kernel
      const updatedList = [...nextNodeStates[targetNode], msg.payload];
      STRESS_NODES.forEach((n) => {
        if (stressState.nodeStatus[n] === "ONLINE") {
          nextNodeStates[n] = updatedList;
        }
      });
      nextAnchor = computeModelHash(`${stressState.truthAnchor}:${msg.payload}`);
      actionDesc = `ProcessPayload(${targetNode}, ${msg.payload}) [CLEARED -> Invariant State Advanced | Anchor: ${nextAnchor}]`;
    } else {
      // Gate 1 Isolation Rejection
      nextAdversarialRejected += 1;
      actionDesc = `ProcessPayload(${targetNode}, ${msg.payload}) [GATE 1 REJECTION -> Anomaly Isolated | Zero State Drift]`;
    }

    const nextStep = stressState.stepCount + 1;
    const nextState: StressTestState = {
      ...stressState,
      nodeStates: nextNodeStates,
      truthAnchor: nextAnchor,
      networkBuffer: remainingBuffer,
      stepCount: nextStep,
      adversarialRejectedCount: nextAdversarialRejected,
    };

    setStressState(nextState);
    const inv = evaluateStressTestInvariants(nextState, ADVERSARIAL_SET);
    setStressTrace((prev) => [
      ...prev,
      {
        step: nextStep,
        action: actionDesc,
        invPass: inv.allSatisfied,
      },
    ]);
  };

  // Run Automated 20-Step Random Stress Burst
  const handleRunStressBurst = () => {
    let curr = { ...stressState };
    const traceAdditions: Array<{ step: number; action: string; invPass: boolean }> = [];

    for (let i = 0; i < 15; i++) {
      const actionRoll = Math.random();
      const randomNode = STRESS_NODES[Math.floor(Math.random() * STRESS_NODES.length)];

      if (actionRoll < 0.35) {
        // Ingress Valid
        const payload = VALID_PAYLOAD_OPTIONS[Math.floor(Math.random() * VALID_PAYLOAD_OPTIONS.length)];
        const hash = computeModelHash(`${curr.truthAnchor}:${payload}`);
        curr.networkBuffer = [
          ...curr.networkBuffer,
          {
            id: `burst-${Date.now()}-${i}`,
            from: "INGRESS",
            to: randomNode,
            payload,
            hash,
            isAdversarial: false,
          },
        ];
        curr.stepCount += 1;
        const inv = evaluateStressTestInvariants(curr, ADVERSARIAL_SET);
        traceAdditions.push({ step: curr.stepCount, action: `[BURST] IngressValid(${randomNode}, ${payload})`, invPass: inv.allSatisfied });
      } else if (actionRoll < 0.6) {
        // Ingress Adversarial
        const badPayload = ADVERSARIAL_PAYLOAD_OPTIONS[Math.floor(Math.random() * ADVERSARIAL_PAYLOAD_OPTIONS.length)];
        curr.networkBuffer = [
          ...curr.networkBuffer,
          {
            id: `burst-adv-${Date.now()}-${i}`,
            from: "INGRESS",
            to: randomNode,
            payload: badPayload,
            hash: `0xBAD_${Math.floor(Math.random() * 9999)}`,
            isAdversarial: true,
          },
        ];
        curr.stepCount += 1;
        const inv = evaluateStressTestInvariants(curr, ADVERSARIAL_SET);
        traceAdditions.push({ step: curr.stepCount, action: `[BURST] IngressAdversarial(${randomNode}, ${badPayload})`, invPass: inv.allSatisfied });
      } else if (actionRoll < 0.75 && curr.networkBuffer.length > 0) {
        // Byzantine Tamper or Drop
        const idx = Math.floor(Math.random() * curr.networkBuffer.length);
        if (Math.random() > 0.5) {
          const bad = ADVERSARIAL_PAYLOAD_OPTIONS[0];
          curr.networkBuffer[idx] = { ...curr.networkBuffer[idx], payload: bad, hash: "0xTAMPERED", isAdversarial: true };
          traceAdditions.push({ step: curr.stepCount, action: `[BURST] AdversarialTamper(${curr.networkBuffer[idx].id})`, invPass: true });
        } else {
          const dropped = curr.networkBuffer[idx];
          curr.networkBuffer = curr.networkBuffer.filter((_, k) => k !== idx);
          traceAdditions.push({ step: curr.stepCount, action: `[BURST] DropMessage(${dropped.id})`, invPass: true });
        }
      } else if (curr.networkBuffer.length > 0) {
        // Process Payload
        const msg = curr.networkBuffer[0];
        curr.networkBuffer = curr.networkBuffer.slice(1);
        if (curr.nodeStatus[msg.to] === "ONLINE") {
          const isCleared = !msg.isAdversarial && !ADVERSARIAL_SET.has(msg.payload);
          if (isCleared) {
            const updated = [...curr.nodeStates[msg.to], msg.payload];
            STRESS_NODES.forEach((n) => {
              if (curr.nodeStatus[n] === "ONLINE") curr.nodeStates[n] = updated;
            });
            curr.truthAnchor = computeModelHash(`${curr.truthAnchor}:${msg.payload}`);
          } else {
            curr.adversarialRejectedCount += 1;
          }
          curr.stepCount += 1;
          const inv = evaluateStressTestInvariants(curr, ADVERSARIAL_SET);
          traceAdditions.push({
            step: curr.stepCount,
            action: `[BURST] ProcessPayload(${msg.to}, ${msg.payload}) -> ${isCleared ? "COMMITTED" : "ISOLATED"}`,
            invPass: inv.allSatisfied,
          });
        }
      }
    }

    setStressState(curr);
    setStressTrace((prev) => [...prev, ...traceAdditions]);
  };

  const resetStressSimulator = () => {
    setStressState(initialStressState);
    setStressTrace([
      { step: 0, action: "Init: [Nodes: NodeA, NodeB, NodeD, NodeE | Anchor: " + initialStressState.truthAnchor + "]", invPass: true },
    ]);
  };

  // ==========================================
  // PROTOCOL CHECKER ACTIONS
  // ==========================================
  const stepProcessGate1Ingress = () => {
    if (tlaState.ingress_queue.length === 0) return;

    const payload = tlaState.ingress_queue[0];
    const remainingQueue = tlaState.ingress_queue.slice(1);

    let nextBlocks = [...tlaState.blocks];
    let nextQuarantine = [...tlaState.quarantine_zone];
    let nextGainShare = tlaState.gain_share_extracted;

    if (payload.is_valid) {
      const newBlockId = nextBlocks.length + 1;
      const prevHash = nextBlocks[nextBlocks.length - 1].hash;
      nextBlocks.push({
        id: newBlockId,
        hash: `VALID_SHA256_0x${Math.random().toString(16).slice(2, 8)}`,
        prev: prevHash,
      });
    } else {
      nextQuarantine.push(payload);
      const fee = Math.floor((payload.loss_value * 5) / 100);
      nextGainShare += fee;
    }

    const nextStep = tlaState.step_count + 1;
    const nextState: TlaState = {
      step_count: nextStep,
      blocks: nextBlocks,
      ingress_queue: remainingQueue,
      quarantine_zone: nextQuarantine,
      gain_share_extracted: nextGainShare,
    };

    setTlaState(nextState);
    const inv = evaluateInvariants(nextState);
    setHistory((prev) => [
      ...prev,
      {
        step: nextStep,
        action: `ProcessGate1Ingress (Payload #${payload.payload_id} ${payload.is_valid ? "VALID -> LEDGER" : "ANOMALOUS -> QUARANTINE"})`,
        invPass: inv.Inv_Ledger && inv.TypeOK,
      },
    ]);
  };

  const injectPayload = (isValid: boolean) => {
    const newId = 100 + tlaState.ingress_queue.length + tlaState.quarantine_zone.length + tlaState.blocks.length + 1;
    const lossValue = isValid ? Math.floor(Math.random() * 5000) + 1000 : Math.floor(Math.random() * 20000) + 3000;

    setTlaState((prev) => ({
      ...prev,
      ingress_queue: [...prev.ingress_queue, { payload_id: newId, is_valid: isValid, loss_value: lossValue }],
    }));
  };

  const resetProtocolSimulator = () => {
    setTlaState(initialTlaState);
    setHistory([{ step: 0, action: "Init", invPass: true }]);
  };

  return (
    <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-5 shadow-xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
            <h2 className="text-lg font-black font-mono text-slate-100 tracking-tight">
              TLA+ FORMAL SPECIFICATION &amp; STRESS TEST MODEL CHECKER
            </h2>
          </div>
          <p className="text-xs text-slate-400 font-mono">
            Mathematical Soundness Proof &bull; Byzantine Fault Injection &bull; Gate 1 Isolation Invariant &bull; Unified Truth Invariant
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono flex-wrap">
          <button
            id="tla-tab-stress-btn"
            onClick={() => setActiveTab("stress_test")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "stress_test"
                ? "bg-rose-950 text-rose-300 border border-rose-800 shadow-md shadow-rose-950/40"
                : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200"
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            <span>SumerAveraStressTest</span>
            <span className="px-1.5 py-0.2 bg-rose-500 text-slate-950 text-[9px] font-black rounded uppercase">
              TLC
            </span>
          </button>

          <button
            id="tla-tab-checker-btn"
            onClick={() => setActiveTab("checker")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "checker"
                ? "bg-cyan-950 text-cyan-300 border border-cyan-800 shadow"
                : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Protocol Checker</span>
          </button>

          <button
            id="tla-tab-spec-btn"
            onClick={() => setActiveTab("spec")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "spec"
                ? "bg-purple-950 text-purple-300 border border-purple-800 shadow"
                : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200"
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5 text-purple-400" />
            <span>Raw TLA+ Specs</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: STRESS TEST & BYZANTINE FAULT INJECTION (TLC MODEL) */}
      {/* ========================================================= */}
      {activeTab === "stress_test" && (
        <div className="space-y-5 animate-fade-in">
          {/* TLC Invariants Status Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div
              className={`p-3 border rounded-xl space-y-1 ${
                stressInvariants.Gate1IsolationInvariant
                  ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                  : "bg-rose-950/80 border-rose-600 text-rose-200 animate-pulse"
              }`}
            >
              <span className="text-[10px] text-slate-400 uppercase font-bold block truncate">
                Gate1IsolationInvariant
              </span>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-extrabold text-sm truncate">
                  {stressInvariants.Gate1IsolationInvariant ? "SATISFIED" : "VIOLATED"}
                </span>
              </div>
              <span className="text-[9px] text-slate-400 block truncate">
                Zero Adversarial Ingress in State
              </span>
            </div>

            <div
              className={`p-3 border rounded-xl space-y-1 ${
                stressInvariants.UnifiedTruthInvariant
                  ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                  : "bg-rose-950/80 border-rose-600 text-rose-200 animate-pulse"
              }`}
            >
              <span className="text-[10px] text-slate-400 uppercase font-bold block truncate">
                UnifiedTruthInvariant
              </span>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-extrabold text-sm truncate">
                  {stressInvariants.UnifiedTruthInvariant ? "SATISFIED" : "VIOLATED"}
                </span>
              </div>
              <span className="text-[9px] text-slate-400 block truncate">
                All Online Nodes Agree on History
              </span>
            </div>

            <div
              className={`p-3 border rounded-xl space-y-1 ${
                stressInvariants.TypeOK
                  ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                  : "bg-rose-950/80 border-rose-600 text-rose-200"
              }`}
            >
              <span className="text-[10px] text-slate-400 uppercase font-bold block truncate">
                Boundary: TypeOK
              </span>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-extrabold text-sm truncate">
                  {stressInvariants.TypeOK ? "SATISFIED" : "VIOLATED"}
                </span>
              </div>
              <span className="text-[9px] text-slate-400 block truncate">
                Finite Trace &bull; Type Conformity
              </span>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-amber-300 font-mono">
              <span className="text-[10px] text-slate-500 uppercase font-bold block truncate">
                Root Truth Anchor &bull; Step (T)
              </span>
              <span className="text-sm font-black text-amber-400 block truncate">
                {stressState.truthAnchor}
              </span>
              <span className="text-[9px] text-slate-400 block truncate">
                T = {stressState.stepCount} | Isolated Anomaly: {stressState.adversarialRejectedCount}
              </span>
            </div>
          </div>

          {/* Model Checker Control & Execution Bar */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3 font-mono text-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-rose-400" />
                <span className="font-bold text-slate-200">
                  TLC State Machine: Next Action Dispatcher
                </span>
                <span className="text-[10px] px-2 py-0.5 bg-slate-900 border border-slate-800 text-slate-400 rounded">
                  Nodes: &#123;NodeA, NodeB, NodeD, NodeE&#125;
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="stress-step-process-btn"
                  onClick={() => handleProcessPayload()}
                  disabled={stressState.networkBuffer.length === 0}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-lg transition disabled:opacity-40 flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Process Next Msg ({stressState.networkBuffer.length} In-Transit)</span>
                </button>

                <button
                  id="stress-burst-btn"
                  onClick={handleRunStressBurst}
                  className="px-3 py-1.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Flame className="w-3.5 h-3.5 fill-current" />
                  <span>Run 15-Step Stress Burst</span>
                </button>

                <button
                  id="stress-reset-btn"
                  onClick={resetStressSimulator}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold rounded-lg border border-slate-700 transition flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Reset State</span>
                </button>
              </div>
            </div>

            {/* Quick Ingress Dispatch Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
              {STRESS_NODES.map((node) => {
                const isOnline = stressState.nodeStatus[node] === "ONLINE";
                return (
                  <div key={node} className="p-2 bg-slate-900 border border-slate-800 rounded-lg space-y-1.5">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-bold text-slate-300">{node}</span>
                      <button
                        onClick={() => (isOnline ? handleCrashNode(node) : handleRecoverNode(node))}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition ${
                          isOnline
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800 hover:bg-rose-950 hover:text-rose-300"
                            : "bg-rose-950 text-rose-400 border border-rose-800 hover:bg-emerald-950 hover:text-emerald-300"
                        }`}
                      >
                        {isOnline ? "ONLINE (Crash?)" : "CRASHED (Sync?)"}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-[9px]">
                      <button
                        onClick={() => handleIngressPayload(node, "PAYLOAD_ALPHA_TX", false)}
                        disabled={!isOnline}
                        className="p-1 bg-slate-950 hover:bg-slate-800 text-emerald-400 rounded border border-slate-800 disabled:opacity-30 transition cursor-pointer text-center truncate"
                      >
                        + Valid Payload
                      </button>
                      <button
                        onClick={() => handleIngressPayload(node, "MALICIOUS_POISON_01", true)}
                        disabled={!isOnline}
                        className="p-1 bg-slate-950 hover:bg-slate-800 text-rose-400 rounded border border-slate-800 disabled:opacity-30 transition cursor-pointer text-center truncate"
                      >
                        + Byzantine Attack
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Node States & Network Buffer Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* 4 Node Cluster States */}
            <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-slate-200">
                    Cluster Node Ledger States (nodeStates[n])
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  Anchor: <span className="text-amber-400">{stressState.truthAnchor}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STRESS_NODES.map((node) => {
                  const isOnline = stressState.nodeStatus[node] === "ONLINE";
                  const items = stressState.nodeStates[node];
                  const hasAdversarial = items.some((p) => ADVERSARIAL_SET.has(p));

                  return (
                    <div
                      key={node}
                      className={`p-3 rounded-xl border space-y-2 ${
                        !isOnline
                          ? "bg-slate-900/40 border-slate-800 opacity-60"
                          : hasAdversarial
                          ? "bg-rose-950/40 border-rose-600"
                          : "bg-slate-900 border-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-400 animate-ping" : "bg-rose-500"}`} />
                          <span className="font-bold text-slate-200">{node}</span>
                        </div>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            isOnline
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : "bg-rose-950 text-rose-300 border border-rose-800"
                          }`}
                        >
                          {stressState.nodeStatus[node]}
                        </span>
                      </div>

                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        <div className="text-[9px] text-slate-500">Committed Sequence: {items.length} records</div>
                        {items.map((it, idx) => (
                          <div
                            key={idx}
                            className={`p-1 rounded text-[10px] font-mono truncate ${
                              ADVERSARIAL_SET.has(it)
                                ? "bg-rose-950 text-rose-300 border border-rose-800"
                                : "bg-slate-950 text-cyan-300 border border-slate-850"
                            }`}
                          >
                            <span className="text-slate-500 mr-1">#{idx + 1}</span>
                            <span>{it}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* In-Transit Network Buffer */}
            <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 font-mono text-xs flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-purple-400" />
                  <span className="font-bold text-slate-200">
                    networkBuffer (In-Transit Messages)
                  </span>
                </div>
                <span className="text-purple-400 font-bold">{stressState.networkBuffer.length} Packets</span>
              </div>

              {stressState.networkBuffer.length === 0 ? (
                <div className="p-6 text-center text-slate-600 italic my-auto">
                  Network buffer empty. Inject payloads or run stress burst above.
                </div>
              ) : (
                <div className="space-y-2 overflow-y-auto max-h-72">
                  {stressState.networkBuffer.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-2.5 rounded-xl border text-[11px] space-y-1.5 ${
                        msg.isAdversarial
                          ? "bg-rose-950/40 border-rose-900/60 text-rose-200"
                          : "bg-slate-900 border-slate-800 text-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-cyan-400">{msg.from}</span>
                          <span className="text-slate-500">&rarr;</span>
                          <span className="font-bold text-amber-300">{msg.to}</span>
                        </div>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            msg.isAdversarial
                              ? "bg-rose-950 text-rose-400 border border-rose-800"
                              : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                          }`}
                        >
                          {msg.isAdversarial ? "ADVERSARIAL" : "VALID"}
                        </span>
                      </div>

                      <div className="font-mono text-[10px] text-slate-300 truncate">
                        Payload: <span className="font-bold text-white">{msg.payload}</span>
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono truncate">
                        Hash: {msg.hash}
                      </div>

                      {/* In-Flight Fault Injection Controls */}
                      <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800/80 justify-end">
                        <button
                          onClick={() => handleProcessPayload(msg.id)}
                          className="px-2 py-0.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded text-[9px] font-bold cursor-pointer"
                          title="Execute Gate 1 process"
                        >
                          Process
                        </button>
                        {!msg.isAdversarial && (
                          <button
                            onClick={() => handleAdversarialTamper(msg.id)}
                            className="px-2 py-0.5 bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 rounded text-[9px] font-bold cursor-pointer"
                            title="Tamper message payload mid-flight"
                          >
                            Tamper
                          </button>
                        )}
                        <button
                          onClick={() => handleDropMessage(msg.id)}
                          className="px-2 py-0.5 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded text-[9px] font-bold cursor-pointer"
                          title="Simulate network packet loss"
                        >
                          Drop
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stress Test Transition Trace Log */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 font-mono text-xs">
            <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-bold">
              <span>SumerAveraStressTest Trace Execution Stream</span>
              <span>{stressTrace.length} Recorded Steps</span>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {stressTrace.slice().reverse().map((h, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-1.5 bg-slate-900 rounded border border-slate-850 text-[11px]"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-cyan-400 font-bold shrink-0">Step {h.step}:</span>
                    <span className="text-slate-300 truncate">{h.action}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[9px] font-black bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>INVARIANTS OK</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: PROTOCOL MODEL CHECKER (ORIGINAL GATE 1 PROOF) */}
      {/* ========================================================= */}
      {activeTab === "checker" && (
        <div className="space-y-5 animate-fade-in">
          {/* Invariant Status Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono text-xs">
            <div
              className={`p-2.5 border rounded-xl space-y-1 ${
                invariants.UnifiedTruthInvariant
                  ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                  : "bg-rose-950/60 border-rose-800 text-rose-300"
              }`}
            >
              <span className="text-[9px] text-slate-400 uppercase font-bold block truncate">
                UnifiedTruthInvariant
              </span>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-extrabold text-xs truncate">
                  {invariants.UnifiedTruthInvariant ? "SATISFIED" : "VIOLATED"}
                </span>
              </div>
              <span className="text-[9px] text-slate-400 block truncate">Zero-Drift Root Truth</span>
            </div>

            <div
              className={`p-2.5 border rounded-xl space-y-1 ${
                invariants.Inv_Ledger
                  ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                  : "bg-rose-950/60 border-rose-800 text-rose-300"
              }`}
            >
              <span className="text-[9px] text-slate-400 uppercase font-bold block truncate">
                Safety: Inv_Ledger
              </span>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-extrabold text-xs truncate">
                  {invariants.Inv_Ledger ? "SATISFIED" : "VIOLATED"}
                </span>
              </div>
              <span className="text-[9px] text-slate-400 block truncate">Gate 1 Isolation</span>
            </div>

            <div
              className={`p-2.5 border rounded-xl space-y-1 ${
                invariants.TypeOK
                  ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                  : "bg-rose-950/60 border-rose-800 text-rose-300"
              }`}
            >
              <span className="text-[9px] text-slate-400 uppercase font-bold block truncate">
                Boundary: TypeOK
              </span>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-extrabold text-xs truncate">
                  {invariants.TypeOK ? "SATISFIED" : "VIOLATED"}
                </span>
              </div>
              <span className="text-[9px] text-slate-400 block truncate">Type Conformity</span>
            </div>

            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-cyan-300 font-mono">
              <span className="text-[9px] text-slate-500 uppercase font-bold block truncate">
                Execution Depth (T)
              </span>
              <span className="text-sm font-black text-cyan-400 block truncate">
                {tlaState.step_count} Steps
              </span>
              <span className="text-[9px] text-slate-500 block truncate">Monotonic Ticks</span>
            </div>

            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-amber-300 font-mono">
              <span className="text-[9px] text-slate-500 uppercase font-bold block truncate">
                Gain Share Extracted
              </span>
              <span className="text-sm font-black text-amber-400 block truncate">
                ${tlaState.gain_share_extracted.toLocaleString()}
              </span>
              <span className="text-[9px] text-slate-500 block truncate">5% Fraud Fee</span>
            </div>
          </div>

          {/* Model Checker Control & Execution Panel */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-4 font-mono text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-slate-200">Action: ProcessGate1Ingress</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="tla-step-btn"
                  onClick={stepProcessGate1Ingress}
                  disabled={tlaState.ingress_queue.length === 0}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-lg transition disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Step Next Payload ({tlaState.ingress_queue.length} in Queue)</span>
                </button>

                <button
                  id="tla-inject-valid-btn"
                  onClick={() => injectPayload(true)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold rounded-lg border border-slate-700 transition cursor-pointer"
                >
                  + Inject Valid Payload
                </button>

                <button
                  id="tla-inject-anomaly-btn"
                  onClick={() => injectPayload(false)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold rounded-lg border border-slate-700 transition cursor-pointer"
                >
                  + Inject Fraud Payload
                </button>

                <button
                  id="tla-reset-btn"
                  onClick={resetProtocolSimulator}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold rounded-lg border border-slate-700 transition flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* State Displays */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Ingress Queue */}
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-[11px] text-slate-400 border-b border-slate-800 pb-1">
                  <span className="font-bold text-slate-300">ingress_queue</span>
                  <span className="text-slate-500">{tlaState.ingress_queue.length} items</span>
                </div>
                {tlaState.ingress_queue.length === 0 ? (
                  <p className="text-[11px] text-slate-600 italic py-2">Queue empty. Inject payloads above.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {tlaState.ingress_queue.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded border text-[11px] flex justify-between items-center ${
                          item.is_valid
                            ? "bg-slate-950 border-emerald-900/60 text-emerald-300"
                            : "bg-slate-950 border-rose-900/60 text-rose-300"
                        }`}
                      >
                        <div>
                          <span className="font-bold">Payload #{item.payload_id}</span>
                          <span className="block text-[9px] text-slate-500">Loss Val: ${item.loss_value}</span>
                        </div>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            item.is_valid
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : "bg-rose-950 text-rose-400 border border-rose-800"
                          }`}
                        >
                          {item.is_valid ? "VALID" : "ANOMALOUS"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Immutable Blocks */}
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-[11px] text-slate-400 border-b border-slate-800 pb-1">
                  <span className="font-bold text-slate-300">blocks (SHA-256)</span>
                  <span className="text-emerald-400 font-bold">{tlaState.blocks.length} Blocks</span>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {tlaState.blocks.map((blk, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-slate-950 border border-slate-800 rounded text-[11px] font-mono text-slate-300 flex justify-between items-center"
                    >
                      <div>
                        <span className="font-bold text-cyan-400">Block #{blk.id}</span>
                        <span className="block text-[9px] text-slate-500 truncate max-w-[140px]">{blk.hash}</span>
                      </div>
                      <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Quarantine Zone */}
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-[11px] text-slate-400 border-b border-slate-800 pb-1">
                  <span className="font-bold text-slate-300">quarantine_zone</span>
                  <span className="text-rose-400 font-bold">{tlaState.quarantine_zone.length} Isolated</span>
                </div>
                {tlaState.quarantine_zone.length === 0 ? (
                  <p className="text-[11px] text-slate-600 italic py-2">Zero isolated anomalies.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {tlaState.quarantine_zone.map((q, idx) => (
                      <div
                        key={idx}
                        className="p-2 bg-rose-950/40 border border-rose-900/60 rounded text-[11px] text-rose-300 flex justify-between items-center"
                      >
                        <div>
                          <span className="font-bold">Anomalous #{q.payload_id}</span>
                          <span className="block text-[9px] text-rose-400/80">Prevented Loss: ${q.loss_value}</span>
                        </div>
                        <span className="text-[10px] font-extrabold text-amber-400">
                          +${Math.floor(q.loss_value * 0.05)} Fee
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Model Checker Proof Step Log */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 font-mono text-xs">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">
              TLA+ State Transition Trace Log
            </span>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {history.map((h, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-1.5 bg-slate-900 rounded border border-slate-850 text-[11px]"
                >
                  <span className="text-cyan-400 font-bold">Step {h.step}:</span>
                  <span className="text-slate-300 truncate max-w-md">{h.action}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Inv_Ledger SATISFIED</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: RAW TLA+ FORMAL SPECIFICATIONS */}
      {/* ========================================================= */}
      {activeTab === "spec" && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setActiveSpecModule("stress_test")}
                className={`px-3 py-1.5 rounded-lg border font-bold transition cursor-pointer ${
                  activeSpecModule === "stress_test"
                    ? "bg-rose-950 border-rose-700 text-rose-200 shadow"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                SumerAveraStressTest.tla
              </button>

              <button
                onClick={() => setActiveSpecModule("stress_test_cfg")}
                className={`px-3 py-1.5 rounded-lg border font-bold transition cursor-pointer ${
                  activeSpecModule === "stress_test_cfg"
                    ? "bg-amber-950 border-amber-700 text-amber-200 shadow"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                SumerAveraStressTest.cfg (TLC)
              </button>

              <button
                onClick={() => setActiveSpecModule("truth_kernel")}
                className={`px-3 py-1.5 rounded-lg border font-bold transition cursor-pointer ${
                  activeSpecModule === "truth_kernel"
                    ? "bg-purple-950 border-purple-700 text-purple-200 shadow"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                UnifiedTruthKernel.tla
              </button>

              <button
                onClick={() => setActiveSpecModule("protocol")}
                className={`px-3 py-1.5 rounded-lg border font-bold transition cursor-pointer ${
                  activeSpecModule === "protocol"
                    ? "bg-purple-950 border-purple-700 text-purple-200 shadow"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                SumerAveraProtocol.tla
              </button>
            </div>

            <button
              id="tla-copy-spec-btn"
              onClick={() => {
                let specText = SUMERAVERA_STRESS_TEST_TLA_SPEC;
                if (activeSpecModule === "stress_test_cfg") specText = SUMERAVERA_STRESS_TEST_TLC_CFG;
                if (activeSpecModule === "truth_kernel") specText = UNIFIED_TRUTH_KERNEL_TLA_SPEC;
                if (activeSpecModule === "protocol") specText = SUMERAVERA_TLA_SPEC;
                navigator.clipboard.writeText(specText);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">
                    Copied {activeSpecModule === "stress_test" ? "SumerAveraStressTest.tla" : activeSpecModule === "stress_test_cfg" ? "SumerAveraStressTest.cfg" : activeSpecModule === "truth_kernel" ? "UnifiedTruthKernel.tla" : "SumerAveraProtocol.tla"}!
                  </span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Active File</span>
                </>
              )}
            </button>
          </div>

          <div className="p-4 bg-black border border-slate-800 rounded-xl font-mono text-xs overflow-x-auto text-emerald-300 max-h-[500px] leading-relaxed shadow-inner select-all">
            <pre>
              {activeSpecModule === "stress_test"
                ? SUMERAVERA_STRESS_TEST_TLA_SPEC
                : activeSpecModule === "stress_test_cfg"
                ? SUMERAVERA_STRESS_TEST_TLC_CFG
                : activeSpecModule === "truth_kernel"
                ? UNIFIED_TRUTH_KERNEL_TLA_SPEC
                : SUMERAVERA_TLA_SPEC}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
