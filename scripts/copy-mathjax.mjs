import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mathJaxSource = path.join(root, "node_modules", "mathjax");
const mathJaxTarget = path.join(root, "public", "vendor", "mathjax");
const fontSource = path.join(
  root,
  "node_modules",
  "@mathjax",
  "mathjax-newcm-font",
  "chtml",
  "woff2"
);
const fontVendorTarget = path.join(root, "public", "vendor", "mathjax-fonts");
const fontTarget = path.join(fontVendorTarget, "mathjax-newcm-font", "chtml", "woff2");

await mkdir(path.dirname(mathJaxTarget), { recursive: true });
await rm(mathJaxTarget, { recursive: true, force: true });
await cp(mathJaxSource, mathJaxTarget, { recursive: true });

await rm(fontVendorTarget, { recursive: true, force: true });
await mkdir(path.dirname(fontTarget), { recursive: true });
await cp(fontSource, fontTarget, { recursive: true });
