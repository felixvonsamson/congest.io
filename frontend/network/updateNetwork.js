import { createNetwork } from './createNetwork.js';

export function updateNetwork({
  mainScene,
  overviewScene,
  createNetwork,
  data,
  state
}) {
  if (state.mainNetwork) mainScene.remove(state.mainNetwork);
  if (state.overviewNetwork) overviewScene.remove(state.overviewNetwork);

  state.mainNetwork = createNetwork(data, state);
  state.overviewNetwork = createNetwork(data, state);

  mainScene.add(state.mainNetwork);
  overviewScene.add(state.overviewNetwork);
}


function update_network(data) {
  if (state.mainNetwork) {
    mainScene.remove(state.mainNetwork);
  }
  if (state.overviewNetwork) {
    overviewScene.remove(state.overviewNetwork);
  }
  state.mainNetwork = createNetwork(data, state, controls, { onToggle });
  state.overviewNetwork = state.mainNetwork.clone();
  overviewScene.add(state.overviewNetwork);
  mainScene.add(state.mainNetwork);

  // Center overview camera on network
  const max_x = Math.max(...Object.values(data.nodes).map(n => n.x));
  const min_x = Math.min(...Object.values(data.nodes).map(n => n.x));
  const max_y = Math.max(...Object.values(data.nodes).map(n => n.y));
  const min_y = Math.min(...Object.values(data.nodes).map(n => n.y));
  const center_x = (max_x + min_x) / 2;
  const center_y = (max_y + min_y) / 2;
  let size_x = (max_x - min_x) * 1.2;
  let size_y = (max_y - min_y) * 1.2;
  if (size_x > size_y * aspect) {
    size_y = size_x / aspect;
  } else {
    size_x = size_y * aspect;
  }
  overviewCamera.left = -size_x / 2;
  overviewCamera.right = size_x / 2;
  overviewCamera.top = size_y / 2;
  overviewCamera.bottom = -size_y / 2;
  overviewCamera.position.set(center_x, center_y, 500);
  overviewCamera.lookAt(center_x, center_y, 0);
  overviewCamera.updateProjectionMatrix();

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