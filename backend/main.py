from fastapi import FastAPI
import json
from .network import (
    generate_network,
    calculate_power_flow,
    update_network,
    force_directed_layout,
    solve_network,
)
from .schemas import TopologyChangeRequest, update_network_from_dict
from fastapi.middleware.cors import CORSMiddleware
import os
from datetime import datetime


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or ["http://localhost:5173"] for dev
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global in-memory network (placeholder)
network = generate_network()


@app.post("/change_node_topology")
def change_node_topology(req: TopologyChangeRequest):
    global network
    network = update_network(network, req)
    state = calculate_power_flow(network)
    return state


@app.get("/grid")
def get_initial_grid():
    return network


@app.get("/network_state")
def get_network_state():
    global network
    state = calculate_power_flow(network)
    return state


@app.post("/reset_network")
def reset_network():
    global network
    network = generate_network()
    return network


@app.post("/new_layout")
def get_new_layout():
    global network
    network = force_directed_layout(network, k=150.0)
    state = calculate_power_flow(network)
    return state


@app.post("/switch_node")
def switch_node(switch_id: str):
    global network
    # switch_id has the format "L[from_id]-[to_id]_[from/to]"
    line_id, direction = (switch_id.split("_")[0], switch_id.split("_")[1])
    if line_id not in network.lines:
        return {"error": "Invalid switch ID"}
    network = update_network(
        network,
        TopologyChangeRequest(
            line_id=line_id,
            direction=direction,
        ),
    )
    state = calculate_power_flow(network)
    return state

@app.post("/reset_switches")
def reset_switches(node_id: str):
    global network
    for line in list(network.lines.values()):
        if line.from_node == node_id + "b":
            network = update_network(
                network,
                TopologyChangeRequest(
                    line_id=line.id,
                    direction="from",
                ),
            )
        if line.to_node == node_id + "b":
            network = update_network(
                network,
                TopologyChangeRequest(
                    line_id=line.id,
                    direction="to",
                ),
            )
    state = calculate_power_flow(network)
    return state

@app.post("/solve")
def solve_net():
    global network
    state = solve_network(network)
    return state

@app.get("/save_network")
def save_network():
    global network
    os.makedirs("saves", exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filepath = f"saves/network_{timestamp}.json"
    with open(filepath, "w") as f:
        json.dump(network.dict(), f)
    return {"status": "Network saved", "file": filepath}

@app.get("/load_network")
def load_network(file_path: str):
    global network
    if not os.path.exists(file_path):
        return {"error": "File does not exist"}
    with open(file_path, "r") as f:
        data = json.load(f)
    network = update_network_from_dict(data)
    state = calculate_power_flow(network)
    return state