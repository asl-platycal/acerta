import { describe, expect, it } from "vitest";
import {
  buildCombatResult,
  pontosAcertoParcial,
  pontosDestruicaoAlvo,
  resolveTargetDestruction,
  resolveTargetHit,
  validateCombatAttempt,
} from "./combat-engine";
import type {
  Board,
  BoardGenerationMeta,
  CombatAttempt,
  EntityCatalog,
  FleetPlacement,
  Hex,
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
    const r = buildCombatResult(board, attempt, catalogFr);
    expect(r.processed).toBe(true);
    expect(r.hitOccupant).toBe(true);
    expect(r.occupantDestroyed).toBe(false);
    expect(r.damage?.partialHitValue).toBe(pontosAcertoParcial("FRAGATA"));
    expect(r.damage?.destructionBonusValue).toBe(0);
    expect(r.updatedFleetPlacement?.placementId).toBe("fleet_placement:fr-1");
    expect(r.updatedFleetPlacement?.revealedHexIds).toEqual(["hex:0:0"]);
    expect(r.updatedFleetPlacement?.currentIntegrity).toBe(1);
    expect(r.updatedFleetPlacement?.destroyed).toBe(false);
    expect(r.updatedRevealedTerrainHexIds).toBeUndefined();
  });

  it("água vazia: sem ocupante", () => {
    const board: Board = {
      hexes: { "hex:1:1": cell(1, 1, "water") },
      fleetPlacements: [],
      structurePlacements: [],
      generation: minimalGeneration(),
    };
    const emptyCatalog: EntityCatalog = { fleetUnits: {}, structures: {} };
    const r = buildCombatResult(board, { target: { hexId: "hex:1:1" }, authorized: true }, emptyCatalog);
    expect(r.processed).toBe(true);
    expect(r.hitOccupant).toBe(false);
    expect(r.targetKind).toBe("none");
    expect(r.damage).toBeUndefined();
    expect(r.updatedRevealedTerrainHexIds).toEqual(["hex:1:1"]);
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
    const r = buildCombatResult(board, { target: { hexId: "hex:2:1" }, authorized: true }, catalogLn);
    expect(r.occupantDestroyed).toBe(true);
    expect(r.damage?.destructionBonusValue).toBe(pontosDestruicaoAlvo("LANCHA ATAQUE"));
    expect(r.updatedFleetPlacement?.destroyed).toBe(true);
    expect(r.updatedFleetPlacement?.currentIntegrity).toBe(0);
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
    const r = buildCombatResult(board, { target: { hexId: "hex:3:3" }, authorized: true }, catalogFarol);
    expect(r.targetKind).toBe("structure");
    expect(r.occupantDestroyed).toBe(true);
    expect(r.damage?.destructionBonusValue).toBe(pontosDestruicaoAlvo("FAROL"));
    expect(r.updatedStructurePlacement?.destroyed).toBe(true);
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
    const r = buildCombatResult(board, { target: { hexId: "hex:4:4" }, authorized: false }, emptyCatalog);
    expect(r.processed).toBe(false);
    expect(r.error).toBe("not_authorized");
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
    const hit = resolveTargetHit(frozen, "hex:5:5");
    expect(hit.ok).toBe(true);
    const placement = fleetP("fleet_placement:u", "fleet_unit:u", ["hex:5:5"]);
    const dest = resolveTargetDestruction(placement, "hex:5:5");
    expect(dest.fullyDestroyed).toBe(true);
    expect(dest.updated.destroyed).toBe(true);
    expect(frozen).toEqual(board);
  });
});
