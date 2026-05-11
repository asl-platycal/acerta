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
}
