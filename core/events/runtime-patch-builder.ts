import type { Board, FleetPlacement, StructurePlacement } from "@acerta/shared/schemas";
import type {
  PlacementPatch,
  PlacementRuntimePatchType,
  TerrainRevealPatch,
} from "@acerta/shared/schemas/runtime-patch";

function sortedUnique(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

/**
 * Constrói o delta de placement entre dois snapshots locais (pré/pós revelação).
 */
export function buildPlacementPatchBetween(
  previous: FleetPlacement | StructurePlacement,
  updated: FleetPlacement | StructurePlacement,
): PlacementPatch | undefined {
  if (previous.placementId !== updated.placementId) {
    return undefined;
  }
  const prevSet = new Set(previous.revealedHexIds);
  const newlyRevealedHexIds = sortedUnique(updated.revealedHexIds.filter((id) => !prevSet.has(id)));
  const integrityDelta = updated.currentIntegrity - previous.currentIntegrity;
  const destroyedTransition = { from: previous.destroyed, to: updated.destroyed } as const;
  const unchanged =
    newlyRevealedHexIds.length === 0 &&
    integrityDelta === 0 &&
    destroyedTransition.from === destroyedTransition.to;
  if (unchanged) {
    return undefined;
  }
  let patchType: PlacementRuntimePatchType;
  if (destroyedTransition.to && !destroyedTransition.from) {
    patchType = "destruction";
  } else if (integrityDelta !== 0) {
    patchType = "integrity_update";
  } else {
    patchType = "placement_update";
  }
  return {
    patchType,
    placementId: previous.placementId,
    placementKind: previous.kind === "fleet" ? "fleet" : "structure",
    newlyRevealedHexIds,
    integrityDelta,
    destroyedTransition,
  };
}

/** Terreno revelado neste disparo (delta em relação a `board.revealedTerrainHexIds`). */
export function buildTerrainRevealPatchForHex(board: Board, hexId: string): TerrainRevealPatch | undefined {
  const set = new Set(board.revealedTerrainHexIds ?? []);
  if (set.has(hexId)) {
    return undefined;
  }
  return {
    patchType: "terrain_reveal",
    newlyRevealedTerrainHexIds: sortedUnique([hexId]),
  };
}
