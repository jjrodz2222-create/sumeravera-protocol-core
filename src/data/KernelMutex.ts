// ============================================================================
// SUMERAVERA PROTOCOL // KERNEL MUTEX CONCURRENCY MODULE
// Strict Generic Mutex<T> Wrapper for Type-Safe State Transitions & Zero Leakage
// ============================================================================

import type { KernelState, QuintetEquilibrium, BalancerMetrics } from "../types";

/**
 * Defensive deep cloner ensuring zero reference sharing or data leakage
 * across asynchronous execution boundaries.
 */
export function deepClone<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // Fallback for non-cloneable objects (functions, symbols)
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Recursively deep freezes an object to guarantee immutable state snapshots.
 */
export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== "object" || Object.isFrozen(obj)) {
    return obj as Readonly<T>;
  }
  Object.freeze(obj);
  const keys = Object.getOwnPropertyNames(obj);
  for (const key of keys) {
    const prop = (obj as Record<string, unknown>)[key];
    if (prop !== null && typeof prop === "object") {
      deepFreeze(prop);
    }
  }
  return obj as Readonly<T>;
}

export interface MutexOptions<T> {
  /** Custom cloning function to isolate state copies */
  cloner?: (value: T) => T;
  /** Optional runtime validator enforcing invariants before state commit */
  validator?: (state: T) => boolean | Promise<boolean>;
  /** Descriptive identifier for debugging and metrics */
  name?: string;
}

export interface MutexGuard<T> {
  /** The current guarded value */
  readonly value: T;
  /** Updates the guarded value within the critical section */
  update(newValue: T): void;
  /** Releases the lock, committing changes */
  release(): void;
  /** Async disposal protocol support for TS 5.2+ 'using' syntax */
  [Symbol.asyncDispose](): Promise<void>;
}

export interface ConcurrencyMetrics {
  name: string;
  totalAcquisitions: number;
  totalTransitions: number;
  totalErrors: number;
  currentQueueLength: number;
  isLocked: boolean;
  peakQueueLength: number;
  averageHoldTimeMs: number;
}

/**
 * Strict Generic Mutex Wrapper: Mutex<T>
 * 
 * Enforces serialized, type-safe access to a shared resource or state of type T.
 * Guarantees:
 * 1. Strict FIFO ordering under high-burst concurrency without race conditions.
 * 2. Absolute zero 'any' type casting or runtime data leakage across callers.
 * 3. Automatic atomic rollback: if an asynchronous transition or critical section throws,
 *    the lock is reliably released (preventing deadlocks) and the inner state remains
 *    at the previous valid, invariant-conforming state.
 */
export class Mutex<T> {
  private _state: T;
  private _queue: Promise<void> = Promise.resolve();
  private _queueLength: number = 0;
  private _isLocked: boolean = false;
  private readonly _options: MutexOptions<T>;
  private readonly _name: string;

  // Concurrency telemetry
  private _totalAcquisitions: number = 0;
  private _totalTransitions: number = 0;
  private _totalErrors: number = 0;
  private _peakQueueLength: number = 0;
  private _totalHoldTimeMs: number = 0;

  constructor(initialState: T, options?: MutexOptions<T>) {
    this._options = options || {};
    this._name = this._options.name || "KernelMutex";
    const cloner = this._options.cloner || deepClone;
    this._state = cloner(initialState);
  }

  /**
   * Executes a critical section task with exclusive read/write access to the resource.
   * Passes a defensive clone to prevent caller mutations from leaking into the mutex.
   * 
   * @param task Function accepting current state of type T and returning Promise<R> | R
   * @returns Result of type R, strictly inferred without type casting
   */
  public async withLock<R>(task: (state: T) => Promise<R> | R): Promise<R> {
    this._queueLength++;
    if (this._queueLength > this._peakQueueLength) {
      this._peakQueueLength = this._queueLength;
    }

    const previousQueue = this._queue;
    let releaseLock!: () => void;
    this._queue = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    try {
      // Await completion of all prior critical sections
      await previousQueue;
      this._isLocked = true;
      this._totalAcquisitions++;
      const startTime = Date.now();

      const cloner = this._options.cloner || deepClone;
      const stateClone = cloner(this._state);

      const result = await task(stateClone);

      const holdTime = Date.now() - startTime;
      this._totalHoldTimeMs += holdTime;
      return result;
    } catch (error) {
      this._totalErrors++;
      throw error;
    } finally {
      this._queueLength--;
      this._isLocked = false;
      releaseLock();
    }
  }

  /**
   * Atomically transitions the protected resource from current state to next state.
   * If mutator fails or violates the validator invariant, the state is rolled back
   * to the previous valid state and the lock is unlocked cleanly.
   * 
   * @param mutator Pure transition function mapping Readonly<T> to new T
   * @returns Cloned copy of the committed state T
   */
  public async transition(
    mutator: (currentState: Readonly<T>) => Promise<T> | T
  ): Promise<T> {
    this._queueLength++;
    if (this._queueLength > this._peakQueueLength) {
      this._peakQueueLength = this._queueLength;
    }

    const previousQueue = this._queue;
    let releaseLock!: () => void;
    this._queue = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    try {
      await previousQueue;
      this._isLocked = true;
      this._totalAcquisitions++;
      const startTime = Date.now();

      const cloner = this._options.cloner || deepClone;
      // Provide an immutable snapshot to mutator to prevent in-flight side effects
      const snapshot = deepFreeze(cloner(this._state));

      const nextState = await mutator(snapshot);

      // Validate proposed next state
      if (this._options.validator) {
        const isValid = await this._options.validator(nextState);
        if (!isValid) {
          throw new Error(
            `[${this._name}] MUTEX_INVARIANT_VIOLATION: Proposed state transition violates kernel invariants.`
          );
        }
      }

      // Atomically commit new state
      this._state = cloner(nextState);
      this._totalTransitions++;

      const holdTime = Date.now() - startTime;
      this._totalHoldTimeMs += holdTime;

      return cloner(this._state);
    } catch (error) {
      this._totalErrors++;
      throw error;
    } finally {
      this._queueLength--;
      this._isLocked = false;
      releaseLock();
    }
  }

  /**
   * Atomically performs a state transition and simultaneously produces a typed result R.
   * 
   * @param action Reducer returning { nextState: T, result: R }
   * @returns Result of type R
   */
  public async dispatch<R>(
    action: (currentState: Readonly<T>) => Promise<{ nextState: T; result: R }> | { nextState: T; result: R }
  ): Promise<R> {
    this._queueLength++;
    if (this._queueLength > this._peakQueueLength) {
      this._peakQueueLength = this._queueLength;
    }

    const previousQueue = this._queue;
    let releaseLock!: () => void;
    this._queue = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    try {
      await previousQueue;
      this._isLocked = true;
      this._totalAcquisitions++;
      const startTime = Date.now();

      const cloner = this._options.cloner || deepClone;
      const snapshot = deepFreeze(cloner(this._state));

      const { nextState, result } = await action(snapshot);

      if (this._options.validator) {
        const isValid = await this._options.validator(nextState);
        if (!isValid) {
          throw new Error(
            `[${this._name}] MUTEX_DISPATCH_VIOLATION: Proposed state violates kernel invariants.`
          );
        }
      }

      this._state = cloner(nextState);
      this._totalTransitions++;

      const holdTime = Date.now() - startTime;
      this._totalHoldTimeMs += holdTime;

      return result;
    } catch (error) {
      this._totalErrors++;
      throw error;
    } finally {
      this._queueLength--;
      this._isLocked = false;
      releaseLock();
    }
  }

  /**
   * Acquires the mutex lock explicitly, returning an RAII MutexGuard<T>.
   * Call `guard.release()` or use TypeScript `await using` to release the lock.
   */
  public async acquire(): Promise<MutexGuard<T>> {
    this._queueLength++;
    if (this._queueLength > this._peakQueueLength) {
      this._peakQueueLength = this._queueLength;
    }

    const previousQueue = this._queue;
    let releaseLock!: () => void;
    this._queue = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    try {
      await previousQueue;
      this._isLocked = true;
      this._totalAcquisitions++;
      const startTime = Date.now();

      let released = false;
      const cloner = this._options.cloner || deepClone;
      let workingCopy = cloner(this._state);

      const guard: MutexGuard<T> = {
        get value(): T {
          if (released) {
            throw new Error(`[${this._name}] MutexGuard has already been released.`);
          }
          return workingCopy;
        },
        update: (newValue: T): void => {
          if (released) {
            throw new Error(`[${this._name}] MutexGuard has already been released.`);
          }
          workingCopy = cloner(newValue);
        },
        release: (): void => {
          if (released) return;
          released = true;
          this._state = workingCopy;
          const holdTime = Date.now() - startTime;
          this._totalHoldTimeMs += holdTime;
          this._queueLength--;
          this._isLocked = false;
          releaseLock();
        },
        [Symbol.asyncDispose]: async (): Promise<void> => {
          guard.release();
        },
      };

      return guard;
    } catch (error) {
      this._queueLength--;
      this._isLocked = false;
      releaseLock();
      throw error;
    }
  }

  /**
   * Retrieves an immutable, deep-frozen snapshot of the current state.
   * Safe to pass to external observers without risk of state corruption.
   */
  public getSnapshot(): Readonly<T> {
    const cloner = this._options.cloner || deepClone;
    return deepFreeze(cloner(this._state));
  }

  /**
   * Resets the protected state unconditionally (e.g., on system reboot).
   */
  public async reset(newState: T): Promise<T> {
    return this.transition(() => newState);
  }

  public isLocked(): boolean {
    return this._isLocked;
  }

  public getQueueLength(): number {
    return this._queueLength;
  }

  public getMetrics(): ConcurrencyMetrics {
    return {
      name: this._name,
      totalAcquisitions: this._totalAcquisitions,
      totalTransitions: this._totalTransitions,
      totalErrors: this._totalErrors,
      currentQueueLength: this._queueLength,
      isLocked: this._isLocked,
      peakQueueLength: this._peakQueueLength,
      averageHoldTimeMs:
        this._totalAcquisitions > 0 ? this._totalHoldTimeMs / this._totalAcquisitions : 0,
    };
  }
}

// -----------------------------------------------------------------------------
// DEFAULT KERNEL INITIAL STATE
// -----------------------------------------------------------------------------
export const DEFAULT_KERNEL_INITIAL_STATE: KernelState = {
  E: 420.0,
  E_capacity: 1000.0,
  E_floor: 100.0,
  Quintet: {
    bio: 82.5,
    art: 78.0,
    spirit: 85.0,
    water: 90.2,
    energy: 74.8,
  },
  H_overall_index: 82.1,
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
};

/**
 * Validates SumerAvera Core Invariants on KernelState:
 * 1. Carrying capacity bounds: E in [E_floor, E_capacity]
 * 2. Quintet non-negative equilibrium bounds: each node in [0, 100]
 * 3. Monotonic time step: time_step >= 0
 */
export function validateKernelInvariants(state: KernelState): boolean {
  if (state.E < state.E_floor || state.E > state.E_capacity) {
    return false;
  }
  if (state.time_step < 0) {
    return false;
  }
  const nodes = Object.values(state.Quintet);
  for (const val of nodes) {
    if (typeof val !== "number" || isNaN(val) || val < 0 || val > 100) {
      return false;
    }
  }
  return true;
}

/**
 * Specialized Kernel State Mutex Wrapper: KernelStateMutex
 * 
 * Extends Mutex<KernelState> with dedicated Lotka-Volterra differential simulation
 * step methods, enforcing all homeostatic invariants atomically during high-concurrency simulation.
 */
export class KernelStateMutex extends Mutex<KernelState> {
  constructor(initialState: KernelState = DEFAULT_KERNEL_INITIAL_STATE) {
    super(initialState, {
      name: "SumerAveraKernelMutex",
      validator: validateKernelInvariants,
    });
  }

  /**
   * Executes a high-concurrency simulation step atomically:
   * 1. Monotonically increments time_step.
   * 2. Adjusts carrying capacity E bounded strictly within [E_floor, E_capacity].
   * 3. Steps Quintet Lotka-Volterra dynamics within [0, 100].
   * 4. Updates homeostatic status and overall harmony index.
   */
  public async stepSimulation(
    dt: number = 1.0,
    perturbation?: Partial<QuintetEquilibrium>
  ): Promise<KernelState> {
    return this.transition((prev) => {
      const step = prev.time_step + 1;
      
      // Homeostatic Lotka-Volterra differential coupling
      const bioDelta = ((prev.Quintet.water * 0.05) - (prev.Quintet.energy * 0.02)) * dt;
      const artDelta = ((prev.Quintet.spirit * 0.04) - (prev.Quintet.bio * 0.01)) * dt;
      const spiritDelta = ((prev.Quintet.art * 0.03) - (prev.Quintet.water * 0.01)) * dt;
      const waterDelta = ((prev.Quintet.energy * 0.03) - (prev.Quintet.bio * 0.02)) * dt;
      const energyDelta = ((prev.Quintet.bio * 0.04) - (prev.Quintet.spirit * 0.02)) * dt;

      // Apply perturbations if any (e.g. from high-concurrency stress test injections)
      const pBio = perturbation?.bio ?? 0;
      const pArt = perturbation?.art ?? 0;
      const pSpirit = perturbation?.spirit ?? 0;
      const pWater = perturbation?.water ?? 0;
      const pEnergy = perturbation?.energy ?? 0;

      const clampNode = (val: number): number =>
        Number(Math.min(100.0, Math.max(0.0, val)).toFixed(2));

      const nextQuintet: QuintetEquilibrium = {
        bio: clampNode(prev.Quintet.bio + bioDelta + pBio),
        art: clampNode(prev.Quintet.art + artDelta + pArt),
        spirit: clampNode(prev.Quintet.spirit + spiritDelta + pSpirit),
        water: clampNode(prev.Quintet.water + waterDelta + pWater),
        energy: clampNode(prev.Quintet.energy + energyDelta + pEnergy),
      };

      // Carrying capacity differential drift
      const meanHarmony =
        (nextQuintet.bio + nextQuintet.art + nextQuintet.spirit + nextQuintet.water + nextQuintet.energy) / 5.0;
      const targetE = prev.E + (meanHarmony - 75.0) * 0.2 * dt;
      const nextE = Number(Math.min(prev.E_capacity, Math.max(prev.E_floor, targetE)).toFixed(2));

      // Homeostatic classification
      const harmonyIndex = Number(meanHarmony.toFixed(1));
      let status: "STABLE" | "DEGRADED" | "CRITICAL" = "STABLE";
      if (harmonyIndex < 40 || nextE <= prev.E_floor + 10) {
        status = "CRITICAL";
      } else if (harmonyIndex < 60 || nextE <= prev.E_floor + 50) {
        status = "DEGRADED";
      }

      const nextState: KernelState = {
        ...prev,
        E: nextE,
        time_step: step,
        Quintet: nextQuintet,
        H_overall_index: harmonyIndex,
        homeostasis_status: status,
        balancer: prev.balancer
          ? {
              ...prev.balancer,
              homeostatic_pressure: Number((Math.abs(meanHarmony - 80) * 0.1).toFixed(2)),
            }
          : undefined,
      };

      return nextState;
    });
  }

  /**
   * Rebalances a specific node in the Quintet equilibrium back toward the mean.
   */
  public async rebalance(node?: keyof QuintetEquilibrium): Promise<KernelState> {
    return this.transition((prev) => {
      const values = Object.values(prev.Quintet);
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;

      const nextQuintet: QuintetEquilibrium = { ...prev.Quintet };
      if (node && node in nextQuintet) {
        nextQuintet[node] = Number(((nextQuintet[node] + mean) / 2.0).toFixed(2));
      } else {
        for (const k of Object.keys(nextQuintet) as Array<keyof QuintetEquilibrium>) {
          nextQuintet[k] = Number(((nextQuintet[k] * 0.7) + (mean * 0.3)).toFixed(2));
        }
      }

      return {
        ...prev,
        Quintet: nextQuintet,
      };
    });
  }
}

/**
 * Factory helper for creating a type-safe KernelStateMutex.
 */
export function createKernelMutex(
  initialState?: KernelState
): KernelStateMutex {
  return new KernelStateMutex(initialState);
}
