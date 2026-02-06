export class AppError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = "internal_error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const notFound = (message: string) => new AppError(message, 404, "not_found");
export const unauthorized = (message: string) => new AppError(message, 401, "unauthorized");
export const forbidden = (message: string) => new AppError(message, 403, "forbidden");
export const badRequest = (message: string) => new AppError(message, 400, "bad_request");
