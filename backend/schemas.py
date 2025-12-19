from pydantic import BaseModel
from typing import List, Optional


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
    cost: float = None


class TopologyChangeRequest(BaseModel):
    line_id: str
    direction: str  # "to" or "from"

def update_network_from_dict(data: dict) -> NetworkState:
    nodes = {node_id: Node(**node_data) for node_id, node_data in data.get("nodes", {}).items()}
    lines = {line_id: Line(**line_data) for line_id, line_data in data.get("lines", {}).items()}
    cost = data.get("cost", None)
    return NetworkState(nodes=nodes, lines=lines, cost=cost)