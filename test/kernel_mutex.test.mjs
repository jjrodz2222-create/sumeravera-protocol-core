// ============================================================================
// SUMERAVERA PROTOCOL // KERNEL MUTEX HIGH-CONCURRENCY TEST SUITE
// Strict generic Mutex<T> validation, race condition immunity, & zero state bleed
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import {
  Mutex,
  KernelStateMutex,
  createKernelMutex,
  DEFAULT_KERNEL_INITIAL_STATE,
  validateKernelInvariants,
} from "../src/data/KernelMutex.ts";
import { TypedAsyncMutex } from "../src/server.ts";

test("Mutex<T>: Strict Generic Type Safety and Data Leakage Isolation", async () => {
  const initial = {
    session_id: "sess_001",
    counter: 10,
    tags: ["alpha", "beta"],
  };

  const mutex = new Mutex(initial, { name: "ResourceTestMutex" });

  // 1. Initial snapshot must be a defensive clone
  const snapshot = mutex.getSnapshot();
  assert.equal(snapshot.counter, 10);
  assert.equal(snapshot.session_id, "sess_001");

  // Attempting to mutate snapshot should either throw (frozen) or not affect internal state
  try {
    snapshot.counter = 999;
  } catch (err) {
    // Expected in strict mode due to Object.freeze
  }
  assert.equal(mutex.getSnapshot().counter, 10, "External mutation of snapshot must not bleed into internal state");

  // 2. withLock executes with strict generic return type and state isolation
  const computedValue = await mutex.withLock((state) => {
    state.tags.push("gamma"); // caller attempts local mutation
    return state.counter * 2;
  });

  assert.equal(computedValue, 20, "withLock must return strictly typed result");
  assert.deepEqual(
    mutex.getSnapshot().tags,
    ["alpha", "beta"],
    "Modifications inside withLock must not mutate internal state without explicit transition"
  );
});

test("Mutex<T>: High-Concurrency FIFO Serialization (Zero Lost Updates under 200 Concurrent Requests)", async () => {
  const mutex = new Mutex({ val: 0, history: [] }, { name: "HighConcurrencyCounter" });
  const CONCURRENT_STEPS = 200;

  // Launch 200 concurrent transition requests simultaneously
  const promises = Array.from({ length: CONCURRENT_STEPS }, (_, index) => {
    return mutex.transition(async (prev) => {
      // Simulate non-trivial async I/O or differential micro-step
      await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 5)));
      return {
        val: prev.val + 1,
        history: [...prev.history, index],
      };
    });
  });

  await Promise.all(promises);

  const finalState = mutex.getSnapshot();
  assert.equal(finalState.val, CONCURRENT_STEPS, `Final counter must equal exactly ${CONCURRENT_STEPS} (zero lost updates)`);
  assert.equal(finalState.history.length, CONCURRENT_STEPS, "Every single concurrent step must be recorded");
  assert.equal(mutex.isLocked(), false, "Mutex must be unlocked after all tasks complete");
  assert.equal(mutex.getQueueLength(), 0, "Queue length must be zero after completion");
});

test("Mutex<T>: Atomic Rollback & Error Isolation (No Deadlock on Throw)", async () => {
  const mutex = new Mutex({ balance: 1000 }, { name: "AccountMutex" });

  // Task 1: Valid transition
  await mutex.transition((prev) => ({ balance: prev.balance - 100 }));
  assert.equal(mutex.getSnapshot().balance, 900);

  // Task 2: Throwing an error in transition must rollback state and NOT deadlock subsequent tasks
  let errorCaught = false;
  try {
    await mutex.transition(async (prev) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      throw new Error("ADVERSARIAL_INJECTION_ATTEMPT");
    });
  } catch (err) {
    errorCaught = true;
    assert.equal(err.message, "ADVERSARIAL_INJECTION_ATTEMPT");
  }

  assert.ok(errorCaught, "Error must be rethrown to caller");
  assert.equal(mutex.getSnapshot().balance, 900, "State must remain at previous valid state (zero state corruption)");
  assert.equal(mutex.isLocked(), false, "Mutex must unlock cleanly after error");

  // Task 3: Subsequent task must execute cleanly without deadlock
  await mutex.transition((prev) => ({ balance: prev.balance + 500 }));
  assert.equal(mutex.getSnapshot().balance, 1400, "Subsequent task must succeed without deadlock");
});

test("KernelStateMutex: High-Concurrency Simulation Steps & Invariant Preservation", async () => {
  const kernelMutex = createKernelMutex(DEFAULT_KERNEL_INITIAL_STATE);
  const SIMULATION_BURSTS = 100;

  // Run 100 concurrent simulation steps
  const steps = Array.from({ length: SIMULATION_BURSTS }, (_, i) => {
    return kernelMutex.stepSimulation(1.0, {
      bio: i % 2 === 0 ? 0.2 : -0.1,
      energy: i % 3 === 0 ? 0.3 : -0.2,
    });
  });

  const results = await Promise.all(steps);
  const finalKernel = kernelMutex.getSnapshot();

  // 1. Invariant: time_step must strictly match total simulation steps
  assert.equal(finalKernel.time_step, SIMULATION_BURSTS, `time_step must equal ${SIMULATION_BURSTS}`);

  // 2. Invariant: Carrying capacity bounds [E_floor, E_capacity]
  assert.ok(
    finalKernel.E >= finalKernel.E_floor,
    `E (${finalKernel.E}) must not breach minimum operational floor (${finalKernel.E_floor})`
  );
  assert.ok(
    finalKernel.E <= finalKernel.E_capacity,
    `E (${finalKernel.E}) must not exceed maximum carrying capacity (${finalKernel.E_capacity})`
  );

  // 3. Invariant: Quintet nodes within [0, 100]
  for (const [node, val] of Object.entries(finalKernel.Quintet)) {
    assert.ok(typeof val === "number" && !isNaN(val), `Node ${node} must be a number`);
    assert.ok(val >= 0 && val <= 100, `Node ${node} (${val}) must be within [0, 100]`);
  }

  // 4. Invariant: Invariant validator must approve final state
  assert.ok(validateKernelInvariants(finalKernel), "validateKernelInvariants must return true");

  // 5. Invariant: Rebalance works under mutex lock
  const rebalanced = await kernelMutex.rebalance("bio");
  assert.ok(rebalanced.Quintet.bio >= 0 && rebalanced.Quintet.bio <= 100);
});

test("Mutex<T>: Explicit MutexGuard Acquisition and Disposal Protocol", async () => {
  const mutex = new Mutex({ status: "INIT" }, { name: "GuardTest" });

  const guard = await mutex.acquire();
  assert.equal(guard.value.status, "INIT");
  assert.equal(mutex.isLocked(), true, "Mutex must be marked locked while guard is active");

  guard.update({ status: "ACTIVE" });
  guard.release();

  assert.equal(mutex.isLocked(), false, "Mutex must be unlocked after release");
  assert.equal(mutex.getSnapshot().status, "ACTIVE", "Updated value must be committed on release");

  // Guard access after release should throw error
  assert.throws(() => {
    const _ = guard.value;
  }, /already been released/);
});

test("TypedAsyncMutex: Backwards-compatible Strict Generic Lock Queue", async () => {
  const asyncMutex = new TypedAsyncMutex();
  const sequence = [];

  const task1 = asyncMutex.lock(async () => {
    await new Promise((r) => setTimeout(r, 20));
    sequence.push("A");
    return 100;
  });

  const task2 = asyncMutex.lock(async () => {
    await new Promise((r) => setTimeout(r, 5));
    sequence.push("B");
    return "STRING_RESULT";
  });

  const task3 = asyncMutex.lock(() => {
    sequence.push("C");
    return true;
  });

  const [res1, res2, res3] = await Promise.all([task1, task2, task3]);

  assert.equal(res1, 100);
  assert.equal(res2, "STRING_RESULT");
  assert.equal(res3, true);
  assert.deepEqual(sequence, ["A", "B", "C"], "TypedAsyncMutex must enforce strict FIFO execution order");
});
