import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { settings } from '../settings.js';
import { createToggle } from '../ui/toggles.js';

export function createNetwork(data, state) {

  state.particles = [];
  state.particleMeshes = [];

  const group = new THREE.Group();

  Object.values(data.lines).forEach(line => {
    const from = data.nodes[line.from_node];
    const to = data.nodes[line.to_node];

    // Base line
    const material = new THREE.LineBasicMaterial({
      color: Math.abs(line.flow) > line.limit
        ? settings.colors.lineOverload
        : settings.colors.line
    });
    const points = [
        new THREE.Vector3(from.x, from.y, 0),
        new THREE.Vector3(to.x, to.y, 0)
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    group.add(new THREE.Line(geometry, material));

    // Moving particle along the line
    let length = points[0].distanceTo(points[1]);
    const n = Math.max(1, Math.floor(length / 10));

    for (let i = 0; i < n; i++) {
      const mesh = createParticle(from, to, line.flow / length * 2, i / n);
      group.add(mesh);
      state.particleMeshes.push(mesh);
      state.particles.push(mesh.userData.state);
    }

    // // Flow magnitude label using CSS2DObject
    // const div = document.createElement('div');
    // div.className = 'label';
    // div.textContent = Math.abs(line.flow).toFixed(0);
    // div.style.color = 'yellow';
    // const label = new CSS2DObject(div);
    // label.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, 0);
    // labelsMain.add(label);
    // labelsOverview.add(label.clone());

    // for (let end of ["from", "to"]) {
    //   let type = "normal"
    //   if (end === "from" && from.id.includes('b') || end === "to" && to.id.includes('b')) {
    //     type = "b"
    //   }
    //   const toggleDiv = createToggle(type = type);
    //   toggleDiv.dataset.lineNodeID = line.id + "_" + end;
    //   toggleDiv.addEventListener('click', (event) => {
    //     console.log('Toggle clicked for', event.currentTarget.dataset.lineNodeID);
    //     const switchID = event.currentTarget.dataset.lineNodeID;
    //     // Send switch request to server
    //     fetch(`http://127.0.0.1:8000/switch_node?switch_id=${switchID}`, { method: 'POST' })
    //       .then(response => response.json())
    //       .then(data => {
    //         update_network(data);
    //       });
    //   });
    //   const toggle = new CSS2DObject(toggleDiv);
    //   const v_from = new THREE.Vector3(from.x, from.y, 0);
    //   const v_to = new THREE.Vector3(to.x, to.y, 0);
    //   const v_dir = new THREE.Vector3().subVectors(v_to, v_from).normalize();
    //   let v_pos;
    //   if (end === "from") {
    //     v_pos = v_from.clone().add(v_dir.clone().multiplyScalar(15));
    //   } else {
    //     v_pos = v_to.clone().add(v_dir.clone().multiplyScalar(-15));
    //   }
    //   toggle.position.set(v_pos.x, v_pos.y, 0);
    //   labelsMain.add(toggle);
    //}
  });

//   // Nodes
//   Object.entries(data.nodes).forEach(([id, node]) => {
//     if (id.includes('b')) {
//       const nodeMesh = new THREE.Mesh(bNodeGeometry, bNodeMaterial);
//       nodeMesh.position.set(node.x, node.y, 0);
//       nodeMesh.renderOrder = settings.render_order.bNodes;
//       group.add(nodeMesh);
//     } else {
//       var material = nodeProdMaterial
//       if (node.injection < 0) {
//         var material = nodeConsMaterial;
//       }
//       const nodeMesh = new THREE.Mesh(nodeGeometry, material);
//       nodeMesh.position.set(node.x, node.y, 0);
//       nodeMesh.userData = { id: node.id };
//       nodeMesh.renderOrder = settings.render_order.nodes;
//       group.add(nodeMesh);

//       // Node injection label using CSS2DObject
//       const divMain = document.createElement('div');
//       divMain.className = 'label';
//       divMain.textContent = node.injection.toFixed(0);
//       divMain.style.color = 'white';
//       const label = new CSS2DObject(divMain);
//       label.position.set(node.x, node.y, 0);
//       labelsMain.add(label);

//       const divOverview = divMain.cloneNode(true);
//       const labelOverview = new CSS2DObject(divOverview);
//       labelOverview.position.set(node.x, node.y, 0);
//       labelsOverview.add(labelOverview);
//     }
//   });
  return group;
}


// ---------- helpers ----------

const particleGeometry = (() => {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, settings.sizes.particleRadius);
  return new THREE.ShapeGeometry(shape, 16);
})();

function createParticle(from, to, speed, t0) {
  const material = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const mesh = new THREE.Mesh(particleGeometry, material);

  mesh.userData.state = {
    from: new THREE.Vector3(from.x, from.y, 0),
    to: new THREE.Vector3(to.x, to.y, 0),
    t: t0,
    speed: speed
  };

  return mesh;
}