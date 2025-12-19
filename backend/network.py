import math
import random
from .schemas import NetworkState, TopologyChangeRequest, Node, Line
import numpy as np
from copy import deepcopy


def generate_network(num_nodes: int = 10, width: float = 500.0, height: float = 500.0):
    """
    Generate a planar graph with nodes positioned in 2D space.
    Each node will have at least degree 3. Edges are created using
    Delaunay triangulation for planarity, then pruned if necessary.
    """
    import random
    import math
    from scipy.spatial import Delaunay

    # 1. Random 2D positions
    points = [
        (random.random() * width, random.random() * height) for _ in range(num_nodes)
    ]

    # 2. Delaunay triangulation (guarantees planarity)
    tri = Delaunay(points)
    edges = set()
    for simplex in tri.simplices:
        a, b, c = simplex
        edges.add(tuple(sorted((a, b))))
        edges.add(tuple(sorted((b, c))))
        edges.add(tuple(sorted((a, c))))

    # Build adjacency to enforce min degree 3
    adjacency = {i: set() for i in range(num_nodes)}
    for u, v in edges:
        adjacency[u].add(v)
        adjacency[v].add(u)

    # Ensure each node has degree >= 3 by adding nearest neighbors if needed
    for i in range(num_nodes):
        if len(adjacency[i]) < 3:
            # sort other nodes by distance
            dists = sorted(
                [
                    (j, math.dist(points[i], points[j]))
                    for j in range(num_nodes)
                    if j != i
                ],
                key=lambda x: x[1],
            )
            for j, _ in dists:
                if j not in adjacency[i]:
                    adjacency[i].add(j)
                    adjacency[j].add(i)
                if len(adjacency[i]) >= 3:
                    break

    # Assign random injections to nodes
    nodes = {}
    raw = [random.uniform(-100, 100) for _ in range(len(points))]

    # Sum positive (generation) and negative (consumption magnitude)
    pos_sum = sum(x for x in raw if x > 0)
    neg_sum = -sum(x for x in raw if x < 0)

    # If one side is larger, scale values on that side down so total generation == total consumption
    if pos_sum > neg_sum and pos_sum > 0:
        scale = neg_sum / pos_sum if pos_sum > 0 else 0.0
        raw = [x * scale if x > 0 else x for x in raw]
    elif neg_sum > pos_sum and neg_sum > 0:
        scale = pos_sum / neg_sum if neg_sum > 0 else 0.0
        raw = [x * scale if x < 0 else x for x in raw]
    # if both are zero or already balanced, leave raw as-is
    for i, (x, y) in enumerate(points):
        nodes[str(i)] = Node(id=str(i), x=x, y=y, injection=raw[i])

    # Convert edges
    lines = {}
    for u in adjacency:
        for v in adjacency[u]:
            if int(u) < int(v):
                lines[f"L{u}-{v}"] = Line(
                    id=f"L{u}-{v}",
                    from_node=str(u),
                    to_node=str(v),
                    flow=0.0,
                    limit=50.0,
                )

    # Convert to Pydantic classes
    network = NetworkState(nodes=nodes, lines=lines)
    network = reduce_edges(network)
    network = force_directed_layout(network, k=150.0)

    state = calculate_power_flow(network)
    if state.cost == 0.0:
        #find the highest flow
        max_flow = max(abs(line.flow) for line in state.lines.values())
        # scale all ijections up so that the highest flow is at 110% of the limit
        scale = 55 / max_flow if max_flow > 0 else 1.0
        for node in network.nodes.values():
            node.injection *= scale
        state = calculate_power_flow(network)
    return state


def reduce_edges(network, factor=0.9, high_degree_node_factor=0.1):
    """
    Reduces the number of edges in the network by the given factor while maintaining connectivity.
    """
    nodes = network.nodes
    lines = network.lines
    node_degree = {node.id: 0 for node in nodes.values()}
    for line in lines.values():
        node_degree[line.from_node] += 1
        node_degree[line.to_node] += 1
    # list of highest degree nodes to keep all edges for
    high_degree_nodes = []
    sorted_node_degree = sorted(node_degree.items(), key=lambda x: x[1], reverse=True)
    for i in range(math.floor(len(nodes) * high_degree_node_factor)):
        high_degree_nodes.append(sorted_node_degree[i][0])
    # keep the top high_degree_nodes fraction with all edges and remove the (1-factor) edges from the rest
    # of the nodes going from highest to lowest degree until we reach the target number of edges or until all other nodes
    # have degree 3. An edge can only be removed if both its nodes have degree > 3.
    target_num_edges = math.floor(len(lines) * factor)
    shuffled_lines = list(lines.values())
    random.shuffle(shuffled_lines)
    for line in shuffled_lines:
        if len(lines) <= target_num_edges:
            break
        if (
            line.from_node not in high_degree_nodes
            and line.to_node not in high_degree_nodes
            and node_degree[line.from_node] > 3
            and node_degree[line.to_node] > 3
        ):
            del lines[line.id]
            node_degree[line.from_node] -= 1
            node_degree[line.to_node] -= 1
    return network


def force_directed_layout(
    network,
    k=50.0,
    iterations=50,
    repulsion=1.0,
    spring=0.02,
    damping=0.85,
    angular_spring=0.5,
):
    """
    Simple force-directed layout algorithm to adjust node positions.
    Nodes repel each other, edges act as springs.
    """
    nodes = network.nodes
    lines = network.lines
    positions = {
        node.id: np.array([node.x, node.y], dtype=float) for node in nodes.values()
    }
    velocities = {node.id: np.array([0.0, 0.0], dtype=float) for node in nodes.values()}

    for _ in range(iterations):
        forces = {node.id: np.array([0.0, 0.0], dtype=float) for node in nodes.values()}

        # Repulsion
        for i, node_a in nodes.items():
            for j, node_b in nodes.items():
                if i != j:
                    delta = positions[node_a.id] - positions[node_b.id]
                    dist = np.linalg.norm(delta) + 1e-6
                    force_magnitude = repulsion / (dist**2)
                    forces[node_a.id] += (delta / dist) * force_magnitude

        # Spring forces
        for line in lines.values():
            pos_from = positions[line.from_node]
            pos_to = positions[line.to_node]
            delta = pos_to - pos_from
            dist = np.linalg.norm(delta) + 1e-6
            force_magnitude = spring * (dist - k)
            force = (delta / dist) * force_magnitude
            forces[line.from_node] += force
            forces[line.to_node] -= force

        # angular springs
        adjacency = {node.id: [] for node in nodes.values()}
        for line in lines.values():
            adjacency[line.from_node].append(line.to_node)
            adjacency[line.to_node].append(line.from_node)
        for node_id in adjacency:
            neighbors = adjacency[node_id]
            num_neighbors = len(neighbors)
            node_pos = positions[node_id]
            angles = []
            for neighbor_id in neighbors:
                vec = positions[neighbor_id] - node_pos
                angle = np.arctan2(vec[1], vec[0])
                angles.append((neighbor_id, angle))
            angles.sort(key=lambda x: x[1])
            ideal_angle = 2 * np.pi / num_neighbors
            for i in range(num_neighbors):
                neighbor_id, angle = angles[i]
                next_neighbor_id, next_angle = angles[(i + 1) % num_neighbors]
                gap = (next_angle - angle) % (2 * np.pi)
                angle_diff = gap - ideal_angle
                torque_magnitude = angular_spring * angle_diff
                vec_1 = positions[neighbor_id] - node_pos
                vec_2 = positions[next_neighbor_id] - node_pos
                # Apply torque as forces perpendicular to the vectors
                perp_1 = np.array([-vec_1[1], vec_1[0]])
                perp_2 = np.array([vec_2[1], -vec_2[0]])
                perp_1 /= np.linalg.norm(perp_1) + 1e-6
                perp_2 /= np.linalg.norm(perp_2) + 1e-6
                forces[neighbor_id] += perp_1 * torque_magnitude
                forces[next_neighbor_id] += perp_2 * torque_magnitude
                forces[node_id] -= (perp_1 + perp_2) * torque_magnitude

        # Update velocities and positions
        for node in nodes.values():
            velocities[node.id] = (velocities[node.id] + forces[node.id]) * damping
            positions[node.id] += velocities[node.id]

    # Update node positions
    for node in nodes.values():
        node.x, node.y = positions[node.id].tolist()

    return network


def calculate_power_flow(network):
    """
    Simple DC power flow using Kirchhoff laws.
    Steps:
    - map node ids to indices
    - build incidence matrix A
    - build susceptance Laplacian B
    - solve B * theta = p
    - compute flows on lines
    """

    nodes = network.nodes
    lines = network.lines
    n = len(nodes)

    # --- Map node IDs to indices ---
    id_to_idx = {node.id: i for i, node in enumerate(nodes.values())}

    # --- Build injection vector p ---
    p = np.array([node.injection for node in nodes.values()], dtype=float)

    # --- Build line data ---
    # assume reactance X = 1.0 for now
    m = len(lines)
    A = np.zeros((n, m))  # incidence matrix

    for ell, line in enumerate(lines.values()):
        i = id_to_idx[line.from_node]
        j = id_to_idx[line.to_node]
        A[i, ell] = 1
        A[j, ell] = -1

    # --- Build B = A * A^T (since X = 1) ---
    B = A @ A.T

    # Slack bus: remove row and column 0
    B_red = B[1:, 1:]
    p_red = p[1:]

    # Solve for angles (theta)
    try:
        theta_red = np.linalg.solve(B_red, p_red)
    except np.linalg.LinAlgError:
        theta_red = np.zeros(n - 1)

    theta = np.zeros(n)
    theta[1:] = theta_red

    # --- Compute line flows f = A^T * theta ---
    flows = A.T @ theta

    # --- Attach flows back to lines ---
    updated_lines = {}
    for ell, line in enumerate(lines.values()):
        updated_lines[line.id] = Line(
            id=line.id,
            from_node=line.from_node,
            to_node=line.to_node,
            flow=float(flows[ell]),
            limit=line.limit,
        )
    # if all flows are zero, set cost to NaN to indicate unsolvable network state
    if np.allclose(flows, 0.0):
        return NetworkState(nodes=nodes, lines=updated_lines, cost=float("nan"))
    
    # Calculate cost as the sum overloads
    cost = sum(
        max(0.0, abs(updated_lines[line.id].flow) - line.limit) for line in lines.values()
    )

    return NetworkState(nodes=nodes, lines=updated_lines, cost=cost)

def update_network(network, req: TopologyChangeRequest):
    """
    Switch the connection to a second node placed at the same location.
    """
    if req.direction == "to":
        target_node_id = req.line_id.split("-")[1]
        from_node_id = req.line_id.split("-")[0][1:]
        if "b" in target_node_id:
            # switching back to original node
            new_node = network.nodes[target_node_id[:-1]]
            # delete "b" node if no other lines are connected
            connected_lines = [
                line
                for line in network.lines.values()
                if line.from_node == target_node_id or line.to_node == target_node_id
            ]
            if len(connected_lines) == 1:
                del network.nodes[target_node_id]
        else:
            if not network.nodes.get(target_node_id + "b"):
                # create a new "b" node
                new_node = Node(
                    id=target_node_id + "b",
                    injection=0.0,
                    x=network.nodes[target_node_id].x,
                    y=network.nodes[target_node_id].y,
                )
                network.nodes[new_node.id] = new_node
            else:
                new_node = network.nodes[target_node_id + "b"]
        new_line_id = f"{req.line_id.split('-')[0]}-{new_node.id}"
        network.lines[new_line_id] = Line(
            id=new_line_id,
            from_node=from_node_id,
            to_node=new_node.id,
            flow=0.0,
            limit=network.lines[req.line_id].limit,
        )
        del network.lines[req.line_id]
    else:
        target_node_id = req.line_id.split("-")[0][1:]
        to_node_id = req.line_id.split("-")[1]
        if "b" in target_node_id:
            # switching back to original node
            new_node = network.nodes[target_node_id[:-1]]
            # delete "b" node if no other lines are connected
            connected_lines = [
                line
                for line in network.lines.values()
                if line.from_node == target_node_id or line.to_node == target_node_id
            ]
            if len(connected_lines) == 1:
                del network.nodes[target_node_id]
        else:
            if not network.nodes.get(target_node_id + "b"):
                # create a new "b" node
                new_node = Node(
                    id=target_node_id + "b",
                    injection=0.0,
                    x=network.nodes[target_node_id].x,
                    y=network.nodes[target_node_id].y,
                )
                network.nodes[new_node.id] = new_node
            else:
                new_node = network.nodes[target_node_id + "b"]
        new_line_id = f"L{new_node.id}-{req.line_id.split('-')[1]}"
        network.lines[new_line_id] = Line(
            id=new_line_id,
            from_node=new_node.id,
            to_node=to_node_id,
            flow=0.0,
            limit=network.lines[req.line_id].limit,
        )
        del network.lines[req.line_id]
    return network

def solve_network(network):
    """
    Try to find a solution that respects line limits by switching nodes.

    This algorythm starts by switching each switch and looks at the resulting
    power flow. A cost is defined by the sum of the squared overloads on each line.
    Each network state is then sorted by cost. It then takes the best network state
    and tries switching each remaining switch again, storing the new network states
    and their costs. Then the states are sorted again and the process repeats until
    a solved network is found or until the maximum number of iterations is reached.
    """
    max_iterations = 10
    network_states = [calculate_power_flow(network)]
    visited_configs = set()
    for iteration in range(max_iterations):
        net = network_states[0]
        if net.cost == 0.0:
            return net
        print(f"Solving iteration {iteration+1}/{max_iterations}")
        # generate new states by switching each switch
        for line in list(net.lines.values()):
            # there are two switches per line, one "to" and one "from"
            from_node = net.nodes[line.from_node]
            to_node = net.nodes[line.to_node]
            if not to_node.id.endswith("b"):
                # switch "to"
                req_to = TopologyChangeRequest(
                    line_id=line.id,
                    direction="to",
                )
                new_net_to = update_network(deepcopy(net), req_to)
                config_to = frozenset(new_net_to.lines.keys())
                if config_to not in visited_configs:
                    visited_configs.add(config_to)
                    new_state_to = calculate_power_flow(new_net_to)
                    if new_state_to.cost is not float("nan"):
                        network_states.append(new_state_to)
            if not from_node.id.endswith("b"):
                # switch "from"
                req_from = TopologyChangeRequest(
                    line_id=line.id,
                    direction="from",
                )
                new_net_from = update_network(deepcopy(net), req_from)
                config_from = frozenset(new_net_from.lines.keys())
                if config_from not in visited_configs:
                    visited_configs.add(config_from)
                    new_state_from = calculate_power_flow(new_net_from)
                    if new_state_from.cost is not float("nan"):
                        network_states.append(new_state_from)

        network_states = sorted(network_states, key=lambda x: x.cost)
        print("number of tested states :", len(network_states))
            # return the best state found
    best_state = min(network_states, key=lambda x: x.cost)
    return best_state