export interface QuintetEquilibrium {
  bio: number;
  art: number;
  spirit: number;
  water: number;
  energy: number;
}

export interface BalancerMetrics {
  quintet_variance: number;
  quintet_stdev: number;
  homeostatic_pressure: number;
  coupling_synergy_index: number;
  auto_rebalance_active: boolean;
  coupling_factor: number;
  dampening_rate: number;
  cross_facet_matrix: Record<string, Record<string, number>>;
}

export interface KernelState {
  E: number;
  E_capacity: number;
  E_floor: number;
  Quintet: QuintetEquilibrium;
  H_overall_index: number;
  time_step: number;
  homeostasis_status: "STABLE" | "DEGRADED" | "CRITICAL";
  balancer?: BalancerMetrics;
}

export interface LedgerBlock {
  index: number;
  timestamp: number;
  action_type: string;
  agent_id: string;
  prev_hash: string;
  hash: string;
  nonce: number;
  state_snapshot: {
    E: number;
    H?: QuintetEquilibrium;
    Quintet?: QuintetEquilibrium;
  };
  details: string;
}

export interface LedgerInfo {
  length: number;
  latest_block: LedgerBlock | null;
  integrity: boolean;
  verification_message?: string;
}

export interface GatewayStats {
  total_requests: number;
  legitimate_routed: number;
  honeypot_diverted: number;
  threats_by_type: Record<string, number>;
}

export interface HoneypotLog {
  id: string;
  timestamp: number;
  client_ip: string;
  user_agent: string;
  threat_type: string;
  reason: string;
  action_taken: string;
  payload_captured: any;
  synthetic_response_sent: {
    status: string;
    synthetic_ledger_hash: string;
    simulated_E: number;
  };
}

export interface LossPreventionMetrics {
  total_prevented_financial_loss: number;
  quarantine_count: number;
  rebalance_count: number;
  stable_count: number;
  last_quarantined_payload?: {
    timestamp: number;
    tenant_id: string;
    source_node_id: string;
    anomaly_index: number;
    prevented_loss: number;
    reasons: string[];
  } | null;
}

export interface HeaderCompliance {
  tenant_id: string;
  source_node_id: string;
  timestamp: number;
  payload_type: string;
  header_present: boolean;
  sha256_verified: boolean;
  computed_sha256: string;
}

export interface TelemetrySummary {
  voltage: number;
  current: number;
  isolation_faults: number;
  claimed_financial_values: number;
  power_kw: number;
}

export interface SchemaValidationData {
  status: "STABLE" | "REBALANCING" | "QUARANTINE";
  http_code: number;
  route: string;
  anomaly_index: number;
  reason: string;
  header_compliance: HeaderCompliance;
  telemetry: TelemetrySummary;
  schema_errors: string[];
  claimed_val?: number;
}

export interface GatewayInfo {
  stats: GatewayStats;
  loss_prevention_metrics?: LossPreventionMetrics;
  honeypot_logs_count: number;
}

export interface SystemLog {
  id: string;
  timestamp: number;
  time_formatted: string;
  module: "KERNEL" | "VERIFICATION" | "HONEYPOT" | "LEDGER" | "INGRESS";
  level: "INFO" | "SUCCESS" | "WARN" | "WARNING" | "CRITICAL";
  message: string;
}

export interface AgentInfo {
  id: string;
  name: string;
  role: string;
  allowed_facets: string[];
}

export interface SumerAveraStatus {
  kernel: KernelState;
  ledger: LedgerInfo;
  gateway: GatewayInfo;
  system_logs: SystemLog[];
  honeypot_logs: HoneypotLog[];
  registered_agents: AgentInfo[];
}

export interface GatewayRouteResult {
  route: string;
  diverted: boolean;
  status?: "STABLE" | "REBALANCING" | "QUARANTINE";
  http_code?: number;
  anomaly_index?: number;
  threat_type?: string;
  message: string;
  new_state?: any;
  ledger_block?: LedgerBlock;
  decoy_response?: any;
  schema_compliance?: SchemaValidationData;
  loss_prevention?: LossPreventionMetrics;
  audit?: any;
}

export interface StressTestMetrics {
  total_requests: number;
  total_wall_time_seconds: number;
  engine_throughput_req_sec: number;
  avg_latency_ms: number;
  p99_latency_ms: number;
  honeypot_interceptions: number;
  honeypot_percentage: number;
  approved_commits: number;
  approved_percentage: number;
  vectors_breakdown: {
    INVALID_SIGNATURE: number;
    CARRYING_CAPACITY_OVERRUN: number;
    FACET_OUT_OF_BOUNDS: number;
    NONE: number;
  };
  final_ledger_blocks: number;
  core_state_integrity: string;
}

export interface LiveIngressEvent {
  id: string;
  timestamp: number;
  protocol: "WEBSOCKET" | "HTTP";
  endpoint: string;
  payload: any;
  status: "VERIFIED_AND_APPROVED" | "REJECTED_HONEYPOT";
  route: "CORE_KERNEL" | "HONEYPOT_SYNTHETIC_PLAYGROUND";
  reason: string;
  block_hash?: string;
  latency_ms?: number;
}

export interface IngressStatusInfo {
  ws_endpoint: string;
  http_endpoint: string;
  active_ws_connections: number;
  status: string;
}

export interface IntentAnalysis {
  intent_text: string;
  classification: string;
  agent_id: string;
  agent_name: string;
  confidence: number;
  harmony_alignment_score: number;
  homeostatic_risk_score: number;
  threat_flag: boolean;
  generated_payload: {
    agent_id: string;
    dE: number;
    dH: Record<string, number>;
    secret_key: string;
    signature: string;
    natural_intent: string;
  };
}

export interface IntentIngressResponse {
  status: "VERIFIED_AND_APPROVED" | "REJECTED_HONEYPOT";
  protocol: string;
  endpoint: string;
  route: "CORE_KERNEL" | "HONEYPOT_SYNTHETIC_PLAYGROUND";
  intent_analysis: IntentAnalysis;
  route_result: GatewayRouteResult;
  kernel_state?: KernelState;
  timestamp: number;
}

export interface SecurityReportData {
  protocol: string;
  report_title: string;
  operational_depth_T: number;
  report_timestamp: number;
  iso_timestamp: string;
  checkpoint_seal: {
    seal_id: string;
    operational_steps: number;
    status: string;
    cryptographic_hash: string;
    ledger_depth_snapshot: number;
    ledger_root_hash: string;
    confirmation_message: string;
  };
  state_invariance_proof: {
    status: string;
    gate_1_isolation_ratio: number;
    state_bleed_detected: boolean;
    ledger_contamination_count: number;
    quarantine_isolation_efficiency: string;
    total_ingress_payloads_processed: number;
    quarantined_payloads: number;
    total_prevented_financial_loss: number;
    details: string;
  };
  zero_drift_baseline: {
    status: string;
    system_alignment_score: number;
    unhandled_loops_count: number;
    unhandled_error_states: number;
    homeostatic_status: string;
    quintet_harmony_index: number;
    energy_equilibrium_E: number;
    details: string;
  };
  uptime_vs_error_density?: {
    total_operational_period: string;
    system_uptime: string;
    service_dropouts: number;
    error_density: string;
    unhandled_exceptions: number;
    loop_drift_events: number;
    gate1_isolation_integrity: string;
    ledger_contamination_rate: string;
    breakdown_by_phase: Array<{
      phase: string;
      uptime: string;
      error_density: string;
      volume_processed: string;
      status: string;
    }>;
  };
  audit_compliance: {
    compliance_standard: string;
    verified_by: string;
    milestone_checkpoint: string;
    signature: string;
  };
}

export interface HistoricalDataPoint {
  timestamp: number;
  timeFormatted: string;
  timeLabel: string;
  E: number;
  bio: number;
  art: number;
  spirit: number;
  water: number;
  energy: number;
  H_overall_index: number;
  time_step?: number;
}

export type HistoricalTimeframe = "hour" | "day" | "week" | "session";

export type IndustryType = 
  | "insurance" 
  | "banking" 
  | "ecommerce" 
  | "healthcare" 
  | "telecom" 
  | "government";

export interface IndustryProfile {
  id: IndustryType;
  rank: number;
  name: string;
  annualFraudLoss: string;
  iconName: string;
  description: string;
  primaryRiskVectors: string[];
  sampleClaims: Array<{
    id: string;
    type: string;
    amount: number;
    description: string;
    defaultRiskFactors: string[];
    syntheticAnomalyScore: number;
  }>;
}

export interface WidgetEvaluationResult {
  evaluationId: string;
  timestamp: string;
  industry: IndustryType;
  claimId: string;
  amount: number;
  riskScore: number; // 0 - 100
  action: "APPROVE" | "AUDIT_REBALANCE" | "QUARANTINE_403";
  statusCode: number;
  estimatedPreventedLoss: number;
  confidenceScore: number;
  triggeredFactors: string[];
  sha256VerificationHash: string;
}

