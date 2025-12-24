import { Matrix, solve } from "ml-matrix";

export function calculatePowerFlow(network) {
    /*
    Efficient DC power flow using Kirchhoff laws.
    Uses ml-matrix for fast linear algebra.
    */

    const nodes = network.nodes;
    const lines = network.lines;

    const nodeIds = Object.keys(nodes);
    const lineIds = Object.keys(lines);

    const n = nodeIds.length;
    const m = lineIds.length;

    // --- Map node IDs to indices ---
    const idToIdx = {};
    nodeIds.forEach((id, i) => {
        idToIdx[id] = i;
    });

    // --- Build injection vector p ---
    const p = Matrix.columnVector(
        nodeIds.map(id => nodes[id].injection)
    );

    // --- Build incidence matrix A ---
    const A = Matrix.zeros(n, m);

    lineIds.forEach((lineId, ell) => {
        const line = lines[lineId];
        const i = idToIdx[line.from_node];
        const j = idToIdx[line.to_node];
        A.set(i, ell, 1);
        A.set(j, ell, -1);
    });

    // --- Build susceptance Laplacian B = A * A^T ---
    const B = A.mmul(A.transpose());

    // --- Slack bus: remove row/column 0 ---
    const Bred = B.subMatrix(1, n - 1, 1, n - 1);
    const pred = p.subMatrix(1, n - 1, 0, 0);

    // --- Solve B * theta = p ---
    let thetaRed;
    try {
        thetaRed = solve(Bred, pred);
    } catch {
        network.cost = Infinity;
        for (const lineId of lineIds) {
            lines[lineId].flow = 0;
        }
        return network;
    }

    const theta = Matrix.zeros(n, 1);
    thetaRed.to1DArray().forEach((val, i) => {
        theta.set(i + 1, 0, val);
    });

    // --- Line flows: f = A^T * theta ---
    const flows = A.transpose().mmul(theta).to1DArray();

    // --- Attach flows back to lines ---
    const updatedLines = {};
    lineIds.forEach((lineId, ell) => {
        const line = lines[lineId];
        updatedLines[lineId] = {
            id: line.id,
            from_node: line.from_node,
            to_node: line.to_node,
            flow: flows[ell],
            limit: line.limit
        };
    });

    // --- Cost = sum of overloads ---
    let cost = 0;
    lineIds.forEach(lineId => {
        const flow = updatedLines[lineId].flow;
        const limit = lines[lineId].limit;
        cost += Math.max(0, Math.abs(flow) - limit);
    });

    network.lines = updatedLines;
    network.cost = cost;

    return network;
}
