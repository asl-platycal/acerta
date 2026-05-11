import type { QuestionValidationResult } from "@acerta/shared/schemas";
import type {
  RuntimeActionEnvelope,
  RuntimeActionOutcome,
  RuntimeAnalyticsMetadata,
  RuntimeScoreMetadata,
} from "@acerta/shared/schemas/runtime-action";
import type { RuntimeActionContext } from "@acerta/shared/schemas/runtime-sequence";
import type { RuntimeStatePatch } from "@acerta/shared/schemas/runtime-patch";

export class RuntimeActionEnvelopeBuildError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "RuntimeActionEnvelopeBuildError";
  }
}

function assertContextMatchesPatch(context: RuntimeActionContext, patch: RuntimeStatePatch): void {
  if (patch.sequenceNumber !== context.sequenceNumber) {
    throw new RuntimeActionEnvelopeBuildError(
      "runtime envelope: patch.sequenceNumber must equal runtimeContext.sequenceNumber",
      "context_sequence_mismatch",
    );
  }
  if (patch.timestamp !== context.timestamp) {
    throw new RuntimeActionEnvelopeBuildError(
      "runtime envelope: patch.timestamp must equal runtimeContext.timestamp",
      "context_timestamp_mismatch",
    );
  }
}

function assertScoreMatchesCombatPatch(patch: RuntimeStatePatch, score: RuntimeScoreMetadata): void {
  const d = patch.outcome.damage;
  if (d !== undefined) {
    if (score.partialHitValue !== d.partialHitValue) {
      throw new RuntimeActionEnvelopeBuildError(
        "runtime envelope: score.partialHitValue must match patch.outcome.damage",
        "score_partial_mismatch",
      );
    }
    if (score.destructionBonusValue !== d.destructionBonusValue) {
      throw new RuntimeActionEnvelopeBuildError(
        "runtime envelope: score.destructionBonusValue must match patch.outcome.damage",
        "score_destruction_mismatch",
      );
    }
  } else if (score.partialHitValue !== undefined || score.destructionBonusValue !== undefined) {
    throw new RuntimeActionEnvelopeBuildError(
      "runtime envelope: score must not set hit/destruction points when patch has no damage",
      "score_unexpected_damage_fields",
    );
  }
}

function assertAnalyticsMatchesCombatPatch(patch: RuntimeStatePatch, analytics: RuntimeAnalyticsMetadata): void {
  if (analytics.targetType === undefined) {
    throw new RuntimeActionEnvelopeBuildError(
      "runtime envelope: analytics.targetType is required for combat_shot",
      "analytics_target_required",
    );
  }
  if (analytics.targetType !== patch.outcome.targetKind) {
    throw new RuntimeActionEnvelopeBuildError(
      "runtime envelope: analytics.targetType must match patch.outcome.targetKind",
      "analytics_target_mismatch",
    );
  }
  if (analytics.destructionOutcome !== undefined && analytics.destructionOutcome !== patch.outcome.occupantDestroyed) {
    throw new RuntimeActionEnvelopeBuildError(
      "runtime envelope: analytics.destructionOutcome must match patch.outcome.occupantDestroyed when set",
      "analytics_destruction_mismatch",
    );
  }
}

export function buildCombatRuntimeActionEnvelope(input: {
  readonly runtimeContext: RuntimeActionContext;
  readonly patch: RuntimeStatePatch;
  readonly score: RuntimeScoreMetadata;
  readonly analytics: RuntimeAnalyticsMetadata;
}): RuntimeActionEnvelope {
  const { runtimeContext, patch, score, analytics } = input;
  if (!runtimeContext || typeof runtimeContext !== "object") {
    throw new RuntimeActionEnvelopeBuildError("runtime envelope: runtimeContext is required", "missing_context");
  }
  if (!patch || typeof patch !== "object") {
    throw new RuntimeActionEnvelopeBuildError("runtime envelope: patch is required for combat_shot", "missing_patch");
  }
  assertContextMatchesPatch(runtimeContext, patch);
  assertScoreMatchesCombatPatch(patch, score);
  assertAnalyticsMatchesCombatPatch(patch, analytics);

  const actionOutcome: RuntimeActionOutcome = {
    kind: "combat",
    processed: patch.outcome.processed,
    hitOccupant: patch.outcome.hitOccupant,
    targetKind: patch.outcome.targetKind,
    occupantDestroyed: patch.outcome.occupantDestroyed,
    error: patch.outcome.error,
  };

  return {
    actionType: "combat_shot",
    runtimeContext,
    patch,
    actionOutcome,
    score,
    analytics,
  };
}

export function buildQuestionRuntimeActionEnvelope(input: {
  readonly runtimeContext: RuntimeActionContext;
  readonly questionValidation: QuestionValidationResult;
  readonly score: RuntimeScoreMetadata;
  readonly analytics: RuntimeAnalyticsMetadata;
  readonly patch?: RuntimeStatePatch;
  readonly pedagogical?: Readonly<Record<string, string>>;
  readonly tactical?: Readonly<Record<string, string>>;
}): RuntimeActionEnvelope {
  const { runtimeContext, questionValidation, score, analytics, patch, pedagogical, tactical } = input;
  if (!runtimeContext || typeof runtimeContext !== "object") {
    throw new RuntimeActionEnvelopeBuildError("runtime envelope: runtimeContext is required", "missing_context");
  }
  if (!questionValidation || typeof questionValidation !== "object") {
    throw new RuntimeActionEnvelopeBuildError(
      "runtime envelope: questionValidation is required for question_answer",
      "missing_question_validation",
    );
  }
  if (typeof questionValidation.questionId !== "string" || questionValidation.questionId.length === 0) {
    throw new RuntimeActionEnvelopeBuildError("runtime envelope: questionValidation.questionId invalid", "question_id_invalid");
  }
  if (patch) {
    assertContextMatchesPatch(runtimeContext, patch);
  }
  if (analytics.questionCorrect !== undefined && analytics.questionCorrect !== questionValidation.correct) {
    throw new RuntimeActionEnvelopeBuildError(
      "runtime envelope: analytics.questionCorrect must match questionValidation.correct when set",
      "analytics_question_mismatch",
    );
  }
  if (analytics.responseTimeMs !== undefined && analytics.responseTimeMs !== questionValidation.responseTimeMs) {
    throw new RuntimeActionEnvelopeBuildError(
      "runtime envelope: analytics.responseTimeMs must match questionValidation.responseTimeMs when set",
      "analytics_response_time_mismatch",
    );
  }

  const actionOutcome: RuntimeActionOutcome = {
    kind: "question",
    correct: questionValidation.correct,
    questionId: questionValidation.questionId,
    error: questionValidation.error,
  };

  return {
    actionType: "question_answer",
    runtimeContext,
    patch,
    actionOutcome,
    score,
    analytics,
    questionValidation,
    pedagogical,
    tactical,
  };
}
