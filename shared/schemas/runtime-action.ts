import type { QuestionValidationResult } from "./question";
import type { RuntimeActionContext } from "./runtime-sequence";
import type { RuntimeStatePatch } from "./runtime-patch";
import type { TargetType } from "./combat";

export type RuntimeActionType = "combat_shot" | "question_answer";

export type RuntimeActionOutcome =
  | {
      readonly kind: "combat";
      readonly processed: boolean;
      readonly hitOccupant: boolean;
      readonly targetKind: TargetType;
      readonly occupantDestroyed: boolean;
      readonly error?: string;
    }
  | {
      readonly kind: "question";
      readonly correct: boolean;
      readonly questionId: string;
      readonly error?: string;
    };

/** Metadados de pontuação (sem sistema de ranking completo). */
export interface RuntimeScoreMetadata {
  readonly partialHitValue?: number;
  readonly destructionBonusValue?: number;
  readonly cognitiveScore?: number;
  readonly tacticalScore?: number;
  readonly bonus?: Readonly<Record<string, number>>;
}

/** Metadados para analytics futuro (sem pipeline). */
export interface RuntimeAnalyticsMetadata {
  readonly responseTimeMs?: number;
  readonly difficulty?: string;
  readonly questionCorrect?: boolean;
  readonly targetType?: TargetType;
  readonly destructionOutcome?: boolean;
  readonly revealProgression?: readonly string[];
}

/**
 * Unidade oficial de replay/sync/audit por ação — não aplica estado no tabuleiro.
 */
export interface RuntimeActionEnvelope {
  readonly actionType: RuntimeActionType;
  readonly runtimeContext: RuntimeActionContext;
  readonly patch?: RuntimeStatePatch;
  readonly actionOutcome: RuntimeActionOutcome;
  readonly score: RuntimeScoreMetadata;
  readonly analytics: RuntimeAnalyticsMetadata;
  readonly questionValidation?: QuestionValidationResult;
  readonly pedagogical?: Readonly<Record<string, string>>;
  readonly tactical?: Readonly<Record<string, string>>;
}
