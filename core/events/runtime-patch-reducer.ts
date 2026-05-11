import type { Board, FleetPlacement, StructurePlacement } from "@acerta/shared/schemas";
import type { PlacementPatch, RuntimeStatePatch } from "@acerta/shared/schemas/runtime-patch";
import { validateRuntimeStatePatch } from "./runtime-patch-validator";

export class RuntimePatchApplyError extends Error {
  constructor(
    message: string,
    public readonly reason?: string,
  ) {
    super(message);
    this.name = "RuntimePatchApplyError";
  }
}

function sortedUnique(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

function cloneBoard(board: Board): Board {
  return {
    ...board,
    hexes: { ...board.hexes },
    fleetPlacements: board.fleetPlacements.map((p) => ({ ...p, occupiedHexIds: [...p.occupiedHexIds], revealedHexIds: [...p.revealedHexIds] })),
    structurePlacements: board.structurePlacements.map((p) => ({
      ...p,
      occupiedHexIds: [...p.occupiedHexIds],
      revealedHexIds: [...p.revealedHexIds],
    })),
    generation: { ...board.generation },
    revealedTerrainHexIds: board.revealedTerrainHexIds !== undefined ? [...board.revealedTerrainHexIds] : undefined,
  };
}

function getPlacement(board: Board, p: PlacementPatch): FleetPlacement | StructurePlacement | undefined {
  if (p.placementKind === "fleet") {
    return board.fleetPlacements.find((x) => x.placementId === p.placementId);
  }
  return board.structurePlacements.find((x) => x.placementId === p.placementId);
}

function mergePlacementWithPatch(placement: FleetPlacement | StructurePlacement, p: PlacementPatch): FleetPlacement | StructurePlacement {
  const revealed = new Set(placement.revealedHexIds);
  for (const id of p.newlyRevealedHexIds) {
    revealed.add(id);
  }
  const revealedHexIds = placement.occupiedHexIds.filter((id) => revealed.has(id));
  const currentIntegrity = placement.occupiedHexIds.length - revealedHexIds.length;
  const destroyed = currentIntegrity === 0;
  if (currentIntegrity !== placement.currentIntegrity + p.integrityDelta) {
    throw new RuntimePatchApplyError("applyPatch: integrity projection mismatch", "apply_integrity_mismatch");
  }
  if (destroyed !== p.destroyedTransition.to) {
    throw new RuntimePatchApplyError("applyPatch: destroyed projection mismatch", "apply_destroyed_mismatch");
  }
  if (placement.kind === "fleet") {
    return { ...placement, revealedHexIds, currentIntegrity, destroyed };
  }
  return { ...placement, revealedHexIds, currentIntegrity, destroyed };
}

function applyPlacementToBoard(board: Board, p: PlacementPatch): Board {
  const base = cloneBoard(board);
  const placement = getPlacement(base, p);
  if (!placement) {
    throw new RuntimePatchApplyError("applyPatch: placement not found after clone", "apply_placement_missing");
  }
  const next = mergePlacementWithPatch(placement, p);
  if (p.placementKind === "fleet") {
    return {
      ...base,
      fleetPlacements: base.fleetPlacements.map((fp) => (fp.placementId === p.placementId ? (next as FleetPlacement) : fp)),
    };
  }
  return {
    ...base,
    structurePlacements: base.structurePlacements.map((sp) => (sp.placementId === p.placementId ? (next as StructurePlacement) : sp)),
  };
}

function applyTerrainToBoard(board: Board, patch: RuntimeStatePatch): Board {
  const t = patch.terrainReveal!;
  const base = cloneBoard(board);
  const merged = sortedUnique([...(base.revealedTerrainHexIds ?? []), ...t.newlyRevealedTerrainHexIds]);
  return {
    ...base,
    revealedTerrainHexIds: merged,
  };
}

/**
 * Aplica uma transição runtime descrita pelo patch sobre o board (imutável, fail-fast).
 * Valida estrutura e compatibilidade com o estado atual antes de qualquer mutação lógica.
 */
export function applyPatch(board: Board, patch: RuntimeStatePatch): Board {
  const v = validateRuntimeStatePatch(board, patch);
  if (!v.ok) {
    throw new RuntimePatchApplyError(`applyPatch: invalid patch (${v.reason ?? "unknown"})`, v.reason);
  }
  if (!patch.outcome.processed) {
    return cloneBoard(board);
  }
  if (patch.placementPatch) {
    return applyPlacementToBoard(board, patch.placementPatch);
  }
  if (patch.terrainReveal) {
    return applyTerrainToBoard(board, patch);
  }
  throw new RuntimePatchApplyError("applyPatch: processed patch without applicable payload", "apply_no_payload");
}
