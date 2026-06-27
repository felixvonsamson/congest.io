/**
 * Download the current minimap view as a PNG.
 *
 * PixiJS v8's Extract plugin reads back from the GPU correctly —
 * no need to create a temporary renderer like the Three.js version did.
 *
 * @param {import('pixi.js').Application} minimapApp
 */
export async function renderOverviewToImage(minimapApp) {
  await minimapApp.renderer.extract.download({
    target:   minimapApp.stage,
    filename: 'overview.png',
  });
}
