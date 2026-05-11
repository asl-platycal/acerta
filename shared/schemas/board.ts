import type { OccupancyType } from "./entities";
import type { FleetPlacement, StructurePlacement } from "./placement";

/** Offset axial (q,r) alinhado ao protótipo (`c`, `ri`). ID canónico `hex:q:r`. */
export interface HexCoordinate {
  id: string;
  q: number;
  r: number;
}

export interface Hex {
  coordinate: HexCoordinate;
  /** Posição lógica em px (sem canvas). */
  world: { x: number; y: number };
  terrain: "water" | "land";
  /** `Infinity` até cálculo de distância à costa. */
  distToShore: number;
  revealed: boolean;
  rgb?: { r: number; g: number; b: number };
  occupancy?: {
    placementId: string;
    entityTypeName: string;
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

export interface Board {
  hexes: Record<string, Hex>;
  fleetPlacements: FleetPlacement[];
  structurePlacements: StructurePlacement[];
  generation: BoardGenerationMeta;
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
