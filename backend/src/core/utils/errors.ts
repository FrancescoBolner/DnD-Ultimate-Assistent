/**
 * Custom application error with HTTP status code.
 * Thrown in services/controllers and caught by the error middleware.
 */
export class AppError extends Error {
  public readonly status: number;

  constructor(message: string, status: number = 500) {
    super(message);
    this.status = status;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /* ── Factory helpers ── */

  static badRequest(msg = 'Bad request')     { return new AppError(msg, 400); }
  static unauthorized(msg = 'Unauthorized')  { return new AppError(msg, 401); }
  static forbidden(msg = 'Forbidden')        { return new AppError(msg, 403); }
  static notFound(msg = 'Not found')         { return new AppError(msg, 404); }
  static conflict(msg = 'Conflict')          { return new AppError(msg, 409); }
}
