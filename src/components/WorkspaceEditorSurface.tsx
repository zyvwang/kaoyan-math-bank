import { Eye } from "lucide-react";
import type { KeyboardEvent } from "react";
import { MODULE_KINDS, moduleLabels } from "../constants.js";
import {
  useCompileExport,
  useQuestions,
  useWorkspaceUi
} from "../context/questionBankContexts.js";
import type { ModuleKind } from "../../shared/types.js";
import controls from "../styles/controls.module.css";
import { LatexPreview } from "./LatexPreview.js";
import { ModuleEditor } from "./ModuleEditor.js";
import styles from "./WorkspaceView.module.css";

export function WorkspaceEditorSurface() {
  const questions = useQuestions();
  const compileExport = useCompileExport();
  const ui = useWorkspaceUi();
  const item = questions.activeItem;
  if (!item) return null;

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, kind: ModuleKind) {
    const index = MODULE_KINDS.indexOf(kind);
    const nextIndex =
      event.key === "ArrowRight" ? (index + 1) % MODULE_KINDS.length :
      event.key === "ArrowLeft" ? (index - 1 + MODULE_KINDS.length) % MODULE_KINDS.length :
      event.key === "Home" ? 0 : event.key === "End" ? MODULE_KINDS.length - 1 : -1;
    if (nextIndex === -1) return;
    event.preventDefault();
    ui.setActiveModule(MODULE_KINDS[nextIndex]);
    document.getElementById(`module-tab-${MODULE_KINDS[nextIndex]}`)?.focus();
  }

  return (
    <section className={styles.editorSurface}>
      <header className={styles.editorHeader}>
        <div className={styles.moduleTabs} role="tablist" aria-label="题目模块">
          {MODULE_KINDS.map((kind) => (
            <button
              id={`module-tab-${kind}`}
              key={kind}
              role="tab"
              aria-selected={ui.editorMode === "focus" && ui.activeModule === kind}
              aria-controls={`module-panel-${kind}`}
              tabIndex={ui.editorMode === "focus" && ui.activeModule === kind ? 0 : -1}
              className={ui.editorMode === "focus" && ui.activeModule === kind ? styles.activeTab : ""}
              onClick={() => { ui.setActiveModule(kind); ui.setEditorMode("focus"); }}
              onKeyDown={(event) => handleTabKey(event, kind)}
            >
              <span>{moduleLabels[kind]}</span>
              <small>{item.modules[kind].tex.trim() ? "已填写" : "空"}</small>
            </button>
          ))}
        </div>
        <button
          className={`${controls.secondaryAction} ${ui.editorMode === "overview" ? styles.overviewActive : ""}`}
          onClick={() => ui.setEditorMode(ui.editorMode === "overview" ? "focus" : "overview")}
          aria-pressed={ui.editorMode === "overview"}
        >
          <Eye size={16} />总览
        </button>
      </header>
      {ui.editorMode === "focus" ? (
        <ModuleEditor
          kind={ui.activeModule}
          value={item.modules[ui.activeModule].tex}
          item={item}
          onChange={(value) => questions.updateItem(item.id, {
            modules: {
              ...item.modules,
              [ui.activeModule]: { ...item.modules[ui.activeModule], tex: value }
            }
          })}
          onUpload={(file) => compileExport.uploadAsset(ui.activeModule, file)}
        />
      ) : (
        <div className={styles.overviewGrid} aria-label="模块总览">
          {MODULE_KINDS.map((kind) => (
            <article key={kind} className={styles.overviewSection}>
              <header>
                <div><span>第 {questions.numberById.get(item.id)} 题</span><h2>{moduleLabels[kind]}</h2></div>
                <button onClick={() => { ui.setActiveModule(kind); ui.setEditorMode("focus"); }}>编辑</button>
              </header>
              <LatexPreview tex={item.modules[kind].tex} assets={item.assets} compact />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
