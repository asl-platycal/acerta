import type { StructuralValidationResult } from "../../events/validators";
import type { Question, QuestionAttemptInput } from "./types";

export function validateQuestionForProcessing(
  question: Question | null | undefined,
): StructuralValidationResult {
  if (!question || typeof question !== "object") {
    return { ok: false, reason: "question_missing" };
  }
  if (typeof question.id !== "string" || question.id.length === 0) {
    return { ok: false, reason: "question_id_invalid" };
  }
  if (typeof question.prompt !== "string") {
    return { ok: false, reason: "question_prompt_invalid" };
  }
  if (!Array.isArray(question.options) || question.options.length === 0) {
    return { ok: false, reason: "question_options_invalid" };
  }
  const ids = new Set<string>();
  for (const opt of question.options) {
    if (!opt || typeof opt.id !== "string" || opt.id.length === 0) {
      return { ok: false, reason: "question_option_id_invalid" };
    }
    if (typeof opt.label !== "string") {
      return { ok: false, reason: "question_option_label_invalid" };
    }
    if (ids.has(opt.id)) {
      return { ok: false, reason: "question_option_id_duplicate" };
    }
    ids.add(opt.id);
  }
  if (typeof question.correctOptionId !== "string" || question.correctOptionId.length === 0) {
    return { ok: false, reason: "question_correct_option_invalid" };
  }
  if (!ids.has(question.correctOptionId)) {
    return { ok: false, reason: "question_correct_option_not_found" };
  }
  return { ok: true };
}

export function validateQuestionAttemptInput(
  attempt: QuestionAttemptInput | null | undefined,
): StructuralValidationResult {
  if (!attempt || typeof attempt !== "object") {
    return { ok: false, reason: "attempt_missing" };
  }
  if (typeof attempt.selectedOptionId !== "string" || attempt.selectedOptionId.length === 0) {
    return { ok: false, reason: "attempt_selected_option_invalid" };
  }
  if (typeof attempt.questionShownAtMs !== "number" || !Number.isFinite(attempt.questionShownAtMs)) {
    return { ok: false, reason: "attempt_shown_at_invalid" };
  }
  if (typeof attempt.answeredAtMs !== "number" || !Number.isFinite(attempt.answeredAtMs)) {
    return { ok: false, reason: "attempt_answered_at_invalid" };
  }
  if (attempt.answeredAtMs < attempt.questionShownAtMs) {
    return { ok: false, reason: "attempt_timestamps_inverted" };
  }
  return { ok: true };
}
