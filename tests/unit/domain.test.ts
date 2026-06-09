import { deepStrictEqual, equal, ok } from "node:assert";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { describe, it, beforeEach } from "vitest";
import {
  buildQuestionOnlyLatex,
  createLatexProcessEnv,
  orderItemsForExport,
  selectedItems
} from "../../server/latex.js";
import {
  appDataDir,
  createEmptyBank,
  createSampleBank,
  createSampleWorkspace,
  moveWorkspace,
  readAppState,
  readBank,
  removeWorkspace,
  switchWorkspace,
  writeBank,
  writeJsonFileAtomic
} from "../../server/storage.js";
import type { QuestionItem } from "../../shared/types.js";
import { moveItemToPositionInList, reorderItemByDrop } from "../../src/itemOrder.js";
import { nextWheelScrollState, wheelDeltaToPixels } from "../../src/wheelScroll.js";

const fixedNow = "2026-01-01T00:00:00.000Z";
const workspacePath = path.resolve(".tmp/vitest-unit-workspace");
const workspacePathB = path.resolve(".tmp/vitest-unit-workspace-b");
const workspacePathC = path.resolve(".tmp/vitest-unit-workspace-c");

beforeEach(async () => {
  await rm(appDataDir, { recursive: true, force: true });
  await rm(workspacePath, { recursive: true, force: true });
  await rm(workspacePathB, { recursive: true, force: true });
  await rm(workspacePathC, { recursive: true, force: true });
});

describe("domain helpers", () => {
  it("reorders items and normalizes wheel scroll", () => {
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
    deepStrictEqual(wheelDeltaToPixels(1, 1, 2, 320, 240), { deltaX: 320, deltaY: 240 });
  });

  it("keeps export order deterministic and strips full-document wrappers", () => {
    const items = createItems(["one", "two", "three", "four"]);
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
  });
});

describe("storage", () => {
  it("manages workspace state and bank data", async () => {
    const freshAppState = await readAppState();
    equal(freshAppState.currentWorkspacePath, undefined);
    deepStrictEqual(freshAppState.recentWorkspacePaths, []);
    await createSampleWorkspace(workspacePath);

    const initialBank = await readBank();
    equal(initialBank.items.length, 2);
    await writeBank(createEmptyBank());
    const emptyBank = await readBank();
    equal(emptyBank.items.length, 0);

    await switchWorkspace(workspacePathB);
    await switchWorkspace(workspacePathC);
    await moveWorkspace(workspacePathC, 1);
    const movedCurrentState = await readAppState();
    equal(movedCurrentState.currentWorkspacePath, workspacePathC);
    deepStrictEqual(movedCurrentState.recentWorkspacePaths, [workspacePathB, workspacePathC, workspacePath]);

    await removeWorkspace(workspacePathC);
    const removedCurrentState = await readAppState();
    equal(removedCurrentState.currentWorkspacePath, workspacePathB);
  });

  it("writes JSON atomically and preserves the previous backup", async () => {
    const filePath = path.resolve(".tmp/vitest-atomic/atomic.json");
    await rm(path.dirname(filePath), { recursive: true, force: true });
    await mkdir(path.dirname(filePath), { recursive: true });

    await writeJsonFileAtomic(filePath, { version: 1, value: "first" });
    await writeJsonFileAtomic(filePath, { version: 1, value: "second" });

    const current = JSON.parse(await readFile(filePath, "utf8")) as { value: string };
    const backup = JSON.parse(await readFile(`${filePath}.bak`, "utf8")) as { value: string };
    equal(current.value, "second");
    equal(backup.value, "first");
  });
});

function itemIds(items: QuestionItem[]) {
  return items.map((item) => item.id);
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
