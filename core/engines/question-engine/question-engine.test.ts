import { describe, expect, it } from "vitest";
import {
  buildQuestionValidationResult,
  calculateResponseTimeMs,
  validateQuestionAnswer,
} from "./question-engine";
import type { Question } from "./types";
import { validateQuestionAttemptInput, validateQuestionForProcessing } from "./validators";

/** Espelha a entrada `DB_MASTER[0]` do protótipo (índice correto `c: 2` → Marte). */
function marsQuestion(): Question {
  return {
    id: "proto-db-0",
    prompt: "Qual o planeta conhecido como o 'Planeta Vermelho'?",
    correctOptionId: "opt-2",
    options: [
      { id: "opt-0", label: "Vênus", feedbackIfSelected: "Incorreto." },
      { id: "opt-1", label: "Júpiter", feedbackIfSelected: "Incorreto." },
      {
        id: "opt-2",
        label: "Marte",
        feedbackIfSelected: "Correto! Marte possui óxido de ferro.",
      },
      { id: "opt-3", label: "Saturno", feedbackIfSelected: "Incorreto." },
      { id: "opt-4", label: "Mercúrio", feedbackIfSelected: "Incorreto." },
    ],
  };
}

describe("question-engine", () => {
  it("resposta correta alinha-se a i === q.c (via correctOptionId)", () => {
    const q = marsQuestion();
    const r = validateQuestionAnswer(q, {
      selectedOptionId: "opt-2",
      questionShownAtMs: 1000,
      answeredAtMs: 2500,
    });
    expect(r.correct).toBe(true);
    expect(r.feedback).toBe("Correto! Marte possui óxido de ferro.");
    expect(r.questionId).toBe("proto-db-0");
    expect(r.selectedOptionId).toBe("opt-2");
    expect(r.error).toBeUndefined();
  });

  it("resposta incorreta preserva feedback da opção escolhida (expls[i])", () => {
    const q = marsQuestion();
    const r = buildQuestionValidationResult(q, {
      selectedOptionId: "opt-0",
      questionShownAtMs: 0,
      answeredAtMs: 100,
    });
    expect(r.correct).toBe(false);
    expect(r.feedback).toBe("Incorreto.");
  });

  it("calculateResponseTimeMs usa apenas timestamps injetados", () => {
    expect(
      calculateResponseTimeMs({ questionShownAtMs: 10, answeredAtMs: 1510 }),
    ).toBe(1500);
  });

  it("payload inválido retorna erro estrutural (sem lançar)", () => {
    const bad = validateQuestionForProcessing({
      id: "x",
      prompt: "p",
      options: [{ id: "a", label: "A" }],
      correctOptionId: "missing",
    });
    expect(bad.ok).toBe(false);
    const badAttempt = validateQuestionAttemptInput({
      selectedOptionId: "a",
      questionShownAtMs: 100,
      answeredAtMs: 50,
    });
    expect(badAttempt.ok).toBe(false);
  });

  it("não altera objetos de entrada (efeitos colaterais)", () => {
    const q = marsQuestion();
    const frozen = Object.freeze(structuredClone(q));
    const attempt = Object.freeze({
      selectedOptionId: "opt-2",
      questionShownAtMs: 1,
      answeredAtMs: 2,
    });
    validateQuestionAnswer(frozen, attempt);
    expect(frozen).toEqual(q);
    expect(attempt).toEqual({
      selectedOptionId: "opt-2",
      questionShownAtMs: 1,
      answeredAtMs: 2,
    });
  });
});
