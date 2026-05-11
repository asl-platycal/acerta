import {
  INITIAL_RUNTIME_SEQUENCE_STATE,
  type RuntimeActionContext,
  type RuntimeSequenceState,
} from "@acerta/shared/schemas/runtime-sequence";

export { INITIAL_RUNTIME_SEQUENCE_STATE };
export type { RuntimeActionContext, RuntimeSequenceState };

/**
 * Avança sequência e timestamp de forma pura e determinística.
 * `clockMs` é injetado pelo host (ex.: `performance.now()`, relógio de servidor) — sem rede aqui.
 */
export function advanceRuntimeSequence(
  state: RuntimeSequenceState,
  clockMs: number,
): { readonly nextState: RuntimeSequenceState; readonly context: RuntimeActionContext } {
  if (typeof clockMs !== "number" || !Number.isFinite(clockMs)) {
    throw new TypeError("MatchRuntimeCoordinator: clockMs must be a finite number");
  }
  if (clockMs < state.lastTimestamp) {
    throw new Error("MatchRuntimeCoordinator: clockMs must be >= lastTimestamp");
  }
  const sequenceNumber = state.lastSequenceNumber + 1;
  if (!Number.isInteger(sequenceNumber)) {
    throw new Error("MatchRuntimeCoordinator: sequence overflow");
  }
  const context: RuntimeActionContext = { sequenceNumber, timestamp: clockMs };
  const nextState: RuntimeSequenceState = {
    lastSequenceNumber: sequenceNumber,
    lastTimestamp: clockMs,
  };
  return { nextState, context };
}

/**
 * Ponto de entrada nominal — apenas funções puras, sem estado interno.
 */
export const MatchRuntimeCoordinator = {
  advanceRuntimeSequence,
  INITIAL_RUNTIME_SEQUENCE_STATE,
} as const;

export function assertStrictlyIncreasingSequence(previous: number, next: number): void {
  if (!Number.isInteger(previous) || !Number.isInteger(next) || next <= previous) {
    throw new Error("runtime-sequence: sequenceNumber must be strictly increasing integers");
  }
}
