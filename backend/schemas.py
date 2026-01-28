from pydantic import BaseModel
from typing import List, Optional
import json
import os


class Node(BaseModel):
    id: str
    injection: float = 0.0
    x: float = 0.0
    y: float = 0.0


class Line(BaseModel):
    # TODO: add from_bus and to_bus
    id: str
    from_node: str
    to_node: str
    flow: float = 0.0
    limit: float = 50.0


class NetworkState(BaseModel):
    nodes: dict[str, Node]
    lines: dict[str, Line]
    cost: float = 10**6
    tutorial: bool = False
    level: Optional[int] = None
    tutorial_info: Optional[str] = None

    def __lt__(self, other):
        return self.cost < other.cost


class TopologyChangeRequest(BaseModel):
    line_id: str
    direction: str  # "to" or "from"

class LoadLevelRequest(BaseModel):
    level_num: int

class NetworkStateRequest(BaseModel):
    network_data: dict

class SwitchNodeRequest(BaseModel):
    network_data: dict
    switch_id: str

class ResetSwitchesRequest(BaseModel):
    network_data: dict
    node_id: str


def update_network_from_file(file_path: str) -> NetworkState:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File {file_path} does not exist.")
    with open(file_path, "r") as f:
        data = json.load(f)
    nodes = {
        node_id: Node(**node_data)
        for node_id, node_data in data.get("nodes", {}).items()
    }
    lines = {
        line_id: Line(**line_data)
        for line_id, line_data in data.get("lines", {}).items()
    }
    level = None if "Level" not in file_path else int(file_path.split("Level")[-1].split(".")[0])
    if "tutorial" in file_path:
        tutorial = True
        level = int(file_path.split("tutorial")[-1].split(".")[0])
    else:
        tutorial = False
    return NetworkState(nodes=nodes, lines=lines, level=level, tutorial=tutorial, tutorial_info=data.get("tutorial_info", None))

def dict_to_network_state(data: dict) -> NetworkState:
    nodes = {
        node_id: Node(**node_data)
        for node_id, node_data in data.get("nodes", {}).items()
    }
    lines = {
        line_id: Line(**line_data)
        for line_id, line_data in data.get("lines", {}).items()
    }
    return NetworkState(nodes=nodes, lines=lines, cost=data.get("cost", 10**6), tutorial=data.get("tutorial", False), level=data.get("level", None), tutorial_info=data.get("tutorial_info", None))

class RegisterRequest(BaseModel):
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class ProgressUpdateRequest(BaseModel):
    username: str
    current_level: int
    unlocked_levels: int

class rewardResponse(BaseModel):
    solved: bool
    player: dict
    reward: int
