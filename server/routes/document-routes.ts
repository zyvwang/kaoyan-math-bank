import { Router } from "express";
import multer from "multer";
import path from "node:path";
import {
  validateCompileItemRequest,
  validateExportRequest
} from "../../shared/validation.js";
import { saveQuestionAsset } from "../asset-service.js";
import { readBankSnapshot } from "../bank-storage.js";
import { exportBank } from "../export-service.js";
import { sendApiError } from "../http/api-response.js";
import { writeCurrentItemCheck } from "../latex-files.js";
import { compileLatex } from "../latex-runtime.js";
import { getCurrentWorkspaceDirs } from "../workspace-storage.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    callback(null, ["image/png", "image/jpeg"].includes(file.mimetype));
  }
});

export function createDocumentRouter(): Router {
  const router = Router();

  router.post("/assets", upload.single("file"), async (request, response, next) => {
    try {
      if (!request.file) {
        sendApiError(
          response,
          400,
          "请选择扩展名、MIME 和内容一致的 PNG 或 JPEG 图片。",
          "IMAGE_REQUIRED"
        );
        return;
      }
      response.json(await saveQuestionAsset(request.file));
    } catch (error) {
      next(error);
    }
  });

  router.post("/compile-item", async (request, response, next) => {
    try {
      const validation = validateCompileItemRequest(request.body);
      if (!validation.ok || !validation.value) {
        sendApiError(response, 400, validation.error, "COMPILE_REQUEST_INVALID");
        return;
      }
      const texPath = await writeCurrentItemCheck(
        validation.value.item,
        validation.value.settings
      );
      const result = await compileLatex(texPath, path.dirname(texPath));
      response.status(result.ok ? 200 : 422).json({
        ...result,
        texUrl: await toPublicTempUrl(result.texPath),
        pdfUrl: result.pdfPath ? await toPublicTempUrl(result.pdfPath) : undefined
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/export", async (request, response, next) => {
    try {
      const validation = validateExportRequest(request.body);
      if (!validation.ok || !validation.value) {
        sendApiError(response, 400, validation.error, "EXPORT_REQUEST_INVALID");
        return;
      }
      const snapshot = await readBankSnapshot();
      const result = await exportBank(
        snapshot.bank,
        snapshot.workspacePath,
        validation.value
      );
      response.status(result.ok ? 200 : 422).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

async function toPublicTempUrl(filePath: string): Promise<string> {
  const { tempDir } = await getCurrentWorkspaceDirs();
  const relative = path
    .relative(tempDir, filePath)
    .split(path.sep)
    .map(encodeURIComponent)
    .join("/");
  return `/tmp/${relative}`;
}
