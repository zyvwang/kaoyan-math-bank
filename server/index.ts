import express from "express";
import type { Server } from "node:http";
import multer from "multer";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import {
  createEmptyWorkspace,
  createWorkspace,
  createSampleWorkspace,
  ensureProjectDirs,
  getCurrentWorkspaceDirs,
  listRecentWorkspaces,
  moveWorkspace,
  openExistingWorkspace,
  removeWorkspace,
  readAppState,
  readBank,
  rootDir,
  switchWorkspace,
  updateTexPathOverride,
  workspaceNameFromPath,
  writeBank
} from "./storage.js";
import {
  buildFullLatex,
  buildQuestionOnlyLatex,
  compileLatex,
  copyAssetsForItems,
  detectTexInstallation,
  listExportFiles,
  sanitizeFileName,
  selectedItems,
  writeCurrentItemCheck
} from "./latex.js";
import type { AppInfo, QuestionAsset } from "../shared/types.js";
import {
  validateBankPayload,
  validateCompileItemRequest,
  validateExportRequest,
  validateTexPathRequest,
  validateWorkspaceMoveRequest,
  validateWorkspacePathRequest
} from "../shared/validation.js";

export interface ApiServerOptions {
  host?: string;
  port?: number;
}

export interface StartedApiServer {
  app: express.Express;
  server: Server;
  url: string;
  port: number;
}

export function createApiApp(): express.Express {
  const app = express();

  const upload = multer({
    storage: multer.diskStorage({
      destination: async (_request, _file, callback) => {
        try {
          const { assetDir } = await getCurrentWorkspaceDirs();
          await mkdir(assetDir, { recursive: true });
          callback(null, assetDir);
        } catch (error) {
          callback(error instanceof Error ? error : new Error("无法打开素材目录。"), "");
        }
      },
      filename: (_request, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase() || ".png";
        callback(null, `${crypto.randomUUID()}${extension}`);
      }
    }),
    limits: {
      fileSize: 15 * 1024 * 1024
    },
    fileFilter: (_request, file, callback) => {
      callback(null, file.mimetype.startsWith("image/"));
    }
  });

  app.use(express.json({ limit: "8mb" }));
  app.use(rejectForeignMutatingOrigins);
  app.use("/assets", dynamicStatic("assetDir"));
  app.use("/exports", dynamicStatic("exportDir"));
  app.use("/tmp", dynamicStatic("tempDir"));

  app.get("/api/app", async (_request, response, next) => {
    try {
      response.json(await buildAppInfo());
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/bank", async (_request, response, next) => {
    try {
      response.json(await readBank());
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/bank", async (request, response, next) => {
    try {
      const validation = validateBankPayload(request.body);
      if (!validation.ok || !validation.value) {
        response.status(400).json({ error: validation.error });
        return;
      }
      response.json(await writeBank(validation.value));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/workspaces/create", async (request, response, next) => {
    try {
      if (!isRequestBodyObject(request.body)) {
        response.status(400).json({ error: "请求体必须是对象。" });
        return;
      }
      await createWorkspace(String(request.body.name ?? "New Bank"));
      response.json(await buildAppInfo());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/workspaces/create-sample", async (request, response, next) => {
    try {
      const validation = validateWorkspacePathRequest(request.body, "缺少示例工作区路径。");
      if (!validation.ok || !validation.value) {
        response.status(400).json({ error: validation.error });
        return;
      }
      await createSampleWorkspace(validation.value.workspacePath);
      response.json(await buildAppInfo());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/workspaces/create-empty", async (request, response, next) => {
    try {
      const validation = validateWorkspacePathRequest(request.body, "缺少新工作区路径。");
      if (!validation.ok || !validation.value) {
        response.status(400).json({ error: validation.error });
        return;
      }
      await createEmptyWorkspace(validation.value.workspacePath);
      response.json(await buildAppInfo());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/workspaces/open", async (request, response, next) => {
    try {
      const validation = validateWorkspacePathRequest(request.body);
      if (!validation.ok || !validation.value) {
        response.status(400).json({ error: validation.error });
        return;
      }
      await openExistingWorkspace(validation.value.workspacePath);
      response.json(await buildAppInfo());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/workspaces/remove", async (request, response, next) => {
    try {
      const validation = validateWorkspacePathRequest(request.body);
      if (!validation.ok || !validation.value) {
        response.status(400).json({ error: validation.error });
        return;
      }
      await removeWorkspace(validation.value.workspacePath);
      response.json(await buildAppInfo());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/workspaces/move", async (request, response, next) => {
    try {
      const validation = validateWorkspaceMoveRequest(request.body);
      if (!validation.ok || !validation.value) {
        response.status(400).json({ error: validation.error });
        return;
      }
      await moveWorkspace(validation.value.workspacePath, validation.value.direction === "down" ? 1 : -1);
      response.json(await buildAppInfo());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/workspaces/switch", async (request, response, next) => {
    try {
      const validation = validateWorkspacePathRequest(request.body);
      if (!validation.ok || !validation.value) {
        response.status(400).json({ error: validation.error });
        return;
      }
      await switchWorkspace(validation.value.workspacePath);
      response.json(await buildAppInfo());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/tex-path", async (request, response, next) => {
    try {
      const validation = validateTexPathRequest(request.body);
      if (!validation.ok || !validation.value) {
        response.status(400).json({ error: validation.error });
        return;
      }
      await updateTexPathOverride(validation.value.texPath);
      response.json(await buildAppInfo());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/assets", upload.single("file"), async (request, response, next) => {
    try {
      if (!request.file) {
        response.status(400).json({ error: "请选择图片文件。" });
        return;
      }

      const asset: QuestionAsset = {
        id: crypto.randomUUID(),
        fileName: request.file.filename,
        originalName: request.file.originalname,
        relativePath: `assets/${request.file.filename}`,
        mimeType: request.file.mimetype,
        size: request.file.size,
        uploadedAt: new Date().toISOString()
      };

      response.json({
        asset,
        url: `/assets/${asset.fileName}`,
        insertText: `\\begin{center}\n\\includegraphics[width=0.75\\linewidth]{assets/${asset.fileName}}\n\\end{center}`
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/compile-item", async (request, response, next) => {
    try {
      const validation = validateCompileItemRequest(request.body);
      if (!validation.ok || !validation.value) {
        response.status(400).json({ error: validation.error });
        return;
      }

      const texPath = await writeCurrentItemCheck(validation.value.item, validation.value.settings);
      const workDir = path.dirname(texPath);
      const result = await compileLatex(texPath, workDir);
      response.status(result.ok ? 200 : 422).json({
        ...result,
        texUrl: await toPublicTempUrl(result.texPath),
        pdfUrl: result.pdfPath ? await toPublicTempUrl(result.pdfPath) : undefined
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/export", async (request, response, next) => {
    try {
      const validation = validateExportRequest(request.body);
      if (!validation.ok || !validation.value) {
        response.status(400).json({ error: validation.error });
        return;
      }
      const bank = await readBank();
      const ids = validation.value.itemIds;
      const fileName = sanitizeFileName(validation.value.fileName);
      const orderMode = validation.value.orderMode === "random" ? "random" : "normal";
      const randomSeed = validation.value.randomSeed || fileName;
      const items = selectedItems(bank, ids, { orderMode, randomSeed });

      if (items.length === 0) {
        response.status(400).json({ error: "请至少勾选一道题目。" });
        return;
      }

      const { exportDir } = await getCurrentWorkspaceDirs();
      const targetDir = path.join(exportDir, fileName);
      await mkdir(targetDir, { recursive: true });
      await copyAssetsForItems(items, targetDir);

      const questionsTex = path.join(targetDir, "questions.tex");
      const fullTex = path.join(targetDir, "full.tex");
      await writeFile(questionsTex, buildQuestionOnlyLatex(items, bank.settings), "utf8");
      await writeFile(fullTex, buildFullLatex(items, bank.settings), "utf8");

      const questionsResult = await compileLatex(questionsTex, targetDir, 60_000);
      const fullResult = await compileLatex(fullTex, targetDir, 60_000);
      const ok = questionsResult.ok && fullResult.ok;
      const files = await listExportFiles(targetDir);

      response.status(ok ? 200 : 422).json({
        ok,
        exportName: fileName,
        exportPath: targetDir,
        exportUrl: `/exports/${encodeURIComponent(fileName)}/`,
        files,
        results: {
          questions: questionsResult,
          full: fullResult
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.use(express.static(path.join(rootDir, "dist")));
  app.use((request, response, next) => {
    if (request.method !== "GET") {
      next();
      return;
    }
    response.sendFile(path.join(rootDir, "dist", "index.html"));
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof multer.MulterError) {
      response.status(400).json({ error: error.message });
      return;
    }
    if (isClientInputError(error)) {
      response.status(400).json({ error: error.message });
      return;
    }
    console.error(error);
    response.status(500).json({
      error: error instanceof Error ? error.message : "服务器内部错误。"
    });
  });

  return app;
}

function rejectForeignMutatingOrigins(
  request: express.Request,
  response: express.Response,
  next: express.NextFunction
) {
  if (!isMutatingMethod(request.method)) {
    next();
    return;
  }

  const origin = request.get("origin");
  if (!origin) {
    next();
    return;
  }

  try {
    const url = new URL(origin);
    if (["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
      next();
      return;
    }
  } catch {
    response.status(403).json({ error: "拒绝未知来源的写入请求。" });
    return;
  }

  response.status(403).json({ error: "拒绝非本机来源的写入请求。" });
}

function isMutatingMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function isRequestBodyObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isClientInputError(error: unknown): error is Error {
  if (!(error instanceof Error)) return false;
  return [
    "该文件夹已经是题库工作区。",
    "这个文件夹不是题库工作区：缺少 bank.json。",
    "尚未选择题库工作区。"
  ].some((message) => error.message.startsWith(message));
}

export async function startApiServer(options: ApiServerOptions = {}): Promise<StartedApiServer> {
  await ensureProjectDirs();
  const app = createApiApp();
  const host = options.host ?? "127.0.0.1";
  const requestedPort = options.port ?? Number(process.env.PORT ?? 5174);

  return new Promise((resolve, reject) => {
    const server = app.listen(requestedPort, host, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : requestedPort;
      const url = `http://${host}:${port}`;
      console.log(`API server listening on ${url}`);
      resolve({ app, server, url, port });
    });
    server.on("error", reject);
  });
}

async function buildAppInfo(): Promise<AppInfo> {
  const appState = await readAppState();
  const currentWorkspacePath = appState.currentWorkspacePath ?? "";
  return {
    appState,
    currentWorkspaceName: currentWorkspacePath ? workspaceNameFromPath(currentWorkspacePath) : "未设置",
    currentWorkspacePath,
    recentWorkspaces: await listRecentWorkspaces(),
    texStatus: await detectTexInstallation(),
    isDesktop: process.env.KMB_DESKTOP === "1",
    setupRequired: !currentWorkspacePath
  };
}

function dynamicStatic(dirKey: "assetDir" | "exportDir" | "tempDir"): express.RequestHandler {
  return async (request, response, next) => {
    try {
      const dirs = await getCurrentWorkspaceDirs();
      express.static(dirs[dirKey])(request, response, next);
    } catch (error) {
      if (error instanceof Error && error.message.includes("尚未选择题库工作区")) {
        next();
        return;
      }
      next(error);
    }
  };
}

async function toPublicTempUrl(filePath: string): Promise<string> {
  const { tempDir } = await getCurrentWorkspaceDirs();
  const relative = path.relative(tempDir, filePath).split(path.sep).map(encodeURIComponent).join("/");
  return `/tmp/${relative}`;
}

function isDirectRun(): boolean {
  const currentFile = fileURLToPath(import.meta.url);
  return Boolean(process.argv[1] && path.resolve(process.argv[1]) === currentFile);
}

if (isDirectRun()) {
  await startApiServer();
}
