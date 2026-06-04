type PerfDetails = Record<string, string | number | boolean | null | undefined>;

const ENABLED = process.env.STELLA_PERF_LOG === "1";
const DISABLED = process.env.STELLA_PERF_LOG === "0";

function formatDetails(details?: PerfDetails) {
  if (!details) return "";
  const parts = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${String(value)}`);
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

export function sanitizePerfPath(path: string) {
  return path
    .split("/")
    .map((segment) => {
      if (!segment) return segment;
      if (/^\d+$/.test(segment)) return "[id]";
      if (/^[A-Za-z0-9_-]{24,}$/.test(segment)) return "[token]";
      return segment;
    })
    .join("/");
}

export function startPerfTimer() {
  return Date.now();
}

export function elapsedPerfMs(startedAt: number) {
  return Date.now() - startedAt;
}

export function logPerf(
  scope: string,
  label: string,
  durationMs: number,
  details?: PerfDetails,
  thresholdMs = 500
) {
  if (DISABLED) return;
  if (!ENABLED && durationMs < thresholdMs) return;

  console.info(
    `[perf] ${scope}.${label} durationMs=${durationMs}${formatDetails(details)}`
  );
}

export async function measurePerf<T>(
  scope: string,
  label: string,
  fn: () => Promise<T>,
  thresholdMs = 200,
  details?: PerfDetails
): Promise<T> {
  const startedAt = Date.now();
  try {
    return await fn();
  } finally {
    logPerf(scope, label, elapsedPerfMs(startedAt), details, thresholdMs);
  }
}
