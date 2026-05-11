/**
 * Estado de sequência por partida — valor puro passado entre ações (sem singleton).
 * O avanço é feito apenas por `advanceRuntimeSequence` em `MatchRuntimeCoordinator`.
 */
export interface RuntimeSequenceState {
  readonly lastSequenceNumber: number;
  readonly lastTimestamp: number;
}

/** Contexto oficial de uma ação: proibido gerar estes campos nas engines. */
export interface RuntimeActionContext {
  readonly sequenceNumber: number;
  readonly timestamp: number;
}

export const INITIAL_RUNTIME_SEQUENCE_STATE: RuntimeSequenceState = {
  lastSequenceNumber: -1,
  lastTimestamp: 0,
};
