import { Router } from "express";
import {
  validateTexPathRequest,
  validateWorkspaceMoveRequest,
  validateWorkspacePathRequest
} from "../../shared/validation.js";
import { updateTexPathOverride } from "../app-state.js";
import { buildAppInfo } from "../app-info.js";
import { sendApiError } from "../http/api-response.js";
import {
  createEmptyWorkspace,
  createSampleWorkspace,
  moveWorkspace,
  openExistingWorkspace,
  removeWorkspace,
  switchWorkspace
} from "../workspace-storage.js";

export function createWorkspaceRouter(): Router {
  const router = Router();

  router.get("/app", async (_request, response, next) => {
    try {
      response.json(await buildAppInfo());
    } catch (error) {
      next(error);
    }
  });

  registerWorkspacePathRoute(router, "/workspaces/create-sample", "缺少示例工作区路径。", async (path) => {
    await createSampleWorkspace(path);
  });
  registerWorkspacePathRoute(router, "/workspaces/create-empty", "缺少新工作区路径。", async (path) => {
    await createEmptyWorkspace(path);
  });
  registerWorkspacePathRoute(router, "/workspaces/open", undefined, async (path) => {
    await openExistingWorkspace(path);
  });
  registerWorkspacePathRoute(router, "/workspaces/remove", undefined, async (path) => {
    await removeWorkspace(path);
  });
  registerWorkspacePathRoute(router, "/workspaces/switch", undefined, async (path) => {
    await switchWorkspace(path);
  });

  router.post("/workspaces/move", async (request, response, next) => {
    try {
      const validation = validateWorkspaceMoveRequest(request.body);
      if (!validation.ok || !validation.value) {
        sendApiError(response, 400, validation.error, "WORKSPACE_MOVE_INVALID");
        return;
      }
      await moveWorkspace(
        validation.value.workspacePath,
        validation.value.direction === "down" ? 1 : -1
      );
      response.json(await buildAppInfo());
    } catch (error) {
      next(error);
    }
  });

  router.post("/tex-path", async (request, response, next) => {
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

  return router;
}

function registerWorkspacePathRoute(
  router: Router,
  route: string,
  missingMessage: string | undefined,
  operation: (workspacePath: string) => Promise<void>
) {
  router.post(route, async (request, response, next) => {
    try {
      const validation = validateWorkspacePathRequest(request.body, missingMessage);
      if (!validation.ok || !validation.value) {
        sendApiError(response, 400, validation.error, "WORKSPACE_PATH_INVALID");
        return;
      }
      await operation(validation.value.workspacePath);
      response.json(await buildAppInfo());
    } catch (error) {
      next(error);
    }
  });
}
