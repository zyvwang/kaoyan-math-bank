import { constants } from "node:fs";
import { access, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDefaultWorkspaceRoot } from "../server/workspace-storage.js";
import { validateBankPayload } from "../shared/validation.js";

const [legacyProjectPathArg, targetWorkspacePathArg] = process.argv.slice(2);

if (!legacyProjectPathArg) {
  console.error("Usage: tsx scripts/migrate-legacy-workspace.ts <legacy-project-path> [target-workspace-path]");
  process.exit(1);
}

const legacyProjectPath = path.resolve(legacyProjectPathArg);
const targetWorkspacePath = path.resolve(
  targetWorkspacePathArg ?? path.join(getDefaultWorkspaceRoot(), "Imported Legacy Bank")
);
const sourceBankPath = path.join(legacyProjectPath, "data", "bank.json");
const sourceAssetsPath = path.join(legacyProjectPath, "assets");
const targetAssetsPath = path.join(targetWorkspacePath, "assets");

await access(sourceBankPath, constants.R_OK);
await mkdir(targetWorkspacePath, { recursive: true });
await mkdir(targetAssetsPath, { recursive: true });
await mkdir(path.join(targetWorkspacePath, "exports"), { recursive: true });
await mkdir(path.join(targetWorkspacePath, ".tmp"), { recursive: true });

const validation = validateBankPayload(JSON.parse(await readFile(sourceBankPath, "utf8")));
if (!validation.ok || !validation.value) {
  throw new Error(validation.error ?? "旧题库数据无效。");
}
const bankJson = validation.value;
await writeFile(path.join(targetWorkspacePath, "bank.json"), `${JSON.stringify(bankJson, null, 2)}\n`, "utf8");

try {
  await access(sourceAssetsPath, constants.R_OK);
  await cp(sourceAssetsPath, targetAssetsPath, { recursive: true, force: true });
} catch {
  // Legacy projects without uploaded images are valid.
}

console.log(`Migrated legacy project to ${targetWorkspacePath}`);
