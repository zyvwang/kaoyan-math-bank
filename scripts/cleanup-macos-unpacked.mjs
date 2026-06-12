import { rm } from "node:fs/promises";
import path from "node:path";

const outputDir = path.resolve("release/mac-arm64");
await rm(outputDir, { recursive: true, force: true });
console.log(`Removed Spotlight-visible unpacked app: ${outputDir}`);
