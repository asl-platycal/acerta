import type { Question, QuestionAttemptInput, QuestionValidationResult } from "./types";
import { validateQuestionAttemptInput, validateQuestionForProcessing } from "./validators";

export function calculateResponseTimeMs(
  input: Pick<QuestionAttemptInput, "questionShownAtMs" | "answeredAtMs">,
): number {
  return input.answeredAtMs - input.questionShownAtMs;
}

export function buildQuestionValidationResult(
  question: Question,
  attempt: QuestionAttemptInput,
): QuestionValidationResult {
  const qv = validateQuestionForProcessing(question);
  if (!qv.ok) {
    return {
      correct: false,
      responseTimeMs: 0,
      questionId: question?.id ?? "",
      selectedOptionId: attempt?.selectedOptionId ?? "",
      error: qv.reason,
    };
  }

  const av = validateQuestionAttemptInput(attempt);
  if (!av.ok) {
    return {
      correct: false,
      responseTimeMs: 0,
      questionId: question.id,
      selectedOptionId: attempt.selectedOptionId,
      error: av.reason,
    };
  }

  const responseTimeMs = calculateResponseTimeMs(attempt);
  if (!Number.isFinite(responseTimeMs) || responseTimeMs < 0) {
    return {
      correct: false,
      responseTimeMs: 0,
      questionId: question.id,
      selectedOptionId: attempt.selectedOptionId,
      error: "invalid_response_time",
    };
  }

  const selected = question.options.find((o) => o.id === attempt.selectedOptionId);
  const correct =
    selected !== undefined && attempt.selectedOptionId === question.correctOptionId;

  return {
    correct,
    responseTimeMs,
    difficulty: question.difficulty,
    questionId: question.id,
    selectedOptionId: attempt.selectedOptionId,
    feedback: selected?.feedbackIfSelected,
  };
}

export function validateQuestionAnswer(
  question: Question,
  attempt: QuestionAttemptInput,
): QuestionValidationResult {
  return buildQuestionValidationResult(question, attempt);
}
