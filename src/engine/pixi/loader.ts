import { Assets } from 'pixi.js';

export interface LoadProgress {
  loaded: number;
  total: number;
}

/**
 * Load a list of asset URLs via PixiJS's Assets system.
 * Calls onProgress as each one completes.
 * Returns when all are loaded.
 */
export async function loadAssets(
  urls: string[],
  onProgress?: (p: LoadProgress) => void
): Promise<void> {
  const total = urls.length;
  let loaded = 0;
  // PixiJS supports bulk Assets.load with a progress callback,
  // but we want per-asset progress on this small set.
  await Promise.all(
    urls.map(async (url) => {
      await Assets.load(url);
      loaded++;
      onProgress?.({ loaded, total });
    })
  );
}
