import { useState } from "react";
import {
  compileItem,
  exportItems,
  uploadQuestionAsset
} from "../api/client.js";
import type {
  Bank,
  CompileResponse,
  ExportOrderMode,
  ExportResponse,
  ModuleKind,
  QuestionItem
} from "../../shared/types.js";
import type { Notice } from "./controllerTypes.js";

interface CompileExportOptions {
  activeItem: QuestionItem | null;
  bank: Bank | null;
  selectedIds: Set<string>;
  persistBank: (bank: Bank) => Promise<void>;
  setNotice: (notice: Notice | null) => void;
  updateItem: (id: string, patch: Partial<QuestionItem>) => void;
}

export function useCompileExportActions({
  activeItem,
  bank,
  selectedIds,
  persistBank,
  setNotice,
  updateItem
}: CompileExportOptions) {
  const [exportName, setExportName] = useState(`math-${new Date().toISOString().slice(0, 10)}`);
  const [exportOrderMode, setExportOrderMode] = useState<ExportOrderMode>("normal");
  const [randomSeed, setRandomSeed] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileResult, setCompileResult] = useState<CompileResponse | null>(null);

  async function uploadAsset(kind: ModuleKind, file: File) {
    if (!activeItem) return;
    const { patch } = await uploadQuestionAsset(kind, activeItem, file);
    updateItem(activeItem.id, patch);
    setNotice({ type: "ok", text: "图片已插入当前模块。" });
  }

  async function compileCurrentItem() {
    if (!activeItem || !bank) return;
    setIsCompiling(true);
    setCompileResult(null);
    setNotice({ type: "info", text: "正在编译当前题。" });
    try {
      const data = await compileItem(activeItem, bank.settings);
      setCompileResult(data);
      if (!data.ok) {
        setNotice({ type: "error", text: "当前题编译失败，查看日志摘要。" });
        return;
      }
      setNotice({ type: "ok", text: "当前题编译通过。", href: data.pdfUrl });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "当前题编译失败。" });
    } finally {
      setIsCompiling(false);
    }
  }

  async function exportSelected() {
    if (!bank) return;
    if (selectedIds.size === 0) {
      setNotice({ type: "error", text: "请至少勾选一道题目。" });
      return;
    }
    setIsExporting(true);
    setNotice({ type: "info", text: "正在导出四份文件。" });
    try {
      await persistBank(bank);
      const effectiveRandomSeed = exportOrderMode === "random" ? randomSeed.trim() || exportName : undefined;
      const data = (await exportItems({
        itemIds: [...selectedIds],
        fileName: exportName,
        orderMode: exportOrderMode,
        randomSeed: effectiveRandomSeed
      })) as ExportResponse & { error?: string };
      if (!data.ok) {
        const failedResult = data.results?.questions.ok ? data.results.full : data.results?.questions;
        setNotice({
          type: "error",
          text: data.error ?? "导出失败，查看编译日志摘要。",
          href: failedResult?.texUrl
        });
        setCompileResult(failedResult ?? null);
        return;
      }
      setNotice({ type: "ok", text: `导出完成：${data.files.join("、")}`, href: data.exportUrl });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "导出失败。" });
    } finally {
      setIsExporting(false);
    }
  }

  return {
    exportName,
    exportOrderMode,
    randomSeed,
    isExporting,
    isCompiling,
    compileResult,
    setExportName,
    setExportOrderMode,
    setRandomSeed,
    setCompileResult,
    uploadAsset,
    compileCurrentItem,
    exportSelected
  };
}
