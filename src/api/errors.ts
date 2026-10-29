import { ApiError } from './contract';

/** A sentence suitable for a toast or inline error. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return 'Something went wrong. Please try again.';
}

/** Per-field messages from a validation error, if any. */
export const fieldErrors = (e: unknown): Record<string, string> => (e instanceof ApiError && e.fields) || {};
