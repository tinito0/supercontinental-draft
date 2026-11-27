export const RETRY_BASE_MS = 2000;
export const RETRY_MAX_MS = 30000;

/** Delay before re-subscribing after the nth consecutive failure (1-based): 2 s, 4 s, 8 s … capped at 30 s. */
export const retryDelay = attempt => Math.min(RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1), RETRY_MAX_MS);
