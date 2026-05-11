import type { FleetPlacement, StructurePlacement } from "./placement";

export type TargetType = "fleet_unit" | "structure" | "none";

export interface TargetReference {
  hexId: string;
}

export interface CombatAttempt {
  target: TargetReference;
  authorized: boolean;
  applyNavalSinkBombBonusRule?: boolean;
}

export interface DamageResult {
  partialHitValue: number;
  destructionBonusValue: number;
}

export interface CombatResult {
  processed: boolean;
  targetHexId: string;
  terrain: "water" | "land";
  hitOccupant: boolean;
  targetKind: TargetType;
  occupantDestroyed: boolean;
  affectedPlacementId?: string;
  damage?: DamageResult;
  navalSinkBombBonusParts?: number;
  error?: string;
  /** Placement naval após o disparo (estado runtime consolidado). */
  updatedFleetPlacement?: FleetPlacement;
  /** Placement de estrutura após o disparo. */
  updatedStructurePlacement?: StructurePlacement;
  /**
   * Lista canónica após disparo em célula **sem** placement (água/terra vazia).
   * Mesclar em `Board.revealedTerrainHexIds` na camada superior.
   */
  updatedRevealedTerrainHexIds?: readonly string[];
}
