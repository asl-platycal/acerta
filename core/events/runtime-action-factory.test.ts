import { describe, expect, it } from "vitest";
import { buildCombatResult } from "../engines/combat-engine/combat-engine";
import { advanceRuntimeSequence, INITIAL_RUNTIME_SEQUENCE_STATE } from "../runtime/match-runtime-coordinator";
import {
  buildCombatRuntimeActionEnvelope,
  buildQuestionRuntimeActionEnvelope,
  RuntimeActionEnvelopeBuildError,
} from "./runtime-action-factory";
import type { Board, CombatAttempt, EntityCatalog, Hex, QuestionValidationResult } from "@acerta/shared/schemas";

function cell(q: number, r: number, terrain: "water" | "land", occupancy?: NonNullable<Hex["occupancy"]>): Hex {
  const id = `hex:${q}:${r}`;
  return {
    coordinate: { id, q, r },
    world: { x: 0, y: 0 },
    terrain,
    distToShore: 0,
    occupancy,
  };
}

const gen = {
  hexRadiusLogical: 1,
  scale: 1,
  cols: 16,
  rows: 16,
  mapWidthPx: 160,
  mapHeightPx: 160,
};

describe("runtime-action-factory", () => {
  it("envelope de combate: score e analytics alinhados ao patch", () => {
    const board: Board = {
      hexes: {
        "hex:0:0": cell(0, 0, "water", {
          placementId: "fleet_placement:x",
          entityId: "fleet_unit:x",
          domain: "naval",
        }),
        "hex:0:1": cell(0, 1, "water", {
          placementId: "fleet_placement:x",
          entityId: "fleet_unit:x",
          domain: "naval",
        }),
      },
      fleetPlacements: [
        {
          kind: "fleet",
          placementId: "fleet_placement:x",
          entityId: "fleet_unit:x",
          occupiedHexIds: ["hex:0:0", "hex:0:1"],
          revealedHexIds: [],
          destroyed: false,
          currentIntegrity: 2,
        },
      ],
      structurePlacements: [],
      generation: gen,
    };
    const catalog: EntityCatalog = {
      fleetUnits: {
        "fleet_unit:x": {
          entityId: "fleet_unit:x",
          entityType: "FRAGATA",
          category: "naval",
          sizeInHexes: 2,
        },
      },
      structures: {},
    };
    const attempt: CombatAttempt = { target: { hexId: "hex:0:0" }, authorized: true };
    const { nextState, context } = advanceRuntimeSequence(INITIAL_RUNTIME_SEQUENCE_STATE, 500);
    const patch = buildCombatResult(board, attempt, catalog, context);
    const d = patch.outcome.damage!;
    const env = buildCombatRuntimeActionEnvelope({
      runtimeContext: context,
      patch,
      score: { partialHitValue: d.partialHitValue, destructionBonusValue: d.destructionBonusValue },
      analytics: {
        targetType: patch.outcome.targetKind,
        destructionOutcome: patch.outcome.occupantDestroyed,
      },
    });
    expect(env.actionType).toBe("combat_shot");
    expect(env.runtimeContext).toEqual(context);
    expect(env.patch).toBe(patch);
    expect(env.actionOutcome.kind).toBe("combat");
    expect(nextState.lastSequenceNumber).toBe(0);
  });

  it("context divergente do patch falha", () => {
    const board: Board = {
      hexes: { "hex:1:1": cell(1, 1, "water") },
      fleetPlacements: [],
      structurePlacements: [],
      generation: gen,
    };
    const { context } = advanceRuntimeSequence(INITIAL_RUNTIME_SEQUENCE_STATE, 1);
    const patch = buildCombatResult(board, { target: { hexId: "hex:1:1" }, authorized: true }, { fleetUnits: {}, structures: {} }, context);
    expect(() =>
      buildCombatRuntimeActionEnvelope({
        runtimeContext: { sequenceNumber: 99, timestamp: 1 },
        patch,
        score: {},
        analytics: { targetType: "none" },
      }),
    ).toThrow(RuntimeActionEnvelopeBuildError);
  });

  it("envelope de pergunta sem patch", () => {
    const { context } = advanceRuntimeSequence(INITIAL_RUNTIME_SEQUENCE_STATE, 42);
    const questionValidation: QuestionValidationResult = {
      correct: true,
      responseTimeMs: 800,
      questionId: "q1",
      selectedOptionId: "a",
    };
    const env = buildQuestionRuntimeActionEnvelope({
      runtimeContext: context,
      questionValidation,
      score: { cognitiveScore: 1 },
      analytics: { questionCorrect: true, responseTimeMs: 800 },
    });
    expect(env.actionType).toBe("question_answer");
    expect(env.patch).toBeUndefined();
    expect(env.questionValidation).toBe(questionValidation);
  });
});
