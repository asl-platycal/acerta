import type { Board } from "@acerta/shared/schemas";
import type { RuntimeActionEnvelope } from "@acerta/shared/schemas/runtime-action";
import type { RuntimeStatePatch } from "@acerta/shared/schemas/runtime-patch";

/** Frame de replay: envelope canónico + índice monotónico. */
export type RuntimeReplayFrame = {
  readonly frameIndex: number;
  readonly envelope: RuntimeActionEnvelope;
};

/** Sequência determinística de patches (transporte/replay). */
export type RuntimePatchSequence = {
  readonly patches: readonly RuntimeStatePatch[];
};

/** Lote de ações já materializadas como envelopes. */
export type RuntimeActionBatch = {
  readonly actions: readonly RuntimeActionEnvelope[];
};

/** Estado mínimo para sync incremental (composição sobre Board canónico). */
export type RuntimeSyncState = {
  readonly board: Board;
  readonly lastSequenceNumber: number;
  readonly lastTimestampMs: number;
};
