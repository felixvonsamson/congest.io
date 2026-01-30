import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { config } from '../config.js';
import { createToggle, createArrow } from '../ui/toggles.js';

export function createNetwork(mode, data, state, controls, callbacks, overview = false) {

  const group = new THREE.Group();

  Object.values(data.lines).forEach(line => {
    const from = data.nodes[line.from_node];
    const to = data.nodes[line.to_node];

    // Base line
    const fromVector = new THREE.Vector3(from.x, from.y, 0);
    const toVector = new THREE.Vector3(to.x, to.y, 0);
    const direction = new THREE.Vector3().subVectors(toVector, fromVector);
    const normalizedDirection = direction.clone().normalize().multiplyScalar(config.sizes.ringRadiusOuter);
    if (from.id.includes('b')) {
      fromVector.add(normalizedDirection)
    }
    if (to.id.includes('b')) {
      toVector.sub(normalizedDirection);
    }
    const lineLength = fromVector.distanceTo(toVector);
    const center = new THREE.Vector3().addVectors(fromVector, toVector).multiplyScalar(0.5);
    const angle = Math.atan2(direction.y, direction.x);
    const lineWidth = overview ? config.sizes.lineWidth*5 : config.sizes.lineWidth;
    const geometry = new THREE.PlaneGeometry(lineLength, lineWidth);
    const material = new THREE.LineBasicMaterial({
      color: Math.abs(line.flow) > line.limit
        ? config.colors.lineOverload
        : config.colors.line
    });
    const lineRect = new THREE.Mesh(geometry, material);
    lineRect.position.copy(center);
    lineRect.rotation.z = angle;
    lineRect.renderOrder = config.render_order.lines;
    group.add(lineRect);

    // Flow magnitude label using CSS2DObject
    const div = document.createElement('div');
    div.className = overview ? 'label-small' : 'label';
    if (Math.abs(line.flow) >= 49.5 && Math.abs(line.flow) <= 50.5) {
      div.textContent = Math.abs(line.flow).toFixed(1);
    } else if (Math.abs(line.flow) >= 49.95 && Math.abs(line.flow) <= 50.05) {
      div.textContent = Math.abs(line.flow).toFixed(2);
    } else {
      div.textContent = Math.abs(line.flow).toFixed(0);
    }
    div.style.color = 'yellow';
    const label = new CSS2DObject(div);
    label.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, 0);
    if (overview) {
      state.labelsOverview.add(label);
    } else {
      state.labelsMain.add(label);
    }

    if (!overview) {
      // Moving particle along the line
      let length = fromVector.distanceTo(toVector);
      const n = Math.max(1, Math.floor(length / 10));

      for (let i = 0; i < n; i++) {
          const mesh = createParticle(from, to, fromVector, toVector, line.flow / length * 2, i / n);
          mesh.renderOrder = config.render_order.particles;
          group.add(mesh);
          state.particleMeshes.push(mesh);
          state.particles.push(mesh.userData.state);
      }

      // Toggles at both ends
      if (mode === 'switches') {
        for (let end of ["from", "to"]) {
          let type = "normal"
          if (end === "from" && from.id.includes('b') || end === "to" && to.id.includes('b')) {
            type = "b"
          }
          const toggleDiv = createToggle(type = type, controls);
          toggleDiv.addEventListener('click', (event) => {
            callbacks.onToggle(line.id+"_"+end);
          });
          const toggle = new CSS2DObject(toggleDiv);
          const v_from = new THREE.Vector3(from.x, from.y, 0);
          const v_to = new THREE.Vector3(to.x, to.y, 0);
          const v_dir = new THREE.Vector3().subVectors(v_to, v_from).normalize();
          let v_pos;
          if (end === "from") {
            v_pos = v_from.clone().add(v_dir.clone().multiplyScalar(15));
          } else {
            v_pos = v_to.clone().add(v_dir.clone().multiplyScalar(-15));
          }
          toggle.position.set(v_pos.x, v_pos.y, 0);
          state.labelsMain.add(toggle);
        }
      }
    }
  });

  // Nodes
  Object.entries(data.nodes).forEach(([id, node]) => {
    if (id.includes('b')) {
      const nodeMesh = new THREE.Mesh(bNodeGeometry, bNodeMaterial);
      if (overview) {
        nodeMesh.scale.set(1.5, 1.5, 1);
      }
      nodeMesh.position.set(node.x, node.y, 0);
      nodeMesh.renderOrder = config.render_order.bNodes;
      group.add(nodeMesh);
    } else {
      var material = nodeProdMaterial
      if (node.injection < 0) {
        var material = nodeConsMaterial;
      }
      const nodeMesh = new THREE.Mesh(nodeGeometry, material);
      if (overview) {
        nodeMesh.scale.set(1.5, 1.5, 1);
      }
      nodeMesh.position.set(node.x, node.y, 0);
      nodeMesh.userData = { id: node.id };
      nodeMesh.renderOrder = config.render_order.nodes;
      group.add(nodeMesh);

      if (!overview) {
        // Node injection label using CSS2DObject
        const divMain = document.createElement('div');
        divMain.className = 'label';
        divMain.textContent = node.injection.toFixed(0);
        divMain.style.color = 'white';
        const label = new CSS2DObject(divMain);
        label.position.set(node.x, node.y, 0);
        state.labelsMain.add(label);

        if (mode === 'redispatch') {
          // show increase/decrease arrows
          for (let direction of ["up", "down"]) {
            const arrowDiv = createArrow(direction , controls);
            const toggle = new CSS2DObject(arrowDiv);
            let yOffset = direction === "up" ? 12 : -12;
            toggle.position.set(node.x, node.y + yOffset, 0);
            state.labelsMain.add(toggle);
            
            //prices
            const divPrice = document.createElement('div');
            divPrice.className = 'label-small';
            divPrice.textContent = direction === "up" ? node.cost_increase + '€' : node.cost_decrease + '€';
            divPrice.style.color = 'white';
            const priceLabel = new CSS2DObject(divPrice);
            let priceYOffset = direction === "up" ? 12 : -12;
            priceLabel.position.set(node.x + 12, node.y + priceYOffset, 0);
            state.labelsMain.add(priceLabel);
          }
        }
      }
    }
  });
  return group;
}


// ---------- helpers ----------

const particleGeometry = (() => {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, config.sizes.particleRadius);
  return new THREE.ShapeGeometry(shape, 16);
})();

function createParticle(from, to, fromVector, toVector, speed, t0) {
  const material = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const mesh = new THREE.Mesh(particleGeometry, material);

  mesh.userData.state = {
    from: fromVector,
    to: toVector,
    from_b: from.id.includes('b'),
    to_b: to.id.includes('b'),
    t: t0,
    speed: speed
  };

  return mesh;
}

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
const bNodeGeometry = (() => {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, config.sizes.ringRadiusOuter);
  const holePath = new THREE.Path();
  holePath.absarc(0, 0, config.sizes.ringRadiusInner);
  shape.holes.push(holePath);
  return new THREE.ShapeGeometry(shape, 32);
})();
const bNodeMaterial = new THREE.MeshBasicMaterial({
  color: config.colors.bNode,
  side: THREE.DoubleSide,
  depthWrite: false
});