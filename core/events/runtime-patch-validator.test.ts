import { describe, expect, it } from "vitest";
import { buildCombatResult, validateCombatAttempt } from "../engines/combat-engine/combat-engine";
import { validateRuntimeStatePatch } from "./runtime-patch-validator";
import type { Board, CombatAttempt, EntityCatalog, Hex, RuntimeActionContext } from "@acerta/shared/schemas";

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

const rtCtx = (n: number, t: number): RuntimeActionContext => ({ sequenceNumber: n, timestamp: t });

describe("runtime-patch-validator", () => {
  it("patch de hit válido passa na validação estrutural", () => {
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
    const attempt: CombatAttempt = {
      target: { hexId: "hex:0:0" },
      authorized: true,
    };
    const ctx = rtCtx(7, 1_700_000_000);
    expect(validateCombatAttempt(board, attempt, catalog).ok).toBe(true);
    const patch = buildCombatResult(board, attempt, catalog, ctx);
    expect(patch.sequenceNumber).toBe(7);
    expect(patch.timestamp).toBe(1_700_000_000);
    expect(validateRuntimeStatePatch(board, patch).ok).toBe(true);
    expect(patch.placementPatch?.newlyRevealedHexIds).toEqual(["hex:0:0"]);
  });

  it("patch determinístico: ordem lexical de hex ids no delta", () => {
    const board: Board = {
      hexes: {
        "hex:0:0": cell(0, 0, "water", {
          placementId: "fleet_placement:b",
          entityId: "fleet_unit:b",
          domain: "naval",
        }),
        "hex:0:1": cell(0, 1, "water", {
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
        "fleet_unit:b": {
          entityId: "fleet_unit:b",
          entityType: "FRAGATA",
          category: "naval",
          sizeInHexes: 2,
        },
      },
      structures: {},
    };
    const p1 = buildCombatResult(board, { target: { hexId: "hex:0:1" }, authorized: true }, catalog, rtCtx(1, 1));
    const p2 = buildCombatResult(board, { target: { hexId: "hex:0:1" }, authorized: true }, catalog, rtCtx(2, 2));
    expect(p1.placementPatch?.newlyRevealedHexIds).toEqual(p2.placementPatch?.newlyRevealedHexIds);
  });

  it("validator não muta o board", () => {
    const board: Board = {
      hexes: { "hex:9:9": cell(9, 9, "water") },
      fleetPlacements: [],
      structurePlacements: [],
      generation: gen,
    };
    const frozen = structuredClone(board);
    const patch = buildCombatResult(board, { target: { hexId: "hex:9:9" }, authorized: true }, emptyCatalog, rtCtx(0, 0));
    validateRuntimeStatePatch(board, patch);
    expect(board).toEqual(frozen);
  });
});
