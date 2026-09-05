/**
 * Generate a silhouette, releasing all listeners on completion, timeout, or unmount.
 * The fallback also handles generation interrupted by another animation.
 * @param {EventTarget & { generateNewBlob(duration?: number): unknown }} blob
 * @param {number} duration
 * @param {AbortSignal} signal
 * @param {number} [padding]
 * @returns {Promise<boolean>} False when the caller's lifetime has ended.
 */
export function generateBlobAndWait(blob, duration, signal, padding = 180) {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(fallback);
      blob.removeEventListener('dynamo-blob-complete', complete);
      signal.removeEventListener('abort', cancel);
    };
    const complete = () => {
      cleanup();
      resolve(true);
    };
    const cancel = () => {
      cleanup();
      resolve(false);
    };
    const fallback = setTimeout(complete, duration + padding);
    blob.addEventListener('dynamo-blob-complete', complete);
    signal.addEventListener('abort', cancel, { once: true });
    try {
      blob.generateNewBlob(duration);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
