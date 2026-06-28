export const MIN_LOADING_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function applyMinimumLoadingDelay(
  startedAt,
  minMs = MIN_LOADING_MS,
  method = 'get',
) {
  if (!startedAt || String(method).toLowerCase() !== 'get') return;
  const remaining = minMs - (Date.now() - startedAt);
  if (remaining > 0) {
    await sleep(remaining);
  }
}

export async function withMinimumLoading(promise, minMs = MIN_LOADING_MS) {
  const startedAt = Date.now();
  const result = await promise;
  await applyMinimumLoadingDelay(startedAt, minMs, 'get');
  return result;
}
