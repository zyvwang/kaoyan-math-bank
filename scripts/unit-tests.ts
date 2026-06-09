import { deepStrictEqual, equal, ok } from "node:assert";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { buildQuestionOnlyLatex, orderItemsForExport, selectedItems } from "../server/latex.js";
import { createLatexProcessEnv } from "../server/latex.js";
import {
  appDataDir,
  createEmptyWorkspace,
  createEmptyBank,
  createSampleBank,
  createSampleWorkspace,
  moveWorkspace,
  openExistingWorkspace,
  readAppState,
  readBank,
  removeWorkspace,
  switchWorkspace,
  writeBank
} from "../server/storage.js";
import type { QuestionItem } from "../server/types.js";
import { moveItemToPositionInList, reorderItemByDrop } from "../src/itemOrder.js";
import { nextWheelScrollState, wheelDeltaToPixels } from "../src/wheelScroll.js";

const fixedNow = "2026-01-01T00:00:00.000Z";
const workspacePath = path.resolve(".tmp/unit-workspace");
const workspacePathB = path.resolve(".tmp/unit-workspace-b");
const workspacePathC = path.resolve(".tmp/unit-workspace-c");
const nonWorkspacePath = path.resolve(".tmp/unit-not-a-workspace");
await rm(appDataDir, { recursive: true, force: true });
await rm(workspacePath, { recursive: true, force: true });
await rm(workspacePathB, { recursive: true, force: true });
await rm(workspacePathC, { recursive: true, force: true });
await rm(nonWorkspacePath, { recursive: true, force: true });

const freshAppState = await readAppState();
equal(freshAppState.currentWorkspacePath, undefined);
deepStrictEqual(freshAppState.recentWorkspacePaths, []);
await createSampleWorkspace(workspacePath);

const itemIds = (items: QuestionItem[]) => items.map((item) => item.id);
const items = createItems(["one", "two", "three", "four"]);

deepStrictEqual(itemIds(moveItemToPositionInList(items, "four", 2, fixedNow)), ["one", "four", "two", "three"]);
deepStrictEqual(
  moveItemToPositionInList(items, "four", 2, fixedNow).map((item) => item.order),
  [1, 2, 3, 4]
);
deepStrictEqual(itemIds(reorderItemByDrop(items, "one", "three", "after", fixedNow)), ["two", "three", "one", "four"]);

const nearBottomWheel = nextWheelScrollState({
  scrollTop: 95,
  scrollLeft: 0,
  scrollHeight: 200,
  scrollWidth: 100,
  clientHeight: 100,
  clientWidth: 100,
  deltaX: 0,
  deltaY: 80
});
equal(nearBottomWheel.scrollTop, 100);
equal(nearBottomWheel.changed, true);

const nearTopWheel = nextWheelScrollState({
  scrollTop: 5,
  scrollLeft: 0,
  scrollHeight: 200,
  scrollWidth: 100,
  clientHeight: 100,
  clientWidth: 100,
  deltaX: 0,
  deltaY: -80
});
equal(nearTopWheel.scrollTop, 0);
equal(nearTopWheel.changed, true);
deepStrictEqual(wheelDeltaToPixels(0, 3, 1, 320, 240), { deltaX: 0, deltaY: 54 });
deepStrictEqual(wheelDeltaToPixels(1, 1, 2, 320, 240), { deltaX: 320, deltaY: 240 });

const firstRandom = itemIds(orderItemsForExport(items, "random", "seed-1"));
const secondRandom = itemIds(orderItemsForExport(items, "random", "seed-1"));
const otherRandom = itemIds(orderItemsForExport(items, "random", "seed-2"));
deepStrictEqual(firstRandom, secondRandom);
deepStrictEqual([...firstRandom].sort(), itemIds(items).sort());
deepStrictEqual([...otherRandom].sort(), itemIds(items).sort());

const bank = createSampleBank();
const selected = selectedItems({ ...bank, items }, ["four", "two"], { orderMode: "normal" });
deepStrictEqual(itemIds(selected), ["two", "four"]);

const latex = buildQuestionOnlyLatex(
  [
    {
      ...items[0],
      sourceNumber: "source_1",
      questionTex: "\\documentclass{article}\\begin{document}Body $x^2$\\end{document}"
    }
  ],
  bank.settings
);
ok(latex.includes("Body $x^2$"));
ok(!latex.includes("\\documentclass{article}"));
ok(latex.includes("\\documentclass[UTF8,12pt]{ctexart}"));

const latexEnv = createLatexProcessEnv("/Library/TeX/texbin/latexmk");
const pathKey = Object.keys(latexEnv).find((key) => key.toLowerCase() === "path") ?? "PATH";
ok(latexEnv[pathKey]?.split(path.delimiter).includes("/Library/TeX/texbin"));

const initialBank = await readBank();
equal(initialBank.items.length, 2);
await writeBank(createEmptyBank());
const emptyBank = await readBank();
equal(emptyBank.items.length, 0);

await rejectsWithMessage(
  () => createEmptyWorkspace(workspacePath),
  "该文件夹已经是题库工作区。请使用“打开”切换到它。"
);

await mkdir(nonWorkspacePath, { recursive: true });
await rejectsWithMessage(
  () => openExistingWorkspace(nonWorkspacePath),
  "这个文件夹不是题库工作区：缺少 bank.json。请使用“新建”创建空工作区。"
);

await switchWorkspace(workspacePathB);
await switchWorkspace(workspacePathC);
await moveWorkspace(workspacePathC, 1);
const movedCurrentState = await readAppState();
equal(movedCurrentState.currentWorkspacePath, workspacePathC);
deepStrictEqual(movedCurrentState.recentWorkspacePaths, [workspacePathB, workspacePathC, workspacePath]);

await moveWorkspace(workspacePath, -1);
const movedState = await readAppState();
deepStrictEqual(movedState.recentWorkspacePaths, [workspacePathB, workspacePath, workspacePathC]);

await removeWorkspace(workspacePathC);
const removedCurrentState = await readAppState();
equal(removedCurrentState.currentWorkspacePath, workspacePathB);
deepStrictEqual(removedCurrentState.recentWorkspacePaths, [workspacePathB, workspacePath]);

await removeWorkspace(workspacePath);
await removeWorkspace(workspacePathB);
const emptyWorkspaceState = await readAppState();
equal(emptyWorkspaceState.currentWorkspacePath, undefined);
deepStrictEqual(emptyWorkspaceState.recentWorkspacePaths, []);

console.log("Unit tests passed");

async function rejectsWithMessage(action: () => Promise<unknown>, message: string) {
  try {
    await action();
  } catch (error) {
    equal(error instanceof Error ? error.message : String(error), message);
    return;
  }
  throw new Error(`Expected rejection: ${message}`);
}

function createItems(ids: string[]): QuestionItem[] {
  return ids.map((id, index) => ({
    id,
    order: index + 1,
    sourceNumber: id,
    chapter: "chapter",
    tags: [],
    star: 3,
    questionTex: `question ${id}`,
    solutionTex: `solution ${id}`,
    noteTex: `note ${id}`,
    assets: [],
    createdAt: fixedNow,
    updatedAt: fixedNow
  }));
}
