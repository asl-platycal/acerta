import type { RuntimeStatePatch } from "@acerta/shared/schemas/runtime-patch";
import type { LaunchAttackDTO, SubmitAnswerDTO, SyncRuntimePatchDTO } from "../dto/contracts";

/** Envelope genérico cliente→servidor (contrato apenas; sem WebSocket). */
export type WebSocketClientMessage = {
  readonly channel: "client";
  readonly messageId: string;
  readonly payload: WebSocketClientPayload;
};

export type WebSocketClientPayload =
  | { readonly op: "submit_answer"; readonly body: SubmitAnswerDTO }
  | { readonly op: "launch_attack"; readonly body: LaunchAttackDTO }
  | { readonly op: "sync_patch"; readonly body: SyncRuntimePatchDTO };

/** Envelope genérico servidor→cliente (contrato apenas). */
export type WebSocketServerMessage = {
  readonly channel: "server";
  readonly messageId: string;
  readonly payload: WebSocketServerPayload;
};

export type WebSocketServerPayload =
  | { readonly op: "patch_broadcast"; readonly body: SyncRuntimePatchDTO }
  | { readonly op: "ack"; readonly body: { readonly ok: boolean; readonly errorCode?: string } };

/** Pacote de sync incremental (alias semântico para transporte). */
export type RuntimeSyncPacket = {
  readonly matchId: string;
  readonly patches: readonly RuntimeStatePatch[];
};
