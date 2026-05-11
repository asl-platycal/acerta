import type { StructuralValidationResult } from "../../events/validators";
import type {
  Board,
  CombatAttempt,
  CombatResult,
  DamageResult,
  EntityCatalog,
  FleetPlacement,
  Hex,
  StructurePlacement,
} from "@acerta/shared/schemas";
import {
  validateBoardSnapshot,
  validateCombatAttemptPayload,
  validateEntityCatalog,
  validateHexForCombat,
} from "./validators";

/** docs/acerta-níveis-dificuldade-3.xlsx · aba "Pontos por acerto" (protótipo). */
const UNIDADES_ORDEM_PONTOS_ACERTO = [
  "PORTA-AVIÕES",
  "NAVIO ANFÍBIO",
  "SUBMARINO",
  "DESTROIER",
  "FRAGATA",
  "LANCHA ATAQUE",
  "BOMBA NAVAL",
  "FAROL",
  "CAMINHÃO",
  "PAIOL",
  "BASE",
] as const;

const PONTOS_LINHA_ACERTO = [1, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1];
const PONTOS_LINHA_DESTRUICAO = [2, 2, 2, 2, 3, 4, 0, 1, 1, 2, 1];

export function pontosAcertoParcial(unitName: string): number {
  const i = UNIDADES_ORDEM_PONTOS_ACERTO.indexOf(unitName as (typeof UNIDADES_ORDEM_PONTOS_ACERTO)[number]);
  if (i < 0) return 0;
  return PONTOS_LINHA_ACERTO[i]! | 0;
}

export function pontosDestruicaoAlvo(unitName: string): number {
  const i = UNIDADES_ORDEM_PONTOS_ACERTO.indexOf(unitName as (typeof UNIDADES_ORDEM_PONTOS_ACERTO)[number]);
  if (i < 0) return 0;
  return PONTOS_LINHA_DESTRUICAO[i]! | 0;
}

function findPlacement(
  board: Board,
  placementId: string,
): { placement: FleetPlacement | StructurePlacement; targetKind: "fleet_unit" | "structure" } | null {
  const naval = board.fleetPlacements.find((u) => u.placementId === placementId);
  if (naval) return { placement: naval, targetKind: "fleet_unit" };
  const land = board.structurePlacements.find((s) => s.placementId === placementId);
  if (land) return { placement: land, targetKind: "structure" };
  return null;
}

function resolveEntityType(catalog: EntityCatalog, placement: FleetPlacement | StructurePlacement): string {
  if (placement.kind === "fleet") {
    return catalog.fleetUnits[placement.entityId]?.entityType ?? "";
  }
  return catalog.structures[placement.entityId]?.entityType ?? "";
}

/**
 * Consolida `revealedHexIds`, `currentIntegrity` e `destroyed` no placement após revelar um hex.
 * Estado runtime exclusivo do placement (sem mutar o board).
 */
export function applyRevealToPlacement(
  placement: FleetPlacement | StructurePlacement,
  revealHexId: string,
): FleetPlacement | StructurePlacement {
  const revealed = new Set(placement.revealedHexIds);
  revealed.add(revealHexId);
  const revealedHexIds = placement.occupiedHexIds.filter((id) => revealed.has(id));
  const currentIntegrity = placement.occupiedHexIds.length - revealedHexIds.length;
  const destroyed = currentIntegrity === 0;
  if (placement.kind === "fleet") {
    return { ...placement, revealedHexIds, currentIntegrity, destroyed };
  }
  return { ...placement, revealedHexIds, currentIntegrity, destroyed };
}

export function validateCombatAttempt(
  board: Board,
  attempt: CombatAttempt,
  entityCatalog: EntityCatalog,
): StructuralValidationResult {
  const bv = validateBoardSnapshot(board);
  if (!bv.ok) return bv;
  const cv = validateEntityCatalog(entityCatalog);
  if (!cv.ok) return cv;
  const av = validateCombatAttemptPayload(attempt);
  if (!av.ok) return av;
  if (!attempt.authorized) {
    return { ok: false, reason: "not_authorized" };
  }
  return validateHexForCombat(board, attempt.target.hexId);
}

export function resolveTargetHit(
  board: Board,
  targetHexId: string,
): { ok: true; hex: Hex; hitOccupant: boolean } | { ok: false; reason: string } {
  const bv = validateBoardSnapshot(board);
  if (!bv.ok) return { ok: false, reason: bv.reason ?? "board_invalid" };
  const hex = board.hexes[targetHexId];
  const hv = validateHexForCombat(board, targetHexId);
  if (!hv.ok) return { ok: false, reason: hv.reason ?? "hex_invalid" };
  const hitOccupant = hex!.occupancy !== undefined;
  return { ok: true, hex: hex!, hitOccupant };
}

export function resolveTargetDestruction(
  placement: FleetPlacement | StructurePlacement,
  revealHexId: string,
): { fullyDestroyed: boolean; updated: FleetPlacement | StructurePlacement } {
  const updated = applyRevealToPlacement(placement, revealHexId);
  return { fullyDestroyed: updated.destroyed, updated };
}

function computeNavalSinkBombBonusParts(entityType: string, hexCount: number): number {
  return entityType === "BOMBA NAVAL" ? 3 : hexCount;
}

function mergeRevealedTerrainHexIds(board: Board, hexId: string): readonly string[] {
  const set = new Set(board.revealedTerrainHexIds ?? []);
  set.add(hexId);
  return [...set].sort();
}

export function buildCombatResult(
  board: Board,
  attempt: CombatAttempt,
  entityCatalog: EntityCatalog,
): CombatResult {
  const base: Pick<CombatResult, "targetHexId"> = { targetHexId: attempt.target.hexId };
  const v = validateCombatAttempt(board, attempt, entityCatalog);
  if (!v.ok) {
    return {
      processed: false,
      ...base,
      terrain: "water",
      hitOccupant: false,
      targetKind: "none",
      occupantDestroyed: false,
      error: v.reason,
    };
  }

  const hex = board.hexes[attempt.target.hexId]!;
  const hitOccupant = hex.occupancy !== undefined;
  const targetKind: CombatResult["targetKind"] = hitOccupant
    ? hex.occupancy!.domain === "naval"
      ? "fleet_unit"
      : "structure"
    : "none";

  let damage: DamageResult | undefined;
  let occupantDestroyed = false;
  let affectedPlacementId: string | undefined;
  let navalSinkBombBonusParts: number | undefined;
  let updatedFleetPlacement: FleetPlacement | undefined;
  let updatedStructurePlacement: StructurePlacement | undefined;
  let updatedRevealedTerrainHexIds: readonly string[] | undefined;

  if (hitOccupant && hex.occupancy) {
    affectedPlacementId = hex.occupancy.placementId;
    const placementWrap = findPlacement(board, hex.occupancy.placementId);
    const entityType = placementWrap ? resolveEntityType(entityCatalog, placementWrap.placement) : "";
    const partial = pontosAcertoParcial(entityType);
    let destructionBonus = 0;

    if (placementWrap) {
      const { fullyDestroyed, updated } = resolveTargetDestruction(placementWrap.placement, attempt.target.hexId);
      occupantDestroyed = fullyDestroyed;
      if (placementWrap.placement.kind === "fleet") {
        updatedFleetPlacement = updated as FleetPlacement;
      } else {
        updatedStructurePlacement = updated as StructurePlacement;
      }
      if (fullyDestroyed) {
        destructionBonus = pontosDestruicaoAlvo(entityType);
      }
      if (
        attempt.applyNavalSinkBombBonusRule === true &&
        fullyDestroyed &&
        entityType &&
        placementWrap.targetKind === "fleet_unit"
      ) {
        navalSinkBombBonusParts = computeNavalSinkBombBonusParts(
          entityType,
          placementWrap.placement.occupiedHexIds.length,
        );
      }
    }

    damage = { partialHitValue: partial, destructionBonusValue: destructionBonus };
  } else {
    updatedRevealedTerrainHexIds = mergeRevealedTerrainHexIds(board, attempt.target.hexId);
  }

  return {
    processed: true,
    targetHexId: attempt.target.hexId,
    terrain: hex.terrain,
    hitOccupant,
    targetKind,
    occupantDestroyed,
    affectedPlacementId,
    damage,
    navalSinkBombBonusParts,
    updatedFleetPlacement,
    updatedStructurePlacement,
    updatedRevealedTerrainHexIds,
  };
}
