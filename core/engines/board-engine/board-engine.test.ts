import { describe, expect, it } from "vitest";
import {
  computeShoreDistances,
  createBoard,
  createHexCoordinate,
  findSpecificBlock,
  findStrictLine,
  generateHexGrid,
  getNeighborCoordinates,
  hexCoordinateId,
  isAreaClear,
  placeFleetUnit,
  validatePlacement,
} from "./board-engine";
import type { FleetPlacement } from "@acerta/shared/schemas";

describe("board-engine", () => {
  it("createHexCoordinate produz id canónico hex:q:r", () => {
    const c = createHexCoordinate(2, 5);
    expect(c.id).toBe("hex:2:5");
    expect(hexCoordinateId(-1, 0)).toBe("hex:-1:0");
  });

  it("generateHexGrid cria células com world alinhado ao protótipo (initGrid)", () => {
    const b = generateHexGrid({
      hexRadius: 9,
      scale: 2,
      mapWidthPx: 100,
      mapHeightPx: 80,
    });
    const rEff = 18;
    const hDist = Math.sqrt(3) * rEff;
    const wDist = 2 * rEff * 0.75;
    expect(b.hexes["hex:0:0"]!.world.x).toBe(0);
    expect(b.hexes["hex:0:0"]!.world.y).toBe(0);
    expect(b.hexes["hex:1:0"]!.world.y).toBeCloseTo(hDist / 2, 5);
    expect(b.hexes["hex:1:0"]!.world.x).toBeCloseTo(wDist, 5);
    expect(Object.keys(b.hexes).length).toBe(b.generation.cols * b.generation.rows);
  });

  it("getNeighborCoordinates — coluna par (q=2), só vizinhos dentro do grid", () => {
    const b = createBoard({ hexRadius: 1, scale: 1, mapWidthPx: 50, mapHeightPx: 50 });
    const n = getNeighborCoordinates(b, 2, 2);
    const ids = new Set(n.map((c) => c.id));
    expect(ids.has("hex:2:1")).toBe(true);
    expect(ids.has("hex:3:1")).toBe(true);
    expect(ids.has("hex:3:2")).toBe(true);
    expect(ids.has("hex:2:3")).toBe(true);
    expect(ids.has("hex:1:2")).toBe(true);
    expect(ids.has("hex:1:1")).toBe(true);
  });

  it("computeShoreDistances — terra isolada e anel de água (BFS no protótipo)", () => {
    let b = createBoard({ hexRadius: 1, scale: 1, mapWidthPx: 120, mapHeightPx: 120 });
    const idCenter = "hex:5:5";
    b = {
      ...b,
      hexes: {
        ...b.hexes,
        [idCenter]: { ...b.hexes[idCenter]!, terrain: "land" },
      },
    };
    const withDist = computeShoreDistances(b);
    expect(withDist.hexes[idCenter]!.distToShore).toBe(0);
    const inlandWater = Object.values(withDist.hexes).find(
      (h) => h.terrain === "water" && h.distToShore >= 2,
    );
    expect(inlandWater).toBeDefined();
  });

  it("validatePlacement falha em colisão de vizinhança (isAreaClear)", () => {
    const b0 = computeShoreDistances(
      createBoard({ hexRadius: 1, scale: 1, mapWidthPx: 200, mapHeightPx: 200 }),
    );
    const b = placeFleetUnit(b0, {
      id: "fleet_unit:test-a",
      kind: "fleet",
      entityTypeName: "BOMBA NAVAL",
      hexCoordinateIds: ["hex:5:5"],
    });
    const v = validatePlacement(b, ["hex:5:6"], { expectedTerrain: "water", minDistToShore: 0 });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("placement_area_not_clear");
  });

  it("findSpecificBlock retorna null se hex ocupado", () => {
    const b0 = computeShoreDistances(
      createBoard({ hexRadius: 1, scale: 1, mapWidthPx: 60, mapHeightPx: 60 }),
    );
    const b = placeFleetUnit(b0, {
      id: "fleet_unit:x",
      kind: "fleet",
      entityTypeName: "BOMBA NAVAL",
      hexCoordinateIds: ["hex:2:2"],
    });
    const block = findSpecificBlock(b, 2, 2, 2, 2, "water", 0);
    expect(block).toBeNull();
  });

  it("placeFleetUnit não muta o board original", () => {
    const b0 = createBoard({ hexRadius: 1, scale: 1, mapWidthPx: 40, mapHeightPx: 40 });
    const snap = JSON.stringify(b0);
    placeFleetUnit(b0, {
      id: "fleet_unit:z",
      kind: "fleet",
      entityTypeName: "LANCHA ATAQUE",
      hexCoordinateIds: ["hex:1:1", "hex:1:2"],
    });
    expect(JSON.stringify(b0)).toBe(snap);
  });
});
