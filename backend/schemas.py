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
    solved: bool = False


class TopologyChangeRequest(BaseModel):
    line_id: str
    direction: str  # "to" or "from"
