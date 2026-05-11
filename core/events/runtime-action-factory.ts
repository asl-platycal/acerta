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

function assertFiniteNonNegative(name: string, n: number): void {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) {
    throw new RuntimeActionEnvelopeBuildError(`runtime envelope: ${name} must be a finite number >= 0`, "score_field_invalid");
  }
}

/** Consolidação única: campos explícitos de `damage` → metadados de envelope (sem reinterpretar `damage`). */
export function consolidateCombatScoreFromPatch(patch: RuntimeStatePatch): RuntimeScoreMetadata {
  if (!patch.outcome.processed) {
    return {
      partialHitScoreDelta: 0,
      destructionScoreDelta: 0,
      tacticalScoreDelta: 0,
      cognitiveScoreDelta: 0,
      bonusScoreDelta: 0,
      totalScoreDelta: 0,
    };
  }
  if (!patch.outcome.damage) {
    throw new RuntimeActionEnvelopeBuildError(
      "runtime envelope: processed combat patch requires outcome.damage",
      "patch_damage_missing",
    );
  }
  const d = patch.outcome.damage;
  const partialHitScoreDelta = d.partialHitScore;
  const destructionScoreDelta = d.destructionScore;
  const tacticalScoreDelta = d.tacticalBonusScore;
  const bonusScoreDelta = d.navalSinkBombBonusParts;
  const cognitiveScoreDelta = 0;

  assertFiniteNonNegative("partialHitScoreDelta", partialHitScoreDelta);
  assertFiniteNonNegative("destructionScoreDelta", destructionScoreDelta);
  assertFiniteNonNegative("tacticalScoreDelta", tacticalScoreDelta);
  assertFiniteNonNegative("cognitiveScoreDelta", cognitiveScoreDelta);
  assertFiniteNonNegative("bonusScoreDelta", bonusScoreDelta);

  const totalScoreDelta =
    partialHitScoreDelta + destructionScoreDelta + tacticalScoreDelta + cognitiveScoreDelta + bonusScoreDelta;
  if (!Number.isFinite(totalScoreDelta)) {
    throw new RuntimeActionEnvelopeBuildError("runtime envelope: totalScoreDelta invalid", "score_total_invalid");
  }

  return {
    partialHitScoreDelta,
    destructionScoreDelta,
    tacticalScoreDelta,
    cognitiveScoreDelta,
    bonusScoreDelta,
    totalScoreDelta,
  };
}

/**
 * Pontuação cognitiva mínima por resposta (regra local até haver tabela oficial).
 * Demais deltas explicitamente zero.
 */
export function consolidateQuestionScoreFromValidation(questionValidation: QuestionValidationResult): RuntimeScoreMetadata {
  const partialHitScoreDelta = 0;
  const destructionScoreDelta = 0;
  const tacticalScoreDelta = 0;
  const cognitiveScoreDelta = questionValidation.correct ? 1 : 0;
  const bonusScoreDelta = 0;
  const totalScoreDelta =
    partialHitScoreDelta + destructionScoreDelta + tacticalScoreDelta + cognitiveScoreDelta + bonusScoreDelta;
  return {
    partialHitScoreDelta,
    destructionScoreDelta,
    tacticalScoreDelta,
    cognitiveScoreDelta,
    bonusScoreDelta,
    totalScoreDelta,
  };
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
  readonly analytics: RuntimeAnalyticsMetadata;
}): RuntimeActionEnvelope {
  const { runtimeContext, patch, analytics } = input;
  if (!runtimeContext || typeof runtimeContext !== "object") {
    throw new RuntimeActionEnvelopeBuildError("runtime envelope: runtimeContext is required", "missing_context");
  }
  if (!patch || typeof patch !== "object") {
    throw new RuntimeActionEnvelopeBuildError("runtime envelope: patch is required for combat_shot", "missing_patch");
  }
  assertContextMatchesPatch(runtimeContext, patch);
  assertAnalyticsMatchesCombatPatch(patch, analytics);
  const score = consolidateCombatScoreFromPatch(patch);

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
  readonly analytics: RuntimeAnalyticsMetadata;
  readonly patch?: RuntimeStatePatch;
  readonly pedagogical?: Readonly<Record<string, string>>;
  readonly tactical?: Readonly<Record<string, string>>;
}): RuntimeActionEnvelope {
  const { runtimeContext, questionValidation, analytics, patch, pedagogical, tactical } = input;
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

  const score = consolidateQuestionScoreFromValidation(questionValidation);

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
