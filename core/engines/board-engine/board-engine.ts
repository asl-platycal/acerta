import type {
  Board,
  BoardGenerationConfig,
  BoardGenerationMeta,
  FleetPlacement,
  Hex,
  HexCoordinate,
  PlayableAreaConfig,
  PlacementValidationResult,
  StructurePlacement,
} from "@acerta/shared/schemas";
import {
  validateBoardGenerationConfig,
  validateBoardSnapshot,
  validateFleetPlacement,
  validateHexCoordinate,
  validateHexCoordinateId,
  validateStructurePlacement,
} from "./validators";

export function hexCoordinateId(q: number, r: number): string {
  return `hex:${q}:${r}`;
}

export function createHexCoordinate(q: number, r: number): HexCoordinate {
  return { q, r, id: hexCoordinateId(q, r) };
}

export function parseHexCoordinateId(id: string): { q: number; r: number } | null {
  const m = /^hex:(-?\d+):(-?\d+)$/.exec(id);
  if (!m) return null;
  return { q: Number(m[1]), r: Number(m[2]) };
}

/** Vetores de vizinhança espelhando `getNeighbors` do protótipo (`c` par/impar). */
export function neighborDeltasForColumn(q: number): readonly [number, number][] {
  return q % 2 === 0
    ? [
        [0, -1],
        [1, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
        [-1, -1],
      ]
    : [
        [0, -1],
        [1, 0],
        [1, 1],
        [0, 1],
        [-1, 1],
        [-1, 0],
      ];
}

function cloneHex(h: Hex): Hex {
  return {
    ...h,
    coordinate: { ...h.coordinate },
    world: { ...h.world },
    rgb: h.rgb ? { ...h.rgb } : undefined,
    occupancy: h.occupancy ? { ...h.occupancy } : undefined,
  };
}

function cloneBoard(board: Board): Board {
  return {
    hexes: Object.fromEntries(Object.entries(board.hexes).map(([k, v]) => [k, cloneHex(v)])),
    fleetPlacements: board.fleetPlacements.map((p) => ({ ...p, hexCoordinateIds: [...p.hexCoordinateIds] })),
    structurePlacements: board.structurePlacements.map((p) => ({
      ...p,
      hexCoordinateIds: [...p.hexCoordinateIds],
    })),
    generation: { ...board.generation },
  };
}

export function generateHexGrid(config: BoardGenerationConfig): Board {
  const cv = validateBoardGenerationConfig(config);
  if (!cv.ok) {
    throw new Error(cv.reason ?? "invalid_board_config");
  }
  const rEff = config.hexRadius * config.scale;
  const hDist = Math.sqrt(3) * rEff;
  const wDist = 2 * rEff * 0.75;
  const cols = Math.ceil(config.mapWidthPx / wDist) + 1;
  const rows = Math.ceil(config.mapHeightPx / hDist) + 1;
  const hexes: Record<string, Hex> = {};
  for (let q = 0; q < cols; q++) {
    for (let r = 0; r < rows; r++) {
      const x = q * wDist;
      const y = r * hDist + (q % 2 === 1 ? hDist / 2 : 0);
      const id = hexCoordinateId(q, r);
      const terrain = config.terrainByHexId?.[id] ?? "water";
      hexes[id] = {
        coordinate: createHexCoordinate(q, r),
        world: { x, y },
        terrain,
        distToShore: Number.POSITIVE_INFINITY,
        revealed: false,
      };
    }
  }
  const meta: BoardGenerationMeta = {
    hexRadiusLogical: rEff,
    scale: config.scale,
    cols,
    rows,
    mapWidthPx: config.mapWidthPx,
    mapHeightPx: config.mapHeightPx,
  };
  return {
    hexes,
    fleetPlacements: [],
    structurePlacements: [],
    generation: meta,
  };
}

/** Alias semântico — mesmo resultado que `generateHexGrid`. */
export function createBoard(config: BoardGenerationConfig): Board {
  return generateHexGrid(config);
}

export function computeShoreDistances(board: Board): Board {
  const bv = validateBoardSnapshot(board);
  if (!bv.ok) {
    throw new Error(bv.reason ?? "invalid_board");
  }
  const next = cloneBoard(board);
  const queue: string[] = [];
  for (const hex of Object.values(next.hexes)) {
    const nbrs = getNeighborCoordinates(next, hex.coordinate.q, hex.coordinate.r);
    if (nbrs.some((n) => next.hexes[n.id]!.terrain !== hex.terrain)) {
      hex.distToShore = 0;
      queue.push(hex.coordinate.id);
    }
  }
  while (queue.length > 0) {
    const id = queue.shift()!;
    const curr = next.hexes[id]!;
    const deltas = neighborDeltasForColumn(curr.coordinate.q);
    for (const [dq, dr] of deltas) {
      const nq = curr.coordinate.q + dq;
      const nr = curr.coordinate.r + dr;
      const nid = hexCoordinateId(nq, nr);
      const n = next.hexes[nid];
      if (!n) continue;
      if (n.terrain === curr.terrain && n.distToShore === Number.POSITIVE_INFINITY) {
        n.distToShore = curr.distToShore + 1;
        queue.push(nid);
      }
    }
  }
  return next;
}

export function getNeighborCoordinates(
  board: Board,
  q: number,
  r: number,
): HexCoordinate[] {
  const bv = validateBoardSnapshot(board);
  if (!bv.ok) return [];
  const out: HexCoordinate[] = [];
  for (const [dq, dr] of neighborDeltasForColumn(q)) {
    const id = hexCoordinateId(q + dq, r + dr);
    const h = board.hexes[id];
    if (h) out.push({ ...h.coordinate });
  }
  return out;
}

export function isHexInPlayableArea(hex: Hex, playable: PlayableAreaConfig): boolean {
  const sx = hex.world.x + playable.mapOffsetXPx;
  const sy = hex.world.y + playable.mapOffsetYPx;
  return (
    sx >= playable.viewportWidthPx * 0.25 &&
    sx <= playable.viewportWidthPx * 0.75 &&
    sy >= 0 &&
    sy <= playable.viewportHeightPx
  );
}

export function isSafeToPlace(hex: Hex, playable: PlayableAreaConfig, hexRadiusLogical: number): boolean {
  const sx = hex.world.x + playable.mapOffsetXPx;
  const sy = hex.world.y + playable.mapOffsetYPx;
  const mx = hexRadiusLogical * 3;
  const my = hexRadiusLogical * 2.5;
  return (
    sx >= playable.viewportWidthPx * 0.25 + mx &&
    sx <= playable.viewportWidthPx * 0.75 - mx &&
    sy >= my &&
    sy <= playable.viewportHeightPx - my
  );
}

/** Espelha `isAreaClear` do protótipo: células do caminho vazias e vizinhos sem ocupação. */
export function isAreaClear(board: Board, hexCoordinateIds: readonly string[]): boolean {
  for (const id of hexCoordinateIds) {
    const h = board.hexes[id];
    if (!h || h.occupancy) return false;
    for (const n of getNeighborCoordinates(board, h.coordinate.q, h.coordinate.r)) {
      const nh = board.hexes[n.id];
      if (nh?.occupancy) return false;
    }
  }
  return true;
}

const STRICT_LINE_AXES: readonly { even: [number, number]; odd: [number, number] }[] = [
  { even: [0, 1], odd: [0, 1] },
  { even: [1, 0], odd: [1, 1] },
  { even: [-1, 0], odd: [-1, 1] },
] as const;

/**
 * Espelha `findStrictLine`: uma direção fixa (`axisIndex` 0–2) para determinismo e testes.
 * No protótipo o eixo era aleatório (`Math.random`).
 */
export function findStrictLine(
  board: Board,
  startQ: number,
  startR: number,
  axisIndex: 0 | 1 | 2,
  size: number,
  terrain: "water" | "land",
  minDistToShore: number,
): readonly string[] | null {
  const startId = hexCoordinateId(startQ, startR);
  const start = board.hexes[startId];
  if (!start) return null;
  const axis = STRICT_LINE_AXES[axisIndex]!;
  const path: string[] = [startId];
  let curr = start;
  for (let i = 1; i < size; i++) {
    const dq = curr.coordinate.q % 2 === 0 ? axis.even[0] : axis.odd[0];
    const dr = curr.coordinate.q % 2 === 0 ? axis.even[1] : axis.odd[1];
    const nq = curr.coordinate.q + dq;
    const nr = curr.coordinate.r + dr;
    const nid = hexCoordinateId(nq, nr);
    const next = board.hexes[nid];
    if (!next || next.terrain !== terrain || next.distToShore < minDistToShore || next.occupancy) {
      return null;
    }
    path.push(nid);
    curr = next;
  }
  return path;
}

/** Espelha `findSpecificBlock` (índices retangulares em q,r do protótipo). */
export function findSpecificBlock(
  board: Board,
  startQ: number,
  startR: number,
  width: number,
  height: number,
  terrain: "water" | "land",
  minDistToShore: number,
): readonly string[] | null {
  const path: string[] = [];
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      const id = hexCoordinateId(startQ + i, startR + j);
      const node = board.hexes[id];
      if (!node || node.terrain !== terrain || node.distToShore < minDistToShore || node.occupancy) {
        return null;
      }
      path.push(id);
    }
  }
  return path;
}

function lighthouseCandidate(hex: Hex, board: Board): boolean {
  const rgb = hex.rgb;
  if (!rgb) return false;
  const isVegetation = rgb.g > rgb.r * 1.2 && rgb.r < 100;
  const waterNeighbors = getNeighborCoordinates(board, hex.coordinate.q, hex.coordinate.r).filter(
    (n) => board.hexes[n.id]?.terrain === "water",
  ).length;
  return isVegetation && waterNeighbors >= 2;
}

export function validatePlacement(
  board: Board,
  hexCoordinateIds: readonly string[],
  ctx: {
    expectedTerrain: "water" | "land";
    minDistToShore: number;
    playable?: PlayableAreaConfig;
    entityTypeName?: string;
  },
): PlacementValidationResult {
  const bv = validateBoardSnapshot(board);
  if (!bv.ok) return { ok: false, reason: bv.reason };
  if (!hexCoordinateIds.length) return { ok: false, reason: "placement_hexes_empty" };
  for (const id of hexCoordinateIds) {
    const iv = validateHexCoordinateId(id);
    if (!iv.ok) return { ok: false, reason: iv.reason };
    const h = board.hexes[id];
    if (!h) return { ok: false, reason: "placement_hex_not_on_board" };
    if (h.terrain !== ctx.expectedTerrain) return { ok: false, reason: "placement_terrain_mismatch" };
    if (h.distToShore < ctx.minDistToShore) return { ok: false, reason: "placement_min_shore_violation" };
    if (h.occupancy) return { ok: false, reason: "placement_hex_already_occupied" };
    if (ctx.playable) {
      if (!isHexInPlayableArea(h, ctx.playable)) return { ok: false, reason: "placement_outside_playable" };
      if (!isSafeToPlace(h, ctx.playable, board.generation.hexRadiusLogical)) {
        return { ok: false, reason: "placement_not_safe_margin" };
      }
    }
    if (ctx.entityTypeName === "FAROL" && !lighthouseCandidate(h, board)) {
      return { ok: false, reason: "placement_farol_rule_failed" };
    }
  }
  if (!isAreaClear(board, hexCoordinateIds)) {
    return { ok: false, reason: "placement_area_not_clear" };
  }
  return { ok: true };
}

export function placeFleetUnit(board: Board, placement: FleetPlacement): Board {
  const pv = validateFleetPlacement(placement);
  if (!pv.ok) throw new Error(pv.reason ?? "invalid_fleet_placement");
  if (placement.kind !== "fleet") throw new Error("fleet_placement_kind_invalid");
  const next = cloneBoard(board);
  for (const id of placement.hexCoordinateIds) {
    const h = next.hexes[id];
    if (!h) throw new Error("hex_not_found");
    h.occupancy = {
      placementId: placement.id,
      entityTypeName: placement.entityTypeName,
      domain: "naval",
    };
  }
  next.fleetPlacements = [...next.fleetPlacements, { ...placement, hexCoordinateIds: [...placement.hexCoordinateIds] }];
  return next;
}

export function placeStructure(board: Board, placement: StructurePlacement): Board {
  const pv = validateStructurePlacement(placement);
  if (!pv.ok) throw new Error(pv.reason ?? "invalid_structure_placement");
  if (placement.kind !== "structure") throw new Error("structure_placement_kind_invalid");
  const next = cloneBoard(board);
  for (const id of placement.hexCoordinateIds) {
    const h = next.hexes[id];
    if (!h) throw new Error("hex_not_found");
    h.occupancy = {
      placementId: placement.id,
      entityTypeName: placement.entityTypeName,
      domain: "land",
    };
  }
  next.structurePlacements = [
    ...next.structurePlacements,
    { ...placement, hexCoordinateIds: [...placement.hexCoordinateIds] },
  ];
  return next;
}
