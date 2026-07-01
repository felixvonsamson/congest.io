"""
Diagnostic: log per-component force magnitudes during force-directed layout
to help tune the angular_spring constant.
"""
import random
import math
import numpy as np
from scipy.spatial import Delaunay
from backend.schemas import Node, Line, NetworkState

random.seed(42)
np.random.seed(42)

NUM_NODES = 12
WIDTH, HEIGHT = 500.0, 500.0

# Build a small test network (same logic as _generate_once)
points = [(random.random() * WIDTH, random.random() * HEIGHT) for _ in range(NUM_NODES)]
tri = Delaunay(points)
edges = set()
for simplex in tri.simplices:
    a, b, c = simplex
    edges.update([tuple(sorted((a,b))), tuple(sorted((b,c))), tuple(sorted((a,c)))])
adjacency = {i: set() for i in range(NUM_NODES)}
for u, v in edges:
    adjacency[u].add(v); adjacency[v].add(u)

nodes = {str(i): Node(id=str(i), x=x, y=y) for i, (x, y) in enumerate(points)}
lines = {f"L{u}-{v}": Line(id=f"L{u}-{v}", from_node=str(u), to_node=str(v), flow=0, limit=50)
         for u in adjacency for v in adjacency[u] if u < v}
network = NetworkState(nodes=nodes, lines=lines)

# --- Layout params to test ---
k           = 150.0
repulsion   = 2.0
spring      = 0.02
angular_spring = 0.3
centering   = 0.005
iterations  = 10

positions = {n.id: np.array([n.x, n.y], dtype=float) for n in nodes.values()}
velocities = {n.id: np.array([0.0, 0.0]) for n in nodes.values()}
node_ids = list(nodes.keys())

adj = {n.id: [] for n in nodes.values()}
for line in lines.values():
    adj[line.from_node].append(line.to_node)
    adj[line.to_node].append(line.from_node)

print(f"{'Iter':>4}  {'Repulsion':>12}  {'Spring':>10}  {'Angular':>10}  {'Centering':>10}  {'Ratio ang/rep':>14}")
print("-" * 70)

for it in range(iterations):
    f_rep    = {n: np.zeros(2) for n in node_ids}
    f_spring = {n: np.zeros(2) for n in node_ids}
    f_ang    = {n: np.zeros(2) for n in node_ids}
    f_cen    = {n: np.zeros(2) for n in node_ids}

    # Repulsion
    for a in range(len(node_ids)):
        for b in range(a + 1, len(node_ids)):
            ia, ib = node_ids[a], node_ids[b]
            delta = positions[ia] - positions[ib]
            dist = np.linalg.norm(delta) + 1e-6
            force = (delta / dist) * repulsion / dist**2
            f_rep[ia] += force; f_rep[ib] -= force

    # Spring
    for line in lines.values():
        pf, pt = positions[line.from_node], positions[line.to_node]
        delta = pt - pf
        dist = np.linalg.norm(delta) + 1e-6
        force = (delta / dist) * spring * (dist - k)
        f_spring[line.from_node] += force; f_spring[line.to_node] -= force

    # Angular
    for node_id in adj:
        neighbors = adj[node_id]
        if len(neighbors) < 2:
            continue
        node_pos = positions[node_id]
        angs = sorted([(nb, np.arctan2(*(positions[nb] - node_pos)[::-1])) for nb in neighbors], key=lambda x: x[1])
        ideal = 2 * np.pi / len(neighbors)
        for i in range(len(neighbors)):
            nb_id, ang = angs[i]
            nb2_id, ang2 = angs[(i+1) % len(neighbors)]
            gap = max((ang2 - ang) % (2 * np.pi), 1e-3)
            torque = angular_spring * (1.0 / gap - 1.0 / ideal)
            v1 = positions[nb_id] - node_pos
            v2 = positions[nb2_id] - node_pos
            p1 = np.array([-v1[1], v1[0]]); p1 /= np.linalg.norm(p1) + 1e-6
            p2 = np.array([v2[1], -v2[0]]); p2 /= np.linalg.norm(p2) + 1e-6
            f_ang[nb_id]   += p1 * torque
            f_ang[nb2_id]  += p2 * torque
            f_ang[node_id] -= (p1 + p2) * torque

    # Centering
    centroid = np.mean(list(positions.values()), axis=0)
    for nid in node_ids:
        f_cen[nid] += centering * (centroid - positions[nid])

    # RMS magnitudes
    def rms(fd): return np.mean([np.linalg.norm(v) for v in fd.values()])
    r, s, a, c = rms(f_rep), rms(f_spring), rms(f_ang), rms(f_cen)
    print(f"{it+1:>4}  {r:>12.4f}  {s:>10.4f}  {a:>10.4f}  {c:>10.4f}  {a/r:>14.3f}")

    # Update
    total = {n: f_rep[n] + f_spring[n] + f_ang[n] + f_cen[n] for n in node_ids}
    for nid in node_ids:
        velocities[nid] = (velocities[nid] + total[nid]) * 0.85
        positions[nid] += velocities[nid]
