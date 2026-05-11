export type DifficultyLevel = "SIMPLES" | "COMPLICADA" | "DIFICIL";

export interface QuestionOption {
  id: string;
  label: string;
  /** Texto de feedback ao selecionar esta opção (protótipo: `expls[i]`). */
  feedbackIfSelected?: string;
}

export interface Question {
  id: string;
  prompt: string;
  options: QuestionOption[];
  correctOptionId: string;
  difficulty?: DifficultyLevel;
}

export interface QuestionAttemptInput {
  selectedOptionId: string;
  questionShownAtMs: number;
  answeredAtMs: number;
}

export interface QuestionValidationResult {
  correct: boolean;
  responseTimeMs: number;
  difficulty?: DifficultyLevel;
  questionId: string;
  selectedOptionId: string;
  feedback?: string;
  error?: string;
}
