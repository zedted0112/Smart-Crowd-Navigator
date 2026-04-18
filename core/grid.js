import { state } from './state.js';
import { CELL_SIZE, COLS, ROWS, STATIC_OBSTACLES } from './constants.js';
import { updateFacilityMetrics } from '../ui/dashboard.js';
import { calculateSafeRoute } from './pathfinding.js';
import { redrawActiveLines } from '../ui/render.js';
import { getCell, isPointInObstacle, isSegmentBlocked } from './grid_utils.js';

export function initGrid() {
    for (let c = 0; c < COLS; c++) {
        state.grid[c] = [];
        for (let r = 0; r < ROWS; r++) {
            const cx = c * CELL_SIZE + CELL_SIZE / 2;
            const cy = r * CELL_SIZE + CELL_SIZE / 2;
            const isBlocked = isPointInObstacle(cx, cy);
            
            state.grid[c][r] = {
                col: c, row: r,
                x: c * CELL_SIZE,
                y: r * CELL_SIZE,
                cx: cx,
                cy: cy,
                count: 0,
                blocked: isBlocked,
                staticBlocked: isBlocked,
                svgRect: null
            };
        }
    }
}

export function updateGridDensity() {
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) state.grid[c][r].count = 0;
    }
    state.people.forEach(p => {
        const cell = getCell(p.x, p.y);
        cell.count++;
    });

    state.grid.forEach(col => col.forEach(cell => {
        const isManualBlock = state.ui.manualBlocks.has(`${cell.col},${cell.row}`);
        const shouldBeBlocked = cell.staticBlocked || cell.count > state.settings.blockedThreshold || isManualBlock;
        
        if (cell.blocked !== shouldBeBlocked) {
            cell.blocked = shouldBeBlocked;
            if (shouldBeBlocked) {
                if (!cell.staticBlocked) {
                    cell.svgRect.setAttribute('fill', isManualBlock ? 'rgba(139, 92, 246, 0.3)' : 'rgba(236, 72, 153, 0.3)');
                }
            } else {
                cell.svgRect.setAttribute('fill', 'transparent');
            }
        }
    }));
    if (Math.random() < 0.2) { // Optimize: Only update metrics/rerouting checks 20% of intervals
        updateFacilityMetrics();
        autoRerouteIfBlocked();
    }
}

export function autoRerouteIfBlocked() {
    if (!state.userAvatar.active || !state.userAvatar.path || state.userAvatar.path.length === 0) return;

    let pathIsBlocked = false;
    const currentPos = { x: state.userAvatar.x, y: state.userAvatar.y };
    const nextNode = state.userAvatar.path[state.userAvatar.targetIndex];
    if (isSegmentBlocked(currentPos, nextNode)) {
        pathIsBlocked = true;
    } else {
        for (let i = state.userAvatar.targetIndex; i < state.userAvatar.path.length - 1; i++) {
            if (isSegmentBlocked(state.userAvatar.path[i], state.userAvatar.path[i+1])) {
                pathIsBlocked = true;
                break;
            }
        }
    }

    if (pathIsBlocked) {
        const start = { x: state.userAvatar.x, y: state.userAvatar.y };
        const target = state.userAvatar.finalDestination || state.userAvatar.path[state.userAvatar.path.length - 1];
        
        const result = calculateSafeRoute([start, target]);
        state.userAvatar.path = result.path;
        state.userAvatar.targetIndex = 0;
        state.userAvatar.active = true; 
        
        redrawActiveLines();
        
        const feedStatus = document.getElementById('feed-route-type');
        if (feedStatus) {
            feedStatus.innerText = "Detour Active";
            feedStatus.style.color = "var(--status-yellow)";
        }
    }
}
