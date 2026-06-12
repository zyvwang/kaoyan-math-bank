import { ListOrdered, Plus, Trash2 } from "lucide-react";
import type { QuestionBankController } from "../hooks/useQuestionBankApp.js";

export function Overlays({ app }: { app: QuestionBankController }) {
  return (
    <>
      {app.reorderMenu && (
        <div
          className="contextMenu"
          role="menu"
          aria-label="题目操作"
          style={{ left: app.reorderMenu.x, top: app.reorderMenu.y }}
        >
          <button role="menuitem" type="button" onClick={() => app.addItem({ type: "insertAfter", afterId: app.reorderMenu!.id })}>
            <Plus size={16} />
            在此题后插入
          </button>
          <button role="menuitem" type="button" onClick={() => app.openReorderDialog(app.reorderMenu!.id)}>
            <ListOrdered size={16} />
            更改题序至...
          </button>
          <button role="menuitem" className="danger" type="button" onClick={() => app.deleteItem(app.reorderMenu!.id)}>
            <Trash2 size={16} />
            删除
          </button>
        </div>
      )}

      {app.addMenu && (
        <div
          className="contextMenu"
          role="menu"
          aria-label="新增题目"
          style={{ left: app.addMenu.x, top: app.addMenu.y }}
        >
          {app.activeItem && (
            <button role="menuitem" type="button" onClick={() => app.addItem({ type: "insertAfter", afterId: app.activeItem!.id })}>
              <Plus size={16} />
              在当前题后插入
            </button>
          )}
          <button role="menuitem" type="button" onClick={() => app.addItem({ type: "append" })}>
            <Plus size={16} />
            追加到末尾
          </button>
        </div>
      )}

      {app.reorderDialogItem && <ReorderDialog app={app} />}
    </>
  );
}

function ReorderDialog({ app }: { app: QuestionBankController }) {
  const item = app.reorderDialogItem;
  if (!item) return null;

  return (
    <div
      className="modalBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reorder-dialog-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) app.closeReorderDialog();
      }}
    >
      <form
        className="reorderDialog"
        noValidate
        onSubmit={app.submitReorder}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            app.closeReorderDialog();
          }
        }}
      >
        <header>
          <h2 id="reorder-dialog-title">更改题序</h2>
          <span>
            当前第 {app.numberById.get(item.id)} 题 / 共 {app.orderedItems.length} 题
          </span>
        </header>
        <label>
          <span>目标题序</span>
          <input
            ref={app.reorderInputRef}
            type="text"
            value={app.reorderTarget}
            inputMode="numeric"
            onChange={(event) => {
              app.setReorderTarget(event.target.value);
              app.setReorderError("");
            }}
          />
        </label>
        {app.reorderError && <p className="reorderError">{app.reorderError}</p>}
        <footer>
          <button type="button" className="secondaryAction" onClick={app.closeReorderDialog}>
            取消
          </button>
          <button type="submit" className="primaryAction">
            确认
          </button>
        </footer>
      </form>
    </div>
  );
}
