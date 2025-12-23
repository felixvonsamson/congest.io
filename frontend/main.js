import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import { config } from "./config.js";
import { updateNetwork } from './network/updateNetwork.js';
import { getViewports } from './ui/viewport_calculations.js';

// --- Settings ---
const settings = {
  collapseOverview: false,
  isPortrait: null,
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

// --- Update collapse button symbol ---
if (settings.isPortrait) {
  document.getElementById('collapseOverviewBtn').textContent = "⯅";
}

// --- Fetch network data ---
async function fetchNetwork() {
  const response = await fetch('/api/network_state');
  const data = await response.json();
  return data;
}

// --- Main ---
fetchNetwork().then(data => {
  updateNetwork(settings, scenes, cameras, data, state, controls, { onToggle });
  // Show help screen on first tutorial level
  const helpPanel = document.getElementById("helpPanel");
  if (data.tutorial && data.level === 1 && data.cost > 0.0) {
    helpPanel.style.display = "block";
  }
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
  updateParticlesInGroup(state.overviewNetwork, state.particles);

  if (!settings.collapseOverview) {
      // --- Render overview ---
      renderer.setViewport(settings.overview_viewport.x, settings.overview_viewport.y, settings.overview_viewport.w, settings.overview_viewport.h);
      renderer.setScissor(settings.overview_viewport.x, settings.overview_viewport.y, settings.overview_viewport.w, settings.overview_viewport.h);
      renderer.setScissorTest(true);
      renderer.render(scenes.overview, cameras.overview);
  }
  // --- Render interactive camera ---
  renderer.setViewport(settings.main_viewport.x, settings.main_viewport.y, settings.main_viewport.w, settings.main_viewport.h);
  renderer.setScissor(settings.main_viewport.x, settings.main_viewport.y, settings.main_viewport.w, settings.main_viewport.h);
  renderer.setScissorTest(true);
  renderer.render(scenes.main, cameras.main);
  
  // --- Render MAIN labels into right half ---
  if (!settings.collapseOverview) {
    labelRendererOverview.render(state.labelsOverview, cameras.overview);
  }
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
  settings.isPortrait = window.innerHeight > window.innerWidth;
  for (const cam of [cameras.main, cameras.overview]) {
    settings.aspect = 0.5 * window.innerWidth / window.innerHeight;
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
  if (vp.contains(event, settings.main_viewport)) {
    mouse = vp.toNDC(event, settings.main_viewport);

    // raycast against main scene using main camera
    raycaster.setFromCamera(mouse, cameras.main);
    const intersects = raycaster.intersectObjects(scenes.main.children, true);
    if (!intersects.length) return;

    for (const inter of intersects) {
      if (inter.object.userData && inter.object.userData.id) {
        // call reset endpoint for that node
        fetch(`/api/reset_switches?node_id=${inter.object.userData.id}`, { method: 'POST' })
          .then(res => res.json())
          .then(data => {
            updateNetwork(settings, scenes, cameras, data, state, controls, { onToggle });
          })
          .catch(err => console.error('reset_switches failed', err));
        return;
      }
    }
  };
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
  }
});

function focusMainCamera(target) {
  const offset = new THREE.Vector3(0, 0, 200);
  newCamPosition = target.clone().add(offset);
  newControlTarget = target;
  controls.update();
}

function show_new_network() {
  fetch('/api/reset_network', { method: 'POST' }).then(response => response.json()).then(data => {
    updateNetwork(settings, scenes, cameras, data, state, controls, { onToggle });
    const newNetworkBtn = document.getElementById("newNetworkBtn");
    newNetworkBtn.disabled = false;
    newNetworkBtn.textContent = "new Network";
  });
}

function next_level() {
  fetch('/api/next_level', { method: 'POST' }).then(response => response.json()).then(data => {
    updateNetwork(settings, scenes, cameras, data, state, controls, { onToggle });
    const nextLevelBtn = document.getElementById("nextLevelBtn");
    nextLevelBtn.disabled = false;
    nextLevelBtn.textContent = "Next Level";
  });
}

// const newNetworkBtn = document.getElementById("newNetworkBtn");
// newNetworkBtn.addEventListener("click", () => {
//   newNetworkBtn.disabled = true;
//   newNetworkBtn.textContent = "Loading...";
//   show_new_network();
// });

const collapseOverviewBtn = document.getElementById("collapseOverviewBtn");
collapseOverviewBtn.addEventListener("click", () => {
  settings.collapseOverview = !settings.collapseOverview;
  vp = getViewports(settings);
  const labelsOverviewDiv = document.getElementById('labelsOverview');
  const labelsMainDiv = document.getElementById('labelsMain');
  labelsOverviewDiv.style.height = settings.overview_viewport.h + 'px';
  labelsOverviewDiv.style.width = settings.overview_viewport.w + 'px';
  labelsMainDiv.style.height = settings.main_viewport.h + 'px';
  labelsMainDiv.style.width = settings.main_viewport.w + 'px';
  labelsMainDiv.style.top = window.innerHeight - settings.main_viewport.h + 'px';
  if (settings.collapseOverview) {
    scenes.overview.remove(state.overviewNetwork);
    labelRendererOverview.domElement.style.display = 'none';
    if (settings.isPortrait) {
      collapseOverviewBtn.textContent = "⯆";
      collapseOverviewBtn.style.top = "10px";
    } else {
      collapseOverviewBtn.textContent = "⯈";
      collapseOverviewBtn.style.left = "10px";
    }
  } else {
    scenes.overview.add(state.overviewNetwork);
    labelRendererOverview.domElement.style.display = 'block';
    if (settings.isPortrait) {
      collapseOverviewBtn.textContent = "⯅";
      collapseOverviewBtn.style.top = "50%";
    } else {
      collapseOverviewBtn.textContent = "⯇";
      collapseOverviewBtn.style.left = "50%";
    }
  }
  labelRendererMain.setSize(settings.main_viewport.w, settings.main_viewport.h);
  cameras.main.left = -d * settings.aspect * 0.3;
  cameras.main.right = d * settings.aspect * 0.3;
  cameras.main.top = d * 0.3;
  cameras.main.bottom = -d * 0.3;
  cameras.main.updateProjectionMatrix();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 's' || event.key === 'S') {
    fetch('/api/solve', { method: 'POST' })
      .then(response => response.json())
      .then(data => {
        updateNetwork(settings, scenes, cameras, data, state, controls, { onToggle });
      })
      .catch(err => console.error('solve failed', err));
  }
});

function onToggle(switchID) {
  fetch(`/api/switch_node?switch_id=${switchID}`, {
    method: 'POST'
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        showErrorToast(data.error);
        return;
      }
      updateNetwork(settings, scenes, cameras, data, state, controls, { onToggle });
    });
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