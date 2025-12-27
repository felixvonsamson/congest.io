import * as THREE from 'three';
import { createNetwork } from './createNetwork.js';

export function updateNetwork(
    settings,
    scenes,
    cameras,
    network,
    state,
    controls,
    callbacks,
) {
    sessionStorage.setItem('network', JSON.stringify(network));
    if (state.mainNetwork) scenes.main.remove(state.mainNetwork);
    if (state.overviewNetwork) scenes.overview.remove(state.overviewNetwork);

    state.particles = [];
    state.particleMeshes = [];
    state.labelsMain.clear();
    state.labelsOverview.clear();
    state.mainNetwork = createNetwork(network, state, controls, callbacks);
    state.overviewNetwork = createNetwork(network, state, controls, callbacks, true);

    scenes.main.add(state.mainNetwork);
    scenes.overview.add(state.overviewNetwork);

    // Center overview camera on network
    const max_x = Math.max(...Object.values(network.nodes).map(n => n.x));
    const min_x = Math.min(...Object.values(network.nodes).map(n => n.x));
    const max_y = Math.max(...Object.values(network.nodes).map(n => n.y));
    const min_y = Math.min(...Object.values(network.nodes).map(n => n.y));
    const center_x = (max_x + min_x) / 2;
    const center_y = (max_y + min_y) / 2;
    const size_x = (max_x - min_x) * 1.2;
    const size_y = (max_y - min_y) * 1.2;
    const size = Math.max(size_x, size_y);
    cameras.overview.left = -size / 2;
    cameras.overview.right = size / 2;
    cameras.overview.top = size / 2;
    cameras.overview.bottom = -size / 2;
    cameras.overview.position.set(center_x, center_y, 500);
    cameras.overview.lookAt(center_x, center_y, 0);
    cameras.overview.updateProjectionMatrix();

  // Update level indicator
  const levelIndicator = document.getElementById('LevelInfoPanel');
  if (network.level === null) {
    levelIndicator.textContent = `Custom Network`;
  } else {
    if (network.tutorial) {
        levelIndicator.textContent = `Tutorial ${network.level}`;
    } else {
        levelIndicator.textContent = `Level ${network.level}`;
    }
  }

  // Update tutorial help
  const tutorialHelp = document.getElementById("tutorialHelp");
  if (network.tutorial && network.tutorial_info) {
    tutorialHelp.style.display = "block";
    tutorialHelp.textContent = network.tutorial_info;
  } else {
    tutorialHelp.style.display = "none";
    tutorialHelp.textContent = "";
  }

  const solvedOverlay = document.getElementById("solvedOverlay");
  if (solvedOverlay) {
    if (network.cost === 0.0) {
        solvedOverlay.style.display = "block";
    } else {
        solvedOverlay.style.display = "none";
    }
  }
}

export function toggleSwitch(network , switchID) {
  /*
  Switch the connection to a second node placed at the same location.
  */
  const direction = switchID.split("_")[1];
  const lineID = switchID.split("_")[0];
  const [from_id, to_id] = lineID.slice(1).split("-");
  const isToDirection = direction === "to";

  // Parse node IDs
  const targetNodeId = isToDirection
      ? to_id
      : from_id; // remove leading "L"

  const otherNodeId = isToDirection
      ? from_id
      : to_id;
  let newNode;

  // --- Handle b-node switching ---
  if (targetNodeId.includes("b")) {
      // Switching back to original node
      const originalId = targetNodeId.slice(0, -1);
      newNode = network.nodes[originalId];

      // Delete b-node if only one line is connected
      let connectionCount = 0;
      for (const line of Object.values(network.lines)) {
          if (line.from_node === targetNodeId || line.to_node === targetNodeId) {
              connectionCount++;
              if (connectionCount > 1) break;
          }
      }
      if (connectionCount === 1) {
          delete network.nodes[targetNodeId];
      }
  } else {
      const bNodeId = targetNodeId + "b";
      if (!network.nodes[bNodeId]) {
          const baseNode = network.nodes[targetNodeId];
          newNode = {
              id: bNodeId,
              injection: 0.0,
              x: baseNode.x,
              y: baseNode.y
          };
          network.nodes[bNodeId] = newNode;
      } else {
          newNode = network.nodes[bNodeId];
      }
  }

  // --- Create new line ---
  const newLineId = isToDirection
      ? `L${from_id}-${newNode.id}`
      : `L${newNode.id}-${to_id}`;

  const oldLine = network.lines[lineID];

  network.lines[newLineId] = {
      id: newLineId,
      from_node: isToDirection ? otherNodeId : newNode.id,
      to_node: isToDirection ? newNode.id : otherNodeId,
      flow: 0.0,
      limit: oldLine.limit
  };

  // --- Remove old line ---
  delete network.lines[lineID];

  return network;
}
