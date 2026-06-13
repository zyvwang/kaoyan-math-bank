import { ListOrdered, Plus, Trash2 } from "lucide-react";
import { useQuestions, useWorkspaceUi } from "../context/questionBankContexts.js";
import controls from "../styles/controls.module.css";
import styles from "./Overlays.module.css";

export function Overlays() {
  const questions = useQuestions();
  const ui = useWorkspaceUi();
  return (
    <>
      {ui.reorderMenu && (
        <div
          className={styles.contextMenu}
          data-context-menu
          role="menu"
          aria-label="题目操作"
          style={{ left: ui.reorderMenu.x, top: ui.reorderMenu.y }}
        >
          <button role="menuitem" onClick={() => questions.addItem({ type: "insertAfter", afterId: ui.reorderMenu!.id })}>
            <Plus size={16} />在此题后插入
          </button>
          <button role="menuitem" onClick={() => ui.openReorderDialog(ui.reorderMenu!.id)}>
            <ListOrdered size={16} />更改题序至...
          </button>
          <button role="menuitem" className={styles.danger} onClick={() => questions.deleteItem(ui.reorderMenu!.id)}>
            <Trash2 size={16} />删除
          </button>
        </div>
      )}
      {ui.addMenu && (
        <div
          className={styles.contextMenu}
          data-context-menu
          role="menu"
          aria-label="新增题目"
          style={{ left: ui.addMenu.x, top: ui.addMenu.y }}
        >
          {questions.activeItem && (
            <button role="menuitem" onClick={() => questions.addItem({ type: "insertAfter", afterId: questions.activeItem!.id })}>
              <Plus size={16} />在当前题后插入
            </button>
          )}
          <button role="menuitem" onClick={() => questions.addItem({ type: "append" })}>
            <Plus size={16} />追加到末尾
          </button>
        </div>
      )}
      {ui.reorderDialogItem && <ReorderDialog />}
    </>
  );
}

function ReorderDialog() {
  const questions = useQuestions();
  const ui = useWorkspaceUi();
  const item = ui.reorderDialogItem;
  if (!item) return null;
  return (
    <div
      className={styles.modalBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reorder-dialog-title"
      onMouseDown={(event) => { if (event.target === event.currentTarget) ui.closeReorderDialog(); }}
    >
      <form
        className={styles.reorderDialog}
        noValidate
        onSubmit={ui.submitReorder}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            ui.closeReorderDialog();
          }
        }}
      >
        <header>
          <h2 id="reorder-dialog-title">更改题序</h2>
          <span>当前第 {questions.numberById.get(item.id)} 题 / 共 {questions.orderedItems.length} 题</span>
        </header>
        <label>
          <span>目标题序</span>
          <input
            ref={ui.reorderInputRef}
            value={ui.reorderTarget}
            inputMode="numeric"
            onChange={(event) => { ui.setReorderTarget(event.target.value); ui.setReorderError(""); }}
          />
        </label>
        {ui.reorderError && <p className={styles.reorderError}>{ui.reorderError}</p>}
        <footer>
          <button type="button" className={controls.secondaryAction} onClick={ui.closeReorderDialog}>取消</button>
          <button type="submit" className={controls.primaryAction}>确认</button>
        </footer>
      </form>
    </div>
  );
}
