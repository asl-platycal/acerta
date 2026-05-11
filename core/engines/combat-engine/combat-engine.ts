import type { StructuralValidationResult } from "../../events/validators";
import type {
  Board,
  CombatAttempt,
  CombatResult,
  DamageResult,
  FleetPlacement,
  Hex,
  StructurePlacement,
} from "@acerta/shared/schemas";
import {
  validateBoardSnapshot,
  validateCombatAttemptPayload,
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
  const naval = board.fleetPlacements.find((u) => u.id === placementId);
  if (naval) return { placement: naval, targetKind: "fleet_unit" };
  const land = board.structurePlacements.find((s) => s.id === placementId);
  if (land) return { placement: land, targetKind: "structure" };
  return null;
}

export function validateCombatAttempt(
  board: Board,
  attempt: CombatAttempt,
): StructuralValidationResult {
  const bv = validateBoardSnapshot(board);
  if (!bv.ok) return bv;
  const av = validateCombatAttemptPayload(attempt);
  if (!av.ok) return av;
  if (!attempt.authorized) {
    return { ok: false, reason: "not_authorized" };
  }
  const hex = board.hexes[attempt.target.hexId];
  return validateHexForCombat(hex, attempt.target.hexId);
}

export function resolveTargetHit(
  board: Board,
  targetHexId: string,
): { ok: true; hex: Hex; hitOccupant: boolean } | { ok: false; reason: string } {
  const bv = validateBoardSnapshot(board);
  if (!bv.ok) return { ok: false, reason: bv.reason ?? "board_invalid" };
  const hex = board.hexes[targetHexId];
  const hv = validateHexForCombat(hex, targetHexId);
  if (!hv.ok) return { ok: false, reason: hv.reason ?? "hex_invalid" };
  const hitOccupant = hex!.occupancy !== undefined;
  return { ok: true, hex: hex!, hitOccupant };
}

export function resolveTargetDestruction(
  board: Board,
  placement: FleetPlacement | StructurePlacement,
  revealHexId: string,
): { fullyDestroyed: boolean; entityTypeName: string } {
  const allRevealed = placement.hexCoordinateIds.every(
    (id) => id === revealHexId || board.hexes[id]?.revealed === true,
  );
  return { fullyDestroyed: allRevealed, entityTypeName: placement.entityTypeName };
}

function computeNavalSinkBombBonusParts(entityTypeName: string, hexCount: number): number {
  return entityTypeName === "BOMBA NAVAL" ? 3 : hexCount;
}

export function buildCombatResult(board: Board, attempt: CombatAttempt): CombatResult {
  const base: Pick<CombatResult, "targetHexId"> = { targetHexId: attempt.target.hexId };
  const v = validateCombatAttempt(board, attempt);
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

  if (hitOccupant && hex.occupancy) {
    affectedPlacementId = hex.occupancy.placementId;
    const placementWrap = findPlacement(board, hex.occupancy.placementId);
    const partial = pontosAcertoParcial(hex.occupancy.entityTypeName);
    let destructionBonus = 0;

    if (placementWrap) {
      const { fullyDestroyed } = resolveTargetDestruction(
        board,
        placementWrap.placement,
        attempt.target.hexId,
      );
      occupantDestroyed = fullyDestroyed;
      if (fullyDestroyed) {
        destructionBonus = pontosDestruicaoAlvo(placementWrap.placement.entityTypeName);
      }
      if (
        attempt.applyNavalSinkBombBonusRule === true &&
        fullyDestroyed &&
        placementWrap.placement.entityTypeName &&
        placementWrap.targetKind === "fleet_unit"
      ) {
        navalSinkBombBonusParts = computeNavalSinkBombBonusParts(
          placementWrap.placement.entityTypeName,
          placementWrap.placement.hexCoordinateIds.length,
        );
      }
    }

    damage = { partialHitValue: partial, destructionBonusValue: destructionBonus };
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
  };
}
