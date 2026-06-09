import type { ExportOrderMode, ModuleKind } from "../../shared/types.js";
import type { DropPosition } from "../itemOrder.js";

export type SaveState = "idle" | "saving" | "saved" | "error";
export type Notice = { type: "ok" | "error" | "info"; text: string; href?: string };
export type ReorderMenu = { id: string; x: number; y: number };
export type AddMenu = { x: number; y: number };
export type AddMode = { type: "append" } | { type: "insertAfter"; afterId: string };
export type ExportSettings = {
  exportName: string;
  exportOrderMode: ExportOrderMode;
  randomSeed: string;
};
export type ModuleUpload = (kind: ModuleKind, file: File) => Promise<void>;
export type DropTarget = { id: string; position: DropPosition };
