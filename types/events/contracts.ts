import type { RuntimeActionEnvelope } from "@acerta/shared/schemas/runtime-action";
import type { RuntimeStatePatch } from "@acerta/shared/schemas/runtime-patch";

export type QuestionAnsweredEvent = {
  readonly kind: "question_answered";
  readonly matchId: string;
  readonly envelope: RuntimeActionEnvelope;
};

export type RuntimePatchAppliedEvent = {
  readonly kind: "runtime_patch_applied";
  readonly matchId: string;
  readonly patch: RuntimeStatePatch;
};

export type RuntimeActionCreatedEvent = {
  readonly kind: "runtime_action_created";
  readonly matchId: string;
  readonly envelope: RuntimeActionEnvelope;
};

export type MatchStartedEvent = {
  readonly kind: "match_started";
  readonly matchId: string;
  readonly startedAtMs: number;
};

export type MatchEndedEvent = {
  readonly kind: "match_ended";
  readonly matchId: string;
  readonly reason: string;
  readonly endedAtMs: number;
};

export type FleetDestroyedEvent = {
  readonly kind: "fleet_destroyed";
  readonly matchId: string;
  readonly patch: RuntimeStatePatch;
};

export type StructureDestroyedEvent = {
  readonly kind: "structure_destroyed";
  readonly matchId: string;
  readonly patch: RuntimeStatePatch;
};
