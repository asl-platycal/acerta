export type TargetType = "fleet_unit" | "structure" | "none";

export interface TargetReference {
  hexId: string;
}

export interface CombatAttempt {
  target: TargetReference;
  authorized: boolean;
  applyNavalSinkBombBonusRule?: boolean;
}

/**
 * Semântica competitiva explícita por disparo (valores numéricos ≥ 0; zeros válidos).
 * Campos táticos/navais separados para replay sem inferência.
 */
export interface DamageResult {
  readonly partialHitScore: number;
  readonly destructionScore: number;
  readonly tacticalBonusScore: number;
  readonly navalSinkBombBonusParts: number;
}

