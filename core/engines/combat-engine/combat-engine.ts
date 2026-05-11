import type { StructuralValidationResult } from "../../events/validators";
import type {
  Board,
  CombatAttempt,
  DamageResult,
  EntityCatalog,
  FleetPlacement,
  Hex,
  RuntimeStatePatch,
  StructurePlacement,
  TargetType,
} from "@acerta/shared/schemas";
import type { RuntimeActionContext } from "@acerta/shared/schemas/runtime-sequence";
import {
  buildPlacementPatchBetween,
  buildTerrainRevealPatchForHex,
} from "../../events/runtime-patch-builder";
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

function zeroDamage(): DamageResult {
  return {
    partialHitScore: 0,
    destructionScore: 0,
    tacticalBonusScore: 0,
    navalSinkBombBonusParts: 0,
  };
}

function damageForOccupantReveal(entityType: string, fullyDestroyed: boolean, navalSinkBombBonusParts: number): DamageResult {
  return {
    partialHitScore: pontosAcertoParcial(entityType),
    destructionScore: fullyDestroyed ? pontosDestruicaoAlvo(entityType) : 0,
    tacticalBonusScore: 0,
    navalSinkBombBonusParts,
  };
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
  runtimeContext: RuntimeActionContext,
  entityCatalog?: EntityCatalog,
): RuntimeStatePatch {
  const bv = validateBoardSnapshot(board);
  if (!bv.ok) {
    return {
      sequenceNumber: runtimeContext.sequenceNumber,
      timestamp: runtimeContext.timestamp,
      targetHexId,
      outcome: {
        processed: false,
        terrain: "water",
        hitOccupant: false,
        targetKind: "none",
        occupantDestroyed: false,
        error: bv.reason ?? "board_invalid",
      },
    };
  }
  const hv = validateHexForCombat(board, targetHexId);
  if (!hv.ok) {
    return {
      sequenceNumber: runtimeContext.sequenceNumber,
      timestamp: runtimeContext.timestamp,
      targetHexId,
      outcome: {
        processed: false,
        terrain: "water",
        hitOccupant: false,
        targetKind: "none",
        occupantDestroyed: false,
        error: hv.reason ?? "hex_invalid",
      },
    };
  }
  const hex = board.hexes[targetHexId]!;
  const hitOccupant = hex.occupancy !== undefined;
  const targetKind: TargetType = hitOccupant
    ? hex.occupancy!.domain === "naval"
      ? "fleet_unit"
      : "structure"
    : "none";
  if (!hitOccupant) {
    const terrainReveal = buildTerrainRevealPatchForHex(board, targetHexId);
    return {
      sequenceNumber: runtimeContext.sequenceNumber,
      timestamp: runtimeContext.timestamp,
      targetHexId,
      terrainReveal,
      outcome: {
        processed: true,
        terrain: hex.terrain,
        hitOccupant,
        targetKind,
        occupantDestroyed: false,
        damage: zeroDamage(),
      },
    };
  }
  const wrap = findPlacement(board, hex.occupancy!.placementId);
  if (!wrap) {
    return {
      sequenceNumber: runtimeContext.sequenceNumber,
      timestamp: runtimeContext.timestamp,
      targetHexId,
      outcome: {
        processed: false,
        terrain: hex.terrain,
        hitOccupant: true,
        targetKind,
        occupantDestroyed: false,
        error: "occupancy_without_placement",
      },
    };
  }
  const prev = wrap.placement;
  const updated = applyRevealToPlacement(prev, targetHexId);
  const placementPatch = buildPlacementPatchBetween(prev, updated);
  if (!placementPatch) {
    return {
      sequenceNumber: runtimeContext.sequenceNumber,
      timestamp: runtimeContext.timestamp,
      targetHexId,
      outcome: {
        processed: false,
        terrain: hex.terrain,
        hitOccupant: true,
        targetKind,
        occupantDestroyed: prev.destroyed,
        error: "target_reveal_noop",
      },
    };
  }
  const entityType =
    entityCatalog !== undefined ? resolveEntityType(entityCatalog, prev) : "";
  const damage = damageForOccupantReveal(entityType, updated.destroyed, 0);
  return {
    sequenceNumber: runtimeContext.sequenceNumber,
    timestamp: runtimeContext.timestamp,
    targetHexId,
    placementPatch,
    outcome: {
      processed: true,
      terrain: hex.terrain,
      hitOccupant: true,
      targetKind,
      occupantDestroyed: updated.destroyed,
      damage,
    },
  };
}

export function resolveTargetDestruction(
  placement: FleetPlacement | StructurePlacement,
  revealHexId: string,
  ctx: {
    targetHexId: string;
    terrain: "water" | "land";
    runtimeContext: RuntimeActionContext;
    entityCatalog?: EntityCatalog;
  },
): RuntimeStatePatch {
  const previous = placement;
  const updated = applyRevealToPlacement(placement, revealHexId);
  const placementPatch = buildPlacementPatchBetween(previous, updated);
  if (!placementPatch) {
    return {
      sequenceNumber: ctx.runtimeContext.sequenceNumber,
      timestamp: ctx.runtimeContext.timestamp,
      targetHexId: ctx.targetHexId,
      outcome: {
        processed: false,
        terrain: ctx.terrain,
        hitOccupant: true,
        targetKind: previous.kind === "fleet" ? "fleet_unit" : "structure",
        occupantDestroyed: previous.destroyed,
        error: "placement_reveal_noop",
      },
    };
  }
  const entityType =
    ctx.entityCatalog !== undefined ? resolveEntityType(ctx.entityCatalog, previous) : "";
  const damage = damageForOccupantReveal(entityType, updated.destroyed, 0);
  return {
    sequenceNumber: ctx.runtimeContext.sequenceNumber,
    timestamp: ctx.runtimeContext.timestamp,
    targetHexId: ctx.targetHexId,
    placementPatch,
    outcome: {
      processed: true,
      terrain: ctx.terrain,
      hitOccupant: true,
      targetKind: previous.kind === "fleet" ? "fleet_unit" : "structure",
      occupantDestroyed: updated.destroyed,
      damage,
    },
  };
}

function computeNavalSinkBombBonusParts(entityType: string, hexCount: number): number {
  return entityType === "BOMBA NAVAL" ? 3 : hexCount;
}

export function buildCombatResult(
  board: Board,
  attempt: CombatAttempt,
  entityCatalog: EntityCatalog,
  runtimeContext: RuntimeActionContext,
): RuntimeStatePatch {
  const seq = runtimeContext.sequenceNumber;
  const ts = runtimeContext.timestamp;
  const targetHexId = attempt.target.hexId;
  const v = validateCombatAttempt(board, attempt, entityCatalog);
  if (!v.ok) {
    return {
      sequenceNumber: seq,
      timestamp: ts,
      targetHexId,
      outcome: {
        processed: false,
        terrain: "water",
        hitOccupant: false,
        targetKind: "none",
        occupantDestroyed: false,
        error: v.reason,
      },
    };
  }

  const hex = board.hexes[targetHexId]!;
  const hitOccupant = hex.occupancy !== undefined;
  const targetKind: TargetType = hitOccupant
    ? hex.occupancy!.domain === "naval"
      ? "fleet_unit"
      : "structure"
    : "none";

  if (hitOccupant && hex.occupancy) {
    let occupantDestroyed = false;
    let navalSinkBombBonusParts = 0;
    let placementPatch = undefined;

    const placementWrap = findPlacement(board, hex.occupancy.placementId);
    const entityType = placementWrap ? resolveEntityType(entityCatalog, placementWrap.placement) : "";

    if (!placementWrap) {
      return {
        sequenceNumber: seq,
        timestamp: ts,
        targetHexId,
        outcome: {
          processed: false,
          terrain: hex.terrain,
          hitOccupant: true,
          targetKind,
          occupantDestroyed: false,
          error: "occupancy_without_placement",
        },
      };
    }
    const prev = placementWrap.placement;
    const updated = applyRevealToPlacement(prev, attempt.target.hexId);
    occupantDestroyed = updated.destroyed;
    placementPatch = buildPlacementPatchBetween(prev, updated);
    if (!placementPatch) {
      return {
        sequenceNumber: seq,
        timestamp: ts,
        targetHexId,
        outcome: {
          processed: false,
          terrain: hex.terrain,
          hitOccupant: true,
          targetKind,
          occupantDestroyed: prev.destroyed,
          error: "combat_reveal_noop",
        },
      };
    }
    if (
      attempt.applyNavalSinkBombBonusRule === true &&
      updated.destroyed &&
      entityType &&
      placementWrap.targetKind === "fleet_unit"
    ) {
      navalSinkBombBonusParts = computeNavalSinkBombBonusParts(
        entityType,
        placementWrap.placement.occupiedHexIds.length,
      );
    }

    const damage = damageForOccupantReveal(entityType, updated.destroyed, navalSinkBombBonusParts);

    return {
      sequenceNumber: seq,
      timestamp: ts,
      targetHexId,
      placementPatch,
      outcome: {
        processed: true,
        terrain: hex.terrain,
        hitOccupant,
        targetKind,
        occupantDestroyed,
        damage,
      },
    };
  }

  const terrainReveal = buildTerrainRevealPatchForHex(board, targetHexId);
  if (!terrainReveal) {
    return {
      sequenceNumber: seq,
      timestamp: ts,
      targetHexId,
      outcome: {
        processed: false,
        terrain: hex.terrain,
        hitOccupant: false,
        targetKind: "none",
        occupantDestroyed: false,
        error: "terrain_reveal_noop",
      },
    };
  }

  return {
    sequenceNumber: seq,
    timestamp: ts,
    targetHexId,
    terrainReveal,
    outcome: {
      processed: true,
      terrain: hex.terrain,
      hitOccupant,
      targetKind,
      occupantDestroyed: false,
      damage: zeroDamage(),
    },
  };
}
