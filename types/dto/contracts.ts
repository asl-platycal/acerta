import type {
  Board,
  CombatAttempt,
  QuestionAttemptInput,
  RuntimeSequenceState,
} from "@acerta/shared/schemas";
import type { RuntimeStatePatch } from "@acerta/shared/schemas/runtime-patch";

/** Transporte: submissão de resposta a uma pergunta no contexto de partida. */
export type SubmitAnswerDTO = {
  readonly matchId: string;
  readonly attempt: QuestionAttemptInput;
};

/** Transporte: disparo de combate (sequência/tempo vêm do coordenador no host). */
export type LaunchAttackDTO = {
  readonly matchId: string;
  readonly attempt: CombatAttempt;
  readonly clientClockMs: number;
};

/** Transporte: snapshot espacial + cursores de sequência para reidratação. */
export type MatchSnapshotDTO = {
  readonly matchId: string;
  readonly board: Board;
  readonly lastSequenceNumber: number;
  readonly lastTimestampMs: number;
};

/** Transporte: estado de sequência por jogador (sem lógica de domínio). */
export type PlayerRuntimeStateDTO = {
  readonly playerId: string;
  readonly matchId: string;
  readonly sequence: RuntimeSequenceState;
};

/** Transporte: sincronização incremental de patches runtime. */
export type SyncRuntimePatchDTO = {
  readonly matchId: string;
  readonly patch: RuntimeStatePatch;
};
