import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import { config } from "./config.js";
import { updateNetwork, toggleSwitch } from './network/updateNetwork.js';
import { getViewports } from './ui/viewport_calculations.js';
import { calculatePowerFlow } from './network/powerFlow.js';
import { ensureLoggedIn, authHeaders } from './auth/auth.js';
import { renderOverviewToImage } from './level_image_halper.js';

// --- Settings ---
const settings = {
  overview_viewport: null,
  main_viewport: null,
  aspect: null,
};
let vp = getViewports(settings);
let newCamPosition = null;
let newControlTarget = null;

// --- Objects ---
let cameraRect = null;
const raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
const state = {
  mainNetwork: null,
  overviewNetwork: null,
  labelsOverview: null,
  labelsMain: null,
  particles: [],
  particleMeshes: []
};

// --- Create the overview and main scene with camera and renderer ---
const scenes = {
  overview: new THREE.Scene(),
  main: new THREE.Scene()
};
scenes.overview.background = new THREE.Color(config.colors.background);
scenes.main.background = new THREE.Color(config.colors.background);

const d = 400;  // size of view volume
const cameras = {
  overview: new THREE.OrthographicCamera(),
  main: new THREE.OrthographicCamera(
    -d * settings.aspect * 0.3, d * settings.aspect * 0.3,   // left, right
    d * 0.3, -d * 0.3                      // top, bottom
  )
};
cameras.overview.up.set(0, 1, 0);
cameras.main.position.set(250, 250, 500);
cameras.main.up.set(0, 1, 0);
cameras.main.lookAt(250, 250, 0);

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('webgl'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

// --- Label renderers ---
state.labelsMain = new THREE.Group();
state.labelsOverview = new THREE.Group();
const labelRendererOverview = new CSS2DRenderer();
const labelRendererMain = new CSS2DRenderer();
labelRendererOverview.setSize(settings.overview_viewport.w, settings.overview_viewport.h);
labelRendererMain.setSize(settings.main_viewport.w, settings.main_viewport.h);
document.getElementById('labelsOverview').appendChild(labelRendererOverview.domElement);
document.getElementById('labelsMain').appendChild(labelRendererMain.domElement);

// --- Controls ---
const inputEl = document.getElementById('labelsMain');
const controls = new OrbitControls(cameras.main, inputEl);
controls.touches.ONE = THREE.TOUCH.PAN;
controls.enableRotate = false;  // no rotation
controls.target.set(250, 250, 0);
controls.update();

// --- Camera rectangle in overview ---
const rectangleGeometry = new THREE.BufferGeometry();
const rectWidth = cameras.main.right - cameras.main.left;
const rectHeight = cameras.main.top - cameras.main.bottom;
const vertices = new Float32Array([
  -rectWidth / 2, -rectHeight / 2, 0,
  rectWidth / 2, -rectHeight / 2, 0,
  rectWidth / 2, rectHeight / 2, 0,
  -rectWidth / 2, rectHeight / 2, 0,
  -rectWidth / 2, -rectHeight / 2, 0
]);
rectangleGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
const rectangleMaterial = new THREE.LineBasicMaterial({ color: 'rgb(255, 150, 0)' });
cameraRect = new THREE.Line(rectangleGeometry, rectangleMaterial);
cameraRect.position.copy(controls.target);
cameraRect.renderOrder = 10;  // render on top
scenes.overview.add(cameraRect);

// --- Fetch network data ---
async function fetchNetworkPowerflow() {
  let networkData = JSON.parse(sessionStorage.getItem('network'));
  if (!networkData) {
    const player = JSON.parse(sessionStorage.getItem('player'));
    const response = await fetch('/api/load_level', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ 
        level_num: player.current_level
      })
    });
    if (!response.ok) {
      throw new Error('Failed to load level data');
    }
    networkData = await response.json();
    sessionStorage.setItem('network', JSON.stringify(networkData));
  }
  networkData = calculatePowerFlow(networkData);
  return networkData;
}

// --- Main ---
ensureLoggedIn().then(ok => {
  if (!ok) return;
  fetchNetworkPowerflow().then(data => {
    updateNetwork(settings, scenes, cameras, data, state, controls, { onToggle });
    // Show help screen on first tutorial level
    const helpPanel = document.getElementById("helpPanel");
    if (data.tutorial && data.level === 1 && data.cost > 0.0) {
      helpPanel.style.display = "block";
    }
  });
});

function animate() {
  requestAnimationFrame(animate);
  if(newCamPosition && newControlTarget) {
    // Smoothly interpolate camera position and control target
    cameras.main.position.lerp(newCamPosition, 0.2);
    controls.target.lerp(newControlTarget, 0.2);
    // If close enough, snap to target
    if (cameras.main.position.distanceTo(newCamPosition) < 0.1 &&
        controls.target.distanceTo(newControlTarget) < 0.1) {
      cameras.main.position.copy(newCamPosition);
      controls.target.copy(newControlTarget);
      newCamPosition = null;
      newControlTarget = null;
    }
  }
  controls.update();

  // Animate flow particles and update labels
  for (const p of state.particles) {
    if (p.t !== undefined) {
      p.t += p.speed * 0.01;
      if (p.t > 1) p.t = 0;
      if (p.t < 0) p.t = 1;
    }
  }

  updateParticlesInGroup(state.mainNetwork, state.particles);

  // --- Render interactive camera ---
  renderer.setViewport(settings.main_viewport.x, settings.main_viewport.y, settings.main_viewport.w, settings.main_viewport.h);
  renderer.setScissor(settings.main_viewport.x, settings.main_viewport.y, settings.main_viewport.w, settings.main_viewport.h);
  renderer.setScissorTest(true);
  renderer.render(scenes.main, cameras.main);
  
  // --- Render overview ---
    renderer.setViewport(settings.overview_viewport.x, settings.overview_viewport.y, settings.overview_viewport.w, settings.overview_viewport.h);
    renderer.setScissor(settings.overview_viewport.x, settings.overview_viewport.y, settings.overview_viewport.w, settings.overview_viewport.h);
    renderer.setScissorTest(true);
    renderer.render(scenes.overview, cameras.overview);

  // --- Render MAIN labels into right half ---
  labelRendererOverview.render(state.labelsOverview, cameras.overview);
  labelRendererMain.render(state.labelsMain, cameras.main);
}
animate();

function updateParticlesInGroup(group, states) {
  let i = 0;
  if (!group) return;

  group.traverse(obj => {
    if (obj.isMesh && obj.userData?.state?.t !== undefined) {
      obj.position.lerpVectors(
        states[i].from,
        states[i].to,
        states[i].t
      );
      if (states[i].from_b && states[i].to_b) {
        obj.material.color.setHSL(0.14, 1, 1);
      } else if (states[i].to_b) {
        obj.material.color.setHSL(0.14, 1, 0.5 + 0.5 * states[i].t);
      } else if (states[i].from_b) {
        obj.material.color.setHSL(0.14, 1, 1 - 0.5 * states[i].t);
      } else {
        obj.material.color.setHSL(0.14, 1, 0.5);
      }
      i++;
    }
  });
}

// --- Handle resize ---
window.addEventListener('resize', () => {
  for (const cam of [cameras.main, cameras.overview]) {
    settings.aspect = window.innerWidth / window.innerHeight;
    cam.left = -d * settings.aspect;
    cam.right = d * settings.aspect;
    cam.top = d;
    cam.bottom = -d;
    cam.updateProjectionMatrix();
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
});

controls.addEventListener('change', () => {
  // when camera is moved, determine the viewport in the main view and show it in the form of a rectangle in the overview
  cameraRect.position.copy(controls.target);
  cameraRect.scale.setScalar(1 / cameras.main.zoom);
});

window.addEventListener('click', (event) => {
  // ignore clicks on UI elements
  if (event.target.closest('.ui-element')) return;
  if (vp.contains(event, settings.overview_viewport)) {
    // --- 2. Convert mouse position to NDC for LEFT viewport ---
    mouse = vp.toNDC(event, settings.overview_viewport);

    // --- 3. Raycast from overview camera ---
    raycaster.setFromCamera(mouse, cameras.overview);

    // --- 4. Intersect ray with the z=0 plane (region of the overview) ---
    const planeZ0 = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const target = new THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(planeZ0, target);
    if (!hit) return;

    // --- 5. Move MAIN camera & controls to the clicked region (even if no object) ---
    focusMainCamera(target);
    return;
  }
  if (vp.contains(event, settings.main_viewport)) {
    mouse = vp.toNDC(event, settings.main_viewport);

    // raycast against main scene using main camera
    raycaster.setFromCamera(mouse, cameras.main);
    const intersects = raycaster.intersectObjects(scenes.main.children, true);
    if (!intersects.length) return;

    for (const inter of intersects) {
      if (inter.object.userData && inter.object.userData.id) {
        // call reset endpoint for that node
        let network = JSON.parse(sessionStorage.getItem('network'));
        // for all lines in the network, check if the from_node or to_node is inter.object.userData.id + "b" and if it is the case switch the switch back on the main node
        for (const line of Object.values(network.lines)) {
          if (line.from_node === inter.object.userData.id + "b") {
            network = toggleSwitch(network, line.id + "_from");
          }
          if (line.to_node === inter.object.userData.id + "b") {
            network = toggleSwitch(network, line.id + "_to");
          }
        }
        network = calculatePowerFlow(network);
        updateNetwork(settings, scenes, cameras, network, state, controls, { onToggle });
        return;
      }
    }
  };
});

function focusMainCamera(target) {
  const offset = new THREE.Vector3(0, 0, 200);
  newCamPosition = target.clone().add(offset);
  newControlTarget = target;
  controls.update();
}

function next_level() {
  const player = JSON.parse(sessionStorage.getItem('player'));
  fetch('/api/load_level', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ level_num: player.current_level + 1 })
  }).then(response => response.json()).then(data => {
    player.current_level += 1;
    sessionStorage.setItem('player', JSON.stringify(player));
    updateNetwork(settings, scenes, cameras, data, state, controls, { onToggle });
    const nextLevelBtn = document.getElementById("nextLevelBtn");
    nextLevelBtn.disabled = false;
    nextLevelBtn.textContent = "Next Level";
  });
};

window.addEventListener('keydown', (event) => {
  if (document.getElementById('authPanel').style.display !== 'none') {
    return; // do not handle key events when auth panel is open
  }
  if (event.key === 's' || event.key === 'S') {
    let network = JSON.parse(sessionStorage.getItem('network'));
    fetch('/api/solve', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ network_data: network })
    })
      .then(response => response.json())
      .then(data => {
        updateNetwork(settings, scenes, cameras, data, state, controls, { onToggle });
      })
      .catch(err => console.error('solve failed', err));
  }
  if (event.key =='c') {
    //clear session storage and reload page
    sessionStorage.clear();
    location.reload();
  }
  if (event.key === "p") {
    renderOverviewToImage(scenes, config, settings, cameras);
  }
});

function onToggle(switchID) {
  let network = JSON.parse(sessionStorage.getItem('network'));
  network = toggleSwitch(network, switchID);
  network = calculatePowerFlow(network);
  if (network.cost === Infinity) {
    showErrorToast("This switch would cut off part of the grid.");
    // Revert the switch toggle
    network = toggleSwitch(network, switchID);
    network = calculatePowerFlow(network);
  }
  updateNetwork(settings, scenes, cameras, network, state, controls, { onToggle });
}

function showErrorToast(message) {
  const toast = document.createElement('div');
  toast.className = 'error-toast';
  toast.innerHTML = "<b>Action blocked:</b> This switch would cut off part of the grid.<br>Every node must remain connected to ensure power can flow through the system.";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

document.getElementById('nextLevelBtn').addEventListener('click', () => {
  const nextLevelBtn = document.getElementById('nextLevelBtn');
  nextLevelBtn.disabled = true;
  nextLevelBtn.textContent = 'Loading...';
  next_level();
});