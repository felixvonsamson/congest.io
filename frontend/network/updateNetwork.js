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
