import { describe, expect, it } from "vitest";
import { buildCombatResult, applyRevealToPlacement } from "../engines/combat-engine/combat-engine";
import { applyPatch, RuntimePatchApplyError } from "./runtime-patch-reducer";
import { validateRuntimeStatePatch } from "./runtime-patch-validator";
import type {
  Board,
  CombatAttempt,
  EntityCatalog,
  FleetPlacement,
  Hex,
  RuntimeActionContext,
  StructurePlacement,
} from "@acerta/shared/schemas";

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

const emptyCatalog: EntityCatalog = { fleetUnits: {}, structures: {} };

const rt = (n: number, t: number): RuntimeActionContext => ({ sequenceNumber: n, timestamp: t });

describe("runtime-patch-reducer", () => {
  it("applyPatch hit: placement e terreno imutáveis no board original", () => {
    const board: Board = {
      hexes: {
        "hex:0:0": cell(0, 0, "water", {
          placementId: "fleet_placement:a",
          entityId: "fleet_unit:a",
          domain: "naval",
        }),
        "hex:0:1": cell(0, 1, "water", {
          placementId: "fleet_placement:a",
          entityId: "fleet_unit:a",
          domain: "naval",
        }),
      },
      fleetPlacements: [
        {
          kind: "fleet",
          placementId: "fleet_placement:a",
          entityId: "fleet_unit:a",
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
        "fleet_unit:a": {
          entityId: "fleet_unit:a",
          entityType: "FRAGATA",
          category: "naval",
          sizeInHexes: 2,
        },
      },
      structures: {},
    };
    const frozen = structuredClone(board);
    const patch = buildCombatResult(board, { target: { hexId: "hex:0:0" }, authorized: true }, catalog, rt(1, 10));
    const next = applyPatch(board, patch);
    expect(next).not.toBe(board);
    expect(next.fleetPlacements[0]).not.toBe(board.fleetPlacements[0]);
    expect(next.fleetPlacements[0]?.revealedHexIds).toEqual(["hex:0:0"]);
    expect(next.fleetPlacements[0]?.currentIntegrity).toBe(1);
    expect(board).toEqual(frozen);
  });

  it("applyPatch miss: revealedTerrainHexIds determinístico", () => {
    const board: Board = {
      hexes: { "hex:1:1": cell(1, 1, "water") },
      fleetPlacements: [],
      structurePlacements: [],
      generation: gen,
    };
    const patch = buildCombatResult(board, { target: { hexId: "hex:1:1" }, authorized: true }, emptyCatalog, rt(2, 20));
    const next = applyPatch(board, patch);
    expect(next.revealedTerrainHexIds).toEqual(["hex:1:1"]);
  });

  it("applyPatch destruction + replay em dois passos", () => {
    const board: Board = {
      hexes: {
        "hex:2:0": cell(2, 0, "water", {
          placementId: "fleet_placement:b",
          entityId: "fleet_unit:b",
          domain: "naval",
        }),
        "hex:2:1": cell(2, 1, "water", {
          placementId: "fleet_placement:b",
          entityId: "fleet_unit:b",
          domain: "naval",
        }),
      },
      fleetPlacements: [
        {
          kind: "fleet",
          placementId: "fleet_placement:b",
          entityId: "fleet_unit:b",
          occupiedHexIds: ["hex:2:0", "hex:2:1"],
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
        "fleet_unit:b": {
          entityId: "fleet_unit:b",
          entityType: "LANCHA ATAQUE",
          category: "naval",
          sizeInHexes: 2,
        },
      },
      structures: {},
    };
    const p1 = buildCombatResult(board, { target: { hexId: "hex:2:0" }, authorized: true }, catalog, rt(1, 1));
    const b1 = applyPatch(board, p1);
    const p2 = buildCombatResult(b1, { target: { hexId: "hex:2:1" }, authorized: true }, catalog, rt(2, 2));
    expect(validateRuntimeStatePatch(b1, p2).ok).toBe(true);
    const b2 = applyPatch(b1, p2);
    let manual: FleetPlacement | StructurePlacement = board.fleetPlacements[0]!;
    manual = applyRevealToPlacement(manual, "hex:2:0");
    manual = applyRevealToPlacement(manual, "hex:2:1");
    expect(b2.fleetPlacements[0]?.destroyed).toBe(true);
    expect(b2.fleetPlacements[0]).toEqual(manual);
  });

  it("applyPatch com patch inválido lança RuntimePatchApplyError", () => {
    const board: Board = {
      hexes: { "hex:9:9": cell(9, 9, "water") },
      fleetPlacements: [],
      structurePlacements: [],
      generation: gen,
    };
    const bad: CombatAttempt = { target: { hexId: "hex:9:9" }, authorized: true };
    const patch = buildCombatResult(board, bad, emptyCatalog, rt(1, 1));
    const corrupt = {
      ...patch,
      terrainReveal: { patchType: "terrain_reveal" as const, newlyRevealedTerrainHexIds: ["hex:missing"] },
    };
    expect(() => applyPatch(board, corrupt)).toThrow(RuntimePatchApplyError);
  });

  it("applyPatch outcome não processado: clone sem alterar runtime", () => {
    const board: Board = {
      hexes: { "hex:3:3": cell(3, 3, "water") },
      fleetPlacements: [],
      structurePlacements: [],
      generation: gen,
    };
    const patch = buildCombatResult(
      board,
      { target: { hexId: "hex:3:3" }, authorized: false },
      emptyCatalog,
      rt(0, 0),
    );
    const next = applyPatch(board, patch);
    expect(next).not.toBe(board);
    expect(next).toEqual(board);
  });
});
