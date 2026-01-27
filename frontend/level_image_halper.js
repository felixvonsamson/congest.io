import * as THREE from 'three';

export function renderOverviewToImage(scenes, config, settings, cameras, scale = 2) {
  const width = settings.overview_viewport.w * scale;
  const height = settings.overview_viewport.h * scale;

  const tempRenderer = new THREE.WebGLRenderer({ antialias: true });
  tempRenderer.setSize(width, height);
  tempRenderer.setClearColor(config.colors.background);

  tempRenderer.render(scenes.overview, cameras.overview);

  const link = document.createElement("a");
  link.download = "overview.png";
  link.href = tempRenderer.domElement.toDataURL("image/png");
  link.click();

  tempRenderer.dispose();
}
