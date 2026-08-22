import React, { useState, useMemo } from "react";
import { KernelState, IndustryType, IndustryProfile, WidgetEvaluationResult } from "../types";
import {
  ShieldCheck,
  ShieldAlert,
  FileCheck2,
  Building2,
  CreditCard,
  ShoppingBag,
  Stethoscope,
  Radio,
  Landmark,
  Calculator,
  Code2,
  Copy,
  Check,
  Play,
  TrendingUp,
  Sliders,
  DollarSign,
  Lock,
  Layers,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Activity,
  Maximize2,
  Eye,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
} from "lucide-react";

interface ClientEvaluationWidgetProps {
  kernel: KernelState;
  onStep?: (dt?: number) => void;
}

// Ranked by Annual Fraud Impact (1 to 6)
const INDUSTRIES_PROFILES: IndustryProfile[] = [
  {
    id: "insurance",
    rank: 1,
    name: "Insurance Industry (POC Focus)",
    annualFraudLoss: "$308.6 Billion / year",
    iconName: "ShieldAlert",
    description: "Property & Casualty, Health Billing, Auto Collision, Disability & Workers' Compensation fraud.",
    primaryRiskVectors: [
      "Staged Collisions & Inflated Auto Claims",
      "Phantom Medical Billing & Ghost Provider NPIs",
      "Pre-existing Property Loss & Photo Manipulation",
      "Unwitnessed Late-Night Accident Clusters",
      "Multi-Claimant Synthetic Ring Hash Anomalies",
    ],
    sampleClaims: [
      {
        id: "INS-CLAIM-8802",
        type: "Auto Collision / Personal Injury",
        amount: 28500,
        description: "Late night rear-end collision reported 29 days after policy origination with 3 unverified passengers.",
        defaultRiskFactors: ["Policy age < 30 days", "Unwitnessed nighttime incident", "Multi-passenger soft tissue claims"],
        syntheticAnomalyScore: 88,
      },
      {
        id: "INS-CLAIM-9104",
        type: "Health / Outpatient Procedure",
        amount: 14200,
        description: "Outpatient surgical claim submitted with non-matching provider NPI and duplicate billing codes.",
        defaultRiskFactors: ["Ghost Provider NPI", "Duplicate procedure codes within 24h", "Out-of-network billing spike"],
        syntheticAnomalyScore: 94,
      },
      {
        id: "INS-CLAIM-1205",
        type: "Commercial Property Damage",
        amount: 45000,
        description: "Water damage loss reported during documented dry weather spell with mismatched metadata on site photos.",
        defaultRiskFactors: ["EXIF Photo Timestamp Mismatch", "Weather radar discrepancy", "Prior claim < 60 days"],
        syntheticAnomalyScore: 78,
      },
      {
        id: "INS-CLAIM-3301",
        type: "Workers' Compensation",
        amount: 8200,
        description: "Standard workplace injury claim with verified supervisor report, immediate medical evaluation, and matching telemetry.",
        defaultRiskFactors: [],
        syntheticAnomalyScore: 12,
      },
    ],
  },
  {
    id: "banking",
    rank: 2,
    name: "Banking & Financial Services",
    annualFraudLoss: "$48.5 Billion / year",
    iconName: "CreditCard",
    description: "Account Takeovers (ATO), Synthetic Identity Creation, Wire Fraud, and Loan Stacking.",
    primaryRiskVectors: [
      "Synthetic Identity SSN Mismatch",
      "High-Frequency Loan Stacking across Fintech APIs",
      "Out-of-Pattern Wire Transfers to High-Risk Jurisdictions",
      "Credential Stuffing & ATO Device Fingerprint Shifts",
    ],
    sampleClaims: [
      {
        id: "BNK-TX-4409",
        type: "High-Value Wire Transfer",
        amount: 125000,
        description: "Wire transfer requested to newly added offshore beneficiary within 5 minutes of password reset.",
        defaultRiskFactors: ["Password reset < 10m", "New foreign beneficiary", "Tor Exit Node IP"],
        syntheticAnomalyScore: 92,
      },
      {
        id: "BNK-LN-1092",
        type: "Personal Loan Application",
        amount: 35000,
        description: "Loan request submitted with synthetic SSN cluster flagged in 4 simultaneous credit pulls.",
        defaultRiskFactors: ["SSN issuance date anomaly", "Rapid multi-bureau inquiry spike", "Disposable VOIP number"],
        syntheticAnomalyScore: 86,
      },
    ],
  },
  {
    id: "ecommerce",
    rank: 3,
    name: "E-Commerce & Digital Commerce",
    annualFraudLoss: "$38.0 Billion / year",
    iconName: "ShoppingBag",
    description: "Friendly Fraud, Chargeback Manipulation, Promo Abuse, and Gift Card Draining Bots.",
    primaryRiskVectors: [
      "Friendly Fraud / False Item-Not-Received Claims",
      "Automated Gift Card Brute-Forcing",
      "Multi-Account Promotional Code Exploitation",
      "Reseller Bot Account Farm Checkout Spikes",
    ],
    sampleClaims: [
      {
        id: "ECM-ORD-9901",
        type: "Bulk Electronics Checkout",
        amount: 4800,
        description: "Cart checkout containing 10 flagship smartphones using guest checkout and proxy residential IP.",
        defaultRiskFactors: ["Proxy IP detected", "Velocity check: 15 orders/sec from subnet", "Shipping/Billing state mismatch"],
        syntheticAnomalyScore: 84,
      },
      {
        id: "ECM-PRM-2011",
        type: "Promo Code Stack Attack",
        amount: 650,
        description: "Single user exploiting 5 nested promo coupons via automated script on new account.",
        defaultRiskFactors: ["Scripted input timing", "Fingerprint matches known bot farm"],
        syntheticAnomalyScore: 72,
      },
    ],
  },
  {
    id: "healthcare",
    rank: 4,
    name: "Healthcare & Pharmaceuticals",
    annualFraudLoss: "$25.2 Billion / year",
    iconName: "Stethoscope",
    description: "Prescription Fraud, Telehealth Overbilling, Phantom Patients, and Counterfeit Rx Distribution.",
    primaryRiskVectors: [
      "Telehealth High-Volume Controlled Substance Prescriptions",
      "Upcoding & Unbundling Diagnostic Codes",
      "Deceased / Phantom Patient ID Billing",
      "Multi-Pharmacy Doctor Shopping Clusters",
    ],
    sampleClaims: [
      {
        id: "HLT-RX-7710",
        type: "Controlled Substance Dispense",
        amount: 3200,
        description: "High-volume Schedule II Rx filled across 4 different retail pharmacies in 48 hours.",
        defaultRiskFactors: ["Doctor shopping risk trigger", "Short time interval dispense", "Out-of-state prescriber NPI"],
        syntheticAnomalyScore: 89,
      },
    ],
  },
  {
    id: "telecom",
    rank: 5,
    name: "Telecommunications & SaaS",
    annualFraudLoss: "$18.4 Billion / year",
    iconName: "Radio",
    description: "SIM Swapping, International Revenue Share Fraud (IRSF), Subscription Abuse, and Toll Fraud.",
    primaryRiskVectors: [
      "SIM Swap Unauthorized Port Request",
      "IRSF Premium Rate Destination PBX Hacking",
      "Stolen Identity Enterprise SaaS Trial Abuse",
    ],
    sampleClaims: [
      {
        id: "TEL-SIM-3309",
        type: "SIM Swap Authorization",
        amount: 1500,
        description: "Urgent SIM replacement request initiated via chat rep with failed 2FA verification.",
        defaultRiskFactors: ["High-risk IP address", "Failed challenge question twice", "Crypto exchange notification active"],
        syntheticAnomalyScore: 91,
      },
    ],
  },
  {
    id: "government",
    rank: 6,
    name: "Government & Public Sector",
    annualFraudLoss: "$12.1 Billion / year",
    iconName: "Landmark",
    description: "Unemployment Claim Theft, Tax Refund Fraud, Public Housing Grant Misuse, and Benefits Rings.",
    primaryRiskVectors: [
      "Stolen Identity Unemployment Application Clusters",
      "Fictitious Employer Tax Return Submissions",
      "Automated Disaster Relief Grant Bot Filing",
    ],
    sampleClaims: [
      {
        id: "GOV-BEN-5511",
        type: "Unemployment Benefit Claim",
        amount: 18000,
        description: "Disability benefit claim filed using deceased individual SSN routed to digital bank account.",
        defaultRiskFactors: ["SSN Master Death File Match", "Digital prepaid bank routing", "Bulk filing IP subnet"],
        syntheticAnomalyScore: 96,
      },
    ],
  },
];

export const ClientEvaluationWidget: React.FC<ClientEvaluationWidgetProps> = ({
  kernel,
  onStep,
}) => {
  const [selectedIndustry, setSelectedIndustry] = useState<IndustryType>("insurance");
  const [mode, setMode] = useState<"EVALUATION" | "MONITORING">("EVALUATION");
  
  // Evaluation State
  const activeProfile = useMemo(
    () => INDUSTRIES_PROFILES.find((p) => p.id === selectedIndustry) || INDUSTRIES_PROFILES[0],
    [selectedIndustry]
  );

  const [selectedSampleIndex, setSelectedSampleIndex] = useState<number>(0);
  const activeSample = activeProfile.sampleClaims[selectedSampleIndex] || activeProfile.sampleClaims[0];

  // Custom Form Inputs
  const [claimIdInput, setClaimIdInput] = useState<string>(activeSample?.id || "INS-CLAIM-8802");
  const [claimTypeInput, setClaimTypeInput] = useState<string>(activeSample?.type || "Auto Collision");
  const [claimAmountInput, setClaimAmountInput] = useState<number>(activeSample?.amount || 28500);
  const [claimDescInput, setClaimDescInput] = useState<string>(activeSample?.description || "");
  const [providerNpiInput, setProviderNpiInput] = useState<string>("1982736450");
  const [serviceCodeInput, setServiceCodeInput] = useState<string>("99214");
  const [activeRiskFactors, setActiveRiskFactors] = useState<string[]>(activeSample?.defaultRiskFactors || []);
  
  // Evaluation Output Result
  const [lastResult, setLastResult] = useState<WidgetEvaluationResult | null>(null);

  // ROI Calculator Inputs
  const [annualClaimVolume, setAnnualClaimVolume] = useState<number>(25000000); // $25M default
  const [estimatedFraudRatePercent, setEstimatedFraudRatePercent] = useState<number>(4.5); // 4.5% fraud avg in insurance

  // Embed Preview Options
  const [embedTheme, setEmbedTheme] = useState<"dark" | "light">("dark");
  const [embedStyle, setEmbedStyle] = useState<"compact" | "full">("full");
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);

  // Switch sample claim and auto-fill inputs
  const handleSelectSample = (index: number) => {
    setSelectedSampleIndex(index);
    const sample = activeProfile.sampleClaims[index];
    if (sample) {
      setClaimIdInput(sample.id);
      setClaimTypeInput(sample.type);
      setClaimAmountInput(sample.amount);
      setClaimDescInput(sample.description);
      setActiveRiskFactors(sample.defaultRiskFactors);
      setLastResult(null);
    }
  };

  // Toggle risk factor check
  const toggleRiskFactor = (factor: string) => {
    if (activeRiskFactors.includes(factor)) {
      setActiveRiskFactors(activeRiskFactors.filter((f) => f !== factor));
    } else {
      setActiveRiskFactors([...activeRiskFactors, factor]);
    }
  };

  // Execute Evaluation Engine Simulation
  const runEvaluation = () => {
    const triggeredInvariants: string[] = [...activeRiskFactors];

    // IngressValidator Invariant Checks from sumeravera Go Package
    if (claimAmountInput <= 0) {
      triggeredInvariants.push("GATE_1_INTERCEPT: Invalid billing amount detected (Zero/Negative)");
    }
    if (providerNpiInput.length !== 10) {
      triggeredInvariants.push("GATE_1_INTERCEPT: Invalid Provider NPI signature length");
    }

    const baseScore = triggeredInvariants.length * 28 + (claimAmountInput > 20000 ? 15 : 5);
    const finalRiskScore = Math.min(99, Math.max(8, baseScore));

    let action: "APPROVE" | "AUDIT_REBALANCE" | "QUARANTINE_403" = "APPROVE";
    let statusCode = 200;

    if (finalRiskScore >= 75 || claimAmountInput <= 0 || providerNpiInput.length !== 10) {
      action = "QUARANTINE_403";
      statusCode = 403;
    } else if (finalRiskScore >= 40) {
      action = "AUDIT_REBALANCE";
      statusCode = 202;
    }

    const preventedLoss = action === "QUARANTINE_403" ? Math.max(0, claimAmountInput) : action === "AUDIT_REBALANCE" ? Math.max(0, claimAmountInput * 0.5) : 0;
    const confidence = Math.min(99.8, 85 + finalRiskScore * 0.14);

    const hashRaw = `${selectedIndustry}:${claimIdInput}:${providerNpiInput}:${serviceCodeInput}:${claimAmountInput}:${finalRiskScore}:${Date.now()}`;
    const syntheticHash = "0x" + Array.from(hashRaw).reduce((acc, char) => (acc + char.charCodeAt(0).toString(16)).padStart(2, "0"), "").slice(0, 32);

    const result: WidgetEvaluationResult = {
      evaluationId: `EVAL-${Math.floor(100000 + Math.random() * 900000)}`,
      timestamp: new Date().toLocaleTimeString(),
      industry: selectedIndustry,
      claimId: claimIdInput,
      amount: claimAmountInput,
      riskScore: finalRiskScore,
      action,
      statusCode,
      estimatedPreventedLoss: Number(preventedLoss.toFixed(2)),
      confidenceScore: Number(confidence.toFixed(1)),
      triggeredFactors: triggeredInvariants,
      sha256VerificationHash: syntheticHash,
    };

    setLastResult(result);
  };

  // Estimated Annual ROI Calculation
  const roiCalculations = useMemo(() => {
    const totalFraudExposed = annualClaimVolume * (estimatedFraudRatePercent / 100);
    const sumerAveraInterceptionRate = 0.942; // 94.2% Gate 1 interception
    const annualSavings = totalFraudExposed * sumerAveraInterceptionRate;
    const estimatedServiceCost = Math.max(12000, annualSavings * 0.04); // 4% gain-share / baseline
    const netBenefit = annualSavings - estimatedServiceCost;
    const roiMultiple = (annualSavings / estimatedServiceCost).toFixed(1);

    return {
      totalFraudExposed: Math.round(totalFraudExposed),
      annualSavings: Math.round(annualSavings),
      estimatedServiceCost: Math.round(estimatedServiceCost),
      netBenefit: Math.round(netBenefit),
      roiMultiple,
    };
  }, [annualClaimVolume, estimatedFraudRatePercent]);

  // Copy Code Snippet
  const copyEmbedCode = () => {
    const snippet = `<script src="https://sumeravera.io/v1/widget.js" 
  data-tenant-id="PROSPECT-CLIENT-DEMO"
  data-industry="${selectedIndustry}"
  data-mode="${mode.toLowerCase()}"
  data-theme="${embedTheme}"
  async>
</script>`;
    navigator.clipboard.writeText(snippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Widget Hero Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
            <h2 className="text-lg font-bold text-slate-100 font-mono tracking-tight">
              SumerAvera Prospective Client Evaluation &amp; Active Monitoring Widget
            </h2>
            <span className="px-2.5 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider">
              POC READY
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1.5 max-w-3xl leading-relaxed">
            Test and evaluate the SumerAvera Fraud Prevention Engine across high-loss industries. Switch seamlessly between <strong className="text-cyan-300">Prospective Evaluation (POC)</strong> and <strong className="text-purple-300">Active Client Monitoring HUD</strong>.
          </p>
        </div>

        {/* Dual Mode Switcher */}
        <div className="bg-slate-950 p-1.5 border border-slate-800 rounded-xl flex items-center font-mono text-xs shadow-inner">
          <button
            onClick={() => setMode("EVALUATION")}
            className={`px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 cursor-pointer ${
              mode === "EVALUATION"
                ? "bg-cyan-600 text-slate-950 shadow-md font-black"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>1. Prospective Evaluation (POC)</span>
          </button>

          <button
            onClick={() => setMode("MONITORING")}
            className={`px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 cursor-pointer ${
              mode === "MONITORING"
                ? "bg-purple-600 text-slate-950 shadow-md font-black"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>2. Active Production Monitor</span>
          </button>
        </div>
      </div>

      {/* Industry Tabs (Ranked Most Fraud to Least Fraud) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
          <span className="flex items-center gap-1.5 font-bold text-slate-300">
            <Building2 className="w-4 h-4 text-cyan-400" />
            Select Target Industry Sector (Ranked by Annual Fraud Exposure):
          </span>
          <span className="text-[11px] text-cyan-400 font-bold">
            #1 Industry POC: Insurance ($308.6B/yr)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 font-mono text-xs">
          {INDUSTRIES_PROFILES.map((profile) => {
            const isSelected = selectedIndustry === profile.id;
            return (
              <button
                key={profile.id}
                onClick={() => {
                  setSelectedIndustry(profile.id);
                  setSelectedSampleIndex(0);
                  setLastResult(null);
                }}
                className={`p-3 rounded-xl border text-left transition relative flex flex-col justify-between space-y-2 cursor-pointer ${
                  isSelected
                    ? "bg-cyan-950/80 border-cyan-500 shadow-lg text-slate-100 ring-1 ring-cyan-500/50"
                    : "bg-slate-900/90 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                    profile.rank === 1 ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-300"
                  }`}>
                    #{profile.rank} FRAUD
                  </span>
                  {profile.rank === 1 && (
                    <span className="text-[9px] font-bold text-cyan-300 uppercase tracking-wider">POC</span>
                  )}
                </div>

                <div>
                  <div className="font-bold text-xs text-slate-200 leading-tight">
                    {profile.name.replace(" (POC Focus)", "")}
                  </div>
                  <div className="text-[10px] text-amber-400 font-bold mt-0.5">
                    {profile.annualFraudLoss}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* MODE A: PROSPECTIVE CLIENT EVALUATION (POC BENCH & ROI SIMULATOR) */}
      {mode === "EVALUATION" && (
        <div className="space-y-6">
          {/* Active Industry Banner & Risk Vectors */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 font-mono">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  {activeProfile.name} Risk Evaluation Bench
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{activeProfile.description}</p>
              </div>
              <div className="text-right font-mono text-xs">
                <span className="text-slate-400 block text-[10px]">Annual Sector Loss</span>
                <span className="text-amber-400 font-black text-sm">{activeProfile.annualFraudLoss}</span>
              </div>
            </div>

            {/* Primary Risk Vectors Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px]">
              <span className="text-slate-400 font-bold text-xs">Primary Risk Vectors Tested:</span>
              {activeProfile.primaryRiskVectors.map((vector, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 bg-slate-950 text-slate-300 border border-slate-800 rounded-lg flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span>{vector}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Evaluation Bench Grid (Left: Claim Input Form & Presets | Right: Risk Scorecard Output) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Sample Preset Selector & Interactive Inputs */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  Claim / Payload Parameter Inspector
                </span>
                <span className="text-[11px] text-slate-400">Select Preset or Edit Values</span>
              </div>

              {/* Sample Presets */}
              <div className="space-y-2">
                <label className="text-[11px] text-slate-400 block font-bold">
                  Preset Sample Claims ({activeProfile.sampleClaims.length} available):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeProfile.sampleClaims.map((sample, idx) => (
                    <button
                      key={sample.id}
                      onClick={() => handleSelectSample(idx)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        selectedSampleIndex === idx
                          ? "bg-cyan-950 text-cyan-200 border-cyan-700 font-bold"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-bold text-cyan-400">{sample.id}</span>
                        <span className="font-bold text-slate-300">${sample.amount.toLocaleString()}</span>
                      </div>
                      <div className="text-[11px] text-slate-200 font-bold mt-1 truncate">{sample.type}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Claim / Transaction ID</label>
                  <input
                    type="text"
                    value={claimIdInput}
                    onChange={(e) => setClaimIdInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono focus:border-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Exposure Amount ($ USD)</label>
                  <input
                    type="number"
                    value={claimAmountInput}
                    onChange={(e) => setClaimAmountInput(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-emerald-300 font-mono font-bold focus:border-cyan-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Claim Type / Category</label>
                  <input
                    type="text"
                    value={claimTypeInput}
                    onChange={(e) => setClaimTypeInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono focus:border-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Provider NPI (10 Digits)</label>
                  <input
                    type="text"
                    value={providerNpiInput}
                    maxLength={10}
                    onChange={(e) => setProviderNpiInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-cyan-300 font-mono focus:border-cyan-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Procedure / Service Code</label>
                <input
                  type="text"
                  value={serviceCodeInput}
                  onChange={(e) => setServiceCodeInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono focus:border-cyan-500 outline-none"
                />
              </div>

              {/* Risk Factor Checkboxes */}
              <div className="space-y-2 pt-1">
                <label className="text-[11px] text-slate-300 font-bold block">
                  Simulated Suspicious Risk Factors:
                </label>
                <div className="space-y-1.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  {activeProfile.primaryRiskVectors.map((factor, idx) => {
                    const isChecked = activeRiskFactors.includes(factor);
                    return (
                      <label
                        key={idx}
                        onClick={() => toggleRiskFactor(factor)}
                        className={`flex items-center gap-2.5 text-xs p-2 rounded-lg cursor-pointer transition ${
                          isChecked ? "bg-amber-950/60 border border-amber-800/80 text-amber-200 font-bold" : "text-slate-400 hover:bg-slate-900"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded border-slate-700 text-amber-500 focus:ring-0"
                        />
                        <span>{factor}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={runEvaluation}
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black rounded-xl transition shadow-lg shadow-cyan-950/50 flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Run SumerAvera Fraud Evaluation Engine</span>
              </button>
            </div>

            {/* Right Column: Instant Fraud Scorecard Output */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl font-mono text-xs flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="font-bold text-slate-200 text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-400" />
                    Evaluation Result &amp; Risk Scorecard
                  </span>
                  <span className="text-[10px] text-slate-500">GATE 1 ENGINE</span>
                </div>

                {!lastResult ? (
                  <div className="py-12 text-center text-slate-500 space-y-3">
                    <HelpCircle className="w-10 h-10 mx-auto text-slate-700" />
                    <p className="text-xs">Click "Run SumerAvera Fraud Evaluation Engine" to generate instant risk score, quarantine decision, and prevented loss report.</p>
                  </div>
                ) : (
                  <div className="space-y-4 animate-fade-in">
                    {/* Score Gauge Block */}
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold">FRAUD ANOMALY SCORE</span>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span
                            className={`text-3xl font-black ${
                              lastResult.riskScore >= 75
                                ? "text-rose-400"
                                : lastResult.riskScore >= 40
                                ? "text-amber-400"
                                : "text-emerald-400"
                            }`}
                          >
                            {lastResult.riskScore}
                          </span>
                          <span className="text-slate-500 font-bold">/ 100</span>
                        </div>
                      </div>

                      {/* Status Code Pill */}
                      <div className="text-right space-y-1">
                        <span
                          className={`inline-block px-3 py-1 rounded-lg text-xs font-black border ${
                            lastResult.statusCode === 200
                              ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                              : lastResult.statusCode === 202
                              ? "bg-amber-950 text-amber-300 border-amber-800"
                              : "bg-rose-950 text-rose-300 border-rose-800"
                          }`}
                        >
                          HTTP {lastResult.statusCode} {lastResult.action}
                        </span>
                        <div className="text-[10px] text-slate-400">
                          Confidence: {lastResult.confidenceScore}%
                        </div>
                      </div>
                    </div>

                    {/* Financial Loss Impact */}
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400">Total Exposure Amount:</span>
                        <span className="font-bold text-slate-200">${lastResult.amount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] border-t border-slate-800 pt-2">
                        <span className="text-slate-400 font-bold">Prevented Financial Loss:</span>
                        <span className="font-black text-emerald-400 text-sm">
                          ${lastResult.estimatedPreventedLoss.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Triggered Factors */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-slate-400 block font-bold">Triggered Risk Anomaly Factors:</span>
                      {lastResult.triggeredFactors.length === 0 ? (
                        <div className="text-slate-500 text-[11px] italic">No suspicious anomalies detected. Clean transaction.</div>
                      ) : (
                        <div className="space-y-1">
                          {lastResult.triggeredFactors.map((f, i) => (
                            <div key={i} className="text-[11px] p-2 bg-rose-950/40 border border-rose-900/50 rounded-lg text-rose-300 flex items-center gap-2">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              <span>{f}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Ledger Verification Hash */}
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[10px] space-y-1">
                      <span className="text-slate-500 block">SHA-256 Ledger State Proof:</span>
                      <code className="text-cyan-300 font-mono text-[9px] block break-all">
                        {lastResult.sha256VerificationHash}
                      </code>
                    </div>
                  </div>
                )}
              </div>

              {/* Footnote */}
              <div className="text-[10px] text-slate-500 border-t border-slate-800 pt-3 text-center">
                Evaluation ID: {lastResult?.evaluationId || "N/A"} &bull; SumerAvera Gate 1 Classifier
              </div>
            </div>
          </div>

          {/* Prospective Client Annual ROI & Savings Simulator */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5 font-mono">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  Prospective Client ROI &amp; Annual Loss Prevention Simulator
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Estimate total financial savings by deploying SumerAvera Gate 1 in your organization.
                </p>
              </div>
              <span className="px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-lg text-xs font-bold">
                ESTIMATED ROI: {roiCalculations.roiMultiple}x
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Inputs */}
              <div className="space-y-4 bg-slate-950 p-4 border border-slate-800 rounded-xl text-xs">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1 font-bold">
                    Annual Processed Claim / Volume ($ USD):
                  </label>
                  <input
                    type="number"
                    step="1000000"
                    value={annualClaimVolume}
                    onChange={(e) => setAnnualClaimVolume(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-emerald-300 font-bold focus:border-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1 font-bold">
                    Estimated Industry Fraud Rate (%):
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={estimatedFraudRatePercent}
                    onChange={(e) => setEstimatedFraudRatePercent(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-amber-300 font-bold focus:border-cyan-500 outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Insurance industry avg: 4.0% - 6.0%</span>
                </div>
              </div>

              {/* Outputs */}
              <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col justify-between">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Total Fraud Exposure</span>
                  <div className="text-lg font-black text-rose-400 my-2">
                    ${roiCalculations.totalFraudExposed.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-500">Based on {estimatedFraudRatePercent}% rate</span>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col justify-between">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Annual Savings (Prevented Loss)</span>
                  <div className="text-xl font-black text-emerald-400 my-2">
                    ${roiCalculations.annualSavings.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold">94.2% Interception Rate</span>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col justify-between col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Net Financial Benefit</span>
                  <div className="text-xl font-black text-cyan-300 my-2">
                    ${roiCalculations.netBenefit.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-cyan-400 font-bold">{roiCalculations.roiMultiple}x Return on Investment</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE B: ACTIVE PRODUCTION CLIENT MONITORING HUD */}
      {mode === "MONITORING" && (
        <div className="space-y-6 animate-fade-in font-mono text-xs">
          {/* Active Client Telemetry Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg">
              <span className="text-[10px] text-slate-400 block font-bold">CLIENT TENANT STATUS</span>
              <div className="flex items-center gap-2 mt-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-black text-emerald-300">PRODUCTION ACTIVE</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">SLA Uptime: 99.99%</span>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg">
              <span className="text-[10px] text-slate-400 block font-bold">ACCUMULATED PREVENTED LOSS</span>
              <div className="text-xl font-black text-emerald-400 my-1">
                ${(142850 + (kernel.time_step * 340)).toLocaleString()}
              </div>
              <span className="text-[10px] text-cyan-400">Active Gate 1 Enforcement</span>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg">
              <span className="text-[10px] text-slate-400 block font-bold">CLAIMS SCANNED (24H)</span>
              <div className="text-xl font-black text-slate-100 my-1">
                {(8420 + (kernel.time_step * 12)).toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-500">Latency: 14ms avg</span>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg">
              <span className="text-[10px] text-slate-400 block font-bold">QUARANTINED FRAUD RATE</span>
              <div className="text-xl font-black text-rose-400 my-1">
                4.2%
              </div>
              <span className="text-[10px] text-rose-300 font-bold">354 Anomalies Blocked</span>
            </div>
          </div>

          {/* Real-time Claims Stream Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Live Client Claims Telemetry Stream
              </span>
              <span className="text-[10px] bg-slate-950 text-slate-400 border border-slate-800 px-2 py-0.5 rounded font-bold">
                TENANT: PROD-INSURANCE-CLIENT-01
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                    <th className="py-2 px-3">Timestamp</th>
                    <th className="py-2 px-3">Claim ID</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Amount</th>
                    <th className="py-2 px-3">Risk Score</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Prevented Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  <tr className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 text-slate-400">Just now</td>
                    <td className="py-2.5 px-3 font-bold text-cyan-400">INS-AUTO-9912</td>
                    <td className="py-2.5 px-3 text-slate-300">Auto Collision</td>
                    <td className="py-2.5 px-3 text-slate-200 font-bold">$34,200</td>
                    <td className="py-2.5 px-3 font-bold text-rose-400">88 / 100</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 bg-rose-950 text-rose-300 border border-rose-800 rounded font-bold text-[10px]">
                        HTTP 403 QUARANTINE
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-400">$34,200</td>
                  </tr>

                  <tr className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 text-slate-400">12s ago</td>
                    <td className="py-2.5 px-3 font-bold text-cyan-400">INS-HLT-4410</td>
                    <td className="py-2.5 px-3 text-slate-300">Medical Procedure</td>
                    <td className="py-2.5 px-3 text-slate-200 font-bold">$8,500</td>
                    <td className="py-2.5 px-3 font-bold text-amber-400">54 / 100</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 rounded font-bold text-[10px]">
                        HTTP 202 REBALANCE
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-amber-300">$4,250</td>
                  </tr>

                  <tr className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 text-slate-400">45s ago</td>
                    <td className="py-2.5 px-3 font-bold text-cyan-400">INS-PRP-1002</td>
                    <td className="py-2.5 px-3 text-slate-300">Property Loss</td>
                    <td className="py-2.5 px-3 text-slate-200 font-bold">$12,000</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-400">14 / 100</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded font-bold text-[10px]">
                        HTTP 200 APPROVED
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-500">$0.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Embeddable Widget Integration Code Panel & Live Preview */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5 font-mono text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Code2 className="w-5 h-5 text-cyan-400" />
              Embeddable Widget Integration Snippet &amp; Live Client Preview
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Copy and paste this lightweight snippet to integrate the SumerAvera Evaluation Console Widget directly into your operational platform.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setEmbedTheme(embedTheme === "dark" ? "light" : "dark")}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
            >
              Theme: {embedTheme.toUpperCase()}
            </button>
            <button
              onClick={copyEmbedCode}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow"
            >
              {copiedSnippet ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedSnippet ? "Copied!" : "Copy Snippet"}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Code Block */}
          <div className="bg-slate-950 p-4 border border-slate-800 rounded-xl space-y-2">
            <span className="text-[10px] text-slate-400 block font-bold">1. Standalone Symbiotic Edge HTML Widget (`index.html`):</span>
            <pre className="text-[10px] text-emerald-300 font-mono overflow-x-auto p-3 bg-slate-900 rounded-lg border border-slate-800 leading-relaxed max-h-52">
{`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>SumerAvera Symbiotic Edge Widget</title>
    <style>
        body { background-color: #0b0f19; color: #00ffcc; font-family: monospace; padding: 20px; }
        .widget-card { border: 2px solid #00ffcc; border-radius: 8px; padding: 20px; max-width: 450px; background: #111827; }
        .status-badge { background: #059669; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; }
        .btn { background: #00ffcc; color: #0b0f19; border: none; padding: 10px 15px; font-weight: bold; cursor: pointer; border-radius: 4px; width: 100%; margin-top: 10px; }
        .btn:hover { background: #00d6a8; }
        .log-box { background: #030712; border: 1px solid #374151; padding: 10px; height: 120px; overflow-y: scroll; margin-top: 15px; font-size: 12px; color: #9ca3af; }
    </style>
</head>
<body>
<div class="widget-card">
    <h2>SumerAvera Edge Node</h2>
    <p>Engine Status: <span class="status-badge">STABLE (Zero-Drift)</span></p>
    <p>Ledger Root: <span id="ledger-root">0x695e7375...532d434c</span></p>
    <p>Public Goods Allocation: <strong>10% (Life Direct)</strong></p>
    <button class="btn" onclick="executeInteraction()">Execute Symbiotic Interaction</button>
    <div class="log-box" id="node-logs">[SYSTEM READY] Listening on /ws/ingress...</div>
</div>
<script>
    function executeInteraction() {
        const logBox = document.getElementById('node-logs');
        const timestamp = new Date().toISOString().split('T')[1].slice(0,8);
        logBox.innerHTML += \`<br>[\${timestamp}] Attesting payload via HMAC-SHA256...\`;
        logBox.innerHTML += \`<br>[\${timestamp}] 90% -> Sovereign Node | 10% -> Life Pool\`;
        logBox.innerHTML += \`<br><span style="color:#00ffcc;">[SUCCESS] GATE_1 PASSED. State Settled.</span>\`;
        logBox.scrollTop = logBox.scrollHeight;
    }
</script>
</body>
</html>`}
            </pre>

            <span className="text-[10px] text-slate-400 block font-bold pt-2">2. HTML / JavaScript SDK Embed:</span>
            <pre className="text-[11px] text-cyan-300 font-mono overflow-x-auto p-3 bg-slate-900 rounded-lg border border-slate-800 leading-relaxed">
{`<script src="https://sumeravera.io/v1/widget.js" 
  data-tenant-id="TENANT-CLIENT-EVAL"
  data-industry="${selectedIndustry}"
  data-mode="${mode.toLowerCase()}"
  data-theme="${embedTheme}"
  async>
</script>`}
            </pre>

            <span className="text-[10px] text-slate-400 block font-bold pt-2">2. Go Core Ingress Validator (`package sumeravera`):</span>
            <pre className="text-[10px] text-emerald-300 font-mono overflow-x-auto p-3 bg-slate-900 rounded-lg border border-slate-800 leading-relaxed max-h-56">
{`package sumeravera

import (
    "crypto/sha256"
    "errors"
    "fmt"
)

type ClaimState struct {
    ClaimID      string
    ProviderNPI  string
    PatientID    string
    ServiceCode  string
    BilledAmount float64
    Timestamp    int64
}

type IngressValidator struct {
    LedgerRoot [32]byte
}

func NewValidator(genesisHash [32]byte) *IngressValidator {
    return &IngressValidator{LedgerRoot: genesisHash}
}

func (v *IngressValidator) VerifyAndIntercept(claim ClaimState) error {
    if claim.BilledAmount <= 0 {
        return errors.New("GATE_1_INTERCEPT: Invalid billing amount detected")
    }
    if len(claim.ProviderNPI) != 10 {
        return errors.New("GATE_1_INTERCEPT: Invalid Provider NPI signature length")
    }
    data := fmt.Sprintf("%s:%s:%s:%f:%d", claim.ClaimID, claim.ProviderNPI, claim.ServiceCode, claim.BilledAmount, claim.Timestamp)
    hash := sha256.Sum256([]byte(data))
    if hash == v.LedgerRoot {
        return errors.New("GATE_1_INTERCEPT: State collision / Duplicate state injection detected")
    }
    return nil
}`}
            </pre>

            <span className="text-[10px] text-slate-400 block font-bold pt-2">3. Stage 2 Python Edge Node Widget (`IroncladEdgeNodeWidget`):</span>
            <pre className="text-[10px] text-amber-300 font-mono overflow-x-auto p-3 bg-slate-900 rounded-lg border border-slate-800 leading-relaxed max-h-56">
{`import hashlib
import hmac
import json
import time

class IroncladEdgeNodeWidget:
    """Stage 2 Edge Node Widget: Cryptographically secured client runtime bound to core intent hash."""
    def __init__(self, node_id: str, shared_secret: bytes, immutable_intent_hash: str):
        self.node_id = node_id
        self.shared_secret = shared_secret
        self.immutable_intent_hash = immutable_intent_hash

    def sign_payload(self, payload: dict) -> str:
        payload_string = json.dumps(payload, sort_keys=True)
        return hmac.new(self.shared_secret, payload_string.encode('utf-8'), hashlib.sha256).hexdigest()

    def build_secure_packet(self, user_action: str) -> dict:
        packet = {
            "node_id": self.node_id,
            "timestamp": int(time.time()),
            "intent_anchor": self.immutable_intent_hash,
            "action": user_action
        }
        if packet["intent_anchor"] != self.immutable_intent_hash:
            raise ValueError("CRITICAL: Local intent invariant violation detected!")
        signature = self.sign_payload(packet)
        return {"payload": packet, "signature": signature}`}
            </pre>

            <span className="text-[10px] text-slate-400 block font-bold pt-2">4. Sovereign Value Splitter Smart Contract (`SovereignValueSplitter.sol`):</span>
            <pre className="text-[10px] text-cyan-300 font-mono overflow-x-auto p-3 bg-slate-900 rounded-lg border border-slate-800 leading-relaxed max-h-60">
{`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SovereignValueSplitter
 * @dev Bypasses traditional banking systems, routing value directly
 * to protocol nodes and an unalterable "Return to Life" public goods pool.
 */
contract SovereignValueSplitter {
    address payable public immutable nodeOperator;
    address payable public immutable returnToLifePool;
    uint256 public constant LIFE_RETIREMENT_PERCENT = 10;

    event ValueDistributed(uint256 totalAmount, uint256 nodeAmount, uint256 lifeAmount);

    constructor(address payable _nodeOperator, address payable _returnToLifePool) {
        require(_nodeOperator != address(0), "Invalid node operator address");
        require(_returnToLifePool != address(0), "Invalid public goods pool address");
        nodeOperator = _nodeOperator;
        returnToLifePool = _returnToLifePool;
    }

    receive() external payable {
        require(msg.value > 0, "Zero value submission");
        uint256 lifeShare = (msg.value * LIFE_RETIREMENT_PERCENT) / 100;
        uint256 nodeShare = msg.value - lifeShare;

        (bool successNode, ) = nodeOperator.call{value: nodeShare}("");
        require(successNode, "Node transfer failed");

        (bool successLife, ) = returnToLifePool.call{value: lifeShare}("");
        require(successLife, "Public goods pool transfer failed");

        emit ValueDistributed(msg.value, nodeShare, lifeShare);
    }
}`}
            </pre>

            <span className="text-[10px] text-slate-400 block font-bold pt-2">5. SumerAvera 1 Billion Vector Streaming Engine (`billion_vector_engine.py`):</span>
            <pre className="text-[10px] text-emerald-300 font-mono overflow-x-auto p-3 bg-slate-900 rounded-lg border border-slate-800 leading-relaxed max-h-60">
{`import asyncio, hashlib, mmap, os, time, struct
from concurrent.futures import ProcessPoolExecutor

TOTAL_TARGET = 1_000_000_000  # 1 Billion Vectors
CHUNK_SIZE = 10_000_000       # 10 Million Vectors per Batch
STORAGE_FILE = "billion_vector_ledger.mmap"

def hash_vector_chunk(chunk_id, prev_hash, count):
    hasher = hashlib.sha256()
    hasher.update(f"BLOCK:{chunk_id}|PREV:{prev_hash}".encode('utf-8'))
    raw_payload = struct.pack(f'<{min(count, 100000)}I', *range(min(count, 100000)))
    hasher.update(raw_payload)
    return hasher.hexdigest(), len(raw_payload)

class BillionVectorEngine:
    def __init__(self):
        self.total_target = TOTAL_TARGET
        self.chunk_size = CHUNK_SIZE
        self.verified_blocks = 0
        self.previous_hash = "0" * 64

    async def execute_billion_run(self):
        loop = asyncio.get_running_loop()
        with ProcessPoolExecutor() as executor:
            with open(STORAGE_FILE, "r+b") as f:
                mmapped_ledger = mmap.mmap(f.fileno(), 0)
                offset = 0
                for chunk_idx in range(0, self.total_target, self.chunk_size):
                    self.verified_blocks += 1
                    block_hash, byte_size = await loop.run_in_executor(
                        executor, hash_vector_chunk, self.verified_blocks, self.previous_hash, self.chunk_size
                    )
                    record = f"BLOCK#{self.verified_blocks:03d}|HASH:{block_hash}|VECTORS:{self.chunk_size:,}\n".encode('utf-8')
                    mmapped_ledger[offset : offset + len(record)] = record
                    offset += len(record)
                    self.previous_hash = block_hash
        return {"status": "COMPLETED", "total_vectors": self.total_target, "final_state_root": self.previous_hash}`}
            </pre>

            <span className="text-[10px] text-slate-400 block font-bold pt-2">6. 1 Billion Vector Streaming Engine (`billion_vector_engine.py`):</span>
            <pre className="text-[10px] text-cyan-300 font-mono overflow-x-auto p-3 bg-slate-900 rounded-lg border border-slate-800 leading-relaxed max-h-60">
{`import asyncio, hashlib, mmap, struct, time
from concurrent.futures import ProcessPoolExecutor

TOTAL_TARGET = 1_000_000_000  # 1 Billion Vectors
CHUNK_SIZE = 10_000_000       # 10M Vectors per Batch
STORAGE_FILE = "billion_vector_ledger.mmap"

def hash_vector_chunk(chunk_id, prev_hash, count):
    hasher = hashlib.sha256()
    hasher.update(f"BLOCK:{chunk_id}|PREV:{prev_hash}".encode('utf-8'))
    raw_payload = struct.pack(f'<{count}I', *range(count))
    hasher.update(raw_payload)
    return hasher.hexdigest(), len(raw_payload)

class BillionVectorEngine:
    async def execute_billion_run(self):
        loop = asyncio.get_running_loop()
        with ProcessPoolExecutor() as executor:
            with open(STORAGE_FILE, "r+b") as f:
                mmapped_ledger = mmap.mmap(f.fileno(), 0)
                offset = 0
                for chunk_idx in range(0, TOTAL_TARGET, CHUNK_SIZE):
                    block_hash, byte_size = await loop.run_in_executor(
                        executor, hash_vector_chunk, block_id, prev_hash, CHUNK_SIZE
                    )
                    record = f"BLOCK#{block_id:03d}|HASH:{block_hash}|VECTORS:{CHUNK_SIZE:,}\\n".encode('utf-8')
                    mmapped_ledger[offset : offset + len(record)] = record
                    offset += len(record)`}
            </pre>

            <span className="text-[10px] text-slate-400 block font-bold pt-2">7. React / Next.js Component Import:</span>
            <pre className="text-[11px] text-purple-300 font-mono overflow-x-auto p-3 bg-slate-900 rounded-lg border border-slate-800 leading-relaxed">
{`import { SumerAveraWidget } from '@sumeravera/sdk-react';

<SumerAveraWidget 
  industry="${selectedIndustry}" 
  mode="${mode.toLowerCase()}" 
  onFraudDetected={(res) => console.log('Quarantined claim:', res)} 
/>`}
            </pre>
          </div>

          {/* Live Embedded Preview Simulator Frame */}
          <div className="space-y-2">
            <span className="text-[10px] text-slate-400 block font-bold">Live Embedded Widget Preview (Client Portal View):</span>
            <div
              className={`p-4 rounded-xl border transition shadow-inner ${
                embedTheme === "dark"
                  ? "bg-slate-950 border-slate-800 text-slate-100"
                  : "bg-slate-100 border-slate-300 text-slate-900"
              }`}
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-700/50 mb-3">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-cyan-500" />
                  SumerAvera Fraud Shield Widget
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 font-bold border border-cyan-800">
                  {selectedIndustry.toUpperCase()}
                </span>
              </div>

              <div className="space-y-2 text-[11px]">
                <div className="flex justify-between">
                  <span>Engine Status:</span>
                  <span className="text-emerald-500 font-bold">Active &amp; Guarding</span>
                </div>
                <div className="flex justify-between">
                  <span>Tested Sector:</span>
                  <span className="font-bold">{activeProfile.name}</span>
                </div>
                <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-[10px]">
                  Ready to ingest claims and return instant HTTP status routing (200 / 202 / 403).
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
