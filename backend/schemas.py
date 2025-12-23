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
    id: str
    from_node: str
    to_node: str
    flow: float = 0.0
    limit: float = 100.0


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