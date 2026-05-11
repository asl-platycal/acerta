import { describe, expect, it } from "vitest";
import { buildCombatResult, resolveTargetHit } from "../engines/combat-engine/combat-engine";
import { advanceRuntimeSequence, INITIAL_RUNTIME_SEQUENCE_STATE } from "../runtime/match-runtime-coordinator";
import {
  buildCombatRuntimeActionEnvelope,
  buildQuestionRuntimeActionEnvelope,
  consolidateCombatScoreFromPatch,
  consolidateQuestionScoreFromValidation,
  RuntimeActionEnvelopeBuildError,
} from "./runtime-action-factory";
import type { Board, CombatAttempt, EntityCatalog, Hex, QuestionValidationResult } from "@acerta/shared/schemas";
import type { RuntimeActionContext } from "@acerta/shared/schemas/runtime-sequence";

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

const rt = (n: number, t: number): RuntimeActionContext => ({ sequenceNumber: n, timestamp: t });

describe("runtime-action-factory", () => {
  it("envelope de combate: score consolidado sem inferir damage depois", () => {
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
      analytics: {
        targetType: patch.outcome.targetKind,
        destructionOutcome: patch.outcome.occupantDestroyed,
      },
    });
    expect(env.actionType).toBe("combat_shot");
    expect(env.runtimeContext).toEqual(context);
    expect(env.patch).toBe(patch);
    expect(env.actionOutcome.kind).toBe("combat");
    expect(env.score.partialHitScoreDelta).toBe(d.partialHitScore);
    expect(env.score.destructionScoreDelta).toBe(d.destructionScore);
    expect(env.score.tacticalScoreDelta).toBe(d.tacticalBonusScore);
    expect(env.score.cognitiveScoreDelta).toBe(0);
    expect(env.score.bonusScoreDelta).toBe(d.navalSinkBombBonusParts);
    expect(env.score.totalScoreDelta).toBe(
      d.partialHitScore + d.destructionScore + d.tacticalBonusScore + d.navalSinkBombBonusParts,
    );
    expect(nextState.lastSequenceNumber).toBe(0);
  });

  it("tacticalScoreDelta a partir de navalSinkBombBonusParts", () => {
    const board: Board = {
      hexes: {
        "hex:2:0": cell(2, 0, "water", {
          placementId: "fleet_placement:bomb",
          entityId: "fleet_unit:bomb",
          domain: "naval",
        }),
        "hex:2:1": cell(2, 1, "water", {
          placementId: "fleet_placement:bomb",
          entityId: "fleet_unit:bomb",
          domain: "naval",
        }),
      },
      fleetPlacements: [
        {
          kind: "fleet",
          placementId: "fleet_placement:bomb",
          entityId: "fleet_unit:bomb",
          occupiedHexIds: ["hex:2:0", "hex:2:1"],
          revealedHexIds: ["hex:2:0"],
          destroyed: false,
          currentIntegrity: 1,
        },
      ],
      structurePlacements: [],
      generation: gen,
    };
    const catalog: EntityCatalog = {
      fleetUnits: {
        "fleet_unit:bomb": {
          entityId: "fleet_unit:bomb",
          entityType: "BOMBA NAVAL",
          category: "naval",
          sizeInHexes: 2,
        },
      },
      structures: {},
    };
    const ctx = rt(0, 10);
    const patch = buildCombatResult(
      board,
      {
        target: { hexId: "hex:2:1" },
        authorized: true,
        applyNavalSinkBombBonusRule: true,
      },
      catalog,
      ctx,
    );
    expect(patch.outcome.damage?.navalSinkBombBonusParts).toBe(3);
    const score = consolidateCombatScoreFromPatch(patch);
    expect(score.tacticalScoreDelta).toBe(0);
    expect(score.bonusScoreDelta).toBe(3);
    expect(score.totalScoreDelta).toBe(
      score.partialHitScoreDelta + score.destructionScoreDelta + score.tacticalScoreDelta + score.bonusScoreDelta,
    );
  });

  it("miss: deltas zero e total zero", () => {
    const board: Board = {
      hexes: { "hex:1:1": cell(1, 1, "water") },
      fleetPlacements: [],
      structurePlacements: [],
      generation: gen,
    };
    const ctx = rt(0, 1);
    const patch = buildCombatResult(board, { target: { hexId: "hex:1:1" }, authorized: true }, { fleetUnits: {}, structures: {} }, ctx);
    const score = consolidateCombatScoreFromPatch(patch);
    expect(score.partialHitScoreDelta).toBe(0);
    expect(score.destructionScoreDelta).toBe(0);
    expect(score.tacticalScoreDelta).toBe(0);
    expect(score.totalScoreDelta).toBe(0);
  });

  it("resolveTargetHit com catálogo: damage explícito e envelope autocontido", () => {
    const board: Board = {
      hexes: {
        "hex:5:0": cell(5, 0, "water", {
          placementId: "fleet_placement:y",
          entityId: "fleet_unit:y",
          domain: "naval",
        }),
      },
      fleetPlacements: [
        {
          kind: "fleet",
          placementId: "fleet_placement:y",
          entityId: "fleet_unit:y",
          occupiedHexIds: ["hex:5:0"],
          revealedHexIds: [],
          destroyed: false,
          currentIntegrity: 1,
        },
      ],
      structurePlacements: [],
      generation: gen,
    };
    const catalog: EntityCatalog = {
      fleetUnits: {
        "fleet_unit:y": {
          entityId: "fleet_unit:y",
          entityType: "FRAGATA",
          category: "naval",
          sizeInHexes: 1,
        },
      },
      structures: {},
    };
    const patch = resolveTargetHit(board, "hex:5:0", rt(0, 0), catalog);
    expect(patch.outcome.hitOccupant).toBe(true);
    expect(patch.outcome.damage?.partialHitScore).toBeGreaterThan(0);
    const env = buildCombatRuntimeActionEnvelope({
      runtimeContext: rt(0, 0),
      patch,
      analytics: { targetType: "fleet_unit" },
    });
    expect(env.score.totalScoreDelta).toBe(env.score.partialHitScoreDelta + env.score.destructionScoreDelta);
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
        analytics: { targetType: "none" },
      }),
    ).toThrow(RuntimeActionEnvelopeBuildError);
  });

  it("envelope de pergunta: score cognitivo consolidado", () => {
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
      analytics: { questionCorrect: true, responseTimeMs: 800 },
    });
    expect(env.actionType).toBe("question_answer");
    expect(env.patch).toBeUndefined();
    expect(env.questionValidation).toBe(questionValidation);
    expect(env.score.cognitiveScoreDelta).toBe(1);
    expect(env.score.totalScoreDelta).toBe(1);
    expect(env.score.partialHitScoreDelta).toBe(0);
  });

  it("consolidateQuestionScore errado: cognitive e total zero", () => {
    const s = consolidateQuestionScoreFromValidation({
      correct: false,
      responseTimeMs: 100,
      questionId: "q2",
      selectedOptionId: "x",
    });
    expect(s.cognitiveScoreDelta).toBe(0);
    expect(s.totalScoreDelta).toBe(0);
  });
});
