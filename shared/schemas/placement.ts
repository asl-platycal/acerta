/**
 * Instância posicionada — estado espacial / runtime.
 * `placementId` canónico: `fleet_placement:<id>` ou `structure_placement:<id>`
 */
export interface FleetPlacement {
  kind: "fleet";
  placementId: string;
  /** Referência à definição — `fleet_unit:<id>` */
  entityId: string;
  boardId?: string;
  occupiedHexIds: readonly string[];
  revealedHexIds: readonly string[];
  destroyed: boolean;
  currentIntegrity: number;
}

export interface StructurePlacement {
  kind: "structure";
  placementId: string;
  /** Referência à definição — `structure:<id>` */
  entityId: string;
  boardId?: string;
  occupiedHexIds: readonly string[];
  revealedHexIds: readonly string[];
  destroyed: boolean;
  currentIntegrity: number;
}

export type BoardPlacement = FleetPlacement | StructurePlacement;

export interface PlacementValidationResult {
  ok: boolean;
  reason?: string;
}
