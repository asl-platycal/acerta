/**
 * @deprecated Reexport — preferir `MatchRuntimeCoordinator` em `@acerta/core/runtime`.
 */
export {
  MatchRuntimeCoordinator,
  advanceRuntimeSequence,
  INITIAL_RUNTIME_SEQUENCE_STATE,
  assertStrictlyIncreasingSequence,
} from "../runtime/match-runtime-coordinator";
export type { RuntimeActionContext, RuntimeSequenceState } from "../runtime/match-runtime-coordinator";
