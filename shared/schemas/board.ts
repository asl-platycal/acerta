import type { OccupancyType } from "./entities";
import type { FleetPlacement, StructurePlacement } from "./placement";

/** Offset axial (q,r). ID canónico `hex:q:r`. */
export interface HexCoordinate {
  id: string;
  q: number;
  r: number;
}

/** Estrutura espacial da célula — sem estado tático de revelação (ver placements / `revealedTerrainHexIds` no Board). */
export interface Hex {
  coordinate: HexCoordinate;
  world: { x: number; y: number };
  terrain: "water" | "land";
  distToShore: number;
  rgb?: { r: number; g: number; b: number };
  occupancy?: {
    placementId: string;
    entityId: string;
    domain: Extract<OccupancyType, "naval" | "land">;
  };
}

export interface BoardGenerationMeta {
  hexRadiusLogical: number;
  scale: number;
  cols: number;
  rows: number;
  mapWidthPx: number;
  mapHeightPx: number;
}

/**
 * Tabuleiro: células + placements.
 * Revelação em células **com** alvo: `FleetPlacement` / `StructurePlacement`.`revealedHexIds`.
 * Revelação em células **sem** placement (disparo em vazio): lista canónica ao nível do tabuleiro (nunca em `Hex`).
 */
export interface Board {
  boardId?: string;
  hexes: Record<string, Hex>;
  fleetPlacements: FleetPlacement[];
  structurePlacements: StructurePlacement[];
  generation: BoardGenerationMeta;
  revealedTerrainHexIds?: readonly string[];
}

export interface BoardGenerationConfig {
  hexRadius: number;
  scale: number;
  mapWidthPx: number;
  mapHeightPx: number;
  terrainByHexId?: Record<string, "water" | "land">;
}

export interface PlayableAreaConfig {
  viewportWidthPx: number;
  viewportHeightPx: number;
  mapOffsetXPx: number;
  mapOffsetYPx: number;
}
