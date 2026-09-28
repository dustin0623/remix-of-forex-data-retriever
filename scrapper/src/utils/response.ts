import type { ResponseMeta } from "../models/schemas.js";

export type SuccessResponse<T> = { success: true; data: T; meta?: ResponseMeta };
export type ErrorResponse = { success: false; error: { code: string; message: string } };

export const ok = <T>(data: T, meta?: ResponseMeta): SuccessResponse<T> =>
  meta ? { success: true, data, meta } : { success: true, data };

export const fail = (code: string, message: string): ErrorResponse => ({
  success: false,
  error: { code, message },
});

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
