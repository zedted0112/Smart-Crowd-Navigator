/**
 * SVG Rendering System
 * Functional drawing utilities for the venue map, crowd, and interactive layers.
 */
import { state } from '../core/state.js';
import { SVGNs, STATIC_OBSTACLES, CELL_SIZE, COLS, ROWS, NODES } from '../core/constants.js';

export function createSVGElement(tag, attributes) {
    const el = document.createElementNS(SVGNs, tag);
    for (const key in attributes) {
        el.setAttribute(key, attributes[key]);
    }
    return el;
}

export function drawGrid(layer) {
    if (!layer) return;
    layer.innerHTML = '';

    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            const cell = state.grid[c][r];
            const rect = createSVGElement('rect', {
                x: cell.x, y: cell.y,
                width: CELL_SIZE, height: CELL_SIZE,
                fill: 'transparent', 
                stroke: 'rgba(200, 200, 200, 0.1)', 
                strokeWidth: 1
            });
            cell.svgRect = rect;
            layer.appendChild(rect);
        }
    }
}

export function drawSeats(layer) {
    if (!layer) return;
    layer.innerHTML = '';
    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 6; col++) {
            const x = 750 + col * 20;
            const y = 350 + row * 20;
            const isAssigned = state.userAvatar.assignedSeat && x === state.userAvatar.assignedSeat.x && y === state.userAvatar.assignedSeat.y;
            layer.appendChild(createSVGElement('rect', {
                x: x, y: y, width: 12, height: 12, rx: 2, class: isAssigned ? 'seat-dot seat-assigned' : 'seat-dot'
            }));
        }
    }
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 8; col++) {
            const x = 500 + col * 20;
            const y = 650 + row * 20;
            const isAssigned = state.userAvatar.assignedSeat && x === state.userAvatar.assignedSeat.x && y === state.userAvatar.assignedSeat.y;
            layer.appendChild(createSVGElement('rect', {
                x: x, y: y, width: 12, height: 12, rx: 2, class: isAssigned ? 'seat-dot seat-assigned' : 'seat-dot'
            }));
        }
    }
}

export function drawObstacles(layer) {
    if(!layer) return;
    layer.innerHTML = '';
    
    STATIC_OBSTACLES.forEach(obs => {
        const rect = createSVGElement('rect', {
            x: obs.x, y: obs.y, width: obs.w, height: obs.h,
            class: 'obstacle-rect', rx: 4
        });
        layer.appendChild(rect);
        
        if (obs.label) {
            const text = createSVGElement('text', {
                x: obs.x + obs.w / 2, y: obs.y + obs.h / 2,
                class: 'obstacle-label',
                'text-anchor': 'middle',
                'dominant-baseline': 'central'
            });
            text.textContent = obs.label;
            layer.appendChild(text);
        }
    });
}

export function drawNodes(layer) {
    if (!layer) return;
    layer.innerHTML = '';
    
    const n = NODES.gate;
    layer.appendChild(createSVGElement('circle', {
        cx: n.x, cy: n.y, r: 8, class: 'node-circ'
    }));
}

export function drawFacilities(layer) {
    if (!layer) return;
    layer.innerHTML = '';
    
    ['washroom', 'food'].forEach(type => {
        state.facilities[type].forEach(f => {
            const container = createSVGElement('g', {
                id: `fac-${f.id}`,
                class: 'facility-marker status-green'
            });
            
            container.appendChild(createSVGElement('rect', {
                x: f.x - 24, y: f.y - 24, width: 48, height: 48, rx: 14,
                class: 'facility-base'
            }));

            const icon = createSVGElement('text', {
                x: f.x, y: f.y, class: 'facility-icon',
                'text-anchor': 'middle',
                'dominant-baseline': 'central'
            });
            icon.textContent = type === 'washroom' ? 'WC' : '🍴';
            container.appendChild(icon);
            
            const label = createSVGElement('text', {
                x: f.x, y: f.y + 42, class: 'facility-label',
                'text-anchor': 'middle'
            });
            label.textContent = f.label;
            
            layer.appendChild(container);

            const badgeGroup = createSVGElement('g', {
                id: `fac-badge-group-${f.id}`,
                style: 'pointer-events: none;'
            });
            badgeGroup.appendChild(createSVGElement('circle', {
                cx: f.x + 22, cy: f.y - 22, r: 12,
                class: 'facility-badge-bg status-green-bg',
                id: `fac-badge-bg-${f.id}`
            }));
            const badgeText = createSVGElement('text', {
                x: f.x + 22, y: f.y - 22, 
                class: 'facility-badge-text',
                id: `fac-badge-val-${f.id}`,
                'text-anchor': 'middle',
                'dominant-baseline': 'central'
            });
            badgeText.textContent = '0';
            badgeGroup.appendChild(badgeText);
            layer.appendChild(badgeGroup);

            layer.appendChild(label);
        });
    });
}

export function drawTargetPing(x, y) {
    let old = document.getElementById('click-target-ping');
    if (old) old.remove();
    const svg = document.getElementById('venue-svg');
    if (!svg) return;
    const ping = createSVGElement('circle', {
        id: 'click-target-ping',
        cx: x, cy: y, r: 6, class: 'target-ping'
    });
    // Explicitly inserting before seats-layer if it exists
    const seats = document.getElementById('seats-layer');
    if (seats) svg.insertBefore(ping, seats);
    else svg.appendChild(ping);
}

export function redrawActiveLines(origGroup, optGroup) {
    const og = origGroup || document.getElementById('active-path-original');
    const ogOpt = optGroup || document.getElementById('active-path-optimized');
    if (!og || !ogOpt) return;
    og.innerHTML = ''; ogOpt.innerHTML = '';
    
    if (state.ui.currentlyBlockedLine) {
        og.appendChild(createSVGElement('path', { d: pathArrayToString(state.ui.currentlyBlockedLine), class: 'path-blocked' }));
    }
    ogOpt.appendChild(createSVGElement('path', { d: pathArrayToString(state.userAvatar.path), class: 'path-optimized' }));
}

function pathArrayToString(pathArr) {
    return pathArr.map((pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `L ${pt.x} ${pt.y}`)).join(' ');
}
