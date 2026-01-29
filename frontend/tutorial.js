import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import { config } from "./config.js";

const aspect = window.innerWidth / window.innerHeight;
// --- Objects ---
const state = {
  network: null,
  labelsMain: null,
  particles: [],
  particleMeshes: []
};

// --- Geometry helpers ---
const nodeGeometry = (() => {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, config.sizes.nodeRadius);
  return new THREE.ShapeGeometry(shape, 32);
})();
const nodeProdMaterial = new THREE.MeshBasicMaterial({ 
  color: config.colors.nodeProd, 
  side: THREE.DoubleSide, 
  depthWrite: false 
});
const nodeConsMaterial = new THREE.MeshBasicMaterial({ 
  color: config.colors.nodeCons, 
  side: THREE.DoubleSide, 
  depthWrite: false 
});

// --- Create the overview and main scene with camera and renderer ---
const mainScene = new THREE.Scene();
mainScene.background = new THREE.Color(config.colors.background);

const mainCamera = new THREE.OrthographicCamera(
  aspect * 120, -aspect * 120,   // left, right
  120, -120                      // top, bottom
)
mainCamera.position.set(0, 0, 500);
mainCamera.up.set(0, 1, 0);
mainCamera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('webgl'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

// --- Label renderers ---
state.labelsMain = new THREE.Group();
const labelRendererMain = new CSS2DRenderer();
labelRendererMain.setSize(window.innerWidth, window.innerHeight);
document.getElementById('labelsMain').appendChild(labelRendererMain.domElement);

// --- Controls ---
const inputEl = document.getElementById('labelsMain');
const controls = new OrbitControls(mainCamera, inputEl);
controls.touches.ONE = THREE.TOUCH.PAN;
controls.enableRotate = false;  // no rotation
controls.target.set(0, 0, 0);
controls.update();

let situation = situation1();
mainScene.add(situation);

function animate() {
  requestAnimationFrame(animate);

  // Animate flow particles and update labels
  for (const p of state.particles) {
    if (p.t !== undefined) {
      p.t += p.speed * 0.01;
      if (p.t > 1) p.t = 0;
      if (p.t < 0) p.t = 1;
    }
  }

  //updateParticlesInGroup(state.mainNetwork, state.particles);

  // --- Render interactive camera ---
  renderer.render(mainScene, mainCamera);
  labelRendererMain.render(state.labelsMain, mainCamera);
}
animate();

function situation1(){
    const group = new THREE.Group();

    // --- nodes ---
    const nodeMesh1 = nodeMesh({x: 50, y: -30}, true);
    group.add(nodeMesh1);

    const nodeMesh2 = nodeMesh({x: -50, y: -30}, false);
    group.add(nodeMesh2);

    const nodeMesh3 = nodeMesh({x: 0, y: 60}, false);
    group.add(nodeMesh3);

    // --- lines ---
    const line1 = lineGeometry(
        new THREE.Vector3(50, -30, 0),
        new THREE.Vector3(-50, -30, 0),
        config.colors.line
    );
    group.add(line1);
    
    const line2 = lineGeometry(
        new THREE.Vector3(50, -30, 0),
        new THREE.Vector3(0, 60, 0),
        config.colors.line
    );
    group.add(line2);

    const line3 = lineGeometry(
        new THREE.Vector3(-50, -30, 0),
        new THREE.Vector3(0, 60, 0),
        config.colors.line
    );
    group.add(line3);
    console.log(group);

    return group;
}

function nodeMesh(position, isProducer) {
    const material = isProducer ? nodeProdMaterial : nodeConsMaterial;
    const mesh = new THREE.Mesh(nodeGeometry, material);
    mesh.position.set(position.x, position.y, 0);
    mesh.renderOrder = config.render_order.nodes;
    return mesh;
}

function lineGeometry(from, to, color) {
    const direction = new THREE.Vector3().subVectors(to, from);
    const center = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
    const angle = Math.atan2(direction.y, direction.x);
    const material = new THREE.MeshBasicMaterial({ color: color });
    const length = from.distanceTo(to);
    console.log(length);
    const geometry = new THREE.PlaneGeometry(length, 10);
    const lineRect = new THREE.Mesh(geometry, material);
    lineRect.position.copy(center);
    //lineRect.rotation.z = angle;
    lineRect.renderOrder = config.render_order.lines;
    return lineRect;
}