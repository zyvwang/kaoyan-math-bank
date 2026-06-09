import { rm } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { appDataDir, createEmptyWorkspace, isKnownWorkspacePath } from "../../server/storage.js";

const workspacePath = path.resolve(".tmp/vitest-electron-workspace");
const unrelatedPath = path.resolve(".tmp/vitest-electron-unrelated");

beforeEach(async () => {
  await rm(appDataDir, { recursive: true, force: true });
  await rm(workspacePath, { recursive: true, force: true });
  await rm(unrelatedPath, { recursive: true, force: true });
});

describe("Electron shell path allowlist", () => {
  it("allows only current or recent workspace roots", async () => {
    await createEmptyWorkspace(workspacePath);
    await expect(isKnownWorkspacePath(workspacePath)).resolves.toBe(true);
    await expect(isKnownWorkspacePath(path.join(workspacePath, "bank.json"))).resolves.toBe(false);
    await expect(isKnownWorkspacePath(unrelatedPath)).resolves.toBe(false);
  });
});
