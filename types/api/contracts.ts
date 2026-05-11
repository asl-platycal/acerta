import type { QuestionValidationResult } from "@acerta/shared/schemas";
import type { RuntimeActionEnvelope } from "@acerta/shared/schemas/runtime-action";
import type { RuntimeStatePatch } from "@acerta/shared/schemas/runtime-patch";
import type { LaunchAttackDTO, SubmitAnswerDTO } from "../dto/contracts";

export type MatchCreateRequest = {
  readonly mode: string;
  readonly locale?: string;
};

export type MatchCreateResponse = {
  readonly matchId: string;
  readonly joinToken?: string;
};

export type SubmitAnswerRequest = {
  readonly matchId: string;
  readonly body: SubmitAnswerDTO;
};

export type SubmitAnswerResponse = {
  readonly ok: boolean;
  readonly envelope?: RuntimeActionEnvelope;
  readonly validation?: QuestionValidationResult;
  readonly errorCode?: string;
};

export type LaunchAttackRequest = {
  readonly matchId: string;
  readonly body: LaunchAttackDTO;
};

export type LaunchAttackResponse = {
  readonly ok: boolean;
  readonly patch?: RuntimeStatePatch;
  readonly errorCode?: string;
};

export type RuntimePatchSyncRequest = {
  readonly matchId: string;
  readonly sinceSequenceNumber: number;
};

export type RuntimePatchSyncResponse = {
  readonly ok: boolean;
  readonly appliedThroughSequence: number;
  readonly patches: readonly RuntimeStatePatch[];
};
