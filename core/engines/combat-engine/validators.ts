import type { StructuralValidationResult } from "../../events/validators";
import type { Board, CombatAttempt, EntityCatalog, Hex } from "@acerta/shared/schemas";

export function validateEntityCatalog(catalog: EntityCatalog | null | undefined): StructuralValidationResult {
  if (!catalog || typeof catalog !== "object") {
    return { ok: false, reason: "entity_catalog_missing" };
  }
  if (!catalog.fleetUnits || typeof catalog.fleetUnits !== "object") {
    return { ok: false, reason: "entity_catalog_fleet_invalid" };
  }
  if (!catalog.structures || typeof catalog.structures !== "object") {
    return { ok: false, reason: "entity_catalog_structures_invalid" };
  }
  return { ok: true };
}

export function validateBoardSnapshot(board: Board | null | undefined): StructuralValidationResult {
  if (!board || typeof board !== "object") {
    return { ok: false, reason: "board_missing" };
  }
  if (!board.hexes || typeof board.hexes !== "object") {
    return { ok: false, reason: "board_hexes_invalid" };
  }
  if (!Array.isArray(board.fleetPlacements)) {
    return { ok: false, reason: "board_fleet_placements_invalid" };
  }
  if (!Array.isArray(board.structurePlacements)) {
    return { ok: false, reason: "board_structure_placements_invalid" };
  }
  if (!board.generation || typeof board.generation !== "object") {
    return { ok: false, reason: "board_generation_meta_invalid" };
  }
  if (board.revealedTerrainHexIds !== undefined && !Array.isArray(board.revealedTerrainHexIds)) {
    return { ok: false, reason: "board_terrain_reveals_invalid" };
  }
  return { ok: true };
}

export function validateCombatAttemptPayload(
  attempt: CombatAttempt | null | undefined,
): StructuralValidationResult {
  if (!attempt || typeof attempt !== "object") {
    return { ok: false, reason: "attempt_missing" };
  }
  if (typeof attempt.authorized !== "boolean") {
    return { ok: false, reason: "attempt_authorized_invalid" };
  }
  if (!attempt.target || typeof attempt.target.hexId !== "string" || attempt.target.hexId.length === 0) {
    return { ok: false, reason: "attempt_target_invalid" };
  }
  return { ok: true };
}

function isHexIdRevealedByPlacements(board: Board, hexId: string): boolean {
  for (const p of board.fleetPlacements) {
    if (p.revealedHexIds.includes(hexId)) return true;
  }
  for (const p of board.structurePlacements) {
    if (p.revealedHexIds.includes(hexId)) return true;
  }
  return false;
}

export function validateHexForCombat(board: Board, hexId: string): StructuralValidationResult {
  const hex = board.hexes[hexId];
  if (!hex) {
    return { ok: false, reason: "hex_not_found" };
  }
  if (hex.coordinate?.id !== hexId) {
    return { ok: false, reason: "hex_id_mismatch" };
  }
  if (isHexIdRevealedByPlacements(board, hexId)) {
    return { ok: false, reason: "hex_already_revealed" };
  }
  if (board.revealedTerrainHexIds?.includes(hexId)) {
    return { ok: false, reason: "hex_already_revealed" };
  }
  if (hex.terrain !== "water" && hex.terrain !== "land") {
    return { ok: false, reason: "hex_terrain_invalid" };
  }
  return { ok: true };
}
