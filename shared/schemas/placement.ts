/** Base comum a colocações — `id` com prefixo `fleet_unit:` ou `structure:`. */
export interface Placement {
  id: string;
  entityTypeName: string;
  hexCoordinateIds: readonly string[];
}

export interface FleetPlacement extends Placement {
  kind: "fleet";
}

export interface StructurePlacement extends Placement {
  kind: "structure";
}

export interface PlacementValidationResult {
  ok: boolean;
  reason?: string;
}
