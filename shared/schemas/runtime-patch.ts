import type { DamageResult, TargetType } from "./combat";

/** Tipos explícitos de delta runtime (sem `terrain_reveal` em placement). */
export type RuntimePatchType =
  | "placement_update"
  | "terrain_reveal"
  | "destruction"
  | "integrity_update";

export type PlacementRuntimePatchType = Exclude<RuntimePatchType, "terrain_reveal">;

export interface DestroyedTransition {
  readonly from: boolean;
  readonly to: boolean;
}

/** Delta incremental de placement (não snapshot completo). */
export interface PlacementPatch {
  readonly patchType: PlacementRuntimePatchType;
  readonly placementId: string;
  readonly placementKind: "fleet" | "structure";
  readonly newlyRevealedHexIds: readonly string[];
  readonly integrityDelta: number;
  readonly destroyedTransition: DestroyedTransition;
}

/** Apenas terreno revelado neste evento. */
export interface TerrainRevealPatch {
  readonly patchType: "terrain_reveal";
  readonly newlyRevealedTerrainHexIds: readonly string[];
}

export interface RuntimeStatePatchOutcome {
  readonly processed: boolean;
  readonly terrain: "water" | "land";
  readonly hitOccupant: boolean;
  readonly targetKind: TargetType;
  readonly occupantDestroyed: boolean;
  /** Obrigatório quando `processed === true` (inclui disparo em vazio: zeros explícitos). */
  readonly damage?: DamageResult;
  readonly error?: string;
}

/**
 * Transição atômica de estado runtime: apenas deltas descritivos.
 * Não aplica estado; não muta board/placements.
 */
export interface RuntimeStatePatch {
  readonly sequenceNumber: number;
  readonly timestamp: number;
  readonly targetHexId: string;
  readonly placementPatch?: PlacementPatch;
  readonly terrainReveal?: TerrainRevealPatch;
  readonly outcome: RuntimeStatePatchOutcome;
}
