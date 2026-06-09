import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckSquare,
  ExternalLink,
  FileCheck2,
  FolderInput,
  FolderOpen,
  FolderPlus,
  GripVertical,
  Plus,
  Search,
  Square,
  Star,
  Tags,
  Trash2
} from "lucide-react";
import { STAR_RATINGS } from "../constants.js";
import type { QuestionBankController } from "../hooks/useQuestionBankApp.js";
import { renderStars } from "../utils/form.js";

export function Sidebar({ app }: { app: QuestionBankController }) {
  return (
    <aside className="sidebar">
      <header className="brandBar">
        <div>
          <h1>Kaoyan Math Bank</h1>
          <p>{app.orderedItems.length} 题 · 已选 {app.selectedIds.size}</p>
        </div>
        <button className="iconButton primary" onClick={app.openAddMenu} title="新增题目">
          <Plus size={18} />
        </button>
      </header>

      <WorkspacePanel app={app} />
      <FilterPanel app={app} />
      <QuestionList app={app} />
    </aside>
  );
}

function WorkspacePanel({ app }: { app: QuestionBankController }) {
  const appInfo = app.appInfo;
  if (!appInfo) return null;

  return (
    <section className="workspacePanel">
      <div className="workspaceTitle">
        <span>工作区</span>
        <strong title={appInfo.currentWorkspacePath}>{appInfo.currentWorkspaceName}</strong>
      </div>
      <div className="workspaceActions">
        <button
          className="workspaceActionButton"
          onClick={() => void app.createNewWorkspace()}
          disabled={app.isChangingWorkspace}
          title="新建空工作区"
        >
          <FolderPlus size={16} />
          新建
        </button>
        <button
          className="workspaceActionButton"
          onClick={() => void app.openWorkspace()}
          disabled={app.isChangingWorkspace}
          title="打开已有工作区"
        >
          <FolderInput size={16} />
          打开
        </button>
        <button
          className="workspaceActionButton"
          onClick={app.openCurrentWorkspaceFolder}
        disabled={!appInfo.currentWorkspacePath}
          title="在 Finder 或文件管理器中显示当前工作区"
        >
          <ExternalLink size={16} />
          显示
        </button>
      </div>
      <div className="workspaceList">
        {appInfo.recentWorkspaces.map((workspace, index) => (
          <div
            className={[
              "workspaceListItem",
              workspace.path === appInfo.currentWorkspacePath ? "active" : "",
              workspace.exists ? "" : "missing"
            ]
              .filter(Boolean)
              .join(" ")}
            key={workspace.path}
          >
            <button
              className="workspaceListMain"
              type="button"
              onClick={() => void app.switchToWorkspace(workspace.path)}
              disabled={app.isChangingWorkspace || workspace.path === appInfo.currentWorkspacePath}
              title={workspace.path}
            >
              <strong>{workspace.name}</strong>
              <small>{workspace.exists ? "本地工作区" : "路径缺失"}</small>
            </button>
            <div className="workspaceListControls">
              <button
                className="miniIconButton"
                type="button"
                onClick={() => void app.moveWorkspaceInList(workspace.path, "up")}
                disabled={index === 0 || app.isChangingWorkspace}
                title="上移工作区"
              >
                <ArrowUp size={14} />
              </button>
              <button
                className="miniIconButton"
                type="button"
                onClick={() => void app.moveWorkspaceInList(workspace.path, "down")}
                disabled={index === appInfo.recentWorkspaces.length - 1 || app.isChangingWorkspace}
                title="下移工作区"
              >
                <ArrowDown size={14} />
              </button>
              <button
                className="miniIconButton danger"
                type="button"
                onClick={() => void app.deleteWorkspace(workspace.path)}
                disabled={app.isChangingWorkspace}
                title="删除工作区"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className={`texStatus ${appInfo.texStatus.available ? "ok" : "missing"}`}
        title={appInfo.texStatus.message}
        onClick={() =>
          app.setNotice({ type: appInfo.texStatus.available ? "ok" : "error", text: appInfo.texStatus.message })
        }
      >
        {appInfo.texStatus.available ? <FileCheck2 size={15} /> : <AlertTriangle size={15} />}
        {appInfo.texStatus.available ? "TeX 可用" : "未检测到 TeX"}
      </button>
    </section>
  );
}

function FilterPanel({ app }: { app: QuestionBankController }) {
  const allFilteredSelected =
    app.filteredItems.length > 0 && app.filteredItems.every((item) => app.selectedIds.has(item.id));

  return (
    <div className="filterStack">
      <label className="searchBox">
        <Search size={16} />
        <input value={app.search} onChange={(event) => app.setSearch(event.target.value)} placeholder="搜索" />
      </label>
      <div className="filterRow">
        <label>
          <FolderOpen size={15} />
          <select value={app.chapterFilter} onChange={(event) => app.setChapterFilter(event.target.value)}>
            <option value="">全部章节</option>
            {app.chapters.map((chapter) => (
              <option key={chapter} value={chapter}>
                {chapter}
              </option>
            ))}
          </select>
        </label>
        <label>
          <Tags size={15} />
          <select value={app.tagFilter} onChange={(event) => app.setTagFilter(event.target.value)}>
            <option value="">全部标签</option>
            {app.tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
        <label>
          <Star size={15} />
          <select value={app.starFilter} onChange={(event) => app.setStarFilter(event.target.value)}>
            <option value="">全部星级</option>
            {STAR_RATINGS.map((rating) => (
              <option key={rating} value={rating}>
                {renderStars(rating)} {rating}星
              </option>
            ))}
          </select>
        </label>
      </div>
      <button className="selectFiltered" onClick={app.toggleAllFiltered}>
        {allFilteredSelected ? <CheckSquare size={16} /> : <Square size={16} />}
        当前列表
      </button>
    </div>
  );
}

function QuestionList({ app }: { app: QuestionBankController }) {
  return (
    <div className="questionList">
      {app.filteredItems.map((item) => (
        <button
          key={item.id}
          className={[
            "questionListItem",
            app.activeItem?.id === item.id ? "active" : "",
            app.draggingId === item.id ? "dragging" : "",
            app.dropTarget?.id === item.id ? `drop-${app.dropTarget.position}` : ""
          ]
            .filter(Boolean)
            .join(" ")}
          data-question-id={item.id}
          onClick={() => app.setActiveId(item.id)}
          onContextMenu={(event) => app.openReorderMenu(event, item.id)}
        >
          <span className="checkHit" onClick={(event) => event.stopPropagation()}>
            <input
              type="checkbox"
              checked={app.selectedIds.has(item.id)}
              onChange={() => app.toggleSelected(item.id)}
              aria-label="选择导出"
            />
          </span>
          <span
            className="dragHandle"
            title="拖拽排序"
            onMouseDown={(event) => app.startMouseDrag(event, item.id)}
            onPointerDown={(event) => app.startPointerDrag(event, item.id)}
          >
            <GripVertical size={16} />
          </span>
          <span className="questionIndex">{app.numberById.get(item.id)}</span>
          <span className="questionMeta">
            <strong>{item.sourceNumber || item.chapter || "未命名题目"}</strong>
            <small>
              <span className="starText">{renderStars(item.star)}</span>
              {item.tags.length ? ` · ${item.tags.join(" / ")}` : ` · ${item.chapter || "未分类"}`}
            </small>
          </span>
        </button>
      ))}
    </div>
  );
}
