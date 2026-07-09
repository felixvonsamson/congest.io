# tmp — backend refactor decisions (2026-07-01)

## Constants (network.py)
- `SCALING_TARGET = 54` — max flow scaled to this % of line limit
- `MIN_MAX_FLOW_BEFORE_SCALING = 30` — below this, scaling factor is too extreme, regenerate
- `EDGE_REDUCTION_FACTOR = 0.85` — fraction of Delaunay edges kept after pruning
- `HIGH_DEGREE_NODE_FACTOR = 0.1` — fraction of highest-degree nodes whose edges are never pruned
- `DEFAULT_LINE_LIMIT = 50.0` — line capacity (MW), uniform for now (varied limits deferred)
- `SOLVER_TIMEOUT_SECONDS = 10`
- `MAX_GENERATION_RETRIES = 10`

## Generator
- Seed parameter added (`seed: int | None = None`)
- Retry loop: calls `solve_network` on each attempt; logs failures with node/line counts; returns best-effort after max retries
- Rejects attempts where `max_flow < 30` before scaling (scaling factor would exceed 1.8×)
- Planarity claim removed from docstring (degree-3 fixup breaks it, and it doesn't matter for gameplay)
- `reduce_edges` mutation comment added
- Varied line limits: deferred (game already interesting as-is)

## Force-directed layout
- Adjacency dict moved outside the iteration loop (was rebuilt every iteration)
- Repulsion loop fixed to iterate `i < j` pairs only; default `repulsion` constant doubled (1.0 → 2.0) to preserve existing behaviour
- Weak centering force added (`centering=0.005`) instead of hard boundary clamping

## Solver
- Cost function stays **linear** (sum of overloads) — empirically better than squared
- BFS connectivity check replaces O(n³) matrix rank check in `calculate_power_flow`
- Empty heap guard: `if not network_states: break`
- `previous_states` list replaced with single `best_so_far` variable (deduplication still via `visited_configs` frozenset)
- New node-grouped expansion (`_get_node_switch_states`): enumerates all switch combos per node (2^degree), pushes best result per node to heap. Handles the "disconnect then reconnect" pattern where an intermediate high-cost state is required to reach the solution.
- 30-second wall-clock timeout added
- `print` statements removed
- `visited_configs` comment added explaining line-ID encoding invariant

## validate_network()
- Standalone function checking all line endpoints exist in nodes dict
- Called from `calculate_power_flow`, `/solve`, and `check_solution`

## API
- `/solve` requires authentication (same as `/check_solution`)
- `check_solution`: validates topology against original level using `reset_all_switches` comparison (same base nodes + injections + lines after reset)
- `ProgressUpdateRequest.username` field removed (redundant with JWT)
- `load_level` level range now dynamic (glob count of `levels/Level*.json`)
- Race condition on level unlock: deferred (low traffic)
