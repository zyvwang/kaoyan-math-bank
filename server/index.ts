import express from "express";
import type { Server } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  apiErrorHandler,
  contentSecurityPolicy,
  dynamicWorkspaceStatic,
  installFrontend,
  rejectForeignMutatingOrigins
} from "./http/middleware.js";
import { createBankRouter } from "./routes/bank-routes.js";
import { createDocumentRouter } from "./routes/document-routes.js";
import { createWorkspaceRouter } from "./routes/workspace-routes.js";
import { ensureProjectDirs } from "./workspace-storage.js";

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
  app.use(contentSecurityPolicy);
  app.use(express.json({ limit: "8mb" }));
  app.use(rejectForeignMutatingOrigins);
  app.use("/assets", dynamicWorkspaceStatic("assetDir"));
  app.use("/exports", dynamicWorkspaceStatic("exportDir"));
  app.use("/tmp", dynamicWorkspaceStatic("tempDir"));
  app.use("/api", createWorkspaceRouter());
  app.use("/api", createBankRouter());
  app.use("/api", createDocumentRouter());
  installFrontend(app);
  app.use(apiErrorHandler);
  return app;
}

export async function startApiServer(
  options: ApiServerOptions = {}
): Promise<StartedApiServer> {
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

function isDirectRun(): boolean {
  const currentFile = fileURLToPath(import.meta.url);
  return Boolean(process.argv[1] && path.resolve(process.argv[1]) === currentFile);
}

if (isDirectRun()) {
  await startApiServer();
}
