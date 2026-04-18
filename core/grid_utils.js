/**
 * Grid & Coordinate Utilities
 * Provides low-level geometry and grid-lookup functions shared across modules.
 */
import { state } from './state.js';
import { CELL_SIZE, COLS, ROWS, STATIC_OBSTACLES } from './constants.js';

export function getCell(px, py) {
    const c = Math.max(0, Math.min(COLS - 1, Math.floor(px / CELL_SIZE)));
    const r = Math.max(0, Math.min(ROWS - 1, Math.floor(py / CELL_SIZE)));
    return state.grid[c][r];
}

export function isValidCell(c, r) {
    return c >= 0 && c < COLS && r >= 0 && r < ROWS;
}

export function isPointInObstacle(x, y) {
    for (const obs of STATIC_OBSTACLES) {
        if (x >= obs.x && x <= obs.x + obs.w &&
            y >= obs.y && y <= obs.y + obs.h) {
            return true;
        }
    }
    return false;
}

export function isPointInFacility(x, y) {
    for (const type in state.facilities) {
        for (const f of state.facilities[type]) {
            if (x >= f.x - 24 && x <= f.x + 24 && y >= f.y - 24 && y <= f.y + 24) return true;
        }
    }
    return false;
}

export function isPointBlocked(x, y) {
    return isPointInObstacle(x, y) || isPointInFacility(x, y);
}

export function snapTargetNode(px, py) {
    const cell = getCell(px, py);
    return { x: cell.cx, y: cell.cy };
}

export function isSegmentBlocked(p1, p2) {
    const steps = Math.max(10, Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y)) / 10;
    for (let j = 0; j <= steps; j++) {
        const x = p1.x + (p2.x - p1.x) * (j / steps);
        const y = p1.y + (p2.y - p1.y) * (j / steps);
        if (isPointInObstacle(x, y)) return true;
        const cell = getCell(x, y);
        if (cell && cell.blocked) return true;
    }
    return false;
}
