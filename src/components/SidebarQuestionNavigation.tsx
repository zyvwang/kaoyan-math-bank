import {
  CheckSquare,
  FolderOpen,
  GripVertical,
  Search,
  Square,
  Star,
  Tags
} from "lucide-react";
import { STAR_RATINGS } from "../constants.js";
import {
  useQuestions,
  useSelection,
  useWorkspaceUi
} from "../context/questionBankContexts.js";
import { renderStars } from "../utils/form.js";
import styles from "./Sidebar.module.css";

export function SidebarQuestionNavigation() {
  return (
    <>
      <FilterPanel />
      <QuestionList />
    </>
  );
}

function FilterPanel() {
  const selection = useSelection();
  const allFilteredSelected =
    selection.filteredItems.length > 0 &&
    selection.filteredItems.every((item) => selection.selectedIds.has(item.id));
  return (
    <section className={styles.filterStack} aria-label="题目筛选">
      <label className={styles.searchBox}>
        <Search size={16} />
        <input
          value={selection.search}
          onChange={(event) => selection.setSearch(event.target.value)}
          placeholder="搜索"
        />
      </label>
      <div className={styles.filterRow}>
        <FilterSelect
          icon={<FolderOpen size={15} />}
          label="章节"
          value={selection.chapterFilter}
          onChange={selection.setChapterFilter}
          options={selection.chapters}
          emptyLabel="全部章节"
        />
        <FilterSelect
          icon={<Tags size={15} />}
          label="标签"
          value={selection.tagFilter}
          onChange={selection.setTagFilter}
          options={selection.tags}
          emptyLabel="全部标签"
        />
        <label>
          <Star size={15} />
          <span className={styles.srOnly}>星级</span>
          <select
            value={selection.starFilter}
            onChange={(event) => selection.setStarFilter(event.target.value)}
          >
            <option value="">全部星级</option>
            {STAR_RATINGS.map((rating) => (
              <option key={rating} value={rating}>{renderStars(rating)} {rating}星</option>
            ))}
          </select>
        </label>
      </div>
      <button className={styles.selectFiltered} onClick={selection.toggleAllFiltered}>
        {allFilteredSelected ? <CheckSquare size={16} /> : <Square size={16} />}
        当前列表
      </button>
    </section>
  );
}

function FilterSelect(props: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  emptyLabel: string;
}) {
  return (
    <label>
      {props.icon}
      <span className={styles.srOnly}>{props.label}</span>
      <select value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        <option value="">{props.emptyLabel}</option>
        {props.options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function QuestionList() {
  const questions = useQuestions();
  const selection = useSelection();
  const ui = useWorkspaceUi();
  return (
    <div className={styles.questionList} aria-label="题目列表">
      {selection.filteredItems.map((item) => (
        <div
          key={item.id}
          className={[
            styles.questionListItem,
            questions.activeItem?.id === item.id ? styles.activeQuestion : "",
            ui.draggingId === item.id ? styles.dragging : "",
            ui.dropTarget?.id === item.id
              ? ui.dropTarget.position === "before" ? styles.dropBefore : styles.dropAfter
              : ""
          ].filter(Boolean).join(" ")}
          data-question-id={item.id}
          onContextMenu={(event) => ui.openReorderMenu(event, item.id)}
        >
          <label className={styles.checkHit}>
            <input
              type="checkbox"
              checked={selection.selectedIds.has(item.id)}
              onChange={() => selection.toggleSelected(item.id)}
              aria-label={`选择导出 ${item.sourceNumber || item.chapter || "未命名题目"}`}
            />
          </label>
          <span
            className={styles.dragHandle}
            title="拖拽排序"
            onMouseDown={(event) => ui.startMouseDrag(event, item.id)}
            onPointerDown={(event) => ui.startPointerDrag(event, item.id)}
          >
            <GripVertical size={16} />
          </span>
          <button className={styles.questionMain} onClick={() => questions.setActiveId(item.id)}>
            <span className={styles.questionIndex}>{questions.numberById.get(item.id)}</span>
            <span className={styles.questionMeta}>
              <strong>{item.sourceNumber || item.chapter || "未命名题目"}</strong>
              <small>
                <span className={styles.starText}>{renderStars(item.star)}</span>
                {item.tags.length ? ` · ${item.tags.join(" / ")}` : ` · ${item.chapter || "未分类"}`}
              </small>
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}
