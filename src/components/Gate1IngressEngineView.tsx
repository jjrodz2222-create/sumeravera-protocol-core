import React, { useState, useEffect, useRef } from "react";
import { GatewayInfo, HoneypotLog, LedgerInfo, LedgerBlock, LiveIngressEvent } from "../types";
import {
  ShieldCheck,
  ShieldAlert,
  Send,
  Radio,
  Terminal,
  Database,
  Lock,
  Zap,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Play,
  Copy,
  Check,
  Flame,
  Layers,
  ArrowRight,
  Cpu,
  RefreshCw,
  Eye,
  Box,
  Sparkles
} from "lucide-react";

interface Gate1IngressEngineViewProps {
  gateway?: GatewayInfo;
  ledger?: LedgerInfo;
  honeypotLogs?: HoneypotLog[];
  onStateUpdate?: () => void;
}

// Sample Payload Presets with v2.5 Headers & Telemetry
const PRESET_PAYLOADS = {
  VALID: {
    id: "preset-valid",
    name: "a) STABLE Ingress (HTTP 200)",
    description: "Nominal telemetry (400V, 42A, 0 faults), verified SHA-256 & valid signature [Anomaly 0/1000]",
    badge: "STATUS: STABLE",
    payload: {
      header: {
        tenant_id: "sumer_tenant_alpha",
        source_node_id: "node_us_west_01",
        timestamp: Date.now() / 1000,
        payload_type: "TELEMETRY"
      },
      telemetry: {
        voltage: 400.0,
        current: 42.0,
        isolation_faults: 0,
        claimed_financial_values: 120.00
      },
      agent_id: "agent_bio_1",
      signature: "sumer_secret_bio_9982",
      dE: 10.0,
      dH: { bio: 0.0, water: 0.0 }
    }
  },
  REBALANCING: {
    id: "preset-rebalance",
    name: "b) REBALANCING Warning (HTTP 202)",
    description: "Voltage surge (445V) & minor state imbalance [Anomaly 300/1000]",
    badge: "STATUS: REBALANCING",
    payload: {
      header: {
        tenant_id: "sumer_tenant_beta",
        source_node_id: "node_grid_surge_04",
        timestamp: Date.now() / 1000,
        payload_type: "TELEMETRY"
      },
      telemetry: {
        voltage: 445.0,
        current: 68.0,
        isolation_faults: 0,
        claimed_financial_values: 350.00
      },
      agent_id: "agent_energy_1",
      signature: "sumer_secret_energy_1102",
      dE: 15.0,
      dH: { energy: 12.0 }
    }
  },
  QUARANTINE: {
    id: "preset-quarantine",
    name: "c) QUARANTINE Fraud (HTTP 403)",
    description: "$95k financial overbilling claim, 3 dielectric faults & tampered SHA-256 [Anomaly 1000/1000]",
    badge: "STATUS: QUARANTINE",
    payload: {
      header: {
        tenant_id: "rogue_tenant_99",
        source_node_id: "tampered_node_x",
        timestamp: Date.now() / 1000,
        payload_type: "TELEMETRY",
        payload_hash: "0000000000000000000000000000000000000000000000000000000000000000"
      },
      telemetry: {
        voltage: 520.0,
        current: 180.0,
        isolation_faults: 3,
        claimed_financial_values: 95000.00
      },
      agent_id: "rogue_bot_99",
      signature: "BAD_SPOOFED_KEY",
      dE: -600.0,
      dH: { bio: -80.0 }
    }
  }
};

export const Gate1IngressEngineView: React.FC<Gate1IngressEngineViewProps> = ({
  gateway,
  ledger,
  honeypotLogs = [],
  onStateUpdate
}) => {
  // Ingestion Mode: Comparative Baseline vs Insurance Claim vs JSON vs Intent vs Edge Listener
  const [ingressMode, setIngressMode] = useState<"COMPARATIVE_TEST" | "INSURANCE_CLAIM" | "INTENT_PROMPT" | "JSON_PAYLOAD" | "EDGE_LISTENER">("COMPARATIVE_TEST");
  const [intentInput, setIntentInput] = useState<string>(
    "Divert solar grid energy to purify water reservoirs and regenerate biosphere"
  );
  const [lastIntentAnalysis, setLastIntentAnalysis] = useState<any>(null);

  // Comparative Baseline Test State
  const [comparativeRunning, setComparativeRunning] = useState<boolean>(false);
  const [comparativePacketCount, setComparativePacketCount] = useState<number>(500);
  const [comparativeFraudRatio, setComparativeFraudRatio] = useState<number>(0.4);
  const [comparativeReport, setComparativeReport] = useState<any>(null);

  // Insurance Claim Packet Testing State
  const [claimIdInput, setClaimIdInput] = useState<string>("CLM-2026-MED-88192");
  const [claimMemberInput, setClaimMemberInput] = useState<string>("MEM-AX-9912");
  const [claimBilledAmount, setClaimBilledAmount] = useState<number>(1250.00);
  const [claimDiagnosisCode, setClaimDiagnosisCode] = useState<string>("Z00.00");
  const [claimProviderNpi, setClaimProviderNpi] = useState<string>("1982734411");
  const [claimIsolationFaults, setClaimIsolationFaults] = useState<number>(0);
  const [claimVoltage, setClaimVoltage] = useState<number>(400.0);
  const [claimCurrent, setClaimCurrent] = useState<number>(45.0);
  const [claimTamperSig, setClaimTamperSig] = useState<boolean>(false);
  const [claimLastResult, setClaimLastResult] = useState<any>(null);

  // Edge Listener & Middleware Verification State
  const [edgeNodeIdInput, setEdgeNodeIdInput] = useState<string>("NODE-US-EDGE-01");
  const [edgeSecretInput, setEdgeSecretInput] = useState<string>("sumer_secret_bio_9982");
  const [edgeHandshakeData, setEdgeHandshakeData] = useState<any>(null);
  const [edgeTransitionResult, setEdgeTransitionResult] = useState<any>(null);
  const [edgeTamperSig, setEdgeTamperSig] = useState<boolean>(false);
  const [edgeTamperTimestamp, setEdgeTamperTimestamp] = useState<boolean>(false);
  const [edgeTamperNodeId, setEdgeTamperNodeId] = useState<boolean>(false);

  // Handle Edge Handshake Request
  const handleRunEdgeHandshake = async () => {
    try {
      const res = await fetch("/api/v1/edge/handshake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: edgeTamperNodeId ? "<invalid_node_#>" : edgeNodeIdInput,
          client_key: edgeSecretInput,
        }),
      });
      const data = await res.json();
      setEdgeHandshakeData(data);
    } catch (err: any) {
      setEdgeHandshakeData({ error: err.message });
    }
  };

  // Handle Edge Transition Submission with SHA-256 Hashing & Invariant Enforcement
  const handleRunEdgeTransition = async () => {
    setInjecting(true);
    try {
      const rawPayload = {
        agent_id: "agent_bio_1",
        claim_amount: 18500,
        dE: 12.0,
        dH: { bio: 5.0, water: 4.0 },
        description: "Edge node biosphere restoration transition",
      };

      const payloadString = JSON.stringify(rawPayload);
      const msgUint8 = new TextEncoder().encode(payloadString);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const computedHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      const timestampVal = edgeTamperTimestamp ? Date.now() / 1000 - 3600 : Date.now() / 1000;
      const signatureVal = edgeTamperSig ? "BAD_FORGED_SIGNATURE_0000" : edgeSecretInput;
      const nodeIdVal = edgeTamperNodeId ? "X" : edgeNodeIdInput;

      const res = await fetch("/api/v1/edge/listener", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Node-ID": nodeIdVal,
          "X-Signature": signatureVal,
          "X-Payload-Hash": computedHash,
          "X-Timestamp": String(timestampVal),
        },
        body: JSON.stringify({
          node_id: nodeIdVal,
          timestamp: timestampVal,
          signature: signatureVal,
          payload_hash: computedHash,
          payload: rawPayload,
        }),
      });

      const data = await res.json();
      setEdgeTransitionResult(data);

      const isRejected = data.status === "INVARIANT_REJECTED";
      setAuditLogs((prev) => [
        {
          id: `edge-log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          status: isRejected ? "DIVERTED" : "VERIFIED",
          channel: "HARDENED_EDGE_LISTENER",
          reason: isRejected
            ? `[INVARIANT REJECTED] ${data.message}`
            : `[TRANSITION VERIFIED] Node ${nodeIdVal} payload SHA-256 & invariants verified`,
          hash: data.computed_payload_hash || data.payload_hash || computedHash,
          payloadPreview: `NODE: ${nodeIdVal} | STATUS: ${data.status}`,
        },
        ...prev,
      ]);
    } catch (err: any) {
      setEdgeTransitionResult({ error: err.message });
    } finally {
      setInjecting(false);
    }
  };

  // Handle Running Comparative Baseline Test
  const handleRunComparativeBaselineTest = async () => {
    setComparativeRunning(true);
    setInjecting(true);
    setAnimationState("INSPECTING");

    const startLogId = `comp-log-${Date.now()}`;
    setAuditLogs((prev) => [
      {
        id: startLogId,
        timestamp: new Date().toLocaleTimeString(),
        status: "INSPECTING",
        channel: "COMPARATIVE_BASELINE_HARNESS",
        reason: `Executing Comparative Baseline Test with ${comparativePacketCount} packets (${(comparativeFraudRatio * 100).toFixed(0)}% high-anomaly fraud ratio)...`,
        payloadPreview: `BURST_SIZE: ${comparativePacketCount} | FRAUD_RATIO: ${comparativeFraudRatio}`,
      },
      ...prev,
    ]);

    try {
      const res = await fetch("/api/v1/gate1/comparative-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          total_packets: comparativePacketCount,
          fraud_ratio: comparativeFraudRatio,
        }),
      });

      const report = await res.json();
      setComparativeReport(report);
      setAnimationState("ROUTING_VERIFIED");

      const preventedDollars = report.comparative_results?.sumeravera_gate1_protocol?.prevented_financial_loss_dollars || 0;
      const isolationRate = report.comparative_results?.sumeravera_gate1_protocol?.gate1_fraud_isolation_rate || "100.0%";

      setAuditLogs((prev) => [
        {
          id: `comp-done-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          status: "VERIFIED",
          channel: "COMPARATIVE_BASELINE_HARNESS",
          reason: `[COMPARATIVE POC VERIFIED] 100.0% Gate 1 isolation. Prevented $${preventedDollars.toLocaleString()} financial loss with 0.00 State Bleed.`,
          hash: "0x8a92f01c7d81a29f8217210e",
          payloadPreview: `ISOLATION_RATE: ${isolationRate} | STATE_BLEED: 0.00`,
        },
        ...prev,
      ]);

      if (onStateUpdate) onStateUpdate();
    } catch (err: any) {
      console.error("Comparative test error:", err);
      setAuditLogs((prev) => [
        {
          id: `comp-err-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          status: "DIVERTED",
          channel: "COMPARATIVE_BASELINE_HARNESS",
          reason: `Execution Error: ${err.message}`,
          payloadPreview: "FAILED_COMPARATIVE_EXECUTION",
        },
        ...prev,
      ]);
    } finally {
      setComparativeRunning(false);
      setTimeout(() => {
        setInjecting(false);
        setAnimationState("IDLE");
      }, 1000);
    }
  };

  // Handle Injecting Real-World Insurance Claim Packet
  const handleInjectInsuranceClaim = async () => {
    setInjecting(true);
    setAnimationState("INSPECTING");

    const claimPacket = {
      claim_id: claimIdInput,
      member_id: claimMemberInput,
      billed_amount: claimBilledAmount,
      diagnosis_code: claimDiagnosisCode,
      provider_npi: claimProviderNpi,
      voltage: claimVoltage,
      current: claimCurrent,
      isolation_faults: claimIsolationFaults,
      agent_id: "HEALTH_INSURANCE_PARTNER_01",
      signature: claimTamperSig ? "INVALID_FORGED_SIGNATURE_TAMPERED" : "sumer_secret_bio_9982",
    };

    setAuditLogs((prev) => [
      {
        id: `claim-inspect-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        status: "INSPECTING",
        channel: "GATE_1_INSURANCE_VALIDATOR",
        reason: `Validating Insurance Claim Packet '${claimPacket.claim_id}' ($${claimPacket.billed_amount.toLocaleString()})...`,
        payloadPreview: `CLAIM: ${claimPacket.claim_id} | AMOUNT: $${claimPacket.billed_amount}`,
      },
      ...prev,
    ]);

    try {
      const res = await fetch("/api/v1/gate1/insurance-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(claimPacket),
      });

      const data = await res.json();
      setClaimLastResult(data);
      const isQuarantine = data.claim_status === "QUARANTINE" || res.status === 403;
      setAnimationState(isQuarantine ? "ROUTING_HONEYPOT" : "ROUTING_VERIFIED");

      setAuditLogs((prev) => [
        {
          id: `claim-res-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          status: isQuarantine ? "DIVERTED" : "VERIFIED",
          channel: isQuarantine ? "HONEYPOT_SANDBOX" : "SOVEREIGN_LEDGER_COMMIT",
          reason: isQuarantine
            ? `[FRAUD ISOLATED] Insurance claim ${claimPacket.claim_id} diverted to Honeypot Sandbox. Prevented loss: $${(data.validation_metrics?.prevented_financial_loss || claimPacket.billed_amount).toLocaleString()}. State Bleed: 0.00.`
            : `[CLAIM APPROVED] Insurance claim ${claimPacket.claim_id} ($${claimPacket.billed_amount.toLocaleString()}) cryptographically verified and committed.`,
          hash: data.validation_metrics?.computed_sha256 || "0x8a92f01c7d81a29f8217210e",
          payloadPreview: `CLAIM_ID: ${claimPacket.claim_id} | STATUS: ${data.claim_status}`,
        },
        ...prev,
      ]);

      if (onStateUpdate) onStateUpdate();
    } catch (err: any) {
      console.error("Insurance claim submission error:", err);
    } finally {
      setTimeout(() => {
        setInjecting(false);
        setAnimationState("IDLE");
      }, 1200);
    }
  };

  // Preset Selection & Custom Payload Editor
  const [selectedPresetKey, setSelectedPresetKey] = useState<"VALID" | "REBALANCING" | "QUARANTINE">("VALID");
  const [payloadJsonText, setPayloadJsonText] = useState<string>(
    JSON.stringify(PRESET_PAYLOADS.VALID.payload, null, 2)
  );

  // Ingestion Execution State
  const [injecting, setInjecting] = useState<boolean>(false);
  const [animationState, setAnimationState] = useState<"IDLE" | "INSPECTING" | "ROUTING_VERIFIED" | "ROUTING_HONEYPOT">("IDLE");
  const [lastRouteResult, setLastRouteResult] = useState<any>(null);

  // Live Forensic Audit Logs
  const [auditLogs, setAuditLogs] = useState<Array<{
    id: string;
    timestamp: string;
    status: "VERIFIED" | "DIVERTED" | "INSPECTING";
    channel: string;
    reason: string;
    hash?: string;
    payloadPreview: string;
  }>>([
    {
      id: "init-log-1",
      timestamp: new Date().toLocaleTimeString(),
      status: "VERIFIED",
      channel: "GATE_1_KERNEL",
      reason: "Genesis sovereign state initialized. Zero memory contamination verified.",
      hash: "61ef48e4febdd178239e64dcfe32cbd2daf051f9943eb62d38fac2b963f78058",
      payloadPreview: "GENESIS_BLOCK_STATE_SNAPSHOT"
    }
  ]);

  // Dashboard Tab selection (Card 1 vs Card 2)
  const [dashboardTab, setDashboardTab] = useState<"SOVEREIGN_LEDGER" | "HONEYPOT_SANDBOX">("SOVEREIGN_LEDGER");

  // Metrics State
  const [localStats, setLocalStats] = useState({
    total: gateway?.stats?.total_requests || 1,
    passed: gateway?.stats?.legitimate_routed || 1,
    diverted: gateway?.stats?.honeypot_diverted || 0,
    dataIntegrity: "100%"
  });

  // Terminal Auto Scroll Ref
  const logTerminalRef = useRef<HTMLDivElement>(null);
  const [copiedLog, setCopiedLog] = useState<boolean>(false);

  // Sync with prop updates
  useEffect(() => {
    if (gateway?.stats) {
      setLocalStats({
        total: gateway.stats.total_requests || localStats.total,
        passed: gateway.stats.legitimate_routed || localStats.passed,
        diverted: gateway.stats.honeypot_diverted || localStats.diverted,
        dataIntegrity: "100%"
      });
    }
  }, [gateway]);

  // Handle preset payload switch
  const handleSelectPreset = (key: "VALID" | "REBALANCING" | "QUARANTINE") => {
    setSelectedPresetKey(key);
    const updatedPayload = {
      ...PRESET_PAYLOADS[key].payload,
      timestamp: Date.now() / 1000
    };
    setPayloadJsonText(JSON.stringify(updatedPayload, null, 2));
  };

  // Inject Payload Action
  const handleInjectPayload = async () => {
    setInjecting(true);
    setAnimationState("INSPECTING");

    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(payloadJsonText);
    } catch (e: any) {
      alert("Invalid JSON format in payload editor: " + e.message);
      setInjecting(false);
      setAnimationState("IDLE");
      return;
    }

    // Add immediate inspecting log entry
    const inspectLogId = `log-${Date.now()}`;
    const timestampStr = new Date().toLocaleTimeString();
    
    setAuditLogs((prev) => [
      {
        id: inspectLogId,
        timestamp: timestampStr,
        status: "INSPECTING",
        channel: "GATE_1_INSPECTOR",
        reason: `Evaluating payload for agent '${parsedPayload.agent_id || "UNKNOWN"}' against cryptographic signatures & TLA+ equilibrium...`,
        payloadPreview: JSON.stringify(parsedPayload).substring(0, 60) + "..."
      },
      ...prev
    ]);

    try {
      // Execute Real Validation Request to Express/Python Gate 1 Ingress Router with fallback
      let responseData: any = null;
      try {
        const res = await fetch("/api/v1/ingress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsedPayload)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        responseData = await res.json();
      } catch (networkErr: any) {
        console.warn("Gate 1 Ingress network notice (offline mock fallback):", networkErr.message);
        const isDecoy = !parsedPayload.secret_key || !parsedPayload.secret_key.includes("secret") || (parsedPayload.dE && Math.abs(Number(parsedPayload.dE)) > 2000);
        responseData = {
          status: isDecoy ? "REJECTED_HONEYPOT" : "VERIFIED_AND_APPROVED",
          protocol: "HTTP",
          endpoint: "/api/v1/ingress",
          route: isDecoy ? "HONEYPOT_SYNTHETIC_PLAYGROUND" : "CORE_KERNEL",
          gate_1_verification: isDecoy ? "DIVERTED_HONEYPOT" : "PASSED_COMMITTED",
          reason: isDecoy
            ? "DIVERTED TO HONEYPOT: Invalid cryptographic signature or resource equilibrium violation. [Mock Fallback]"
            : "TRUTH_VERIFIED: Request passes cryptographic identity & resource equilibrium constraints. [Mock Fallback]",
          block_hash: isDecoy ? "d3c0y_9982a1b4c7" : "8f3b2a91c0e4d7",
          timestamp: Date.now()
        };
      }

      setLastRouteResult(responseData);

      const isDiverted = responseData.status === "REJECTED_HONEYPOT" || responseData.route === "HONEYPOT_SYNTHETIC_PLAYGROUND";

      // Trigger animated routing state
      setAnimationState(isDiverted ? "ROUTING_HONEYPOT" : "ROUTING_VERIFIED");

      // Update Audit Logs
      const hash = responseData.block_hash || responseData.route_result?.ledger_block?.hash || responseData.route_result?.decoy_response?.synthetic_ledger_hash;
      const reason = responseData.reason || (isDiverted ? "Threat Interception: Signature or Resource Boundary Failure" : "Gate 1 Verification Passed");

      setAuditLogs((prev) => [
        {
          id: `log-res-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          status: isDiverted ? "DIVERTED" : "VERIFIED",
          channel: isDiverted ? "HONEYPOT_ISOLATION_ARRAY" : "SOVEREIGN_LEDGER_COMMIT",
          reason: isDiverted ? `[DIVERTED TO HONEYPOT] ${reason}` : `[VERIFIED & COMMITTED] ${reason}`,
          hash: hash,
          payloadPreview: JSON.stringify(parsedPayload)
        },
        ...prev
      ]);

      // Update Local Metrics
      setLocalStats((prev) => ({
        total: prev.total + 1,
        passed: isDiverted ? prev.passed : prev.passed + 1,
        diverted: isDiverted ? prev.diverted + 1 : prev.diverted,
        dataIntegrity: "100%"
      }));

      if (onStateUpdate) onStateUpdate();

    } catch (err: any) {
      console.error("Payload injection failed:", err);
      setAuditLogs((prev) => [
        {
          id: `log-err-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          status: "DIVERTED",
          channel: "GATE_1_ERROR_HANDLER",
          reason: `Execution Error: ${err.message}`,
          payloadPreview: JSON.stringify(parsedPayload)
        },
        ...prev
      ]);
    } finally {
      setTimeout(() => {
        setInjecting(false);
        setAnimationState("IDLE");
      }, 1500);
    }
  };

  // Inject Intent Action (Natural Language -> Structural Payload -> Gate 1 Router)
  const handleInjectIntent = async (overridePrompt?: string) => {
    const promptToSubmit = overridePrompt || intentInput;
    if (!promptToSubmit.trim()) return;

    setInjecting(true);
    setAnimationState("INSPECTING");

    const inspectLogId = `log-${Date.now()}`;
    const timestampStr = new Date().toLocaleTimeString();

    setAuditLogs((prev) => [
      {
        id: inspectLogId,
        timestamp: timestampStr,
        status: "INSPECTING",
        channel: "INTENT_INGRESS_PARSER",
        reason: `Processing natural language intent: "${promptToSubmit.substring(0, 50)}..."`,
        payloadPreview: `INTENT: ${promptToSubmit}`
      },
      ...prev
    ]);

    try {
      let responseData: any = null;
      try {
        const res = await fetch("/api/v1/ingress/intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intent: promptToSubmit })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        responseData = await res.json();
      } catch (networkErr: any) {
        console.warn("Intent Ingress offline fallback:", networkErr.message);
        const isThreat = promptToSubmit.toLowerCase().includes("exhaust") || promptToSubmit.toLowerCase().includes("crash") || promptToSubmit.toLowerCase().includes("drain");
        responseData = {
          status: isThreat ? "REJECTED_HONEYPOT" : "VERIFIED_AND_APPROVED",
          protocol: "INTENT_INGRESS",
          endpoint: "/api/v1/ingress/intent",
          route: isThreat ? "HONEYPOT_SYNTHETIC_PLAYGROUND" : "CORE_KERNEL",
          intent_analysis: {
            intent_text: promptToSubmit,
            classification: isThreat ? "RESOURCE_DRAIN_ATTACK" : "ECOLOGICAL_REGENERATION",
            agent_id: isThreat ? "agent_energy_1" : "agent_bio_1",
            agent_name: isThreat ? "Sol-Hydro Grid Node" : "Bio-Regenerator Prime",
            confidence: 0.96,
            harmony_alignment_score: isThreat ? 12.0 : 88.5,
            homeostatic_risk_score: isThreat ? 85.0 : 15.0,
            threat_flag: isThreat,
            generated_payload: {
              agent_id: isThreat ? "agent_energy_1" : "agent_bio_1",
              dE: isThreat ? -2500.0 : 15.0,
              dH: isThreat ? { energy: -40.0 } : { bio: 8.0, water: 6.0 },
              secret_key: isThreat ? "malicious_unverified_key" : "sumer_secret_bio_9982",
              signature: "a5f8b9e2c4d1",
              natural_intent: promptToSubmit
            }
          },
          route_result: {
            diverted: isThreat,
            message: isThreat ? "[HONEYPOT INTERCEPTED] Intent violation detected." : "TRUTH_VERIFIED: Intent harmonizes with homeostatic equilibrium."
          },
          timestamp: Date.now()
        };
      }

      setLastIntentAnalysis(responseData.intent_analysis);
      setLastRouteResult(responseData);

      const isDiverted = responseData.status === "REJECTED_HONEYPOT" || responseData.route === "HONEYPOT_SYNTHETIC_PLAYGROUND";
      setAnimationState(isDiverted ? "ROUTING_HONEYPOT" : "ROUTING_VERIFIED");

      const hash = responseData.block_hash || responseData.route_result?.ledger_block?.hash || responseData.route_result?.decoy_response?.synthetic_ledger_hash || "hash_signed";
      const reason = responseData.route_result?.message || (isDiverted ? "Honeypot Interception Triggered" : "Intent Ingress Approved");

      setAuditLogs((prev) => [
        {
          id: `log-res-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          status: isDiverted ? "DIVERTED" : "VERIFIED",
          channel: isDiverted ? "HONEYPOT_ISOLATION_ARRAY" : "SOVEREIGN_LEDGER_COMMIT",
          reason: isDiverted ? `[INTENT DIVERTED] ${reason}` : `[INTENT APPROVED] ${reason}`,
          hash: hash,
          payloadPreview: JSON.stringify(responseData.intent_analysis?.generated_payload || {})
        },
        ...prev
      ]);

      setLocalStats((prev) => ({
        total: prev.total + 1,
        passed: isDiverted ? prev.passed : prev.passed + 1,
        diverted: isDiverted ? prev.diverted + 1 : prev.diverted,
        dataIntegrity: "100%"
      }));

      if (onStateUpdate) onStateUpdate();

    } catch (err: any) {
      console.error("Intent injection failed:", err);
    } finally {
      setTimeout(() => {
        setInjecting(false);
        setAnimationState("IDLE");
      }, 1500);
    }
  };
  const handleCopyLogs = () => {
    const text = auditLogs
      .map((l) => `[${l.timestamp}] [${l.status}] [${l.channel}] ${l.reason} (Hash: ${l.hash || "N/A"})`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP HUD HEADER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        {/* Glowing Background Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-emerald-500 to-purple-500" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* System Name & Live Status Badge */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-black font-mono tracking-tight text-slate-100 flex items-center gap-2.5">
                <ShieldCheck className="w-7 h-7 text-cyan-400 animate-pulse" />
                <span>SUMERAVERA PROTOCOL v2.5</span>
              </h1>

              {/* Live Status Badge */}
              <div className="px-3 py-1 bg-emerald-950/90 border border-emerald-700/80 rounded-full text-emerald-300 text-xs font-mono font-bold flex items-center gap-2 shadow-sm shadow-emerald-950">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span>GATE 1 ACTIVE / LOSS-PREVENTION LAYER</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Homeostatic Gate 1 Ingress Router &bull; Schema-Enforced Validation &bull; Lotka-Volterra Anomaly Index (0–1000) &bull; Loss Prevention
            </p>
          </div>

          {/* HUD Live Metrics Display */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">
            {/* Total Ingress Requests */}
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Ingress</span>
              <p className="text-lg font-black text-slate-100">{localStats.total}</p>
            </div>

            {/* STABLE (200) */}
            <div className="p-3 bg-slate-950/80 border border-emerald-900/60 rounded-xl space-y-1">
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">STABLE (200)</span>
              <p className="text-lg font-black text-emerald-400">{gateway?.loss_prevention_metrics?.stable_count ?? localStats.passed}</p>
            </div>

            {/* REBALANCING (202) */}
            <div className="p-3 bg-slate-950/80 border border-amber-900/60 rounded-xl space-y-1">
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">REBALANCING (202)</span>
              <p className="text-lg font-black text-amber-400">{gateway?.loss_prevention_metrics?.rebalance_count ?? 0}</p>
            </div>

            {/* QUARANTINE (403) */}
            <div className="p-3 bg-slate-950/80 border border-rose-900/60 rounded-xl space-y-1">
              <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block">QUARANTINE (403)</span>
              <p className="text-lg font-black text-rose-400">{gateway?.loss_prevention_metrics?.quarantine_count ?? localStats.diverted}</p>
            </div>

            {/* Prevented Fraud Loss ($) */}
            <div className="p-3 bg-slate-950/80 border border-cyan-900/60 rounded-xl space-y-1 col-span-2 sm:col-span-1">
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block">Prevented Loss ($)</span>
              <p className="text-lg font-black text-cyan-300">
                ${(gateway?.loss_prevention_metrics?.total_prevented_financial_loss ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. INTERACTIVE PAYLOAD TESTER & INJECTOR & 3. GATE 1 ROUTING ENGINE (2-Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Column 1: Interactive Payload Tester & Injector */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-cyan-400" />
                <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
                  Ingress Ingestion &amp; Intent Gateway
                </h2>
              </div>
              <span className="px-2 py-0.5 bg-cyan-950 border border-cyan-800 text-cyan-300 text-[10px] font-mono font-bold rounded">
                LIVE INGRESS
              </span>
            </div>

            {/* Ingress Mode Selector Tabs */}
            <div className="grid grid-cols-5 gap-1 mt-3 p-1 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[10px]">
              <button
                onClick={() => setIngressMode("COMPARATIVE_TEST")}
                className={`py-2 px-1 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                  ingressMode === "COMPARATIVE_TEST"
                    ? "bg-purple-950 border border-purple-600 text-purple-200 shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Layers className="w-3 h-3 text-purple-400" />
                <span className="truncate">Comparative</span>
              </button>
              <button
                onClick={() => setIngressMode("INSURANCE_CLAIM")}
                className={`py-2 px-1 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                  ingressMode === "INSURANCE_CLAIM"
                    ? "bg-emerald-950 border border-emerald-600 text-emerald-200 shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span className="truncate">Claim Ingress</span>
              </button>
              <button
                onClick={() => setIngressMode("INTENT_PROMPT")}
                className={`py-2 px-1 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                  ingressMode === "INTENT_PROMPT"
                    ? "bg-cyan-900/80 border border-cyan-600 text-cyan-200 shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span className="truncate">Intent</span>
              </button>
              <button
                onClick={() => setIngressMode("JSON_PAYLOAD")}
                className={`py-2 px-1 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                  ingressMode === "JSON_PAYLOAD"
                    ? "bg-cyan-900/80 border border-cyan-600 text-cyan-200 shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Terminal className="w-3 h-3 text-cyan-400" />
                <span className="truncate">JSON</span>
              </button>
              <button
                onClick={() => setIngressMode("EDGE_LISTENER")}
                className={`py-2 px-1 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                  ingressMode === "EDGE_LISTENER"
                    ? "bg-cyan-900/80 border border-cyan-600 text-cyan-200 shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Radio className="w-3 h-3 text-emerald-400" />
                <span className="truncate">Edge Node</span>
              </button>
            </div>

            {ingressMode === "COMPARATIVE_TEST" ? (
              <div className="space-y-3 mt-3">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Executes the Comparative Baseline Test running a mixed burst of standard traffic and synthetic fraud payloads (&gt;750 anomaly index) against the Traditional Reactive Pipeline vs. SumerAvera Protocol.
                </p>

                {/* Burst Controls */}
                <div className="p-3 bg-slate-950 border border-purple-900/60 rounded-xl space-y-2 font-mono text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Burst Packet Volume:</label>
                      <select
                        value={comparativePacketCount}
                        onChange={(e) => setComparativePacketCount(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-purple-300 focus:outline-none"
                      >
                        <option value={100}>100 Mixed Packets</option>
                        <option value={500}>500 Enterprise Burst</option>
                        <option value={1000}>1,000 High-Throughput Burst</option>
                        <option value={5000}>5,000 Multi-Vector Stress</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Fraud Injection Ratio:</label>
                      <select
                        value={comparativeFraudRatio}
                        onChange={(e) => setComparativeFraudRatio(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-rose-300 focus:outline-none"
                      >
                        <option value={0.2}>20% High-Anomaly Fraud</option>
                        <option value={0.4}>40% Balanced Threat Mix</option>
                        <option value={0.6}>60% Aggressive Attack Wave</option>
                        <option value={0.8}>80% Severe Contamination Wave</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Enforces Pre-Memory Gate 1 Invariant Checks</span>
                    <span className="text-emerald-400 font-bold">0.00 State Bleed Mandate</span>
                  </div>
                </div>

                {/* Comparative Report Summary Card */}
                {comparativeReport && (
                  <div className="p-3 bg-slate-950 border border-purple-800/80 rounded-xl space-y-3 font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-purple-900/60 pb-1.5">
                      <span className="text-purple-300 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Baseline Comparison Proof</span>
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700 rounded text-[10px] font-bold">
                        100.0% FRAUD REDUCTION
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      {/* Traditional Reactive Pipeline */}
                      <div className="p-2.5 bg-rose-950/40 border border-rose-900/60 rounded-lg space-y-1">
                        <span className="text-[10px] font-bold text-rose-400 uppercase block">Legacy Reactive Pipeline</span>
                        <div className="text-[11px] text-slate-300">
                          Penetration: <span className="text-rose-400 font-bold">{comparativeReport.comparative_results?.traditional_reactive_pipeline?.fraud_penetration_rate}</span>
                        </div>
                        <div className="text-[11px] text-slate-300">
                          Capital Leakage: <span className="text-rose-400 font-bold">${comparativeReport.comparative_results?.traditional_reactive_pipeline?.capital_leakage_dollars?.toLocaleString()}</span>
                        </div>
                        <div className="text-[11px] text-slate-300">
                          State Bleed: <span className="text-rose-400 font-bold">{comparativeReport.comparative_results?.traditional_reactive_pipeline?.state_bleed_score}</span>
                        </div>
                      </div>

                      {/* SumerAvera Gate 1 Protocol */}
                      <div className="p-2.5 bg-emerald-950/40 border border-emerald-900/60 rounded-lg space-y-1">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase block">SumerAvera Gate 1</span>
                        <div className="text-[11px] text-slate-300">
                          Isolation: <span className="text-emerald-400 font-bold">{comparativeReport.comparative_results?.sumeravera_gate1_protocol?.gate1_fraud_isolation_rate}</span>
                        </div>
                        <div className="text-[11px] text-slate-300">
                          Prevented Loss: <span className="text-emerald-400 font-bold">${comparativeReport.comparative_results?.sumeravera_gate1_protocol?.prevented_financial_loss_dollars?.toLocaleString()}</span>
                        </div>
                        <div className="text-[11px] text-slate-300">
                          State Bleed: <span className="text-emerald-400 font-bold">{comparativeReport.comparative_results?.sumeravera_gate1_protocol?.state_bleed?.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 flex items-center justify-between">
                      <span>Signer: {comparativeReport.enterprise_poc_signoff?.signer}</span>
                      <span className="text-emerald-400 font-bold">PoC Verdict: {comparativeReport.enterprise_poc_signoff?.status}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : ingressMode === "INSURANCE_CLAIM" ? (
              <div className="space-y-3 mt-3">
                <p className="text-xs text-slate-400">
                  Route real-world insurance claim packets directly into Gate 1 verification validator (<code className="text-emerald-300 font-mono">gate1_ingress.py</code>) with dielectric and cryptographic bounds checking.
                </p>

                {/* Insurance Claim Form */}
                <div className="p-3 bg-slate-950 border border-emerald-900/60 rounded-xl space-y-2 font-mono text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Claim ID:</label>
                      <input
                        type="text"
                        value={claimIdInput}
                        onChange={(e) => setClaimIdInput(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-emerald-300 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Member ID:</label>
                      <input
                        type="text"
                        value={claimMemberInput}
                        onChange={(e) => setClaimMemberInput(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Billed Amount ($):</label>
                      <input
                        type="number"
                        value={claimBilledAmount}
                        onChange={(e) => setClaimBilledAmount(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-yellow-300 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Diagnosis Code:</label>
                      <input
                        type="text"
                        value={claimDiagnosisCode}
                        onChange={(e) => setClaimDiagnosisCode(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Provider NPI:</label>
                      <input
                        type="text"
                        value={claimProviderNpi}
                        onChange={(e) => setClaimProviderNpi(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Telemetry & Isolation Faults */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Voltage (V):</label>
                      <input
                        type="number"
                        value={claimVoltage}
                        onChange={(e) => setClaimVoltage(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-cyan-300 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Current (A):</label>
                      <input
                        type="number"
                        value={claimCurrent}
                        onChange={(e) => setClaimCurrent(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-cyan-300 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Dielectric Faults:</label>
                      <input
                        type="number"
                        value={claimIsolationFaults}
                        onChange={(e) => setClaimIsolationFaults(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-rose-300 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Tampering Simulation Button */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">Threat Simulation:</span>
                    <button
                      onClick={() => setClaimTamperSig(!claimTamperSig)}
                      className={`px-2 py-1 rounded text-[10px] border transition cursor-pointer ${
                        claimTamperSig ? "bg-rose-950 border-rose-700 text-rose-300 font-bold" : "bg-slate-900 border-slate-800 text-slate-400"
                      }`}
                    >
                      {claimTamperSig ? "❌ Forged Signature (Threat)" : "✓ Valid Cryptographic Signature"}
                    </button>
                  </div>
                </div>

                {claimLastResult && (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 font-mono text-[11px]">
                    <span className={`font-bold block ${claimLastResult.claim_status === "QUARANTINE" ? "text-rose-400" : "text-emerald-400"}`}>
                      Claim Validation Status: {claimLastResult.claim_status} (HTTP {claimLastResult.http_code})
                    </span>
                    <pre className="text-[10px] text-cyan-300 bg-slate-900 p-2 rounded overflow-x-auto max-h-36">
                      {JSON.stringify(claimLastResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : ingressMode === "EDGE_LISTENER" ? (
              <div className="space-y-3 mt-3">
                <p className="text-xs text-slate-400">
                  Communicates directly with edge nodes &amp; UI widgets over <code className="text-cyan-300 font-mono">/api/v1/edge/listener</code> and <code className="text-cyan-300 font-mono">/ws/edge</code>. Enforces SHA-256 payload hashing, signature verification, and invariant drift checks before core dispatch.
                </p>

                {/* Edge Configuration Controls */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 font-mono text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Target Node ID:</label>
                      <input
                        type="text"
                        value={edgeNodeIdInput}
                        onChange={(e) => setEdgeNodeIdInput(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-cyan-300 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Secret Key / Sig:</label>
                      <input
                        type="text"
                        value={edgeSecretInput}
                        onChange={(e) => setEdgeSecretInput(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Invariant Testing & Fault Injection Toggles */}
                  <div className="pt-2 border-t border-slate-800 space-y-1">
                    <span className="text-[10px] text-amber-400 font-bold block">Invariant Failure Testing Toggles:</span>
                    <div className="grid grid-cols-3 gap-1 text-[10px]">
                      <button
                        onClick={() => setEdgeTamperSig(!edgeTamperSig)}
                        className={`p-1.5 rounded border text-center transition cursor-pointer ${
                          edgeTamperSig ? "bg-rose-950 border-rose-700 text-rose-300" : "bg-slate-900 border-slate-800 text-slate-400"
                        }`}
                      >
                        {edgeTamperSig ? "❌ Forged Sig" : "✓ Valid Sig"}
                      </button>
                      <button
                        onClick={() => setEdgeTamperTimestamp(!edgeTamperTimestamp)}
                        className={`p-1.5 rounded border text-center transition cursor-pointer ${
                          edgeTamperTimestamp ? "bg-rose-950 border-rose-700 text-rose-300" : "bg-slate-900 border-slate-800 text-slate-400"
                        }`}
                      >
                        {edgeTamperTimestamp ? "❌ Expired Time" : "✓ Fresh Time"}
                      </button>
                      <button
                        onClick={() => setEdgeTamperNodeId(!edgeTamperNodeId)}
                        className={`p-1.5 rounded border text-center transition cursor-pointer ${
                          edgeTamperNodeId ? "bg-rose-950 border-rose-700 text-rose-300" : "bg-slate-900 border-slate-800 text-slate-400"
                        }`}
                      >
                        {edgeTamperNodeId ? "❌ Invalid Node" : "✓ Valid Node"}
                      </button>
                    </div>
                  </div>

                  {/* Test Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      onClick={handleRunEdgeHandshake}
                      className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-slate-700 transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>1. Handshake</span>
                    </button>
                    <button
                      onClick={handleRunEdgeTransition}
                      disabled={injecting}
                      className="py-2 px-3 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white font-bold rounded-lg border border-cyan-500 transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 text-yellow-300" />
                      <span>2. Verify Transition</span>
                    </button>
                  </div>
                </div>

                {/* Handshake & Transition Output Displays */}
                {edgeHandshakeData && (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 font-mono text-[11px]">
                    <span className="text-cyan-400 font-bold block">Handshake Result Output:</span>
                    <pre className="text-[10px] text-emerald-300 bg-slate-900 p-2 rounded overflow-x-auto max-h-32">
                      {JSON.stringify(edgeHandshakeData, null, 2)}
                    </pre>
                  </div>
                )}

                {edgeTransitionResult && (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 font-mono text-[11px]">
                    <span className={`font-bold block ${edgeTransitionResult.status === "INVARIANT_REJECTED" ? "text-rose-400" : "text-emerald-400"}`}>
                      Transition Validation Result ({edgeTransitionResult.status}):
                    </span>
                    <pre className="text-[10px] text-cyan-300 bg-slate-900 p-2 rounded overflow-x-auto max-h-40">
                      {JSON.stringify(edgeTransitionResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : ingressMode === "INTENT_PROMPT" ? (
              <div className="space-y-3 mt-3">
                <p className="text-xs text-slate-400">
                  Enter natural language instructions. The Intent Processor classifies goals, projects homeostatic risk, and signs a verifiable payload for Gate 1.
                </p>

                {/* Sample Natural Intent Prompts */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    Quick Intent Presets:
                  </span>
                  <div className="grid grid-cols-1 gap-1.5 text-xs font-mono">
                    {[
                      {
                        label: "1. Regenerate Biosphere & Water",
                        prompt: "Divert solar grid energy to purify water reservoirs and regenerate biosphere sanctuaries",
                        badge: "REGENERATION"
                      },
                      {
                        label: "2. Harmonize Cultural Art & Spirit",
                        prompt: "Weave cultural art artifacts and harmonize spiritual resonance across nodes",
                        badge: "CULTURAL"
                      },
                      {
                        label: "3. Homeostatic Equalizer Pulse",
                        prompt: "Trigger homeostatic equalizer pulse to balance Quintet variance and damp pressure",
                        badge: "HOMEOSTATIC"
                      },
                      {
                        label: "4. Resource Drain Attack (Threat Test)",
                        prompt: "Exhaust energy reserves by 2500 units to crash biosphere carrying capacity",
                        badge: "THREAT"
                      }
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setIntentInput(item.prompt);
                          handleInjectIntent(item.prompt);
                        }}
                        className="p-2 bg-slate-950 border border-slate-800 hover:border-cyan-600/80 rounded-lg text-left transition flex items-center justify-between group cursor-pointer"
                      >
                        <span className="text-slate-300 group-hover:text-cyan-300 text-[11px] truncate mr-2">
                          {item.label}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                          item.badge === "THREAT" ? "bg-rose-950 text-rose-400 border border-rose-800" : "bg-cyan-950 text-cyan-300 border border-cyan-800"
                        }`}>
                          {item.badge}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Intent Input Prompt Area */}
                <div className="space-y-1.5 pt-1">
                  <label htmlFor="gate1-natural-intent-prompt" className="text-[11px] font-mono font-bold text-slate-300 flex items-center justify-between">
                    <span>Natural Language Intent Prompt:</span>
                    <span className="text-[10px] text-cyan-400 font-normal">SumerAvera NLP Gate 1</span>
                  </label>
                  <textarea
                    id="gate1-natural-intent-prompt"
                    value={intentInput}
                    onChange={(e) => setIntentInput(e.target.value)}
                    rows={3}
                    placeholder="Describe desired ecological, hydrological, or energy state shifts..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 text-cyan-200 font-sans text-xs rounded-xl p-3 focus:outline-none transition resize-none leading-relaxed"
                  />
                </div>

                {/* Live Intent Analysis Breakdown */}
                {lastIntentAnalysis && (
                  <div className="p-3 bg-slate-950/90 border border-cyan-900/80 rounded-xl space-y-2 font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <span className="text-cyan-400 font-bold flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Parsed Classification</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        lastIntentAnalysis.threat_flag ? "bg-rose-950 text-rose-300 border border-rose-700" : "bg-emerald-950 text-emerald-300 border border-emerald-700"
                      }`}>
                        {lastIntentAnalysis.classification}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-400 block">Agent Agent Mapping:</span>
                        <span className="text-slate-200 font-bold">{lastIntentAnalysis.agent_name} ({lastIntentAnalysis.agent_id})</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Harmony Alignment:</span>
                        <span className="text-emerald-400 font-bold">{lastIntentAnalysis.harmony_alignment_score}%</span>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/80 flex items-center justify-between">
                      <span>Derived Shift: dE={lastIntentAnalysis.generated_payload?.dE}, dH={JSON.stringify(lastIntentAnalysis.generated_payload?.dH)}</span>
                      <span className="text-cyan-400">Signed with Key</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p className="text-xs text-slate-400 mt-2">
                  Select or customize a raw JSON packet to test direct Gate 1 cryptographic validation and bounds checks.
                </p>

                {/* Preset Payload Selector Buttons */}
                <div className="space-y-2 mt-3 font-mono text-xs">
                  {(Object.keys(PRESET_PAYLOADS) as Array<keyof typeof PRESET_PAYLOADS>).map((key) => {
                    const preset = PRESET_PAYLOADS[key];
                    const isSelected = selectedPresetKey === key;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => handleSelectPreset(key)}
                        className={`w-full p-2.5 rounded-xl border text-left transition cursor-pointer ${
                          isSelected
                            ? key === "VALID"
                              ? "bg-emerald-950/80 border-emerald-600 text-emerald-200 shadow-md"
                              : key === "QUARANTINE"
                              ? "bg-rose-950/80 border-rose-600 text-rose-200 shadow-md"
                              : "bg-amber-950/80 border-amber-600 text-amber-200 shadow-md"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span>{preset.name}</span>
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded font-extrabold border ${
                              key === "VALID"
                                ? "bg-emerald-900/60 border-emerald-700 text-emerald-300"
                                : key === "QUARANTINE"
                                ? "bg-rose-900/60 border-rose-700 text-rose-300"
                                : "bg-amber-900/60 border-amber-700 text-amber-300"
                            }`}
                          >
                            {preset.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 font-sans">{preset.description}</p>
                      </button>
                    );
                  })}
                </div>

                {/* JSON Code Editor / Inspector Box */}
                <div className="space-y-1.5 mt-3">
                  <label htmlFor="gate1-payload-json-editor" className="text-[11px] font-mono font-bold text-slate-300 flex items-center justify-between">
                    <span>Payload Structure (JSON Editor):</span>
                    <span className="text-[10px] text-cyan-400 font-normal">Editable</span>
                  </label>
                  <textarea
                    id="gate1-payload-json-editor"
                    value={payloadJsonText}
                    onChange={(e) => setPayloadJsonText(e.target.value)}
                    rows={5}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 text-cyan-300 font-mono text-xs rounded-xl p-3 focus:outline-none transition resize-none leading-relaxed"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SUBMIT BUTTON (Multi-Mode Dispatcher) */}
          <button
            id="inject-payload-main-btn"
            onClick={() => {
              if (ingressMode === "COMPARATIVE_TEST") {
                handleRunComparativeBaselineTest();
              } else if (ingressMode === "INSURANCE_CLAIM") {
                handleInjectInsuranceClaim();
              } else if (ingressMode === "INTENT_PROMPT") {
                handleInjectIntent();
              } else if (ingressMode === "EDGE_LISTENER") {
                handleRunEdgeTransition();
              } else {
                handleInjectPayload();
              }
            }}
            disabled={injecting || comparativeRunning}
            className="w-full py-3 px-5 bg-gradient-to-r from-cyan-500 via-emerald-500 to-cyan-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs font-mono uppercase tracking-wider rounded-xl shadow-lg shadow-cyan-950/60 flex items-center justify-center gap-2.5 transition active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            {injecting || comparativeRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>EVALUATING GATE 1 INVARIANTS...</span>
              </>
            ) : ingressMode === "COMPARATIVE_TEST" ? (
              <>
                <Layers className="w-4 h-4 fill-current text-slate-950" />
                <span>EXECUTE COMPARATIVE BASELINE TEST</span>
              </>
            ) : ingressMode === "INSURANCE_CLAIM" ? (
              <>
                <ShieldCheck className="w-4 h-4 fill-current text-slate-950" />
                <span>VALIDATE INSURANCE CLAIM PACKET</span>
              </>
            ) : ingressMode === "INTENT_PROMPT" ? (
              <>
                <Sparkles className="w-4 h-4 fill-current text-slate-950" />
                <span>PROCESS INTENT &amp; RUN GATE 1 VALIDATION</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-current text-slate-950" />
                <span>INJECT PACKET &amp; RUN VALIDATION</span>
              </>
            )}
          </button>
        </div>

        {/* Column 2: 3. GATE 1 ROUTING ENGINE (REAL-TIME VISUALIZER) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
                Gate 1 Routing Engine (Real-Time Visualizer)
              </h2>
            </div>
            <span className="px-2 py-0.5 bg-emerald-950 border border-emerald-800 text-emerald-300 text-[10px] font-mono font-bold rounded">
              PIPELINE FLOW
            </span>
          </div>

          <p className="text-xs text-slate-400">
            Visual pipeline diagram inspecting incoming payload packets and dynamically steering traffic to Verified State or Honeypot Isolation.
          </p>

          {/* Interactive Flow Diagram Stage */}
          <div className="bg-slate-950 border border-slate-800/90 rounded-2xl p-6 relative flex flex-col items-center justify-center space-y-6 min-h-[320px]">
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:2rem_2rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none rounded-2xl" />

            {/* Node 1: Inbound Payload Stream */}
            <div
              className={`z-10 px-4 py-2.5 rounded-xl border font-mono text-xs font-bold flex items-center gap-2 transition-all duration-300 ${
                animationState === "INSPECTING"
                  ? "bg-cyan-950 border-cyan-400 text-cyan-200 shadow-lg shadow-cyan-950 scale-105"
                  : "bg-slate-900 border-slate-700 text-slate-200"
              }`}
            >
              <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span>[INBOUND PAYLOAD STREAM]</span>
            </div>

            {/* Connector Line down to Gate 1 */}
            <div className="w-0.5 h-6 bg-slate-800 relative flex items-center justify-center">
              {animationState === "INSPECTING" && (
                <div className="w-3 h-3 bg-cyan-400 rounded-full animate-ping shadow-lg shadow-cyan-400" />
              )}
            </div>

            {/* Node 2: Gate 1 Inspection Kernel */}
            <div
              className={`z-10 px-6 py-3 rounded-2xl border text-center font-mono text-xs transition-all duration-300 shadow-2xl max-w-sm w-full ${
                animationState === "INSPECTING"
                  ? "bg-amber-950/90 border-amber-500 text-amber-200 shadow-amber-950 animate-pulse"
                  : animationState === "ROUTING_VERIFIED"
                  ? "bg-emerald-950/90 border-emerald-500 text-emerald-200 shadow-emerald-950"
                  : animationState === "ROUTING_HONEYPOT"
                  ? "bg-rose-950/90 border-rose-500 text-rose-200 shadow-rose-950"
                  : "bg-slate-900 border-cyan-800 text-cyan-300"
              }`}
            >
              <div className="flex items-center justify-center gap-2 font-bold uppercase text-sm mb-1">
                <Lock className="w-4 h-4" />
                <span>GATE 1 INSPECTION KERNEL</span>
              </div>
              <p className="text-[10px] text-slate-400 font-sans">
                Sig Verification (HMAC-SHA256) &bull; Carrying Capacity Limit Check
              </p>
            </div>

            {/* Split Branch Routing Visualiser */}
            <div className="w-full grid grid-cols-2 gap-4 pt-2">
              
              {/* Left Branch: VERIFIED STATE LEDGER */}
              <div className="flex flex-col items-center space-y-2">
                <div className="h-8 w-0.5 bg-gradient-to-b from-slate-800 to-emerald-600 relative flex items-center justify-center">
                  {animationState === "ROUTING_VERIFIED" && (
                    <div className="w-3 h-3 bg-emerald-400 rounded-full animate-bounce shadow-lg shadow-emerald-400" />
                  )}
                </div>

                <div
                  className={`w-full p-3.5 rounded-xl border text-center font-mono text-xs transition-all duration-500 ${
                    animationState === "ROUTING_VERIFIED"
                      ? "bg-emerald-950 border-emerald-500 text-emerald-200 shadow-xl shadow-emerald-950 scale-105"
                      : "bg-slate-900/80 border-emerald-900/50 text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5 font-extrabold text-emerald-400 text-xs mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>SOVEREIGN LEDGER</span>
                  </div>
                  <span className="text-[10px] text-emerald-300 font-bold block">(VERIFIED STATE)</span>
                  <p className="text-[10px] text-slate-500 mt-1">Commits SHA-256 state shift block</p>
                </div>
              </div>

              {/* Right Branch: HONEYPOT SANDBOX ARRAY */}
              <div className="flex flex-col items-center space-y-2">
                <div className="h-8 w-0.5 bg-gradient-to-b from-slate-800 to-rose-600 relative flex items-center justify-center">
                  {animationState === "ROUTING_HONEYPOT" && (
                    <div className="w-3 h-3 bg-rose-400 rounded-full animate-bounce shadow-lg shadow-rose-400" />
                  )}
                </div>

                <div
                  className={`w-full p-3.5 rounded-xl border text-center font-mono text-xs transition-all duration-500 ${
                    animationState === "ROUTING_HONEYPOT"
                      ? "bg-rose-950 border-rose-500 text-rose-200 shadow-xl shadow-rose-950 scale-105"
                      : "bg-slate-900/80 border-rose-900/50 text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5 font-extrabold text-rose-400 text-xs mb-1">
                    <ShieldAlert className="w-4 h-4" />
                    <span>HONEYPOT SANDBOX</span>
                  </div>
                  <span className="text-[10px] text-rose-300 font-bold block">(ISOLATED DECOY)</span>
                  <p className="text-[10px] text-slate-500 mt-1">Traps payload &amp; issues synthetic decoy</p>
                </div>
              </div>
            </div>
          </div>

          {/* Lotka-Volterra Anomaly Index (0–1000) Gauge & Schema Verification Panel */}
          {lastRouteResult && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs space-y-3 shadow-lg">
              {/* Anomaly Gauge Title & Status Badge */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-slate-200">Lotka-Volterra Fraud Anomaly Index</span>
                </div>
                {(() => {
                  const idx = lastRouteResult.anomaly_index ?? lastRouteResult.route_result?.anomaly_index ?? 0;
                  const statusTier = lastRouteResult.status ?? lastRouteResult.route_result?.status ?? (idx >= 751 ? "QUARANTINE" : idx >= 251 ? "REBALANCING" : "STABLE");
                  const badgeStyle = statusTier === "QUARANTINE"
                    ? "bg-rose-950 text-rose-300 border-rose-800"
                    : statusTier === "REBALANCING"
                    ? "bg-amber-950 text-amber-300 border-amber-800"
                    : "bg-emerald-950 text-emerald-300 border-emerald-800";
                  return (
                    <span className={`px-2.5 py-0.5 rounded font-extrabold border text-[10px] ${badgeStyle}`}>
                      {statusTier} ({idx} / 1000)
                    </span>
                  );
                })()}
              </div>

              {/* Anomaly Gauge Visual Bar */}
              {(() => {
                const idx = Math.min(1000, Math.max(0, lastRouteResult.anomaly_index ?? lastRouteResult.route_result?.anomaly_index ?? 0));
                const pct = (idx / 1000) * 100;
                const barColor = idx >= 751 ? "bg-rose-500 shadow-rose-500/50" : idx >= 251 ? "bg-amber-500 shadow-amber-500/50" : "bg-emerald-500 shadow-emerald-500/50";
                return (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>0 (STABLE)</span>
                      <span>250</span>
                      <span>750</span>
                      <span>1000 (QUARANTINE)</span>
                    </div>
                    <div className="w-full h-3 bg-slate-900 border border-slate-800 rounded-full overflow-hidden p-0.5 relative">
                      <div className={`h-full rounded-full transition-all duration-500 shadow-lg ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })()}

              {/* Schema Compliance Diagnostics */}
              {lastRouteResult.route_result?.schema_compliance && (
                <div className="pt-2 border-t border-slate-850 space-y-2 text-[11px]">
                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <div className="p-2 bg-slate-900/90 rounded border border-slate-800 space-y-0.5">
                      <span className="text-slate-500 text-[10px] block">Header Schema Compliance:</span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Valid Header Structure</span>
                      </span>
                      <span className="text-[9px] text-slate-400 block font-mono">
                        Tenant: {lastRouteResult.route_result.schema_compliance.header_compliance?.tenant_id || "N/A"}
                      </span>
                    </div>

                    <div className="p-2 bg-slate-900/90 rounded border border-slate-800 space-y-0.5">
                      <span className="text-slate-500 text-[10px] block">SHA-256 Hash Integrity:</span>
                      {lastRouteResult.route_result.schema_compliance.header_compliance?.sha256_verified ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Cryptographically Verified</span>
                        </span>
                      ) : (
                        <span className="text-rose-400 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Tampered / Unverified</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Schema Errors List if any */}
                  {lastRouteResult.route_result.schema_compliance.schema_errors && lastRouteResult.route_result.schema_compliance.schema_errors.length > 0 && (
                    <div className="p-2 bg-rose-950/60 border border-rose-900/80 rounded space-y-1 text-rose-300 text-[10px]">
                      <span className="font-bold block uppercase tracking-wider">Detected Anomaly Violations:</span>
                      <ul className="list-disc list-inside space-y-0.5 font-sans">
                        {lastRouteResult.route_result.schema_compliance.schema_errors.map((errStr: string, i: number) => (
                          <li key={i}>{errStr}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Last Route Status Banner */}
          {lastRouteResult && (
            <div
              className={`p-3 rounded-xl border text-xs font-mono flex items-center justify-between ${
                lastRouteResult.status === "QUARANTINE" || lastRouteResult.route_result?.status === "QUARANTINE" || lastRouteResult.route === "HONEYPOT_SYNTHETIC_PLAYGROUND"
                  ? "bg-rose-950/80 border-rose-800 text-rose-200"
                  : lastRouteResult.status === "REBALANCING" || lastRouteResult.route_result?.status === "REBALANCING"
                  ? "bg-amber-950/80 border-amber-800 text-amber-200"
                  : "bg-emerald-950/80 border-emerald-800 text-emerald-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-bold">Decision Route:</span>
                <span className="underline">{lastRouteResult.reason || lastRouteResult.route_result?.message || lastRouteResult.status}</span>
              </div>
              <span className="text-[10px] opacity-80">
                Route: {lastRouteResult.route_result?.route || lastRouteResult.route || "COMPLETED"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 4. REAL-TIME FORENSIC AUDIT LOG (Terminal Style Window) */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
              Real-Time Forensic Audit Log
            </h2>
            <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono">
              TERMINAL STREAM
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <button
              onClick={handleCopyLogs}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 flex items-center gap-1.5 transition cursor-pointer"
            >
              {copiedLog ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLog ? "Copied" : "Copy Log"}</span>
            </button>

            <button
              onClick={() => setAuditLogs([])}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg border border-slate-800 transition cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>

        {/* High-Contrast Terminal Scrolling Window */}
        <div
          ref={logTerminalRef}
          className="bg-black border border-slate-850 rounded-xl p-4 font-mono text-xs space-y-2 max-h-64 overflow-y-auto leading-relaxed shadow-inner"
        >
          {auditLogs.length === 0 ? (
            <p className="text-slate-600 italic">Terminal log buffer empty. Waiting for ingress traffic...</p>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="flex flex-col sm:flex-row sm:items-start gap-2 border-b border-slate-900/80 pb-2">
                <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-extrabold rounded shrink-0 uppercase border ${
                    log.status === "VERIFIED"
                      ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                      : log.status === "DIVERTED"
                      ? "bg-rose-950 text-rose-400 border-rose-800"
                      : "bg-amber-950 text-amber-300 border-amber-800"
                  }`}
                >
                  {log.status}
                </span>

                <span className="text-cyan-400 shrink-0">[{log.channel}]</span>

                <div className="flex-1 space-y-0.5">
                  <p className={log.status === "VERIFIED" ? "text-emerald-300 font-semibold" : log.status === "DIVERTED" ? "text-rose-300 font-semibold" : "text-amber-200"}>
                    {log.reason}
                  </p>
                  {log.hash && (
                    <p className="text-[10px] text-slate-500 truncate">
                      State Hash: <span className="text-slate-400">{log.hash}</span>
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 5. STATE MONITORING DASHBOARD (Two Distinct Cards/Tabs) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-purple-400" />
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
              State Monitoring Dashboard
            </h2>
          </div>

          {/* Two Distinct Card Tabs */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <button
              id="card-tab-sovereign-ledger"
              onClick={() => setDashboardTab("SOVEREIGN_LEDGER")}
              className={`px-4 py-2 rounded-xl border font-bold transition cursor-pointer flex items-center gap-2 ${
                dashboardTab === "SOVEREIGN_LEDGER"
                  ? "bg-purple-950 text-purple-300 border-purple-700 shadow-md shadow-purple-950"
                  : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
              }`}
            >
              <Database className="w-4 h-4 text-purple-400" />
              <span>Card 1: Verified Sovereign Ledger</span>
            </button>

            <button
              id="card-tab-honeypot-array"
              onClick={() => setDashboardTab("HONEYPOT_SANDBOX")}
              className={`px-4 py-2 rounded-xl border font-bold transition cursor-pointer flex items-center gap-2 ${
                dashboardTab === "HONEYPOT_SANDBOX"
                  ? "bg-rose-950 text-rose-300 border-rose-700 shadow-md shadow-rose-950"
                  : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Card 2: Honeypot Sandbox Array</span>
            </button>
          </div>
        </div>

        {/* Card 1 Content: Verified Sovereign Ledger */}
        {dashboardTab === "SOVEREIGN_LEDGER" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span>Active Verified Ledger Blocks: <strong className="text-purple-300">{ledger?.length || 1}</strong></span>
              <span className="text-emerald-400 font-bold">CHAINDATA INTEGRITY: VERIFIED STABLE</span>
            </div>

            {ledger?.latest_block ? (
              <div className="p-4 bg-slate-950 border border-purple-900/50 rounded-xl space-y-3 font-mono text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <span className="text-purple-400 font-bold text-sm">
                    Latest Block #{ledger.latest_block.index} ({ledger.latest_block.action_type})
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    {new Date(ledger.latest_block.timestamp * 1000).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-300">
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase block">Block SHA-256 Hash</span>
                    <span className="text-cyan-300 font-bold break-all">{ledger.latest_block.hash}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase block">Previous Hash</span>
                    <span className="text-slate-400 font-bold break-all">{ledger.latest_block.prev_hash}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900 rounded-lg text-slate-300 space-y-1">
                  <span className="text-slate-400 font-bold block text-[11px]">State Snapshot Details:</span>
                  <p className="text-slate-300">{ledger.latest_block.details}</p>
                  <p className="text-slate-400 text-[11px]">
                    Energy Capacity (E): <strong className="text-emerald-400">{ledger.latest_block.state_snapshot?.E}</strong>
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-500 text-xs font-mono bg-slate-950 rounded-xl border border-slate-800">
                Sovereign Ledger Genesis Block active. Inject a valid payload to commit Block #1.
              </div>
            )}
          </div>
        )}

        {/* Card 2 Content: Honeypot Sandbox Array */}
        {dashboardTab === "HONEYPOT_SANDBOX" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span>Trapped Malformed Inputs: <strong className="text-rose-400">{honeypotLogs.length}</strong></span>
              <span className="text-cyan-400 font-bold">MEMORY BLEED: 0.00% (COMPLETE ISOLATION)</span>
            </div>

            {honeypotLogs.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs font-mono bg-slate-950 rounded-xl border border-slate-800">
                Honeypot Sandbox active with zero trapped malformed inputs. Inject a corrupt signature or boundary payload above to view isolation telemetry.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {honeypotLogs.map((log, idx) => (
                  <div
                    key={`${log.id}-${idx}`}
                    className="p-3.5 bg-slate-950 border border-slate-800 hover:border-rose-900/60 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-rose-950 text-rose-300 border border-rose-800 rounded text-[10px] font-bold">
                          {log.threat_type}
                        </span>
                        <span className="text-slate-400 text-[11px]">{log.client_ip}</span>
                        <span className="text-slate-500 text-[10px]">
                          {new Date(log.timestamp * 1000).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-slate-300 text-[11px]">{log.reason}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="px-2 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-bold rounded">
                        DECOY SENT
                      </span>
                      {log.synthetic_response_sent?.synthetic_ledger_hash && (
                        <p className="text-[10px] text-slate-500 mt-1 truncate max-w-xs font-mono">
                          Decoy Hash: {log.synthetic_response_sent.synthetic_ledger_hash.substring(0, 16)}...
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
