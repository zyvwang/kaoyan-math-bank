import { readFile } from "node:fs/promises";
import path from "node:path";
import { getWorkspaceDirs, writeJsonFileAtomic } from "../server/storage.js";
import { validateBankPayload } from "../shared/validation.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const workspacePathArg = args.find((arg) => arg !== "--dry-run");

if (!workspacePathArg) {
  console.error("Usage: tsx scripts/migrate-v2-workspace.ts <workspace-path> [--dry-run]");
  process.exit(1);
}

const workspacePath = path.resolve(workspacePathArg);
const { bankPath } = getWorkspaceDirs(workspacePath);
const raw = await readFile(bankPath, "utf8");
const before = JSON.parse(raw) as { version?: unknown };
const validation = validateBankPayload(before);
if (!validation.ok || !validation.value) {
  throw new Error(validation.error ?? "题库数据无效。");
}
const migrated = validation.value;

if (dryRun) {
  console.log(`Dry run: ${bankPath}`);
  console.log(`- source version: ${String(before.version ?? "missing")}`);
  console.log(`- target version: ${migrated.version}`);
  console.log(`- items: ${migrated.items.length}`);
  process.exit(0);
}

await writeJsonFileAtomic(bankPath, migrated);
console.log(`Migrated workspace bank to v2: ${bankPath}`);
console.log(`- items: ${migrated.items.length}`);
