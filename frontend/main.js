import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { settings } from "./settings.js";

// --- Objects ---
let particles = [];
let mainNetwork = null;
let overviewNetwork = null;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// --- Create the overview and main scene with camera and renderer ---
const overviewScene = new THREE.Scene();
overviewScene.background = new THREE.Color(settings.colors.background);
const mainScene = new THREE.Scene();
mainScene.background = new THREE.Color(settings.colors.background);

const aspect = 0.5 * window.innerWidth / window.innerHeight;
const d = 400;  // size of view volume

const overviewCamera = new THREE.OrthographicCamera(
  -d * aspect, d * aspect,   // left, right
  d, -d                    // top, bottom
);
overviewCamera.position.set(250, 250, 500);
overviewCamera.up.set(0, 1, 0);
overviewCamera.lookAt(250, 250, 0);

const mainCamera = new THREE.OrthographicCamera(
  -d * aspect * 0.3, d * aspect * 0.3,   // left, right
  d * 0.3, -d * 0.3                      // top, bottom
);
mainCamera.position.set(250, 250, 500);
mainCamera.up.set(0, 1, 0);
mainCamera.lookAt(250, 250, 0);

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('webgl'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

// --- Label renderer ---
const labelsMain = new THREE.Group();
const labelsOverview = new THREE.Group();

const labelRendererOverview = new CSS2DRenderer();
labelRendererOverview.setSize(window.innerWidth / 2 - 5, window.innerHeight);
document.getElementById('labelsOverview').appendChild(labelRendererOverview.domElement);

const labelRendererMain = new CSS2DRenderer();
labelRendererMain.setSize(window.innerWidth / 2 - 5, window.innerHeight);
document.getElementById('labelsMain').appendChild(labelRendererMain.domElement);


// --- Controls ---
const inputEl = document.getElementById('mainInput');
const controls = new OrbitControls(mainCamera, inputEl);
controls.enableRotate = false;  // no rotation
controls.target.set(250, 250, 0);
controls.update();

// --- Fetch network data ---
async function fetchNetwork() {
  const response = await fetch('http://127.0.0.1:8000/network_state');
  const data = await response.json();
  return data;
}

function createNetwork(data) {
  labelsMain.clear();
  labelsOverview.clear();
  particles = [];
  const networkGroup = new THREE.Group();

  Object.entries(data.lines).forEach(([, line]) => {
    const from = data.nodes[line.from_node];
    const to = data.nodes[line.to_node];

    // Base line
    const color = Math.abs(line.flow) > line.limit ? settings.colors.lineOverload : settings.colors.line;
    const material = new THREE.LineBasicMaterial({ color });
    const points = [
      new THREE.Vector3(from.x, from.y, 0),
      new THREE.Vector3(to.x, to.y, 0)
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const lineMesh = new THREE.Line(geometry, material);
    networkGroup.add(lineMesh);

    // Moving particle along the line
    let line_length = points[0].distanceTo(points[1]);
    let n_particles = Math.max(1, Math.floor(line_length / 10));
    for (let i = 0; i < n_particles; i++) {
      const particleShape = new THREE.Shape();
      particleShape.absarc(0, 0, 1);
      const particleGeometry = new THREE.ShapeGeometry(particleShape, 32);
      const particleMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide, depthWrite: false });
      const particle = new THREE.Mesh(particleGeometry, particleMaterial);
      particle.userData = { from: points[0], to: points[1], speed: line.flow / line_length * 2, t: i / n_particles };
      particles.push(particle.userData);
      networkGroup.add(particle);
    }

    // Flow magnitude label using CSS2DObject
    const div = document.createElement('div');
    div.className = 'label';
    div.textContent = Math.abs(line.flow).toFixed(0);
    div.style.color = 'yellow';
    const label = new CSS2DObject(div);
    label.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, 0);
    labelsMain.add(label);
    labelsOverview.add(label.clone());

    for (let end of ["from", "to"]) {
      let type = "normal"
      if (end === "from" && from.id.includes('b') || end === "to" && to.id.includes('b')) {
        type = "b"
      }
      const toggleDiv = createToggle(type = type);
      toggleDiv.dataset.lineNodeID = line.id + "_" + end;
      toggleDiv.addEventListener('click', (event) => {
        const switchID = event.currentTarget.dataset.lineNodeID;
        if (toggleDiv.style.backgroundColor === 'blue') {
          toggleDiv.style.backgroundColor = 'green';
        } else {
          toggleDiv.style.backgroundColor = 'blue';
        }
        // Send switch request to server
        fetch(`http://127.0.0.1:8000/switch_node?switch_id=${switchID}`)
          .then(response => response.json())
          .then(data => {
            update_network(data);
          });
      });
      const toggle = new CSS2DObject(toggleDiv);
      const v_from = new THREE.Vector3(from.x, from.y, 0);
      const v_to = new THREE.Vector3(to.x, to.y, 0);
      const v_dir = new THREE.Vector3().subVectors(v_to, v_from).normalize();
      let v_pos;
      if (end === "from") {
        v_pos = v_from.clone().add(v_dir.clone().multiplyScalar(12));
      } else {
        v_pos = v_to.clone().add(v_dir.clone().multiplyScalar(-12));
      }
      toggle.position.set(v_pos.x, v_pos.y, 0);
      labelsMain.add(toggle);
    }
  });

  // Nodes
  Object.entries(data.nodes).forEach(([id, node]) => {
    if (id.includes('b')) {
      // draw a circle with radius 7 border color white and width 2 and no fill
      const nodeShape = new THREE.Shape();
      nodeShape.absarc(node.x, node.y, 7);
      const holePath = new THREE.Path();
      holePath.absarc(node.x, node.y, 6);
      nodeShape.holes.push(holePath);
      const nodeGeom = new THREE.ShapeGeometry(nodeShape, 32);
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const nodeMesh = new THREE.Mesh(nodeGeom, material);
      networkGroup.add(nodeMesh);
    } else {
      // regular node
      const color = node.injection >= 0 ? settings.colors.nodeProd : settings.colors.nodeCons;
      const nodeShape = new THREE.Shape();
      nodeShape.absarc(node.x, node.y, 5);
      const nodeGeom = new THREE.ShapeGeometry(nodeShape, 32);
      const material = new THREE.MeshBasicMaterial({
        color: color,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const nodeMesh = new THREE.Mesh(nodeGeom, material);
      nodeMesh.userData = {id: node.id};
      networkGroup.add(nodeMesh);

      // Node injection label using CSS2DObject
      const divMain = document.createElement('div');
      divMain.className = 'label';
      divMain.textContent = node.injection.toFixed(0);
      divMain.style.color = 'white';
      const label = new CSS2DObject(divMain);
      label.position.set(node.x, node.y, 0);
      labelsMain.add(label);

      const divOverview = divMain.cloneNode(true);
      const labelOverview = new CSS2DObject(divOverview);
      labelOverview.position.set(node.x, node.y, 0);
      labelsOverview.add(labelOverview);
    }
  });
  return networkGroup;
}

// --- Main ---
fetchNetwork().then(data => {
  update_network(data);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();

  // Animate flow particles and update labels
  for (const p of particles) {
    if (p.t !== undefined) {
      p.t += p.speed * 0.01;
      if (p.t > 1) p.t = 0;
      if (p.t < 0) p.t = 1;
    }
  }

  updateParticlesInGroup(mainNetwork, particles);
  updateParticlesInGroup(overviewNetwork, particles);

  const W = window.innerWidth;
  const H = window.innerHeight;

  // --- Render left static overview ---
  renderer.setViewport(0, 0, W / 2 - 5, H);
  renderer.setScissor(0, 0, W / 2 - 5, H);
  renderer.setScissorTest(true);
  renderer.render(overviewScene, overviewCamera);

  // --- Render right interactive camera ---
  renderer.setViewport(W / 2 + 5, 0, W / 2 - 5, H);
  renderer.setScissor(W / 2 + 5, 0, W / 2 - 5, H);
  renderer.setScissorTest(true);
  renderer.render(mainScene, mainCamera);

  // --- Render MAIN labels into right half ---
  labelRendererOverview.render(labelsOverview, overviewCamera);
  labelRendererMain.render(labelsMain, mainCamera);

}
animate();

function updateParticlesInGroup(group, states) {
  let i = 0;
  if (!group) return;

  group.traverse(obj => {
    if (obj.isMesh && obj.userData?.t !== undefined) {
      obj.position.lerpVectors(
        states[i].from,
        states[i].to,
        states[i].t
      );
      i++;
    }
  });
}



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

window.addEventListener('click', (event) => {
  const W = window.innerWidth;
  const H = window.innerHeight;

  // --- 1. Only react to clicks in the OVERVIEW (left half) ---
  const leftWidth = W / 2;
  if (event.clientX > leftWidth){
    const rightOffset = leftWidth + 5;
    const rightWidth = W / 2 - 5;

    // convert mouse to NDC for right viewport
    mouse.x = ((event.clientX - rightOffset) / rightWidth) * 2 - 1;
    mouse.y = (-(event.clientY / H) * 2 + 1);

    // raycast against main scene using main camera
    raycaster.setFromCamera(mouse, mainCamera);
    const intersects = raycaster.intersectObjects(mainScene.children, true);
    if (!intersects.length) return;

    for (const inter of intersects) {
      if (inter.object.userData && inter.object.userData.id) {
        // call reset endpoint for that node
        fetch(`http://127.0.0.1:8000/reset_switches?node_id=${inter.object.userData.id}`)
          .then(res => res.json())
          .then(data => {
            update_network(data);
          })
          .catch(err => console.error('reset_switches failed', err));
        return;
      }
    }
    return;
  };

  // --- 2. Convert mouse position to NDC for LEFT viewport ---
  mouse.x = ((event.clientX / leftWidth) * 2 - 1);
  mouse.y = (-(event.clientY / H) * 2 + 1);

  // --- 3. Raycast from overview camera ---
  raycaster.setFromCamera(mouse, overviewCamera);

  // --- 4. Intersect ray with the z=0 plane (region of the overview) ---
  const planeZ0 = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const target = new THREE.Vector3();
  const hit = raycaster.ray.intersectPlane(planeZ0, target);

  if (!hit) return;

  // --- 5. Move MAIN camera & controls to the clicked region (even if no object) ---
  focusMainCamera(target);
});

function focusMainCamera(target) {
  const offset = new THREE.Vector3(0, 0, 200);

  const newPosition = target.clone().add(offset);

  mainCamera.position.copy(newPosition);
  controls.target.copy(target);
  controls.update();
}


function createToggle(type = 'normal') {
  let backgroundColor = type === 'b' ? 'rgba(200, 200, 200, 0.2)' : 'rgba(200, 200, 200, 0.9)';
  let borderColor = type === 'b' ? 'rgba(200, 200, 200, 0.9)' : 'rgba(200, 200, 200, 0.2)';
  const div = document.createElement('div');
  div.className = 'line-toggle';
  div.style.width = '16px';
  div.style.height = '16px';
  div.style.borderRadius = '50%';
  div.style.backgroundColor = backgroundColor;
  div.style.border = 'none';
  div.style.outline = `4px solid ${borderColor}`;
  div.style.outlineOffset = '2px';
  div.style.cursor = 'pointer';
  return div;
}

function show_new_network(){
  fetch('http://127.0.0.1:8000/reset_network').then(response => response.json()).then(data => {
    update_network(data);
    const newNetworkBtn = document.getElementById("newNetworkBtn");
    newNetworkBtn.disabled = false;
    newNetworkBtn.textContent = "new Network";
  });
}

const newNetworkBtn = document.getElementById("newNetworkBtn");
newNetworkBtn.addEventListener("click", () => {
  newNetworkBtn.disabled = true;
  newNetworkBtn.textContent = "Loading...";
  show_new_network();
});

function update_network(data){
  if (mainNetwork) {
    mainScene.remove(mainNetwork);
  }
  if (overviewNetwork) {
    overviewScene.remove(overviewNetwork);
  }
  mainNetwork = createNetwork(data);
  overviewNetwork = mainNetwork.clone();
  overviewScene.add(overviewNetwork);
  mainScene.add(mainNetwork);

  if(data.solved){
    if (!document.getElementById('solvedOverlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'solvedOverlay';
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
      btn.textContent = 'New Network';
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
        const el = document.getElementById('solvedOverlay');
        if (el) el.remove();
        show_new_network();
      });

      overlay.appendChild(text);
      overlay.appendChild(btn);
      document.body.appendChild(overlay);
    }
  }
}