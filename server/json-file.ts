import { constants } from "node:fs";
import { access, copyFile, mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export async function writeJsonFileAtomic(
  filePath: string,
  value: unknown,
  options: { backup?: boolean } = {}
) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  const backupPath = `${filePath}.bak`;
  const content = `${JSON.stringify(value, null, 2)}\n`;

  try {
    await writeFile(tempPath, content, "utf8");
    if (options.backup !== false && (await fileExists(filePath))) {
      await copyFile(filePath, backupPath);
    }
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}
