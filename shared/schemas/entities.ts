/** Domínio de ocupação em célula (referência espacial, não definição de entidade). */
export type OccupancyType = "naval" | "land" | "none";

/** Catálogo de definições — não inclui estado de tabuleiro. */
export interface EntityCatalog {
  fleetUnits: Record<string, FleetUnit>;
  structures: Record<string, Structure>;
}

/**
 * Definição estática de unidade naval.
 * `entityId` canónico: `fleet_unit:<id>`
 */
export interface FleetUnit {
  entityId: string;
  entityType: string;
  category: "naval";
  /** Número de hexes que a unidade ocupa (configuração estática). */
  sizeInHexes?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Definição estática de estrutura em terra.
 * `entityId` canónico: `structure:<id>`
 */
export interface Structure {
  entityId: string;
  entityType: string;
  category: "land";
  sizeInHexes?: number;
  metadata?: Record<string, unknown>;
}
