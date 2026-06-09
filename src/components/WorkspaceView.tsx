import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  FileCheck2,
  ListOrdered,
  Plus,
  Save,
  Settings,
  Trash2
} from "lucide-react";
import { STAR_RATINGS } from "../constants.js";
import type { QuestionBankController } from "../hooks/useQuestionBankApp.js";
import type { ExportOrderMode, TexField } from "../../shared/types.js";
import { asStarRating, parseTags, renderStars } from "../utils/form.js";
import { ModuleEditor } from "./ModuleEditor.js";

export function WorkspaceView({ app }: { app: QuestionBankController }) {
  return (
    <section className="workspace">
      <TopBar app={app} />
      {app.activeItem ? <ActiveWorkspace app={app} /> : <EmptyWorkspace app={app} />}
      <ExportDock app={app} />
    </section>
  );
}

function TopBar({ app }: { app: QuestionBankController }) {
  return (
    <header className="topBar">
      <div className="statusCluster">
        <span className={`savePill ${app.saveState}`}>
          {app.saveState === "saving" ? <Save size={15} /> : app.saveState === "error" ? <AlertTriangle size={15} /> : <Check size={15} />}
          {app.saveState === "saving" ? "保存中" : app.saveState === "error" ? "保存失败" : "已保存"}
        </span>
        {app.notice && (
          <a className={`notice ${app.notice.type}`} href={app.notice.href} target="_blank" rel="noreferrer">
            {app.notice.type === "error" ? <AlertTriangle size={15} /> : <Check size={15} />}
            <span>{app.notice.text}</span>
          </a>
        )}
      </div>
      <div className="toolbar">
        <button className="iconButton" onClick={() => app.moveActive(-1)} title="上移">
          <ArrowUp size={18} />
        </button>
        <button className="iconButton" onClick={() => app.moveActive(1)} title="下移">
          <ArrowDown size={18} />
        </button>
        <button
          className="iconButton"
          onClick={() => app.activeItem && app.openReorderDialog(app.activeItem.id)}
          disabled={!app.activeItem}
          title="更改题序"
        >
          <ListOrdered size={18} />
        </button>
        <button className="iconButton danger" onClick={app.deleteActiveItem} title="删除题目">
          <Trash2 size={18} />
        </button>
      </div>
    </header>
  );
}

function ActiveWorkspace({ app }: { app: QuestionBankController }) {
  const activeItem = app.activeItem;
  const bank = app.bank;
  if (!activeItem || !bank) return null;

  return (
    <>
      <section className="metaStrip">
        <label>
          <span>原编号</span>
          <input
            value={activeItem.sourceNumber ?? ""}
            onChange={(event) => app.updateItem(activeItem.id, { sourceNumber: event.target.value })}
          />
        </label>
        <label>
          <span>章节</span>
          <input
            value={activeItem.chapter}
            onChange={(event) => app.updateItem(activeItem.id, { chapter: event.target.value })}
            placeholder="高等数学/一元函数微分学"
          />
        </label>
        <label>
          <span>标签</span>
          <input
            value={activeItem.tags.join(", ")}
            onChange={(event) => app.updateItem(activeItem.id, { tags: parseTags(event.target.value) })}
            placeholder="极限, 洛必达"
          />
        </label>
        <label>
          <span>星级</span>
          <select
            value={activeItem.star}
            onChange={(event) => app.updateItem(activeItem.id, { star: asStarRating(event.target.value) })}
          >
            {STAR_RATINGS.map((rating) => (
              <option key={rating} value={rating}>
                {renderStars(rating)} {rating}星
              </option>
            ))}
          </select>
        </label>
      </section>

      <details className="settingsBand">
        <summary>
          <Settings size={16} />
          全局 LaTeX
        </summary>
        <div className="settingsGrid">
          <label>
            <span>题间距</span>
            <input
              value={bank.settings.spacing.item}
              onChange={(event) =>
                app.updateBank((current) => ({
                  ...current,
                  settings: {
                    ...current.settings,
                    spacing: { ...current.settings.spacing, item: event.target.value }
                  }
                }))
              }
            />
          </label>
          <label>
            <span>模块间距</span>
            <input
              value={bank.settings.spacing.module}
              onChange={(event) =>
                app.updateBank((current) => ({
                  ...current,
                  settings: {
                    ...current.settings,
                    spacing: { ...current.settings.spacing, module: event.target.value }
                  }
                }))
              }
            />
          </label>
          <label className="preambleField">
            <span>导言区</span>
            <textarea
              value={bank.settings.preamble}
              onChange={(event) =>
                app.updateBank((current) => ({
                  ...current,
                  settings: { ...current.settings, preamble: event.target.value }
                }))
              }
              spellCheck={false}
            />
          </label>
          <label className="texPathField">
            <span>latexmk 路径</span>
            <input
              value={app.texPathDraft}
              onChange={(event) => app.setTexPathDraft(event.target.value)}
              onBlur={() => void app.saveTexPathOverride()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              placeholder="留空自动检测"
            />
          </label>
        </div>
      </details>

      <section className="moduleStack">
        {(["questionTex", "solutionTex", "noteTex"] as TexField[]).map((field) => (
          <ModuleEditor
            key={field}
            field={field}
            value={activeItem[field]}
            item={activeItem}
            onChange={(value) => app.updateItem(activeItem.id, { [field]: value })}
            onUpload={(file) => app.uploadAsset(field, file)}
          />
        ))}
      </section>
    </>
  );
}

function EmptyWorkspace({ app }: { app: QuestionBankController }) {
  return (
    <section className="emptyState">
      <p>暂无题目</p>
      <button onClick={() => app.addItem({ type: "append" })}>
        <Plus size={16} />
        新增题目
      </button>
    </section>
  );
}

function ExportDock({ app }: { app: QuestionBankController }) {
  return (
    <footer className="exportDock">
      <div className="compileBlock">
        <button onClick={() => void app.compileCurrentItem()} disabled={!app.activeItem || app.isCompiling}>
          <FileCheck2 size={17} />
          {app.isCompiling ? "编译中" : "检查当前题"}
        </button>
        {app.compileResult && !app.compileResult.ok && <pre className="logBox">{app.compileResult.log}</pre>}
      </div>
      <div className="exportBlock">
        <label className="exportNameField">
          <span>导出名</span>
          <input value={app.exportName} onChange={(event) => app.setExportName(event.target.value)} />
        </label>
        <label className="exportOrderField">
          <span>顺序</span>
          <select
            value={app.exportOrderMode}
            onChange={(event) => app.setExportOrderMode(event.target.value as ExportOrderMode)}
          >
            <option value="normal">正常顺序</option>
            <option value="random">随机顺序</option>
          </select>
        </label>
        {app.exportOrderMode === "random" && (
          <label className="exportSeedField">
            <span>种子</span>
            <input
              value={app.randomSeed}
              onChange={(event) => app.setRandomSeed(event.target.value)}
              placeholder="留空则使用导出名"
            />
          </label>
        )}
        <button className="primaryAction" onClick={() => void app.exportSelected()} disabled={app.selectedIds.size === 0 || app.isExporting}>
          <Download size={17} />
          {app.isExporting ? "导出中" : `导出 ${app.selectedIds.size} 题`}
        </button>
      </div>
    </footer>
  );
}
