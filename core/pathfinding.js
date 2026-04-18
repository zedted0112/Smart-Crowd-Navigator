import { state } from './state.js';
import { CELL_SIZE } from './constants.js';
import { getCell, isValidCell, isPointInObstacle, isSegmentBlocked } from './grid_utils.js';

export function getGridCost(col, row, ignoreThreshold = false) {
    if (!isValidCell(col, row)) return Infinity;
    const cell = state.grid[col][row];
    if (state.ui.manualBlocks.has(`${col},${row}`)) return Infinity;
    if (isPointInObstacle(cell.cx, cell.cy)) return Infinity;

    const CRITICAL_THRESHOLD = 15;
    if (!ignoreThreshold && cell.count > CRITICAL_THRESHOLD) return Infinity;

    return CELL_SIZE + (cell.count * 15);
}

export function findAStarPath(start, target, ignoreThreshold = false) {
    const startCell = getCell(start.x, start.y);
    const targetCell = getCell(target.x, target.y);
    if (!startCell || !targetCell) return null;
    if (startCell === targetCell) return [{ x: start.x, y: start.y }, { x: target.x, y: target.y }];

    const openSet = [startCell];
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();
    const cellKey = (c) => `${c.col},${c.row}`;

    gScore.set(cellKey(startCell), 0);
    fScore.set(cellKey(startCell), Math.hypot(targetCell.cx - startCell.cx, targetCell.cy - startCell.cy));

    while (openSet.length > 0) {
        let current = openSet.reduce((a, b) => (fScore.get(cellKey(a)) < fScore.get(cellKey(b)) ? a : b));

        if (current === targetCell) {
            const rawPath = [{ x: target.x, y: target.y }];
            let curr = current;
            while (cameFrom.has(cellKey(curr))) {
                curr = cameFrom.get(cellKey(curr));
                rawPath.unshift({ x: curr.cx, y: curr.cy });
            }
            rawPath[0] = { x: start.x, y: start.y };
            
            const prunedPath = [rawPath[0]];
            for (let i = 1; i < rawPath.length; i++) {
                const last = prunedPath[prunedPath.length - 1];
                if (Math.hypot(rawPath[i].x - last.x, rawPath[i].y - last.y) > 5 || i === rawPath.length - 1) {
                    prunedPath.push(rawPath[i]);
                }
            }
            return smoothAStarPath(prunedPath);
        }

        openSet.splice(openSet.indexOf(current), 1);

        for (let dc = -1; dc <= 1; dc++) {
            for (let dr = -1; dr <= 1; dr++) {
                if (dc === 0 && dr === 0) continue;
                const nc = current.col + dc;
                const nr = current.row + dr;
                if (isValidCell(nc, nr)) {
                    const neighbor = state.grid[nc][nr];
                    const moveCost = getGridCost(nc, nr, ignoreThreshold);
                    if (moveCost === Infinity) continue;

                    const weight = (dc !== 0 && dr !== 0) ? 1.414 : 1;
                    const tentativeGScore = gScore.get(cellKey(current)) + (moveCost * weight);

                    if (!gScore.has(cellKey(neighbor)) || tentativeGScore < gScore.get(cellKey(neighbor))) {
                        cameFrom.set(cellKey(neighbor), current);
                        gScore.set(cellKey(neighbor), tentativeGScore);
                        fScore.set(cellKey(neighbor), tentativeGScore + Math.hypot(targetCell.cx - neighbor.cx, targetCell.cy - neighbor.cy));
                        if (!openSet.includes(neighbor)) openSet.push(neighbor);
                    }
                }
            }
        }
    }
    return null;
}

export function smoothAStarPath(path) {
    if (path.length <= 2) return path;
    let smoothed = [path[0]];
    let current = 0;
    while (current < path.length - 1) {
        let bestVisible = current + 1;
        for (let next = current + 2; next < path.length; next++) {
            if (!isSegmentBlocked(path[current], path[next])) bestVisible = next;
            else break;
        }
        smoothed.push(path[bestVisible]);
        current = bestVisible;
    }
    return smoothed;
}

export function calculateSafeRoute(baseRoute) {
    if (!state.settings.smartRoutingEnabled) return { path: baseRoute, blockedLine: null, type: 'primary' };
    const start = baseRoute[0], target = baseRoute[baseRoute.length - 1];

    const strictPath = findAStarPath(start, target, false);
    if (strictPath) return { path: strictPath, blockedLine: null, type: 'a-star' };

    const relaxedPath = findAStarPath(start, target, true);
    if (relaxedPath) return { path: relaxedPath, blockedLine: [start, target], type: 'a-star' };

    return { path: baseRoute, blockedLine: [start, target], type: 'primary' };
}
