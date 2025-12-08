import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import TWEEN from '@tweenjs/tween.js';

// --- Create scene, camera, renderer ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

const aspect = 0.5 * window.innerWidth / window.innerHeight;
const d = 350;  // size of view volume

const mainCamera = new THREE.OrthographicCamera(
  -d * aspect * 0.3, d * aspect * 0.3,   // left, right
  d * 0.3, -d * 0.3                      // top, bottom
);
mainCamera.position.set(250, 250, 500);
mainCamera.up.set(0, 1, 0);
mainCamera.lookAt(250, 250, 0);

const overviewCamera = new THREE.OrthographicCamera(
  -d * aspect, d * aspect,   // left, right
  d, -d                    // top, bottom
);
overviewCamera.position.set(250, 250, 500);
overviewCamera.up.set(0, 1, 0);
overviewCamera.lookAt(250, 250, 0);

// --- Main renderer ---
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('webgl') });
renderer.setSize(window.innerWidth, window.innerHeight);

// --- Label renderer ---
const labelSceneMain = new THREE.Scene();
const labelSceneOverview = new THREE.Scene();

const labelRendererOverview = new CSS2DRenderer();
labelRendererOverview.setSize(window.innerWidth / 2, window.innerHeight);
document.getElementById('labelsOverview').appendChild(labelRendererOverview.domElement);

const labelRendererMain = new CSS2DRenderer();
labelRendererMain.setSize(window.innerWidth / 2, window.innerHeight);
document.getElementById('labelsMain').appendChild(labelRendererMain.domElement);


// --- Controls ---
const controls = new OrbitControls(mainCamera, renderer.domElement);
controls.enableRotate = false;  // no rotation
controls.enableZoom = true;     // allow zoom
controls.enablePan = true;      // allow map-like pan
controls.screenSpacePanning = true;
controls.target.set(250, 250, 0);
controls.update();

// --- Fetch network data ---
async function fetchNetwork() {
  const response = await fetch('http://127.0.0.1:8000/network_state');
  const data = await response.json();
  return data;
}

// --- Create nodes ---
function createNodes(nodes) {
  const nodeGroup = new THREE.Group();
  const nodesOverview = [];
  const nodesMain = [];

  nodes.forEach(node => {
    const color = node.injection >= 0 ? 0x00ff00 : 0xff0000;
    const geometry = new THREE.SphereGeometry(5, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color });

    const sphereMain = new THREE.Mesh(geometry, material);
    sphereMain.position.set(node.x, node.y, 0);
    nodesMain.push(sphereMain);

    const sphereOverview = new THREE.Mesh(geometry, material.clone());
    sphereOverview.position.set(node.x, node.y, 0);
    nodesOverview.push(sphereOverview);

    nodeGroup.add(sphereMain);
    nodeGroup.add(sphereOverview);

    // Node injection label using CSS2DObject
    const divMain = document.createElement('div');
    divMain.className = 'label';
    divMain.textContent = node.injection.toFixed(1);
    divMain.style.color = 'white';
    const label = new CSS2DObject(divMain);
    label.position.set(node.x, node.y, 0);
    labelSceneMain.add(label);

    const divOverview = divMain.cloneNode(true);
    const labelOverview = new CSS2DObject(divOverview);
    labelOverview.position.set(node.x, node.y, 0);
    labelSceneOverview.add(labelOverview);
  });
  return nodeGroup;
}

// --- Create lines with flow visualization ---
function createLines(nodes, lines) {
  const lineGroup = new THREE.Group();
  const nodeMap = {};
  nodes.forEach(n => { nodeMap[n.id] = n; });

  lines.forEach(line => {
    const from = nodeMap[line.from_node];
    const to = nodeMap[line.to_node];

    // Base line
    const color = Math.abs(line.flow) > line.limit ? 0xff0000 : 0xbbbbbb;
    const material = new THREE.LineBasicMaterial({ color });
    const points = [
      new THREE.Vector3(from.x, from.y, 0),
      new THREE.Vector3(to.x, to.y, 0)
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const lineMesh = new THREE.Line(geometry, material);
    lineGroup.add(lineMesh);

    // Moving particle along the line
    let line_length = points[0].distanceTo(points[1]);
    let n_particles = Math.max(1, Math.floor(line_length / 10));
    for (let i = 0; i < n_particles; i++) {
      const particleGeometry = new THREE.SphereGeometry(1, 6, 6);
      const particleMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
      const particle = new THREE.Mesh(particleGeometry, particleMaterial);
      particle.userData = { from: points[0], to: points[1], speed: line.flow / line_length * 2, t: i / n_particles };
      lineGroup.add(particle);
    }

    // Flow magnitude label using CSS2DObject
    const div = document.createElement('div');
    div.className = 'label';
    div.textContent = Math.abs(line.flow).toFixed(1);
    div.style.color = 'yellow';
    const label = new CSS2DObject(div);
    label.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, 0);
    labelSceneMain.add(label);
    labelSceneOverview.add(label.clone());
  });

  return lineGroup;
}

// --- Main ---
fetchNetwork().then(data => {
  const nodes = createNodes(data.nodes);
  const lines = createLines(data.nodes, data.lines);
  scene.add(lines);
  scene.add(nodes);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  TWEEN.update();

  // Animate flow particles and update labels
  scene.traverse(obj => {
    if (obj.userData.t !== undefined) {
      obj.userData.t += obj.userData.speed * 0.01;  // speed proportional to flow
      if (obj.userData.t > 1) obj.userData.t = 0;
      if (obj.userData.t < 0) obj.userData.t = 1;
      obj.position.lerpVectors(obj.userData.from, obj.userData.to, obj.userData.t);
    }
  });

  const W = window.innerWidth;
  const H = window.innerHeight;

  // --- Render left static overview ---
  renderer.setViewport(0, 0, W / 2 - 5, H);
  renderer.setScissor(0, 0, W / 2 - 5, H);
  renderer.setScissorTest(true);
  renderer.render(scene, overviewCamera);
  //renderer.render(overlayScene, overlayCamera);

  // --- Render right interactive camera ---
  renderer.setViewport(W / 2 + 5, 0, W / 2 - 5, H);
  renderer.setScissor(W / 2 + 5, 0, W / 2 - 5, H);
  renderer.setScissorTest(true);
  renderer.render(scene, mainCamera);

  // --- Render MAIN labels into right half ---
  labelRendererOverview.render(labelSceneOverview, overviewCamera);
  labelRendererMain.render(labelSceneMain, mainCamera);

}
animate();


// --- Handle resize ---
window.addEventListener('resize', () => {
  for (const cam of [mainCamera, overviewCamera]) {
    const aspect = 0.5 * window.innerWidth / window.innerHeight;
    cam.left = -d * aspect;
    cam.right = d * aspect;
    cam.top = d;
    cam.bottom = -d;
    cam.updateProjectionMatrix();
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Click on node to focus ---
window.addEventListener('click', (event) => {
  // Calculate mouse position in normalized device coordinates
  const mouse = new THREE.Vector2();
  mouse.x = ((event.clientX - window.innerWidth / 2 - 5) / (window.innerWidth / 2 - 5)) * 2 - 1;
  mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

  // Raycast to find intersected nodes
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, mainCamera);
  const intersects = raycaster.intersectObjects(scene.children, true);

  if (intersects.length > 0) {
    console.log('Clicked on node:', intersects[0].object);
    const intersected = intersects[0].object;
    // Smoothly move camera to focus on the clicked node
    const targetPosition = new THREE.Vector3().copy(intersected.position);
    targetPosition.z += 200; // offset back
    new TWEEN.Tween(mainCamera.position).to({
      x: targetPosition.x,
      y: targetPosition.y,
      z: targetPosition.z
    }, 1000).easing(TWEEN.Easing.Quadratic.Out).start();
  }
});