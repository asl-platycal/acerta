import { describe, expect, it } from "vitest";
import type { MatchCreateRequest, RuntimePatchAppliedEvent, SubmitAnswerDTO } from "@acerta/types";

describe("@acerta/types contracts", () => {
  it("DTOs e eventos são round-trip JSON (sem Map/Set/Date)", () => {
    const dto: SubmitAnswerDTO = {
      matchId: "m1",
      attempt: {
        selectedOptionId: "opt-a",
        questionShownAtMs: 1,
        answeredAtMs: 2,
      },
    };
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);

    const evt: RuntimePatchAppliedEvent = {
      kind: "runtime_patch_applied",
      matchId: "m1",
      patch: {
        sequenceNumber: 0,
        timestamp: 0,
        targetHexId: "hex:0:0",
        outcome: {
          processed: true,
          terrain: "water",
          hitOccupant: false,
          targetKind: "none",
          occupantDestroyed: false,
          damage: {
            partialHitScore: 0,
            destructionScore: 0,
            tacticalBonusScore: 0,
            navalSinkBombBonusParts: 0,
          },
        },
        terrainReveal: { patchType: "terrain_reveal", newlyRevealedTerrainHexIds: ["hex:0:0"] },
      },
    };
    expect(JSON.parse(JSON.stringify(evt))).toEqual(evt);

    const api: MatchCreateRequest = { mode: "solo", locale: "pt-BR" };
    expect(JSON.parse(JSON.stringify(api))).toEqual(api);
  });
});
