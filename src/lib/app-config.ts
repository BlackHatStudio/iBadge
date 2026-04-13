type RuntimeConfigShape = {
  apiBaseUrl?: string;
  referenceRefreshHours?: number | string;
  queueRetryMinutes?: number | string;
  duplicateWindowSeconds?: number | string;
};

declare global {
  interface Window {
    __IBADGE_CONFIG__?: RuntimeConfigShape;
  }
}

const DEFAULT_SYNC_RETRY_MINUTES = 2;
const DEFAULT_REFERENCE_REFRESH_HOURS = 12;
const DEFAULT_DUPLICATE_WINDOW_SECONDS = 30;

function readNumber(value: number | string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function runtimeConfig(): RuntimeConfigShape {
  if (typeof window === "undefined") {
    return {};
  }

  return window.__IBADGE_CONFIG__ ?? {};
}

function readString(key: keyof RuntimeConfigShape, envName: string, fallback = "") {
  const runtimeValue = runtimeConfig()[key];
  if (typeof runtimeValue === "string" && runtimeValue.trim().length > 0) {
    return runtimeValue.trim();
  }

  const envValue = process.env[envName]?.trim();
  return envValue && envValue.length > 0 ? envValue : fallback;
}

function readRuntimeNumber(key: keyof RuntimeConfigShape, envName: string, fallback: number) {
  const runtimeValue = runtimeConfig()[key];
  if (runtimeValue !== undefined) {
    return readNumber(runtimeValue, fallback);
  }

  return readNumber(process.env[envName], fallback);
}

export const appConfig = {
  apiBaseUrl: trimTrailingSlash(readString("apiBaseUrl", "NEXT_PUBLIC_IBADGE_API_BASE_URL", "/api")),
  referenceRefreshHours: readRuntimeNumber(
    "referenceRefreshHours",
    "NEXT_PUBLIC_IBADGE_REFERENCE_REFRESH_HOURS",
    DEFAULT_REFERENCE_REFRESH_HOURS
  ),
  queueRetryMinutes: readRuntimeNumber(
    "queueRetryMinutes",
    "NEXT_PUBLIC_IBADGE_QUEUE_RETRY_MINUTES",
    DEFAULT_SYNC_RETRY_MINUTES
  ),
  duplicateWindowSeconds: readRuntimeNumber(
    "duplicateWindowSeconds",
    "NEXT_PUBLIC_IBADGE_DUPLICATE_WINDOW_SECONDS",
    DEFAULT_DUPLICATE_WINDOW_SECONDS
  ),
};

export function buildApiUrl(path: string) {
  if (!path.startsWith("/")) {
    throw new Error(`API paths must begin with '/'. Received: ${path}`);
  }

  return appConfig.apiBaseUrl ? `${appConfig.apiBaseUrl}${path}` : path;
}
