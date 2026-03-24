/**
 * Extract a human-readable error message from an unknown thrown value.
 *
 * Handles native `Error` instances, API error objects with a `message`
 * property, and arbitrary values — returning the fallback for anything
 * that cannot be meaningfully converted to a string.
 */
export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong",
): string {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  if (typeof error === "string" && error.length > 0) return error;
  return fallback;
}
