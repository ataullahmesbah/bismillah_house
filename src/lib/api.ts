import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Standard success/error envelope for every API route and server action. */
export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: string; code: string; fields?: Record<string, string> };
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(message: string, options?: { status?: number; code?: string; fields?: Record<string, string> }) {
    super(message);
    this.name = "AppError";
    this.status = options?.status ?? 400;
    this.code = options?.code ?? "BAD_REQUEST";
    this.fields = options?.fields;
  }
}

export const errors = {
  unauthorized: (message = "You need to sign in to continue.") =>
    new AppError(message, { status: 401, code: "UNAUTHORIZED" }),
  forbidden: (message = "You do not have permission to perform this action.") =>
    new AppError(message, { status: 403, code: "FORBIDDEN" }),
  notFound: (message = "The requested resource was not found.") =>
    new AppError(message, { status: 404, code: "NOT_FOUND" }),
  conflict: (message: string) => new AppError(message, { status: 409, code: "CONFLICT" }),
  tooMany: (message = "Too many attempts. Please try again shortly.") =>
    new AppError(message, { status: 429, code: "RATE_LIMITED" }),
  validation: (message: string, fields?: Record<string, string>) =>
    new AppError(message, { status: 422, code: "VALIDATION_ERROR", fields }),
  /**
   * A third party we depend on failed or could not be reached.
   *
   * Distinct from a validation error because it is worth retrying: a courier
   * timing out is not the same as a courier rejecting the parcel.
   */
  upstream: (message = "A service we rely on is not responding. Please try again.") =>
    new AppError(message, { status: 502, code: "UPSTREAM_ERROR" }),
};

/** Flatten a Zod error into `{ fieldPath: message }`. */
export function zodFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_form";
    if (!fields[path]) fields[path] = issue.message;
  }
  return fields;
}

/**
 * Converts any thrown value into a client-safe failure.
 * Internal errors, stack traces and database messages never reach the browser;
 * they are logged on the server instead.
 */
export function toFailure(error: unknown, context?: string): ApiFailure {
  if (error instanceof AppError) {
    return { ok: false, error: error.message, code: error.code, fields: error.fields };
  }
  if (error instanceof ZodError) {
    return {
      ok: false,
      error: "Please correct the highlighted fields.",
      code: "VALIDATION_ERROR",
      fields: zodFields(error),
    };
  }
  console.error(`[trust-mart]${context ? ` ${context}:` : ""}`, error);
  return { ok: false, error: "Something went wrong. Please try again.", code: "INTERNAL_ERROR" };
}

export function statusFor(failure: ApiFailure): number {
  switch (failure.code) {
    case "UNAUTHORIZED": return 401;
    case "FORBIDDEN": return 403;
    case "NOT_FOUND": return 404;
    case "CONFLICT": return 409;
    case "VALIDATION_ERROR": return 422;
    case "RATE_LIMITED": return 429;
    case "INTERNAL_ERROR": return 500;
    case "UPSTREAM_ERROR": return 502;
    default: return 400;
  }
}

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json<ApiSuccess<T>>({ ok: true, data }, init);
}

export function jsonError(error: unknown, context?: string): NextResponse {
  const failure = toFailure(error, context);
  return NextResponse.json<ApiFailure>(failure, { status: statusFor(failure) });
}

/** Wraps a route handler so no unexpected error ever leaks internals. */
export function withApi<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
  context?: string,
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return jsonError(error, context);
    }
  };
}

/** The shape every server action returns to a form. */
export type ActionState =
  | { status: "idle" }
  | { status: "success"; message?: string; redirectTo?: string }
  | { status: "error"; message: string; fields?: Record<string, string> };

export const idleState: ActionState = { status: "idle" };

export function actionFailure(error: unknown, context?: string): ActionState {
  const failure = toFailure(error, context);
  return { status: "error", message: failure.error, fields: failure.fields };
}

export function actionSuccess(message?: string, redirectTo?: string): ActionState {
  return { status: "success", message, redirectTo };
}
