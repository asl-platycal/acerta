/**
 * Arquivo temporário para validação manual da question-engine.
 * Remover após o debug.
 */
import { validateQuestionAnswer } from "./core/engines/question-engine/question-engine";
import type { Question } from "./core/engines/question-engine/types";

const fakeQuestion: Question = {
  id: "debug-fake-1",
  prompt: "Capital do Brasil?",
  correctOptionId: "opt-brasilia",
  options: [
    { id: "opt-rj", label: "Rio de Janeiro", feedbackIfSelected: "Antiga capital." },
    { id: "opt-sp", label: "São Paulo", feedbackIfSelected: "Maior cidade." },
    { id: "opt-brasilia", label: "Brasília", feedbackIfSelected: "Correto." },
  ],
};

const shown = 10_000;
const answered = 12_750;

const result = validateQuestionAnswer(fakeQuestion, {
  selectedOptionId: "opt-brasilia",
  questionShownAtMs: shown,
  answeredAtMs: answered,
});

console.log(result);
// Esperado: correct: true, responseTimeMs: 2750, questionId: debug-fake-1, selectedOptionId: opt-brasilia
