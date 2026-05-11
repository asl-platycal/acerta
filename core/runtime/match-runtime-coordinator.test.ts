import { describe, expect, it } from "vitest";
import { advanceRuntimeSequence, INITIAL_RUNTIME_SEQUENCE_STATE, MatchRuntimeCoordinator } from "./match-runtime-coordinator";

describe("MatchRuntimeCoordinator", () => {
  it("sequência monotónica e timestamps não regressivos", () => {
    const a = advanceRuntimeSequence(INITIAL_RUNTIME_SEQUENCE_STATE, 100);
    expect(a.context.sequenceNumber).toBe(0);
    expect(a.context.timestamp).toBe(100);
    const b = advanceRuntimeSequence(a.nextState, 100);
    expect(b.context.sequenceNumber).toBe(1);
    expect(b.context.timestamp).toBe(100);
    const c = advanceRuntimeSequence(b.nextState, 150);
    expect(c.context.sequenceNumber).toBe(2);
    expect(c.context.timestamp).toBe(150);
  });

  it("clock regressivo falha", () => {
    const a = advanceRuntimeSequence(INITIAL_RUNTIME_SEQUENCE_STATE, 50);
    expect(() => advanceRuntimeSequence(a.nextState, 40)).toThrow();
  });

  it("MatchRuntimeCoordinator.advanceRuntimeSequence é o mesmo avanço", () => {
    const x = MatchRuntimeCoordinator.advanceRuntimeSequence(INITIAL_RUNTIME_SEQUENCE_STATE, 1);
    const y = advanceRuntimeSequence(INITIAL_RUNTIME_SEQUENCE_STATE, 1);
    expect(x).toEqual(y);
  });
});
