import type { StructuralValidationResult } from "./validators";
import type { Board, DamageResult, FleetPlacement, StructurePlacement } from "@acerta/shared/schemas";
import type {
  PlacementPatch,
  RuntimePatchType,
  RuntimeStatePatch,
  TerrainRevealPatch,
} from "@acerta/shared/schemas/runtime-patch";

const PLACEMENT_PATCH_TYPES: ReadonlySet<PlacementPatch["patchType"]> = new Set([
  "placement_update",
  "destruction",
  "integrity_update",
]);

function placementExistsOnBoard(board: Board, placementId: string): boolean {
  return (
    board.fleetPlacements.some((p) => p.placementId === placementId) ||
    board.structurePlacements.some((p) => p.placementId === placementId)
  );
}

function hexExists(board: Board, hexId: string): boolean {
  const hex = board.hexes[hexId];
  return hex !== undefined && hex.coordinate?.id === hexId;
}

function getPlacementOnBoard(board: Board, p: PlacementPatch): FleetPlacement | StructurePlacement | undefined {
  if (p.placementKind === "fleet") {
    return board.fleetPlacements.find((x) => x.placementId === p.placementId);
  }
  return board.structurePlacements.find((x) => x.placementId === p.placementId);
}

function validatePlacementPatch(board: Board, p: PlacementPatch): StructuralValidationResult {
  if (!PLACEMENT_PATCH_TYPES.has(p.patchType)) {
    return { ok: false, reason: "patch_placement_type_invalid" };
  }
  if (typeof p.placementId !== "string" || p.placementId.length === 0) {
    return { ok: false, reason: "patch_placement_id_invalid" };
  }
  if (p.placementKind !== "fleet" && p.placementKind !== "structure") {
    return { ok: false, reason: "patch_placement_kind_invalid" };
  }
  if (!placementExistsOnBoard(board, p.placementId)) {
    return { ok: false, reason: "patch_placement_id_not_on_board" };
  }
  if (!Array.isArray(p.newlyRevealedHexIds)) {
    return { ok: false, reason: "patch_newly_revealed_invalid" };
  }
  for (const id of p.newlyRevealedHexIds) {
    if (typeof id !== "string" || !hexExists(board, id)) {
      return { ok: false, reason: "patch_newly_revealed_hex_invalid" };
    }
  }
  if (typeof p.integrityDelta !== "number" || !Number.isFinite(p.integrityDelta)) {
    return { ok: false, reason: "patch_integrity_delta_invalid" };
  }
  if (
    typeof p.destroyedTransition?.from !== "boolean" ||
    typeof p.destroyedTransition?.to !== "boolean"
  ) {
    return { ok: false, reason: "patch_destroyed_transition_invalid" };
  }
  if (p.patchType === "destruction" && !(p.destroyedTransition.to === true && p.destroyedTransition.from === false)) {
    return { ok: false, reason: "patch_destruction_inconsistent" };
  }
  if (p.patchType === "integrity_update" && p.integrityDelta === 0) {
    return { ok: false, reason: "patch_integrity_update_inconsistent" };
  }
  if (p.patchType === "placement_update" && (p.integrityDelta !== 0 || p.destroyedTransition.from !== p.destroyedTransition.to)) {
    return { ok: false, reason: "patch_placement_update_inconsistent" };
  }
  return { ok: true };
}

function validatePlacementPatchSemantics(board: Board, patch: RuntimeStatePatch): StructuralValidationResult {
  const p = patch.placementPatch!;
  const placement = getPlacementOnBoard(board, p);
  if (!placement) {
    return { ok: false, reason: "patch_placement_resolve_failed" };
  }
  if (placement.kind !== (p.placementKind === "fleet" ? "fleet" : "structure")) {
    return { ok: false, reason: "patch_placement_kind_board_mismatch" };
  }
  if (p.destroyedTransition.from !== placement.destroyed) {
    return { ok: false, reason: "patch_destroyed_from_mismatch" };
  }
  if (!p.newlyRevealedHexIds.includes(patch.targetHexId)) {
    return { ok: false, reason: "patch_target_hex_not_in_newly_revealed" };
  }
  for (const id of p.newlyRevealedHexIds) {
    if (!placement.occupiedHexIds.includes(id)) {
      return { ok: false, reason: "patch_newly_revealed_not_occupied" };
    }
    if (placement.revealedHexIds.includes(id)) {
      return { ok: false, reason: "patch_hex_already_revealed_on_placement" };
    }
  }
  const revealed = new Set(placement.revealedHexIds);
  for (const id of p.newlyRevealedHexIds) {
    revealed.add(id);
  }
  const revealedHexIds = placement.occupiedHexIds.filter((id) => revealed.has(id));
  const nextIntegrity = placement.occupiedHexIds.length - revealedHexIds.length;
  if (placement.currentIntegrity + p.integrityDelta !== nextIntegrity) {
    return { ok: false, reason: "patch_integrity_delta_board_mismatch" };
  }
  const nextDestroyed = nextIntegrity === 0;
  if (p.destroyedTransition.to !== nextDestroyed) {
    return { ok: false, reason: "patch_destroyed_to_board_mismatch" };
  }
  if (patch.outcome.occupantDestroyed !== p.destroyedTransition.to) {
    return { ok: false, reason: "patch_outcome_destroyed_mismatch" };
  }
  if (p.patchType === "destruction" && (!p.destroyedTransition.to || nextIntegrity !== 0)) {
    return { ok: false, reason: "patch_destruction_semantics_invalid" };
  }
  if (p.patchType === "destruction" && !patch.outcome.occupantDestroyed) {
    return { ok: false, reason: "patch_destruction_outcome_invalid" };
  }
  return { ok: true };
}

function validateTerrainRevealSemantics(board: Board, patch: RuntimeStatePatch): StructuralValidationResult {
  const t = patch.terrainReveal!;
  const revealed = new Set(board.revealedTerrainHexIds ?? []);
  for (const id of t.newlyRevealedTerrainHexIds) {
    if (revealed.has(id)) {
      return { ok: false, reason: "patch_terrain_already_on_board" };
    }
    const hex = board.hexes[id];
    if (hex?.occupancy !== undefined) {
      return { ok: false, reason: "patch_terrain_hex_occupied" };
    }
  }
  if (!t.newlyRevealedTerrainHexIds.includes(patch.targetHexId)) {
    return { ok: false, reason: "patch_terrain_target_hex_mismatch" };
  }
  if (patch.outcome.hitOccupant || patch.outcome.occupantDestroyed) {
    return { ok: false, reason: "patch_terrain_outcome_hit_mismatch" };
  }
  return { ok: true };
}

function validateTerrainRevealPatch(board: Board, t: TerrainRevealPatch): StructuralValidationResult {
  if (t.patchType !== "terrain_reveal") {
    return { ok: false, reason: "patch_terrain_type_invalid" };
  }
  if (!Array.isArray(t.newlyRevealedTerrainHexIds)) {
    return { ok: false, reason: "patch_terrain_ids_invalid" };
  }
  if (t.newlyRevealedTerrainHexIds.length === 0) {
    return { ok: false, reason: "patch_terrain_ids_empty" };
  }
  for (const id of t.newlyRevealedTerrainHexIds) {
    if (typeof id !== "string" || !hexExists(board, id)) {
      return { ok: false, reason: "patch_terrain_hex_invalid" };
    }
  }
  return { ok: true };
}

function outcomeMatchesPatchPayload(patch: RuntimeStatePatch): StructuralValidationResult {
  const { outcome, placementPatch, terrainReveal } = patch;
  if (placementPatch && terrainReveal) {
    return { ok: false, reason: "patch_ambiguous_placement_and_terrain" };
  }
  if (terrainReveal && outcome.hitOccupant) {
    return { ok: false, reason: "patch_outcome_terrain_hit_mismatch" };
  }
  if (placementPatch && !outcome.hitOccupant) {
    return { ok: false, reason: "patch_outcome_placement_miss_mismatch" };
  }
  if (outcome.processed && outcome.hitOccupant && outcome.targetKind !== "none" && !placementPatch) {
    return { ok: false, reason: "patch_missing_placement_when_hit" };
  }
  if (
    outcome.processed &&
    !outcome.hitOccupant &&
    outcome.targetKind === "none" &&
    !terrainReveal &&
    !outcome.error
  ) {
    return { ok: false, reason: "patch_outcome_missing_terrain_reveal" };
  }
  return { ok: true };
}

function validateDamageResultStruct(d: DamageResult): StructuralValidationResult {
  const keys: (keyof DamageResult)[] = [
    "partialHitScore",
    "destructionScore",
    "tacticalBonusScore",
    "navalSinkBombBonusParts",
  ];
  for (const k of keys) {
    const v = d[k];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || !Number.isInteger(v)) {
      return { ok: false, reason: "patch_damage_field_invalid" };
    }
  }
  return { ok: true };
}

function validateOutcomeDamageCoherence(patch: RuntimeStatePatch): StructuralValidationResult {
  const o = patch.outcome;
  if (!o.processed) {
    if (o.damage !== undefined) {
      return { ok: false, reason: "patch_damage_when_unprocessed" };
    }
    return { ok: true };
  }
  if (!o.damage) {
    return { ok: false, reason: "patch_missing_damage_when_processed" };
  }
  const st = validateDamageResultStruct(o.damage);
  if (!st.ok) return st;
  const d = o.damage;
  if (!o.hitOccupant && o.targetKind === "none") {
    if (
      d.partialHitScore !== 0 ||
      d.destructionScore !== 0 ||
      d.tacticalBonusScore !== 0 ||
      d.navalSinkBombBonusParts !== 0
    ) {
      return { ok: false, reason: "patch_damage_must_be_zero_on_miss" };
    }
  }
  if (o.hitOccupant && o.targetKind !== "none" && !o.occupantDestroyed && d.destructionScore !== 0) {
    return { ok: false, reason: "patch_destruction_score_without_destruction" };
  }
  return { ok: true };
}

/**
 * Valida consistência estrutural do patch contra o board (sem mutar estado).
 */
export function validateRuntimeStatePatch(board: Board, patch: RuntimeStatePatch): StructuralValidationResult {
  if (!board || typeof board !== "object" || !board.hexes) {
    return { ok: false, reason: "board_missing" };
  }
  if (!patch || typeof patch !== "object") {
    return { ok: false, reason: "patch_missing" };
  }
  if (typeof patch.sequenceNumber !== "number" || !Number.isInteger(patch.sequenceNumber)) {
    return { ok: false, reason: "patch_sequence_invalid" };
  }
  if (typeof patch.timestamp !== "number" || !Number.isFinite(patch.timestamp)) {
    return { ok: false, reason: "patch_timestamp_invalid" };
  }
  if (typeof patch.targetHexId !== "string" || patch.targetHexId.length === 0) {
    return { ok: false, reason: "patch_target_hex_invalid" };
  }
  if (!hexExists(board, patch.targetHexId)) {
    return { ok: false, reason: "patch_target_hex_not_on_board" };
  }
  if (!patch.outcome || typeof patch.outcome !== "object") {
    return { ok: false, reason: "patch_outcome_missing" };
  }
  if (patch.placementPatch && !patch.outcome.processed) {
    return { ok: false, reason: "patch_placement_with_unprocessed_outcome" };
  }
  if (patch.terrainReveal && !patch.outcome.processed) {
    return { ok: false, reason: "patch_terrain_with_unprocessed_outcome" };
  }
  const amb = outcomeMatchesPatchPayload(patch);
  if (!amb.ok) return amb;
  const dmg = validateOutcomeDamageCoherence(patch);
  if (!dmg.ok) return dmg;
  if (patch.placementPatch) {
    const pv = validatePlacementPatch(board, patch.placementPatch);
    if (!pv.ok) return pv;
    const ps = validatePlacementPatchSemantics(board, patch);
    if (!ps.ok) return ps;
  }
  if (patch.terrainReveal) {
    const tv = validateTerrainRevealPatch(board, patch.terrainReveal);
    if (!tv.ok) return tv;
    const ts = validateTerrainRevealSemantics(board, patch);
    if (!ts.ok) return ts;
  }
  return { ok: true };
}

export function isRuntimePatchType(value: string): value is RuntimePatchType {
  return (
    value === "placement_update" ||
    value === "terrain_reveal" ||
    value === "destruction" ||
    value === "integrity_update"
  );
}
