export type SuccessResponse<T> = { success: true; data: T };
export type ErrorResponse = { success: false; error: { code: string; message: string } };

export const ok = <T>(data: T): SuccessResponse<T> => ({ success: true, data });

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
