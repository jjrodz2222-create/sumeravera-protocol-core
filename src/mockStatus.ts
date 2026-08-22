import { SumerAveraStatus } from "./types";

export const MOCK_DEFAULT_STATUS: SumerAveraStatus = {
  kernel: {
    E: 1050.0,
    E_capacity: 2000.0,
    E_floor: 100.0,
    Quintet: {
      bio: 75.0,
      art: 70.0,
      spirit: 80.0,
      water: 85.0,
      energy: 78.0,
    },
    H_overall_index: 77.6,
    time_step: 0,
    homeostasis_status: "STABLE",
    balancer: {
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
    },
  },
  ledger: {
    length: 1,
    latest_block: {
      index: 0,
      timestamp: Math.floor(Date.now() / 1000),
      action_type: "GENESIS",
      agent_id: "agent_eco_guard",
      prev_hash: "0000000000000000000000000000000000000000000000000000000000000000",
      hash: "61ef48e4febdd178239e64dcfe32cbd2daf051f9943eb62d38fac2b963f78058",
      nonce: 0,
      state_snapshot: {
        E: 1050.0,
        Quintet: {
          bio: 75.0,
          art: 70.0,
          spirit: 80.0,
          water: 85.0,
          energy: 78.0,
        },
      },
      details: "SumerAvera Protocol Core Engine initialized with Genesis Sovereign State.",
    },
    integrity: true,
    verification_message: "Ledger integrity verified via SHA-256",
  },
  gateway: {
    stats: {
      total_requests: 1,
      legitimate_routed: 1,
      honeypot_diverted: 0,
      threats_by_type: {
        SQL_EXPLOIT: 0,
        FORGED_SIGNATURE: 0,
        UNREGISTERED_AGENT: 0,
        RESOURCE_DRAIN_ATTACK: 0,
        BOT_REPLAY: 0,
        XSS_PAYLOAD: 0,
        INVALID_SIGNATURE: 0,
      },
    },
    honeypot_logs_count: 0,
  },
  system_logs: [
    {
      id: "LOG-INIT-GENESIS",
      timestamp: Math.floor(Date.now() / 1000),
      time_formatted: new Date().toLocaleTimeString(),
      module: "KERNEL",
      level: "INFO",
      message: "SumerAvera Protocol Core Engine initialized with Genesis Sovereign State.",
    },
  ],
  honeypot_logs: [],
  registered_agents: [
    { id: "agent_bio_1", name: "Bio-Regenerator Prime", role: "Bio/Ecology Synthesizer", allowed_facets: ["bio", "water"] },
    { id: "agent_art_1", name: "Aetheria Cultural Weaver", role: "Art & Spirit Curator", allowed_facets: ["art", "spirit"] },
    { id: "agent_energy_1", name: "Sol-Hydro Grid Node", role: "Energy/Thermodynamic Balancer", allowed_facets: ["energy", "water"] },
    { id: "agent_eco_guard", name: "Gaia Guardian Kernel", role: "Homeostatic Equalizer", allowed_facets: ["bio", "art", "spirit", "water", "energy"] },
  ],
};
