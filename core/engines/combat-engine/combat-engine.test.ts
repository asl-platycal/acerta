import { describe, expect, it } from "vitest";
import {
  buildCombatResult,
  pontosAcertoParcial,
  pontosDestruicaoAlvo,
  resolveTargetDestruction,
  resolveTargetHit,
  validateCombatAttempt,
} from "./combat-engine";
import type { Board, BoardGenerationMeta, CombatAttempt, Hex } from "@acerta/shared/schemas";

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

function cell(
  q: number,
  r: number,
  terrain: "water" | "land",
  revealed: boolean,
  occupancy?: NonNullable<Hex["occupancy"]>,
): Hex {
  const id = `hex:${q}:${r}`;
  return {
    coordinate: { id, q, r },
    world: { x: 0, y: 0 },
    terrain,
    distToShore: 0,
    revealed,
    occupancy,
  };
}

describe("combat-engine", () => {
  it("alvo naval atingido: acerto parcial sem destruição total", () => {
    const board: Board = {
      hexes: {
        "hex:0:0": cell(0, 0, "water", false, {
          placementId: "fleet_unit:fr-1",
          entityTypeName: "FRAGATA",
          domain: "naval",
        }),
        "hex:0:1": cell(0, 1, "water", false, {
          placementId: "fleet_unit:fr-1",
          entityTypeName: "FRAGATA",
          domain: "naval",
        }),
      },
      fleetPlacements: [
        {
          id: "fleet_unit:fr-1",
          kind: "fleet",
          entityTypeName: "FRAGATA",
          hexCoordinateIds: ["hex:0:0", "hex:0:1"],
        },
      ],
      structurePlacements: [],
      generation: minimalGeneration(),
    };
    const attempt: CombatAttempt = {
      target: { hexId: "hex:0:0" },
      authorized: true,
    };
    const r = buildCombatResult(board, attempt);
    expect(r.processed).toBe(true);
    expect(r.hitOccupant).toBe(true);
    expect(r.occupantDestroyed).toBe(false);
    expect(r.damage?.partialHitValue).toBe(pontosAcertoParcial("FRAGATA"));
    expect(r.damage?.destructionBonusValue).toBe(0);
  });

  it("água vazia: sem ocupante", () => {
    const board: Board = {
      hexes: { "hex:1:1": cell(1, 1, "water", false) },
      fleetPlacements: [],
      structurePlacements: [],
      generation: minimalGeneration(),
    };
    const r = buildCombatResult(board, {
      target: { hexId: "hex:1:1" },
      authorized: true,
    });
    expect(r.processed).toBe(true);
    expect(r.hitOccupant).toBe(false);
    expect(r.targetKind).toBe("none");
    expect(r.damage).toBeUndefined();
  });

  it("destruição de FleetUnit quando todos os hexes ficam revelados", () => {
    const board: Board = {
      hexes: {
        "hex:2:0": cell(2, 0, "water", true, {
          placementId: "fleet_unit:ln-1",
          entityTypeName: "LANCHA ATAQUE",
          domain: "naval",
        }),
        "hex:2:1": cell(2, 1, "water", false, {
          placementId: "fleet_unit:ln-1",
          entityTypeName: "LANCHA ATAQUE",
          domain: "naval",
        }),
      },
      fleetPlacements: [
        {
          id: "fleet_unit:ln-1",
          kind: "fleet",
          entityTypeName: "LANCHA ATAQUE",
          hexCoordinateIds: ["hex:2:0", "hex:2:1"],
        },
      ],
      structurePlacements: [],
      generation: minimalGeneration(),
    };
    const r = buildCombatResult(board, {
      target: { hexId: "hex:2:1" },
      authorized: true,
    });
    expect(r.occupantDestroyed).toBe(true);
    expect(r.damage?.destructionBonusValue).toBe(pontosDestruicaoAlvo("LANCHA ATAQUE"));
  });

  it("destruição de Structure em terra", () => {
    const board: Board = {
      hexes: {
        "hex:3:3": cell(3, 3, "land", false, {
          placementId: "structure:farol-1",
          entityTypeName: "FAROL",
          domain: "land",
        }),
      },
      fleetPlacements: [],
      structurePlacements: [
        {
          id: "structure:farol-1",
          kind: "structure",
          entityTypeName: "FAROL",
          hexCoordinateIds: ["hex:3:3"],
        },
      ],
      generation: minimalGeneration(),
    };
    const r = buildCombatResult(board, {
      target: { hexId: "hex:3:3" },
      authorized: true,
    });
    expect(r.targetKind).toBe("structure");
    expect(r.occupantDestroyed).toBe(true);
    expect(r.damage?.destructionBonusValue).toBe(pontosDestruicaoAlvo("FAROL"));
  });

  it("payload inválido: não autorizado", () => {
    const board: Board = {
      hexes: { "hex:4:4": cell(4, 4, "water", false) },
      fleetPlacements: [],
      structurePlacements: [],
      generation: minimalGeneration(),
    };
    const v = validateCombatAttempt(board, { target: { hexId: "hex:4:4" }, authorized: false });
    expect(v.ok).toBe(false);
    const r = buildCombatResult(board, { target: { hexId: "hex:4:4" }, authorized: false });
    expect(r.processed).toBe(false);
    expect(r.error).toBe("not_authorized");
  });

  it("resolveTargetHit e resolveTargetDestruction sem mutar o board", () => {
    const board: Board = {
      hexes: { "hex:5:5": cell(5, 5, "water", false) },
      fleetPlacements: [],
      structurePlacements: [],
      generation: minimalGeneration(),
    };
    const frozen = structuredClone(board);
    Object.freeze(frozen.hexes);
    Object.freeze(frozen);
    const hit = resolveTargetHit(frozen, "hex:5:5");
    expect(hit.ok).toBe(true);
    const dest = resolveTargetDestruction(
      frozen,
      {
        id: "fleet_unit:u",
        kind: "fleet",
        entityTypeName: "FRAGATA",
        hexCoordinateIds: ["hex:5:5"],
      },
      "hex:5:5",
    );
    expect(dest.fullyDestroyed).toBe(true);
    expect(frozen).toEqual(board);
  });
});
