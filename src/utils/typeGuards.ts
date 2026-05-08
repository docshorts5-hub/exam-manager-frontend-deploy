// src/utils/typeGuards.ts

export function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function notEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
