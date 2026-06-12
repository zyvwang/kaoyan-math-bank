import express from "express";
import type { Server } from "node:http";
import multer from "multer";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  createEmptyWorkspace,
  createSampleWorkspace,
  ensureProjectDirs,
  getCurrentWorkspaceDirs,
  listRecoveryCandidates,
  listRecentWorkspaces,
  moveWorkspace,
  openExistingWorkspace,
  readBankSnapshot,
  removeWorkspace,
  recoverBank,
  readAppState,
  rootDir,
  saveBankSnapshot,
  StorageError,
  switchWorkspace,
  updateTexPathOverride,
  workspaceNameFromPath
} from "./storage.js";
import {
  compileLatex,
  detectTexInstallation,
  writeCurrentItemCheck
} from "./latex.js";
import type { ApiErrorResponse, AppInfo } from "../shared/types.js";
import {
  validateCompileItemRequest,
  validateExportRequest,
  validateRecoverBankRequest,
  validateSaveBankRequest,
  validateTexPathRequest,
  validateWorkspaceMoveRequest,
  validateWorkspacePathRequest
} from "../shared/validation.js";
import { AssetUploadError, saveQuestionAsset } from "./asset-service.js";
import { exportBank } from "./export-service.js";

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
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 15 * 1024 * 1024
    },
    fileFilter: (_request, file, callback) => {
      callback(null, ["image/png", "image/jpeg"].includes(file.mimetype));
    }
  });

  app.use((_request, response, next) => {
    if (!process.env.KMB_DEV_SERVER_URL) {
      response.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
      );
    }
    next();
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
      response.json(await readBankSnapshot());
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/bank", async (request, response, next) => {
    try {
      const validation = validateSaveBankRequest(request.body);
      if (!validation.ok || !validation.value) {
        sendApiError(response, 400, validation.error, "BANK_REQUEST_INVALID");
        return;
      }
      response.json(await saveBankSnapshot(validation.value));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/workspaces/create-sample", async (request, response, next) => {
    try {
      const validation = validateWorkspacePathRequest(request.body, "缺少示例工作区路径。");
      if (!validation.ok || !validation.value) {
        sendApiError(response, 400, validation.error, "WORKSPACE_PATH_INVALID");
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
        sendApiError(response, 400, validation.error, "WORKSPACE_PATH_INVALID");
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
        sendApiError(response, 400, validation.error, "WORKSPACE_PATH_INVALID");
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
        sendApiError(response, 400, validation.error, "WORKSPACE_PATH_INVALID");
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
        sendApiError(response, 400, validation.error, "WORKSPACE_MOVE_INVALID");
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
        sendApiError(response, 400, validation.error, "WORKSPACE_PATH_INVALID");
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
        sendApiError(response, 400, validation.error, "TEX_PATH_INVALID");
        return;
      }
      await updateTexPathOverride(validation.value.texPath);
      response.json(await buildAppInfo());
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/recovery", async (_request, response, next) => {
    try {
      response.json({ candidates: await listRecoveryCandidates() });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/recovery", async (request, response, next) => {
    try {
      const validation = validateRecoverBankRequest(request.body);
      if (!validation.ok || !validation.value) {
        sendApiError(response, 400, validation.error, "RECOVERY_REQUEST_INVALID");
        return;
      }
      response.json(await recoverBank(validation.value.candidateId));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/assets", upload.single("file"), async (request, response, next) => {
    try {
      if (!request.file) {
        sendApiError(response, 400, "请选择扩展名、MIME 和内容一致的 PNG 或 JPEG 图片。", "IMAGE_REQUIRED");
        return;
      }
      response.json(await saveQuestionAsset(request.file));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/compile-item", async (request, response, next) => {
    try {
      const validation = validateCompileItemRequest(request.body);
      if (!validation.ok || !validation.value) {
        sendApiError(response, 400, validation.error, "COMPILE_REQUEST_INVALID");
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
        sendApiError(response, 400, validation.error, "EXPORT_REQUEST_INVALID");
        return;
      }
      const snapshot = await readBankSnapshot();
      const result = await exportBank(snapshot.bank, snapshot.workspacePath, validation.value);
      response.status(result.ok ? 200 : 422).json(result);
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
      sendApiError(response, 400, error.message, "UPLOAD_INVALID");
      return;
    }
    if (error instanceof AssetUploadError) {
      sendApiError(response, 400, error.message, error.code);
      return;
    }
    if (error instanceof StorageError) {
      sendApiError(response, error.status, error.message, error.code);
      return;
    }
    if (isClientInputError(error)) {
      sendApiError(response, 400, error.message, "REQUEST_INVALID");
      return;
    }
    console.error(error);
    sendApiError(
      response,
      500,
      error instanceof Error ? error.message : "服务器内部错误。",
      "INTERNAL_ERROR"
    );
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
    const originUrl = new URL(origin);
    const requestUrl = new URL(`${request.protocol}://${request.get("host")}`);
    const devOrigin = process.env.KMB_DEV_SERVER_URL
      ? new URL(process.env.KMB_DEV_SERVER_URL).origin
      : "";
    const allowedOrigins = new Set([requestUrl.origin, devOrigin].filter(Boolean));
    if (isLoopbackHostname(requestUrl.hostname) && allowedOrigins.has(originUrl.origin)) {
      next();
      return;
    }
  } catch {
    sendApiError(response, 403, "拒绝未知来源的写入请求。", "ORIGIN_INVALID");
    return;
  }

  sendApiError(response, 403, "拒绝非本机来源的写入请求。", "ORIGIN_FORBIDDEN");
}

function isMutatingMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function isLoopbackHostname(hostname: string): boolean {
  return ["127.0.0.1", "localhost", "::1"].includes(hostname);
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

function sendApiError(
  response: express.Response,
  status: number,
  error: string | undefined,
  code: string
) {
  const payload: ApiErrorResponse = {
    error: error ?? "请求无效。",
    code
  };
  response.status(status).json(payload);
}

function isDirectRun(): boolean {
  const currentFile = fileURLToPath(import.meta.url);
  return Boolean(process.argv[1] && path.resolve(process.argv[1]) === currentFile);
}

if (isDirectRun()) {
  await startApiServer();
}
