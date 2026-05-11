import { describe, expect, it } from "vitest";
import {
  buildCombatResult,
  pontosAcertoParcial,
  pontosDestruicaoAlvo,
  resolveTargetDestruction,
  resolveTargetHit,
  validateCombatAttempt,
} from "./combat-engine";
import { validateRuntimeStatePatch } from "../../events/runtime-patch-validator";
import type {
  Board,
  BoardGenerationMeta,
  CombatAttempt,
  EntityCatalog,
  FleetPlacement,
  Hex,
  RuntimeActionContext,
} from "@acerta/shared/schemas";

function minimalGeneration(overrides: Partial<BoardGenerationMeta> = {}): BoardGenerationMeta {
  return {
    hexRadiusLogical: 1,
    scale: 1,
    cols: 16,
    rows: 16,
    mapWidthPx: 160,
    mapHeightPx: 160,
    ...overrides,
  };
}

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

function fleetP(
  placementId: string,
  entityId: string,
  occupiedHexIds: string[],
  revealedHexIds: string[] = [],
): FleetPlacement {
  const revealed = new Set(revealedHexIds);
  const revList = occupiedHexIds.filter((id) => revealed.has(id));
  return {
    kind: "fleet",
    placementId,
    entityId,
    occupiedHexIds,
    revealedHexIds: revList,
    destroyed: revList.length === occupiedHexIds.length,
    currentIntegrity: occupiedHexIds.length - revList.length,
  };
}

const catalogFr: EntityCatalog = {
  fleetUnits: {
    "fleet_unit:fr-1": {
      entityId: "fleet_unit:fr-1",
      entityType: "FRAGATA",
      category: "naval",
      sizeInHexes: 2,
    },
  },
  structures: {},
};

const catalogLn: EntityCatalog = {
  fleetUnits: {
    "fleet_unit:ln-1": {
      entityId: "fleet_unit:ln-1",
      entityType: "LANCHA ATAQUE",
      category: "naval",
      sizeInHexes: 2,
    },
  },
  structures: {},
};

const catalogFarol: EntityCatalog = {
  fleetUnits: {},
  structures: {
    "structure:farol-1": {
      entityId: "structure:farol-1",
      entityType: "FAROL",
      category: "land",
      sizeInHexes: 1,
    },
  },
};

const ctx: RuntimeActionContext = { sequenceNumber: 1, timestamp: 1_000 };

describe("combat-engine", () => {
  it("alvo naval atingido: acerto parcial sem destruição total", () => {
    const board: Board = {
      hexes: {
        "hex:0:0": cell(0, 0, "water", {
          placementId: "fleet_placement:fr-1",
          entityId: "fleet_unit:fr-1",
          domain: "naval",
        }),
        "hex:0:1": cell(0, 1, "water", {
          placementId: "fleet_placement:fr-1",
          entityId: "fleet_unit:fr-1",
          domain: "naval",
        }),
      },
      fleetPlacements: [
        fleetP("fleet_placement:fr-1", "fleet_unit:fr-1", ["hex:0:0", "hex:0:1"]),
      ],
      structurePlacements: [],
      generation: minimalGeneration(),
    };
    const attempt: CombatAttempt = {
      target: { hexId: "hex:0:0" },
      authorized: true,
    };
    const r = buildCombatResult(board, attempt, catalogFr, ctx);
    expect(validateRuntimeStatePatch(board, r).ok).toBe(true);
    expect(r.outcome.processed).toBe(true);
    expect(r.outcome.hitOccupant).toBe(true);
    expect(r.outcome.occupantDestroyed).toBe(false);
    expect(r.outcome.damage?.partialHitValue).toBe(pontosAcertoParcial("FRAGATA"));
    expect(r.outcome.damage?.destructionBonusValue).toBe(0);
    expect(r.placementPatch?.placementId).toBe("fleet_placement:fr-1");
    expect(r.placementPatch?.newlyRevealedHexIds).toEqual(["hex:0:0"]);
    expect(r.placementPatch?.integrityDelta).toBe(-1);
    expect(r.placementPatch?.destroyedTransition).toEqual({ from: false, to: false });
    expect(r.terrainReveal).toBeUndefined();
    expect(r.sequenceNumber).toBe(ctx.sequenceNumber);
  });

  it("água vazia: sem ocupante", () => {
    const board: Board = {
      hexes: { "hex:1:1": cell(1, 1, "water") },
      fleetPlacements: [],
      structurePlacements: [],
      generation: minimalGeneration(),
    };
    const emptyCatalog: EntityCatalog = { fleetUnits: {}, structures: {} };
    const r = buildCombatResult(board, { target: { hexId: "hex:1:1" }, authorized: true }, emptyCatalog, ctx);
    expect(validateRuntimeStatePatch(board, r).ok).toBe(true);
    expect(r.outcome.processed).toBe(true);
    expect(r.outcome.hitOccupant).toBe(false);
    expect(r.outcome.targetKind).toBe("none");
    expect(r.outcome.damage).toBeUndefined();
    expect(r.terrainReveal?.newlyRevealedTerrainHexIds).toEqual(["hex:1:1"]);
    expect(r.placementPatch).toBeUndefined();
  });

  it("destruição de FleetUnit quando todos os hexes ficam revelados", () => {
    const board: Board = {
      hexes: {
        "hex:2:0": cell(2, 0, "water", {
          placementId: "fleet_placement:ln-1",
          entityId: "fleet_unit:ln-1",
          domain: "naval",
        }),
        "hex:2:1": cell(2, 1, "water", {
          placementId: "fleet_placement:ln-1",
          entityId: "fleet_unit:ln-1",
          domain: "naval",
        }),
      },
      fleetPlacements: [
        fleetP("fleet_placement:ln-1", "fleet_unit:ln-1", ["hex:2:0", "hex:2:1"], ["hex:2:0"]),
      ],
      structurePlacements: [],
      generation: minimalGeneration(),
    };
    const r = buildCombatResult(board, { target: { hexId: "hex:2:1" }, authorized: true }, catalogLn, ctx);
    expect(validateRuntimeStatePatch(board, r).ok).toBe(true);
    expect(r.outcome.occupantDestroyed).toBe(true);
    expect(r.outcome.damage?.destructionBonusValue).toBe(pontosDestruicaoAlvo("LANCHA ATAQUE"));
    expect(r.placementPatch?.patchType).toBe("destruction");
    expect(r.placementPatch?.destroyedTransition).toEqual({ from: false, to: true });
    expect(r.placementPatch?.integrityDelta).toBe(-1);
  });

  it("destruição de Structure em terra", () => {
    const board: Board = {
      hexes: {
        "hex:3:3": cell(3, 3, "land", {
          placementId: "structure_placement:farol-1",
          entityId: "structure:farol-1",
          domain: "land",
        }),
      },
      fleetPlacements: [],
      structurePlacements: [
        {
          kind: "structure",
          placementId: "structure_placement:farol-1",
          entityId: "structure:farol-1",
          occupiedHexIds: ["hex:3:3"],
          revealedHexIds: [],
          destroyed: false,
          currentIntegrity: 1,
        },
      ],
      generation: minimalGeneration(),
    };
    const r = buildCombatResult(board, { target: { hexId: "hex:3:3" }, authorized: true }, catalogFarol, ctx);
    expect(validateRuntimeStatePatch(board, r).ok).toBe(true);
    expect(r.outcome.targetKind).toBe("structure");
    expect(r.outcome.occupantDestroyed).toBe(true);
    expect(r.outcome.damage?.destructionBonusValue).toBe(pontosDestruicaoAlvo("FAROL"));
    expect(r.placementPatch?.patchType).toBe("destruction");
  });

  it("payload inválido: não autorizado", () => {
    const board: Board = {
      hexes: { "hex:4:4": cell(4, 4, "water") },
      fleetPlacements: [],
      structurePlacements: [],
      generation: minimalGeneration(),
    };
    const emptyCatalog: EntityCatalog = { fleetUnits: {}, structures: {} };
    const v = validateCombatAttempt(board, { target: { hexId: "hex:4:4" }, authorized: false }, emptyCatalog);
    expect(v.ok).toBe(false);
    const r = buildCombatResult(board, { target: { hexId: "hex:4:4" }, authorized: false }, emptyCatalog, ctx);
    expect(r.outcome.processed).toBe(false);
    expect(r.outcome.error).toBe("not_authorized");
    expect(validateRuntimeStatePatch(board, r).ok).toBe(true);
  });

  it("resolveTargetHit e resolveTargetDestruction sem mutar o board", () => {
    const board: Board = {
      hexes: { "hex:5:5": cell(5, 5, "water") },
      fleetPlacements: [],
      structurePlacements: [],
      generation: minimalGeneration(),
    };
    const frozen = structuredClone(board);
    Object.freeze(frozen.hexes);
    Object.freeze(frozen);
    const hit = resolveTargetHit(frozen, "hex:5:5", ctx);
    expect(hit.outcome.processed).toBe(true);
    expect(validateRuntimeStatePatch(frozen, hit).ok).toBe(true);
    const placement = fleetP("fleet_placement:u", "fleet_unit:u", ["hex:5:5"]);
    const dest = resolveTargetDestruction(placement, "hex:5:5", {
      targetHexId: "hex:5:5",
      terrain: "water",
      runtimeContext: ctx,
    });
    expect(dest.outcome.occupantDestroyed).toBe(true);
    expect(dest.placementPatch?.patchType).toBe("destruction");
    expect(frozen).toEqual(board);
  });
});
