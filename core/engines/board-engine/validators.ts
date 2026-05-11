import type { StructuralValidationResult } from "../../events/validators";
import type {
  Board,
  BoardGenerationConfig,
  FleetPlacement,
  HexCoordinate,
  StructurePlacement,
} from "@acerta/shared/schemas";

const HEX_ID = /^hex:-?\d+:-?\d+$/;
const FLEET_ENTITY_ID = /^fleet_unit:.+$/;
const STRUCTURE_ENTITY_ID = /^structure:.+$/;
const FLEET_PLACEMENT_ID = /^fleet_placement:.+$/;
const STRUCTURE_PLACEMENT_ID = /^structure_placement:.+$/;

export function validateHexCoordinateId(id: string | undefined): StructuralValidationResult {
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, reason: "hex_id_empty" };
  }
  if (!HEX_ID.test(id)) {
    return { ok: false, reason: "hex_id_format_invalid" };
  }
  return { ok: true };
}

export function validateFleetEntityId(id: string | undefined): StructuralValidationResult {
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, reason: "fleet_entity_id_empty" };
  }
  if (!FLEET_ENTITY_ID.test(id)) {
    return { ok: false, reason: "fleet_entity_id_format_invalid" };
  }
  return { ok: true };
}

export function validateStructureEntityId(id: string | undefined): StructuralValidationResult {
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, reason: "structure_entity_id_empty" };
  }
  if (!STRUCTURE_ENTITY_ID.test(id)) {
    return { ok: false, reason: "structure_entity_id_format_invalid" };
  }
  return { ok: true };
}

export function validateFleetPlacementId(id: string | undefined): StructuralValidationResult {
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, reason: "fleet_placement_id_empty" };
  }
  if (!FLEET_PLACEMENT_ID.test(id)) {
    return { ok: false, reason: "fleet_placement_id_format_invalid" };
  }
  return { ok: true };
}

export function validateStructurePlacementId(id: string | undefined): StructuralValidationResult {
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, reason: "structure_placement_id_empty" };
  }
  if (!STRUCTURE_PLACEMENT_ID.test(id)) {
    return { ok: false, reason: "structure_placement_id_format_invalid" };
  }
  return { ok: true };
}

export function validateBoardGenerationConfig(
  cfg: BoardGenerationConfig | null | undefined,
): StructuralValidationResult {
  if (!cfg || typeof cfg !== "object") {
    return { ok: false, reason: "board_config_missing" };
  }
  if (!Number.isFinite(cfg.hexRadius) || cfg.hexRadius <= 0) {
    return { ok: false, reason: "board_config_hex_radius_invalid" };
  }
  if (!Number.isFinite(cfg.scale) || cfg.scale <= 0) {
    return { ok: false, reason: "board_config_scale_invalid" };
  }
  if (!Number.isFinite(cfg.mapWidthPx) || cfg.mapWidthPx <= 0) {
    return { ok: false, reason: "board_config_map_width_invalid" };
  }
  if (!Number.isFinite(cfg.mapHeightPx) || cfg.mapHeightPx <= 0) {
    return { ok: false, reason: "board_config_map_height_invalid" };
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

export function validateHexCoordinate(coord: HexCoordinate | null | undefined): StructuralValidationResult {
  if (!coord || typeof coord !== "object") {
    return { ok: false, reason: "hex_coordinate_missing" };
  }
  if (!Number.isInteger(coord.q)) {
    return { ok: false, reason: "hex_coordinate_q_invalid" };
  }
  if (!Number.isInteger(coord.r)) {
    return { ok: false, reason: "hex_coordinate_r_invalid" };
  }
  const idv = validateHexCoordinateId(coord.id);
  if (!idv.ok) return idv;
  if (coord.id !== `hex:${coord.q}:${coord.r}`) {
    return { ok: false, reason: "hex_coordinate_id_mismatch" };
  }
  return { ok: true };
}

export function validateFleetPlacement(p: FleetPlacement | null | undefined): StructuralValidationResult {
  if (!p || typeof p !== "object") {
    return { ok: false, reason: "fleet_placement_missing" };
  }
  if (p.kind !== "fleet") {
    return { ok: false, reason: "fleet_placement_kind_invalid" };
  }
  const pid = validateFleetPlacementId(p.placementId);
  if (!pid.ok) return pid;
  const eid = validateFleetEntityId(p.entityId);
  if (!eid.ok) return eid;
  if (!Array.isArray(p.occupiedHexIds) || p.occupiedHexIds.length === 0) {
    return { ok: false, reason: "fleet_placement_occupied_invalid" };
  }
  if (!Array.isArray(p.revealedHexIds)) {
    return { ok: false, reason: "fleet_placement_revealed_invalid" };
  }
  if (typeof p.destroyed !== "boolean") {
    return { ok: false, reason: "fleet_placement_destroyed_invalid" };
  }
  if (typeof p.currentIntegrity !== "number" || !Number.isFinite(p.currentIntegrity)) {
    return { ok: false, reason: "fleet_placement_integrity_invalid" };
  }
  for (const hid of p.occupiedHexIds) {
    const hv = validateHexCoordinateId(hid);
    if (!hv.ok) return hv;
  }
  for (const hid of p.revealedHexIds) {
    const hv = validateHexCoordinateId(hid);
    if (!hv.ok) return hv;
  }
  return { ok: true };
}

export function validateStructurePlacement(p: StructurePlacement | null | undefined): StructuralValidationResult {
  if (!p || typeof p !== "object") {
    return { ok: false, reason: "structure_placement_missing" };
  }
  if (p.kind !== "structure") {
    return { ok: false, reason: "structure_placement_kind_invalid" };
  }
  const pid = validateStructurePlacementId(p.placementId);
  if (!pid.ok) return pid;
  const eid = validateStructureEntityId(p.entityId);
  if (!eid.ok) return eid;
  if (!Array.isArray(p.occupiedHexIds) || p.occupiedHexIds.length === 0) {
    return { ok: false, reason: "structure_placement_occupied_invalid" };
  }
  if (!Array.isArray(p.revealedHexIds)) {
    return { ok: false, reason: "structure_placement_revealed_invalid" };
  }
  if (typeof p.destroyed !== "boolean") {
    return { ok: false, reason: "structure_placement_destroyed_invalid" };
  }
  if (typeof p.currentIntegrity !== "number" || !Number.isFinite(p.currentIntegrity)) {
    return { ok: false, reason: "structure_placement_integrity_invalid" };
  }
  for (const hid of p.occupiedHexIds) {
    const hv = validateHexCoordinateId(hid);
    if (!hv.ok) return hv;
  }
  for (const hid of p.revealedHexIds) {
    const hv = validateHexCoordinateId(hid);
    if (!hv.ok) return hv;
  }
  return { ok: true };
}
