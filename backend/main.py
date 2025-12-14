from fastapi import FastAPI
from .network import (
    generate_network,
    calculate_power_flow,
    update_network,
    force_directed_layout,
)
from .schemas import Network, TopologyChangeRequest
from fastapi.middleware.cors import CORSMiddleware


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


@app.get("/resimulate")
def resimulate():
    global network
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


@app.get("/reset_network")
def reset_network():
    global network
    network = generate_network()
    state = calculate_power_flow(network)
    return state


@app.get("/new_layout")
def get_new_layout():
    global network
    network = force_directed_layout(network, k=150.0)
    state = calculate_power_flow(network)
    return state


@app.get("/switch_node")
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
