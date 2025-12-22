import * as THREE from 'three';
import { createNetwork } from './createNetwork.js';

export function updateNetwork(
    settings,
    scenes,
    cameras,
    data,
    state,
    controls,
    callbacks,
) {
    if (state.mainNetwork) scenes.main.remove(state.mainNetwork);
    if (state.overviewNetwork) scenes.overview.remove(state.overviewNetwork);

    state.mainNetwork = createNetwork(data, state, controls, callbacks);
    state.overviewNetwork = state.mainNetwork.clone();

    scenes.main.add(state.mainNetwork);
    scenes.overview.add(state.overviewNetwork);

    // Center overview camera on network
    const max_x = Math.max(...Object.values(data.nodes).map(n => n.x));
    const min_x = Math.min(...Object.values(data.nodes).map(n => n.x));
    const max_y = Math.max(...Object.values(data.nodes).map(n => n.y));
    const min_y = Math.min(...Object.values(data.nodes).map(n => n.y));
    const center_x = (max_x + min_x) / 2;
    const center_y = (max_y + min_y) / 2;
    let size_x = (max_x - min_x) * 1.2;
    let size_y = (max_y - min_y) * 1.2;
    if (size_x > size_y * settings.aspect) {
        size_y = size_x / settings.aspect;
    } else {
        size_x = size_y * settings.aspect;
    }
    cameras.overview.left = -size_x / 2;
    cameras.overview.right = size_x / 2;
    cameras.overview.top = size_y / 2;
    cameras.overview.bottom = -size_y / 2;
    cameras.overview.position.set(center_x, center_y, 500);
    cameras.overview.lookAt(center_x, center_y, 0);
    cameras.overview.updateProjectionMatrix();

    // Update level indicator
  const levelIndicator = document.getElementById('LevelInfoPanel');
  if (data.level === null) {
    levelIndicator.textContent = `Custom Network`;
  } else {
    levelIndicator.textContent = `Level ${data.level}`;
  }

  if (data.cost === 0.0) {
    if (!document.getElementById('solvedOverlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'solvedOverlay';
      overlay.className = 'ui-element';
      Object.assign(overlay.style, {
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(0, 0, 0, 0.8)',
        padding: '24px 32px',
        borderRadius: '8px',
        textAlign: 'center',
        zIndex: '9999',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        pointerEvents: 'auto'
      });

      const text = document.createElement('div');
      text.textContent = 'Solved !';
      Object.assign(text.style, {
        fontSize: '48px',
        fontWeight: '700',
        marginBottom: '16px',
        lineHeight: '1'
      });

      const btn = document.createElement('button');
      btn.id = 'nextLevelBtn';
      btn.textContent = 'Next Level';
      Object.assign(btn.style, {
        padding: '10px 20px',
        fontSize: '16px',
        borderRadius: '6px',
        border: 'none',
        cursor: 'pointer',
        background: '#2196F3',
        color: '#fff'
      });

      btn.addEventListener('click', () => {
        const nextLevelBtn = document.getElementById("nextLevelBtn");
        nextLevelBtn.disabled = true;
        nextLevelBtn.textContent = "Loading...";
        next_level();
      });

      overlay.appendChild(text);
      overlay.appendChild(btn);
      document.body.appendChild(overlay);
    }
  }
}