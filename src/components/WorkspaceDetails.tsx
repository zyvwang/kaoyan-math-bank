import { Settings } from "lucide-react";
import { STAR_RATINGS } from "../constants.js";
import { useQuestions, useWorkspace } from "../context/questionBankContexts.js";
import { asStarRating, parseTags, renderStars } from "../utils/form.js";
import styles from "./WorkspaceView.module.css";

export function WorkspaceDetails() {
  return (
    <>
      <MetadataStrip />
      <GlobalSettings />
    </>
  );
}

function MetadataStrip() {
  const { activeItem, updateItem } = useQuestions();
  if (!activeItem) return null;
  return (
    <section className={styles.metaStrip} aria-label="题目元数据">
      <label>
        <span>原编号</span>
        <input
          value={activeItem.sourceNumber ?? ""}
          onChange={(event) => updateItem(activeItem.id, { sourceNumber: event.target.value })}
        />
      </label>
      <label>
        <span>章节</span>
        <input
          value={activeItem.chapter}
          onChange={(event) => updateItem(activeItem.id, { chapter: event.target.value })}
          placeholder="高等数学/一元函数微分学"
        />
      </label>
      <label>
        <span>标签</span>
        <input
          value={activeItem.tags.join(", ")}
          onChange={(event) => updateItem(activeItem.id, { tags: parseTags(event.target.value) })}
          placeholder="极限, 洛必达"
        />
      </label>
      <label>
        <span>星级</span>
        <select
          value={activeItem.star}
          onChange={(event) => updateItem(activeItem.id, { star: asStarRating(event.target.value) })}
        >
          {STAR_RATINGS.map((rating) => (
            <option key={rating} value={rating}>{renderStars(rating)} {rating}星</option>
          ))}
        </select>
      </label>
    </section>
  );
}

function GlobalSettings() {
  const questions = useQuestions();
  const workspace = useWorkspace();
  if (!questions.bank) return null;
  return (
    <details className={styles.settingsBand}>
      <summary><Settings size={16} />全局 LaTeX</summary>
      <div className={styles.settingsGrid}>
        <label>
          <span>题间距</span>
          <input
            value={questions.bank.settings.spacing.item}
            onChange={(event) => questions.updateBank((current) => ({
              ...current,
              settings: {
                ...current.settings,
                spacing: { ...current.settings.spacing, item: event.target.value }
              }
            }))}
          />
        </label>
        <label>
          <span>模块间距</span>
          <input
            value={questions.bank.settings.spacing.module}
            onChange={(event) => questions.updateBank((current) => ({
              ...current,
              settings: {
                ...current.settings,
                spacing: { ...current.settings.spacing, module: event.target.value }
              }
            }))}
          />
        </label>
        <label className={styles.preambleField}>
          <span>导言区</span>
          <textarea
            value={questions.bank.settings.preamble}
            onChange={(event) => questions.updateBank((current) => ({
              ...current,
              settings: { ...current.settings, preamble: event.target.value }
            }))}
            spellCheck={false}
          />
        </label>
        <label className={styles.texPathField}>
          <span>latexmk 路径</span>
          <input
            value={workspace.texPathDraft}
            onChange={(event) => workspace.setTexPathDraft(event.target.value)}
            onBlur={() => void workspace.saveTexPathOverride()}
            onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
            placeholder="留空自动检测"
          />
        </label>
      </div>
    </details>
  );
}
