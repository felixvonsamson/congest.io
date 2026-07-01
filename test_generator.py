import random
import time
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from backend.network import generate_network

OUTPUT_DIR = "generated_networks"
NUM_NETWORKS = 10
MIN_NODES = 6
MAX_NODES = 18

os.makedirs(OUTPUT_DIR, exist_ok=True)

failures = 0
timings = []

for i in range(NUM_NETWORKS):
    num_nodes = random.randint(MIN_NODES, MAX_NODES)
    print(f"[{i+1:3d}/100] num_nodes={num_nodes:2d} ... ", end="", flush=True)
    start = time.time()
    try:
        network = generate_network(num_nodes=num_nodes)
        elapsed = time.time() - start
        timings.append(elapsed)
        path = os.path.join(OUTPUT_DIR, f"network_{i+1:03d}_n{num_nodes}.json")
        with open(path, "w") as f:
            json.dump(network.model_dump(), f, indent=2)
        print(f"ok  {elapsed:.2f}s  cost={network.cost:.2f}  lines={len(network.lines)}")
    except RuntimeError as e:
        elapsed = time.time() - start
        failures += 1
        print(f"FAIL  {elapsed:.2f}s  ({e})")

print()
print("=" * 60)
print(f"Results: {NUM_NETWORKS - failures}/100 succeeded, {failures}/100 failed")
if timings:
    print(f"Time — min: {min(timings):.2f}s  max: {max(timings):.2f}s  avg: {sum(timings)/len(timings):.2f}s")
