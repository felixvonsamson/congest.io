from copy import deepcopy
import math
from fastapi import FastAPI
import json
from .network import (
    generate_network,
    calculate_power_flow,
    update_network,
    force_directed_layout,
    solve_network,
    load_level,
)
from .schemas import (
    TopologyChangeRequest, 
    LoadLevelRequest, 
    NetworkStateRequest,
    SwitchNodeRequest,
    ResetSwitchesRequest,
    update_network_from_file, 
    dict_to_network_state
)
from fastapi.middleware.cors import CORSMiddleware
import os
from datetime import datetime
from fastapi import APIRouter

app = FastAPI()
router = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or ["http://localhost:5173"] for dev
    allow_methods=["*"],
    allow_headers=["*"],
)


@router.post("/network_state")
def get_network_state(data: NetworkStateRequest):
    network = dict_to_network_state(data.network_data)
    if not network.lines or not network.nodes:
        return {"error": "Empty network data"}
    network = calculate_power_flow(network)
    return network


@router.post("/reset_network")
def reset_network():
    network = generate_network()
    return network


@router.post("/switch_node")
def switch_node(data: SwitchNodeRequest):
    network = dict_to_network_state(data.network_data)
    # switch_id has the format "L[from_id]-[to_id]_[from/to]"
    line_id, direction = (data.switch_id.split("_")[0], data.switch_id.split("_")[1])
    if line_id not in network.lines:
        return {"error": "Invalid switch ID"}
    new_state = update_network(
        deepcopy(network),
        TopologyChangeRequest(
            line_id=line_id,
            direction=direction,
        ),
    )
    new_state = calculate_power_flow(new_state)
    if math.isnan(new_state.cost):
        return {"error": "Switching this line creates an unsolvable network"}
    network = new_state
    return network


@router.post("/reset_switches")
def reset_switches(data: ResetSwitchesRequest):
    network = dict_to_network_state(data.network_data)
    for line in list(network.lines.values()):
        if line.from_node == data.node_id + "b":
            network = update_network(
                network,
                TopologyChangeRequest(
                    line_id=line.id,
                    direction="from",
                ),
            )
        if line.to_node == data.node_id + "b":
            network = update_network(
                network,
                TopologyChangeRequest(
                    line_id=line.id,
                    direction="to",
                ),
            )
    network = calculate_power_flow(network)
    return network


@router.post("/solve")
def solve_net(data: NetworkStateRequest):
    network = dict_to_network_state(data.network_data)
    network = solve_network(network)
    return network


# @router.post("/save_network")
# def save_network(network: dict):
#     os.makedirs("saves", exist_ok=True)
#     timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
#     filepath = f"saves/network_{timestamp}.json"
#     with open(filepath, "w") as f:
#         json.dump(network, f)
#     return {"status": "Network saved", "file": filepath}


@router.post("/load_network")
def load_network(file_path: str):
    network = update_network_from_file(file_path)
    network = calculate_power_flow(network)
    return network


@router.post("/load_level")
def load_level_endpoint(data: LoadLevelRequest):
    network = load_level(data.level_num, tutorial=data.is_tutorial)
    return network


app.include_router(router)