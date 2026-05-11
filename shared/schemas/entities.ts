/** Domínio de ocupação em célula (alvo colocado). */
export type OccupancyType = "naval" | "land" | "none";

/** Unidade naval colocada — `id` canónico `fleet_unit:<id>`. */
export interface FleetUnit {
  id: string;
  entityTypeName: string;
  hexCoordinateIds: readonly string[];
}

/** Estrutura em terra — `id` canónico `structure:<id>`. */
export interface Structure {
  id: string;
  entityTypeName: string;
  hexCoordinateIds: readonly string[];
}
