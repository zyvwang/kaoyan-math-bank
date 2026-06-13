import type express from "express";
import type { ApiErrorResponse } from "../../shared/types.js";

export function sendApiError(
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
