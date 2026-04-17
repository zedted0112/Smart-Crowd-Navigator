const SVGNs = "http://www.w3.org/2000/svg";

const nodes = {
    gate: { x: 150, y: 400, label: "Gate (Entry)" },
    food: { x: 450, y: 700, label: "Food Court" },
    washroom: { x: 450, y: 100, label: "Washroom" },
    seat: { x: 800, y: 400, label: "Seat A12" },
    centerJunction: { x: 450, y: 400, label: "" }
};

const routes = {
    food: [nodes.gate, nodes.centerJunction, nodes.food],
    washroom: [nodes.gate, nodes.centerJunction, nodes.washroom],
    seat: [nodes.gate, nodes.centerJunction, nodes.seat]
};

const staticObstacles = [
    { x: 250, y: 500, w: 100, h: 100, label: "Shop" },
    { x: 250, y: 200, w: 100, h: 100, label: "Restricted" },
    { x: 550, y: 150, w: 150, h: 80,  label: "Kiosk" },
    { x: 550, y: 550, w: 150, h: 80,  label: "Food Stall" }
];

// Grid Specs
const CELL_SIZE = 50;
const COLS = 20; // 1000 / 50
const ROWS = 16; // 800 / 50
const grid = [];
let BLOCKED_THRESHOLD = 3;

// People Simulation Details
let NUM_PEOPLE = 80;
let SPEED_MULTIPLIER = 1.0;
let CORRIDOR_BIAS = true;

const people = [];
let currentDestination = null;

// Routing State
let activeOptimizedPath = [];
let currentlyBlockedLine = null;
let SMART_ROUTING_ENABLED = true;
let DETOUR_MODE = 'local';
const manualBlocks = new Set();

function init() {
    initGrid();
    drawObstacles();
    drawSeats();
    drawGrid();
    drawBackgroundPaths();
    drawNodes();
    initPeople();

    const svg = document.getElementById('venue-svg');
    svg.setAttribute('viewBox', '0 0 1000 800');
    
    // Bind Dashboard Listeners
    document.getElementById('ctrl-density').addEventListener('input', (e) => {
        NUM_PEOPLE = parseInt(e.target.value);
        document.getElementById('val-density').innerText = NUM_PEOPLE;
        adjustPeopleCount();
    });
    
    document.getElementById('ctrl-speed').addEventListener('input', (e) => {
        SPEED_MULTIPLIER = parseFloat(e.target.value);
        document.getElementById('val-speed').innerText = SPEED_MULTIPLIER + 'x';
    });
    
    document.getElementById('ctrl-corridor').addEventListener('change', (e) => {
        CORRIDOR_BIAS = e.target.checked;
        initPeople();
    });
    
    document.getElementById('ctrl-smart-routing').addEventListener('change', (e) => {
        SMART_ROUTING_ENABLED = e.target.checked;
        if(currentDestination) navigateTo(currentDestination); 
    });
    
    document.getElementById('ctrl-detour-mode').addEventListener('change', (e) => {
        DETOUR_MODE = e.target.value;
        if(currentDestination) navigateTo(currentDestination); 
    });
    
    document.getElementById('ctrl-sensitivity').addEventListener('input', (e) => {
        BLOCKED_THRESHOLD = 11 - parseInt(e.target.value); 
        document.getElementById('val-sensitivity').innerText = e.target.value;
        updateGridDensity();
    });
    
    document.getElementById('btn-reset').addEventListener('click', resetSimulation);

    let isDraggingFriend = false;
    let friendWasDragged = false;

    svg.addEventListener('mousedown', (e) => {
        if (!document.getElementById('friend-avatar-dot')) return;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
        
        let dist = Math.hypot(svgP.x - friendAvatar.x, svgP.y - friendAvatar.y);
        if (dist <= 25) { 
            isDraggingFriend = true;
            friendWasDragged = false;
            document.getElementById('friend-avatar-dot').style.cursor = 'grabbing';
            e.stopPropagation();
        }
    });

    svg.addEventListener('mousemove', (e) => {
        if (isDraggingFriend) {
            const pt = svg.createSVGPoint();
            pt.x = e.clientX; pt.y = e.clientY;
            const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
            
            friendAvatar.x = Math.max(20, Math.min(980, svgP.x)); 
            friendAvatar.y = Math.max(20, Math.min(780, svgP.y));
            friendWasDragged = true;
            
            const fEl = document.getElementById('friend-avatar-dot');
            if (fEl) {
                fEl.setAttribute('cx', friendAvatar.x);
                fEl.setAttribute('cy', friendAvatar.y);
            }
            drawTargetPing(friendAvatar.x, friendAvatar.y);
            
            if (userAvatar.state === 'MOVING_FINAL' || currentDestination === 'friend') {
                redrawActiveLines();
            }
        }
    });

    svg.addEventListener('mouseup', () => {
        if (isDraggingFriend) {
            isDraggingFriend = false;
            document.getElementById('friend-avatar-dot').style.cursor = 'grab';
            
            const snappedFriend = snapTargetNode(friendAvatar.x, friendAvatar.y);
            navigateToCustom(snappedFriend, friendAvatar);
            friendAvatar.routeSnapshotX = friendAvatar.x;
            friendAvatar.routeSnapshotY = friendAvatar.y;
            
            setTimeout(() => friendWasDragged = false, 100);
        }
    });

    // Map Interactivity for manual congestion
    svg.addEventListener('click', (e) => {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
        
        if (friendWasDragged) return;

        if (e.shiftKey) {
            const cell = getCell(svgP.x, svgP.y);
            const key = `${cell.col},${cell.row}`;
            if (manualBlocks.has(key)) manualBlocks.delete(key);
            else manualBlocks.add(key);
            updateGridDensity();
        } else {
            const friendDist = Math.hypot(svgP.x - friendAvatar.x, svgP.y - friendAvatar.y);
            if (friendDist < 30) {
                navigateToFriend();
                return;
            }

            const clickedNode = { x: svgP.x, y: svgP.y };
            const snappedNode = snapTargetNode(svgP.x, svgP.y);
            console.log(`-- Custom Navigation Activated --`);
            console.log(`Raw Click Coord: [${Math.floor(clickedNode.x)}, ${Math.floor(clickedNode.y)}]`);
            console.log(`Snapped Node: [${Math.floor(snappedNode.x)}, ${Math.floor(snappedNode.y)}]`);
            
            drawTargetPing(clickedNode.x, clickedNode.y); // Dynamically render exactly on the user's specific target!
            navigateToCustom(snappedNode, clickedNode);
        }
    });

    // Start Simulation Loops
    requestAnimationFrame(animatePeople);
    setInterval(updateGridDensity, 2000); // Slower, smoother decision intervals
}

function adjustPeopleCount() {
    if (people.length < NUM_PEOPLE) {
        while(people.length < NUM_PEOPLE) spawnPerson();
    } else if (people.length > NUM_PEOPLE) {
        while(people.length > NUM_PEOPLE) {
            const p = people.pop();
            const el = document.getElementById(`person-${p.id}`);
            if(el) el.remove();
        }
    }
}

function resetSimulation() {
    NUM_PEOPLE = 80;
    SPEED_MULTIPLIER = 1.0;
    CORRIDOR_BIAS = true;
    SMART_ROUTING_ENABLED = true;
    DETOUR_MODE = 'local';
    BLOCKED_THRESHOLD = 3;
    
    document.getElementById('ctrl-density').value = 80;
    document.getElementById('val-density').innerText = '80';
    document.getElementById('ctrl-speed').value = 1;
    document.getElementById('val-speed').innerText = '1x';
    document.getElementById('ctrl-corridor').checked = true;
    document.getElementById('ctrl-smart-routing').checked = true;
    document.getElementById('ctrl-detour-mode').value = 'local';
    document.getElementById('ctrl-sensitivity').value = 8; 
    document.getElementById('val-sensitivity').innerText = '8';
    
    manualBlocks.clear();
    setScenario('normal');
    
    const existingAvatar = document.getElementById('user-avatar-dot');
    if (existingAvatar) existingAvatar.remove();
    userAvatar.active = false;
    userAvatar.isPaused = false;
    userAvatar.state = 'MOVING';
    userAvatar.waitTicks = 0;
    userAvatar.cooldownTicks = 0;
    userAvatar.finalDestination = null;
    currentDestination = null;
    activeOptimizedPath = [];
    currentlyBlockedLine = null;
    redrawActiveLines();
    document.getElementById('route-info').style.display = 'none';
}

function createSVGElement(tag, attributes) {
    const el = document.createElementNS(SVGNs, tag);
    for (const key in attributes) {
        el.setAttribute(key, attributes[key]);
    }
    return el;
}

function initGrid() {
    for (let c = 0; c < COLS; c++) {
        grid[c] = [];
        for (let r = 0; r < ROWS; r++) {
            grid[c][r] = {
                col: c, row: r,
                x: c * CELL_SIZE,
                y: r * CELL_SIZE,
                cx: c * CELL_SIZE + CELL_SIZE / 2,
                cy: r * CELL_SIZE + CELL_SIZE / 2,
                count: 0,
                blocked: false,
                svgRect: null
            };
        }
    }
}

function getCell(px, py) {
    const c = Math.max(0, Math.min(COLS - 1, Math.floor(px / CELL_SIZE)));
    const r = Math.max(0, Math.min(ROWS - 1, Math.floor(py / CELL_SIZE)));
    return grid[c][r];
}

function isValidCell(c, r) {
    return c >= 0 && c < COLS && r >= 0 && r < ROWS;
}

function drawBackgroundPaths() {
    const bgGroup = document.getElementById('all-paths');
    if (!bgGroup) return; // safety
    bgGroup.innerHTML = '';

    const allSegments = [
        [nodes.gate, nodes.centerJunction],
        [nodes.centerJunction, nodes.food],
        [nodes.centerJunction, nodes.washroom],
        [nodes.centerJunction, nodes.seat],
        [nodes.gate, { x: 150, y: 700 }], [{ x: 150, y: 700 }, nodes.food],
        [nodes.gate, { x: 150, y: 100 }], [{ x: 150, y: 100 }, nodes.washroom],
        [nodes.centerJunction, { x: 450, y: 100 }], [{ x: 450, y: 100 }, { x: 800, y: 100 }], [{ x: 800, y: 100 }, nodes.seat]
    ];

    allSegments.forEach(seg => {
        bgGroup.appendChild(createSVGElement('path', { d: pathArrayToString(seg), class: 'path-base' }));
    });
}

function drawGrid() {
    const layer = document.getElementById('grid-layer');
    layer.innerHTML = '';

    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            const cell = grid[c][r];
            const rect = createSVGElement('rect', {
                x: cell.x, y: cell.y,
                width: CELL_SIZE, height: CELL_SIZE,
                fill: 'rgba(255, 50, 50, 0)', // fully transparent initially
                stroke: 'rgba(200, 200, 200, 0.1)', // subtle grid lines
                strokeWidth: 1
            });
            cell.svgRect = rect;
            layer.appendChild(rect);
        }
    }
}

function drawSeats() {
    const seatGroup = document.getElementById('seats-layer');
    seatGroup.innerHTML = '';
    // Draw seat blocks near Seat node
    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 6; col++) {
            const x = 750 + col * 20;
            const y = 350 + row * 20;
            seatGroup.appendChild(createSVGElement('rect', {
                x: x, y: y, width: 12, height: 12, rx: 2, class: 'seat-dot'
            }));
        }
    }
    // Draw seat blocks near Food node
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 8; col++) {
            const x = 500 + col * 20;
            const y = 650 + row * 20;
            seatGroup.appendChild(createSVGElement('rect', {
                x: x, y: y, width: 12, height: 12, rx: 2, class: 'seat-dot'
            }));
        }
    }
}

function drawObstacles() {
    const layer = document.getElementById('obstacles-layer');
    if(!layer) return;
    layer.innerHTML = '';
    
    staticObstacles.forEach(obs => {
        const rect = createSVGElement('rect', {
            x: obs.x, y: obs.y, width: obs.w, height: obs.h,
            class: 'obstacle-rect', rx: 4
        });
        layer.appendChild(rect);
        
        if (obs.label) {
            const text = createSVGElement('text', {
                x: obs.x + obs.w / 2, y: obs.y + obs.h / 2 + 5,
                class: 'obstacle-label'
            });
            text.textContent = obs.label;
            layer.appendChild(text);
        }
    });
}

function drawNodes() {
    const nodeGroup = document.getElementById('nodes');
    nodeGroup.innerHTML = '';
    
    // Render static specific location hubs
    for (const key in nodes) {
        if(key === 'centerJunction') continue;
        const n = nodes[key];
        nodeGroup.appendChild(createSVGElement('circle', {
            cx: n.x, cy: n.y, r: 8, class: 'node-circ'
        }));
    }
}

function drawTargetPing(x, y) {
    let old = document.getElementById('click-target-ping');
    if (old) old.remove();
    const svg = document.getElementById('venue-svg');
    const ping = createSVGElement('circle', {
        id: 'click-target-ping',
        cx: x, cy: y, r: 6, class: 'target-ping'
    });
    // Insert behind floating menus but securely above the primary arrays
    svg.insertBefore(ping, document.getElementById('seats-layer'));
}

function snapTargetNode(px, py) {
    const segments = [
        { x1: 150, y1: 400, x2: 450, y2: 400 }, // Gate-Center
        { x1: 450, y1: 400, x2: 800, y2: 400 }, // Center-Seat
        { x1: 450, y1: 400, x2: 450, y2: 700 }, // Center-Food
        { x1: 450, y1: 100, x2: 450, y2: 400 }  // Center-Washroom
    ];
    
    let closestPt = { x: px, y: py, dist: Infinity };
    
    segments.forEach(seg => {
        let isHoriz = seg.y1 === seg.y2;
        if (isHoriz) {
            let snapX = Math.max(seg.x1, Math.min(seg.x2, px));
            let d = Math.hypot(px - snapX, py - seg.y1);
            if (d < closestPt.dist) closestPt = { x: snapX, y: seg.y1, dist: d };
        } else {
            let snapY = Math.max(seg.y1, Math.min(seg.y2, py));
            let d = Math.hypot(px - seg.x1, py - snapY);
            if (d < closestPt.dist) closestPt = { x: seg.x1, y: snapY, dist: d };
        }
    });
    
    return { x: closestPt.x, y: closestPt.y };
}

function isPointInObstacle(x, y) {
    for (const obs of staticObstacles) {
        if (x >= obs.x && x <= obs.x + obs.w &&
            y >= obs.y && y <= obs.y + obs.h) {
            return true;
        }
    }
    return false;
}

function getEdgePenalty(x, y) {
    let penalty = 0;
    const margin = 50; 
    if (x < margin || x > 1000 - margin) penalty += 500;
    if (y < margin || y > 800 - margin) penalty += 500;
    return penalty;
}

// Data-Driven People Logic
let nextPersonId = 0;
let currentScenario = 'normal';

// Avatar State tracking
let userAvatar = {
    active: false,
    x: 150,
    y: 400,
    path: [],
    targetIndex: 0,
    speed: 0.8, 
    isPaused: false,
    state: 'MOVING', 
    waitTicks: 0,
    cooldownTicks: 0,
    finalDestination: null
};

// Friend wandering entity
let friendAvatar = {
    x: 750,
    y: 200,
    tx: 750,
    ty: 200,
    speed: 0.05,
    routeSnapshotX: null,
    routeSnapshotY: null
};

function navigateToFriend() {
    console.log("-- Friend Target Activated via UI --");
    
    let fEl = document.getElementById('friend-avatar-dot');
    if (!fEl) {
        fEl = createSVGElement('circle', {
            id: 'friend-avatar-dot', r: 10, class: 'friend-dot',
            style: 'cursor: grab;'
        });
        document.getElementById('user-layer').appendChild(fEl);
    }
    fEl.setAttribute('cx', friendAvatar.x);
    fEl.setAttribute('cy', friendAvatar.y);

    const snappedFriend = snapTargetNode(friendAvatar.x, friendAvatar.y);
    drawTargetPing(friendAvatar.x, friendAvatar.y);
    navigateToCustom(snappedFriend, friendAvatar);
    
    // Lock snapshots to natively evaluate dynamically later!
    friendAvatar.routeSnapshotX = friendAvatar.x;
    friendAvatar.routeSnapshotY = friendAvatar.y;
    currentDestination = 'friend';
    document.getElementById('info-dest').innerText = 'Friend';
    document.getElementById('route-info').style.display = 'block';
}

function spawnPerson() {
    let startX = 0;
    let startY = 0;
    let corridor = -1; // -1 means general
    let isScenarioFocused = false;

    if (CORRIDOR_BIAS) {
        isScenarioFocused = Math.random() < 0.85;

        if (isScenarioFocused && currentScenario === 'washroom') {
            corridor = Math.random() > 0.4 ? 1 : 0; 
        } else if (isScenarioFocused && currentScenario === 'food') {
            corridor = Math.random() > 0.4 ? 2 : 0; 
        } else if (isScenarioFocused && currentScenario === 'normal') {
            corridor = Math.floor(Math.random() * 4); 
        }
    }

    if (corridor === 0) { // Gate -> Center 
        startX = 150 + Math.random() * 300; startY = 400 + (Math.random() * 40 - 20);
    } else if (corridor === 1) { // Center -> Washroom
        startX = 450 + (Math.random() * 40 - 20); startY = 100 + Math.random() * 300;
    } else if (corridor === 2) { // Center -> Food
        startX = 450 + (Math.random() * 40 - 20); startY = 400 + Math.random() * 300;
    } else if (corridor === 3) { // Center -> Seat
        startX = 450 + Math.random() * 350; startY = 400 + (Math.random() * 40 - 20);
    } else {
        // Fallback open space
        startX = Math.random() * 800 + 100; startY = Math.random() * 600 + 100;
    }
    
    if (isPointInObstacle(startX, startY)) {
        return spawnPerson(); // Recursively bounce generation safely out of restricted statics
    }

    const p = {
        id: nextPersonId++,
        x: startX,
        y: startY,
        tx: startX,
        ty: startY,
        speed: Math.random() * 0.1 + 0.05,
        isScenarioFocused: isScenarioFocused,
        corridor: corridor
    };

    pickTarget(p);

    people.push(p);

    const circle = createSVGElement('circle', {
        id: `person-${p.id}`, cx: p.x, cy: p.y, r: 4, class: 'person-dot'
    });

    const peopleGroup = document.getElementById('people-layer');
    peopleGroup.appendChild(circle);
}

function pickTarget(p) {
    if (p.corridor === 0) {
        // Gate -> Center constraint
        p.tx = 150 + Math.random() * 300;
        p.ty = 400 + (Math.random() * 40 - 20);
    } else if (p.corridor === 1) {
        // Center -> Washroom constraint
        p.tx = 450 + (Math.random() * 40 - 20);
        p.ty = 100 + Math.random() * 300;
    } else if (p.corridor === 2) {
        // Center -> Food constraint
        p.tx = 450 + (Math.random() * 40 - 20);
        p.ty = 400 + Math.random() * 300;
    } else if (p.corridor === 3) {
        // Center -> Seat constraint
        p.tx = 450 + Math.random() * 350;
        p.ty = 400 + (Math.random() * 40 - 20);
    } else {
        // Random meander off-path safely nearby
        p.tx = Math.max(50, Math.min(950, p.x + (Math.random() * 200 - 100)));
        p.ty = Math.max(50, Math.min(750, p.y + (Math.random() * 200 - 100)));
    }
    
    if (isPointInObstacle(p.tx, p.ty)) pickTarget(p); // Dodge routing inside walls natively!
}

function initPeople() {
    const peopleGroup = document.getElementById('people-layer');
    peopleGroup.innerHTML = '';
    people.length = 0; // reset
    nextPersonId = 0;

    for (let i = 0; i < NUM_PEOPLE; i++) {
        spawnPerson();
    }
}

function animatePeople() {
    people.forEach(p => {
        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 5) {
            pickTarget(p);
        } else {
            p.x += (dx / dist) * p.speed * SPEED_MULTIPLIER;
            p.y += (dy / dist) * p.speed * SPEED_MULTIPLIER;
        }

        const el = document.getElementById(`person-${p.id}`);
        if(el) {
            el.setAttribute('cx', p.x);
            el.setAttribute('cy', p.y);
        }
    });
    
    // Animate User Avatar strictly tracking dual-states logically bypassing math rules when finishing endpoints
    if (userAvatar.active && !userAvatar.isPaused) {
        if (userAvatar.state === 'MOVING_FINAL' && userAvatar.finalDestination) {
            const dx = userAvatar.finalDestination.x - userAvatar.x;
            const dy = userAvatar.finalDestination.y - userAvatar.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 4) {
                userAvatar.x = userAvatar.finalDestination.x;
                userAvatar.y = userAvatar.finalDestination.y;
                userAvatar.active = false;
                userAvatar.finalDestination = null;
                const uEl = document.getElementById('user-avatar-dot');
                if (uEl) uEl.remove();
            } else {
                userAvatar.x += (dx / dist) * userAvatar.speed * SPEED_MULTIPLIER;
                userAvatar.y += (dy / dist) * userAvatar.speed * SPEED_MULTIPLIER;
            }
        } 
        else if (userAvatar.path.length > 0 && userAvatar.targetIndex < userAvatar.path.length) {
            const targetNode = userAvatar.path[userAvatar.targetIndex];
            const dx = targetNode.x - userAvatar.x;
            const dy = targetNode.y - userAvatar.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 4) {
                userAvatar.x = targetNode.x;
                userAvatar.y = targetNode.y;
                userAvatar.targetIndex++;
                
                if (userAvatar.state === 'DETOURING' || userAvatar.state === 'PUSHING') {
                    const isCorridor = (targetNode.x === 150 || targetNode.x === 450 || targetNode.x === 800) || 
                                       (targetNode.y === 100 || targetNode.y === 400 || targetNode.y === 700);
                    if (userAvatar.state === 'PUSHING' || isCorridor) {
                        userAvatar.state = 'MOVING';
                        userAvatar.cooldownTicks = 1; 
                        const el = document.getElementById('user-avatar-dot');
                        if (el) el.classList.remove('avatar-pushing');
                    }
                }

                if (userAvatar.targetIndex >= userAvatar.path.length) {
                    if (userAvatar.finalDestination) {
                        const distToFinal = Math.hypot(userAvatar.finalDestination.x - userAvatar.x, userAvatar.finalDestination.y - userAvatar.y);
                        if (distToFinal > 4) {
                            userAvatar.state = 'MOVING_FINAL';
                        } else {
                            userAvatar.active = false;
                            const uEl = document.getElementById('user-avatar-dot');
                            if (uEl) uEl.remove();
                        }
                    } else {
                        userAvatar.active = false;
                        const uEl = document.getElementById('user-avatar-dot');
                        if (uEl) uEl.remove();
                    }
                }
            } else {
                userAvatar.x += (dx / dist) * userAvatar.speed * SPEED_MULTIPLIER;
                userAvatar.y += (dy / dist) * userAvatar.speed * SPEED_MULTIPLIER;
            }
        }

        if (userAvatar.active) {
            let uEl = document.getElementById('user-avatar-dot');
            if (!uEl) {
                uEl = createSVGElement('circle', {
                    id: 'user-avatar-dot', r: 8, class: 'user-dot'
                });
                document.getElementById('user-layer').appendChild(uEl);
            }
            uEl.setAttribute('cx', userAvatar.x);
            uEl.setAttribute('cy', userAvatar.y);
        }
    }

    requestAnimationFrame(animatePeople);
}


function updateGridDensity() {
    // Reset all counts
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            grid[c][r].count = 0;
        }
    }

    // Tally people per cell
    people.forEach(p => {
        const cell = getCell(p.x, p.y);
        cell.count++;
    });

    let gridChanged = false;

    // Update cell states and visuals
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            const cell = grid[c][r];
            const isManualBlock = manualBlocks.has(`${c},${r}`);
            const shouldBeBlocked = cell.count > BLOCKED_THRESHOLD || isManualBlock;

            if (cell.blocked !== shouldBeBlocked) {
                cell.blocked = shouldBeBlocked;
                gridChanged = true;

                // Subtly highlight blocked cells
                if (shouldBeBlocked) {
                    cell.svgRect.setAttribute('fill', isManualBlock ? 'rgba(150, 0, 150, 0.4)' : 'rgba(255, 50, 50, 0.4)');
                    cell.svgRect.setAttribute('stroke', isManualBlock ? 'rgba(150, 0, 150, 0.8)' : 'rgba(255, 0, 0, 0.8)');
                } else {
                    cell.svgRect.setAttribute('fill', 'rgba(255, 50, 50, 0)');
                    cell.svgRect.setAttribute('stroke', 'rgba(200, 200, 200, 0.1)');
                }
            }
        }
    }

    evalAnalytics();

    // Friend Dynamic Drift Tracking natively explicitly seamlessly flawlessly!
    if (userAvatar.active && currentDestination === 'friend' && friendAvatar.routeSnapshotX !== null) {
        let driftDist = Math.hypot(friendAvatar.x - friendAvatar.routeSnapshotX, friendAvatar.y - friendAvatar.routeSnapshotY);
        if (driftDist > 40) {
            console.log("Friend drifted out of bounds logically! Re-routing dynamically natively!");
            const snappedFriend = snapTargetNode(friendAvatar.x, friendAvatar.y);
            navigateToCustom(snappedFriend, friendAvatar);
            friendAvatar.routeSnapshotX = friendAvatar.x;
            friendAvatar.routeSnapshotY = friendAvatar.y;
            return;
        }
    }

    // Mid-journey dynamic localized routing and waiting evaluation
    if (gridChanged && userAvatar.active && (!userAvatar.isPaused || userAvatar.state === 'WAITING')) {
        if (!SMART_ROUTING_ENABLED) { 
            userAvatar.isPaused = false; 
            return; 
        }
        
        if (userAvatar.cooldownTicks > 0) {
            userAvatar.cooldownTicks--;
            return; // Enforce cooldown lock logically suppressing oscillations!
        }
        
        if (userAvatar.state === 'DETOURING' || userAvatar.state === 'MOVING_FINAL' || userAvatar.state === 'PUSHING') {
            return; // Absolute commitment completely traversing structural detour box geometries or ending vectors natively!
        }

        const currentPosNode = { x: userAvatar.x, y: userAvatar.y };
        if (userAvatar.targetIndex < userAvatar.path.length) {
            const targetNode = userAvatar.path[userAvatar.targetIndex];
            const isBlocked = isSegmentBlocked(currentPosNode, targetNode);
            
            if (isBlocked) {
                const isHard = isSegmentHardBlocked(currentPosNode, targetNode);
                
                if (!isHard && userAvatar.waitTicks < 2) {
                    userAvatar.isPaused = true;
                    userAvatar.state = 'WAITING';
                    userAvatar.waitTicks++;
                    currentlyBlockedLine = [currentPosNode, targetNode];
                    
                    const el = document.getElementById('user-avatar-dot');
                    if(el) el.classList.add('avatar-waiting');
                    
                    const congestionEl = document.getElementById('info-congestion');
                    const alertEl = document.getElementById('info-alert');
                    congestionEl.className = 'alert-text alert-red';
                    congestionEl.innerText = "Temporary Congestion";
                    alertEl.style.display = 'block';
                    alertEl.className = 'alert-text alert-blue';
                    alertEl.innerText = "Waiting for congestion to clear";
                    
                    return; // Hold until next grid evaluation natively
                }

                // Wait timed out or Hard Block hit!
                userAvatar.waitTicks = 0;
                userAvatar.state = 'MOVING';
                userAvatar.isPaused = true;
                
                const el = document.getElementById('user-avatar-dot');
                if(el) el.classList.remove('avatar-waiting');
                currentlyBlockedLine = [currentPosNode, targetNode];

                setTimeout(() => {
                    const routeSubslice = [currentPosNode, ...userAvatar.path.slice(userAvatar.targetIndex)];
                    const result = calculateSafeRoute(routeSubslice);
                    
                    userAvatar.path = result.path;
                    activeOptimizedPath = userAvatar.path;
                    userAvatar.targetIndex = 1; // Since current point is [0] explicitly
                    
                    DETOUR_MODE = result.type;
                    if (result.type !== 'primary') {
                        userAvatar.state = 'DETOURING';
                        userAvatar.cooldownTicks = 1; 
                    } else {
                        userAvatar.state = 'PUSHING';
                        userAvatar.cooldownTicks = 1; 
                        const el = document.getElementById('user-avatar-dot');
                        if (el) el.classList.add('avatar-pushing');
                    }
                    const selectMode = document.getElementById('ctrl-detour-mode');
                    if(selectMode && result.type !== 'primary') selectMode.value = result.type;

                    redrawActiveLines();
                    evalAnalytics();

                    const congestionEl = document.getElementById('info-congestion');
                    const alertEl = document.getElementById('info-alert');
                    congestionEl.className = 'alert-text alert-red';
                    congestionEl.innerText = "High Congestion Detected";
                    alertEl.style.display = 'block';
                    alertEl.className = 'alert-text alert-blue';
                    if (result.type === 'primary') alertEl.innerText = "Pushing carefully through main route";
                    else alertEl.innerText = result.type === 'full' ? "Taking full alternate safe route" : "Taking local detour to avoid area";

                    userAvatar.isPaused = false; 
                }, 400);
            } else if (userAvatar.state === 'WAITING') {
                // Resolved natively by crowd moving!
                userAvatar.state = 'MOVING';
                userAvatar.waitTicks = 0;
                userAvatar.isPaused = false;
                currentlyBlockedLine = null;

                const el = document.getElementById('user-avatar-dot');
                if(el) el.classList.remove('avatar-waiting');
                
                const congestionEl = document.getElementById('info-congestion');
                const alertEl = document.getElementById('info-alert');
                congestionEl.className = 'alert-text alert-green';
                congestionEl.innerText = "Path Cleared";
                alertEl.style.display = 'block';
                alertEl.className = 'alert-text alert-green';
                alertEl.innerText = "Resuming route smoothly!";

                redrawActiveLines();
                evalAnalytics();
                
                setTimeout(()=> { if(userAvatar.state !== 'WAITING' && userAvatar.state !== 'DETOURING') alertEl.style.display = 'none'; }, 2000);
            }
        }
    }
}

function evalAnalytics() {
    let count = 0;
    if (activeOptimizedPath && activeOptimizedPath.length > 0) {
        // approximate tally traversing array intersections
        for (let i = 0; i < activeOptimizedPath.length - 1; i++) {
            const p1 = activeOptimizedPath[i];
            const p2 = activeOptimizedPath[i + 1];
            const steps = Math.max(1, Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y)) / 10;
            for (let j = 0; j <= steps; j++) {
                const x = p1.x + (p2.x - p1.x) * (j / steps);
                const y = p1.y + (p2.y - p1.y) * (j / steps);
                const cell = getCell(x, y);
                count += cell.count;
            }
        }
    }
    const trueCount = Math.floor(count / 8); // deduplicate overlapping cells
    const docCount = document.getElementById('feed-people-path');
    if (docCount) docCount.innerText = trueCount;

    const feedRoute = document.getElementById('feed-route-type');
    if (feedRoute) feedRoute.innerText = SMART_ROUTING_ENABLED ? (currentlyBlockedLine ? `Detour (${DETOUR_MODE})` : "Primary") : "Primary (Forced)";
    const feedCongestion = document.getElementById('feed-congestion');
    if (feedCongestion) {
        if(currentlyBlockedLine) feedCongestion.innerText = 'High';
        else feedCongestion.innerText = 'Clear';
    }
}

function setScenario(scenario) {
    currentScenario = scenario;

    // Update button visuals
    document.querySelectorAll('.btn-scenario').forEach(btn => btn.classList.remove('active-scenario'));
    const btnEl = document.getElementById(`btn-${scenario}`);
    if (btnEl) btnEl.classList.add('active-scenario');

    // Re-initialize people map
    initPeople();

    // Force immediate grid and density calculation so it doesn't wait
    updateGridDensity();
}

// Path Verification against Grid
function isSegmentHardBlocked(p1, p2) {
    const steps = Math.max(10, Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y)) / 10;
    if (steps <= 0) return false;
    for (let j = 0; j <= steps; j++) {
        const x = p1.x + (p2.x - p1.x) * (j / steps);
        const y = p1.y + (p2.y - p1.y) * (j / steps);
        if (isPointInObstacle(x, y)) return true;
        
        const cell = getCell(x, y);
        if (manualBlocks.has(`${cell.col},${cell.row}`)) return true; 
    }
    return false;
}

function isSegmentBlocked(p1, p2) {
    const steps = Math.max(10, Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y)) / 10;
    if (steps <= 0) return false;
    for (let j = 0; j <= steps; j++) {
        const x = p1.x + (p2.x - p1.x) * (j / steps);
        const y = p1.y + (p2.y - p1.y) * (j / steps);
        
        if (isPointInObstacle(x, y)) return true; // Static wall bounds
        
        const cell = getCell(x, y);
        if (cell.blocked) return true;
    }
    return false;
}

function getLocalDetour(p1, p2, offset = 100) {
    const detour = [];
    const isHorizontal = Math.abs(p1.x - p2.x) > Math.abs(p1.y - p2.y);
    
    if (isHorizontal) {
        let yOffset = p1.y < 400 ? offset : -offset;
        detour.push({x: p1.x, y: p1.y + yOffset});
        detour.push({x: p2.x, y: p2.y + yOffset});
    } else {
        let xOffset = p1.x < 500 ? offset : -offset;
        detour.push({x: p1.x + xOffset, y: p1.y});
        detour.push({x: p2.x + xOffset, y: p2.y});
    }
    detour.push({x: p2.x, y: p2.y}); 
    return detour;
}

function calculatePathScore(pathArr) {
    let dist = 0;
    let crowd = 0;
    let edgeCost = 0;
    let obstacleCost = 0;
    
    for (let i = 0; i < pathArr.length - 1; i++) {
        let p1 = pathArr[i], p2 = pathArr[i+1];
        dist += Math.hypot(p2.x - p1.x, p2.y - p1.y);
        
        const steps = Math.max(1, Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y)) / 10;
        for (let j = 0; j <= steps; j++) {
            const x = p1.x + (p2.x - p1.x) * (j / steps);
            const y = p1.y + (p2.y - p1.y) * (j / steps);
            
            if (isPointInObstacle(x, y)) obstacleCost += 5000;
            edgeCost += getEdgePenalty(x, y);
            
            const cell = getCell(x, y);
            crowd += cell.count;
            if (manualBlocks.has(`${cell.col},${cell.row}`)) crowd += 20; 
        }
    }
    crowd = Math.floor(crowd / 8);
    edgeCost = Math.floor(edgeCost / 8);
    
    // Penalize boundary tracking mathematically heavily removing Edge Hugging!
    const turns = Math.max(0, pathArr.length - 2);
    
    return dist * 1 + crowd * 50 + turns * 200 + edgeCost + obstacleCost;
}

function isPathHardBlocked(pathArr) {
    for (let i = 0; i < pathArr.length - 1; i++) {
        if (isSegmentBlocked(pathArr[i], pathArr[i+1])) return true;
    }
    return false;
}

function calculateSafeRoute(baseRoute) {
    if (!SMART_ROUTING_ENABLED) {
        return { path: baseRoute, blockedLine: null, type: 'primary' };
    }
    
    let rawPrimary = calculatePathScore(baseRoute);
    let primaryScore = isPathHardBlocked(baseRoute) ? Infinity : rawPrimary;
    
    let localPath = [baseRoute[0]];
    for (let i = 0; i < baseRoute.length - 1; i++) {
        let p1 = localPath[localPath.length - 1]; 
        let p2 = baseRoute[i+1];
        if (isSegmentBlocked(p1, p2)) localPath.push(...getLocalDetour(p1, p2, 80));
        else localPath.push(p2);
    }
    if (localPath.length === baseRoute.length) localPath = baseRoute; 
    let rawLocal = calculatePathScore(localPath);
    if (localPath !== baseRoute) rawLocal -= 50; 
    let localScore = isPathHardBlocked(localPath) ? Infinity : rawLocal;

    // Reconstruct "Full Detour" natively as a Wide Bypass tracking deep parallel corridors avoiding Edge Perimeter physics!
    let fullPath = [baseRoute[0]];
    for (let i = 0; i < baseRoute.length - 1; i++) {
        let p1 = fullPath[fullPath.length - 1]; 
        let p2 = baseRoute[i+1];
        if (isSegmentBlocked(p1, p2)) {
            fullPath.push(...getLocalDetour(p1, p2, 180));
        } else {
            fullPath.push(p2);
        }
    }
    
    let rawFull = calculatePathScore(fullPath);
    let fullScore = isPathHardBlocked(fullPath) ? Infinity : rawFull;

    console.log(`-- Route Synthesis --`);
    console.log(`Path A (Primary) score: ${primaryScore === Infinity ? 'BLOCKED' : Math.floor(primaryScore)}`);
    console.log(`Path B (Local) score: ${localScore === Infinity ? 'BLOCKED' : Math.floor(localScore)}`);
    console.log(`Path C (Full) score: ${fullScore === Infinity ? 'BLOCKED' : Math.floor(fullScore)}`);
    
    // Fallback: If ALL paths return blocked (extreme crowd wall), fall back structurally minimizing damage smoothly!
    if (primaryScore === Infinity && localScore === Infinity && fullScore === Infinity) {
        primaryScore = rawPrimary;
        localScore = rawLocal;
        fullScore = rawFull;
        console.log("FALLBACK: All trajectories physically blocked. Selecting minimum density resistance naturally...");
    }

    let bestPath = baseRoute;
    let type = 'primary';
    let minScore = primaryScore;

    if (localScore < minScore) {
        minScore = localScore;
        bestPath = localPath;
        type = 'local';
    }
    if (fullScore < minScore) {
        minScore = fullScore;
        bestPath = fullPath;
        type = 'full';
    }

    let blockedTracker = type !== 'primary' ? [baseRoute[0], baseRoute[1]] : null; 
    return { path: bestPath, blockedLine: blockedTracker, type: type };
}

// UI Map Integration
function pathArrayToString(pathArr) {
    return pathArr.map((pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `L ${pt.x} ${pt.y}`)).join(' ');
}

function redrawActiveLines() {
    const origGroup = document.getElementById('active-path-original');
    const optGroup = document.getElementById('active-path-optimized');
    origGroup.innerHTML = ''; optGroup.innerHTML = '';
    
    if (currentlyBlockedLine) {
        origGroup.appendChild(createSVGElement('path', { d: pathArrayToString(currentlyBlockedLine), class: 'path-blocked' }));
    }
    optGroup.appendChild(createSVGElement('path', { d: pathArrayToString(userAvatar.path), class: 'path-optimized' }));
    
    // Draw explicit Final Vector dotted tracks tracking completely organically correctly
    if (userAvatar.finalDestination && userAvatar.path.length > 0) {
        const lastNode = userAvatar.path[userAvatar.path.length - 1];
        const dStr = `M ${lastNode.x} ${lastNode.y} L ${userAvatar.finalDestination.x} ${userAvatar.finalDestination.y}`;
        optGroup.appendChild(createSVGElement('path', { d: dStr, class: 'path-final-dotted' }));
    }
}

function navigateToCustom(snappedDestNode, clickedDestNode) {
    currentDestination = 'custom';
    userAvatar.finalDestination = clickedDestNode;
    const startPoint = (userAvatar.active && !userAvatar.isPaused) ? { x: userAvatar.x, y: userAvatar.y } : nodes.gate;
    
    // Build explicit synthetic vector strictly mapped to Center Hub bounding
    let customNodes = [startPoint];
    const isOnSameXAxis = startPoint.x === snappedDestNode.x && startPoint.x === nodes.centerJunction.x;
    const isOnSameYAxis = startPoint.y === snappedDestNode.y && startPoint.y === nodes.centerJunction.y;
    
    if (!isOnSameXAxis && !isOnSameYAxis) {
        customNodes.push(nodes.centerJunction);
    }
    
    customNodes.push(snappedDestNode);

    // Purge and launch precisely identically to static node navigation tracking
    const existingAvatar = document.getElementById('user-avatar-dot');
    if (existingAvatar) existingAvatar.remove();
    
    const result = calculateSafeRoute(customNodes);
    currentlyBlockedLine = result.blockedLine;
    activeOptimizedPath = result.path;
    
    DETOUR_MODE = result.type;
    const selectMode = document.getElementById('ctrl-detour-mode');
    if(selectMode && result.type !== 'primary') selectMode.value = result.type;

    userAvatar.x = startPoint.x;
    userAvatar.y = startPoint.y;
    userAvatar.path = activeOptimizedPath;
    userAvatar.targetIndex = 1;
    userAvatar.active = true;
    userAvatar.isPaused = false;
    userAvatar.state = result.type !== 'primary' ? 'DETOURING' : 'MOVING';
    userAvatar.cooldownTicks = 1;
    userAvatar.waitTicks = 0;

    redrawActiveLines();
    evalAnalytics();
    
    document.getElementById('route-info').style.display = 'block';
    
    const alertEl = document.getElementById('info-alert');
    const congestionEl = document.getElementById('info-congestion');
    if (currentlyBlockedLine) {
        congestionEl.className = 'alert-text alert-red';
        congestionEl.innerText = "High Congestion Detected";
        alertEl.style.display = 'block';
        alertEl.className = 'alert-text alert-blue';
        alertEl.innerText = result.type === 'full' ? "Taking full alternate safe route" : "Taking local detour to avoid congestion";
    } else {
        congestionEl.className = 'alert-text alert-green';
        congestionEl.innerText = "Path Clear";
        alertEl.style.display = 'none';
    }
}

function navigateTo(destKey) {
    currentDestination = destKey;
    userAvatar.finalDestination = null;
    const baseNodes = routes[destKey];
    
    // Purge old Avatar layout if resetting
    const existingAvatar = document.getElementById('user-avatar-dot');
    if (existingAvatar) existingAvatar.remove();
    
    const result = calculateSafeRoute(baseNodes);
    currentlyBlockedLine = result.blockedLine;
    activeOptimizedPath = result.path;
    
    // Sync UI explicitly based on AI math picking
    DETOUR_MODE = result.type;
    const selectMode = document.getElementById('ctrl-detour-mode');
    if(selectMode && result.type !== 'primary') selectMode.value = result.type;

    // Init Avatar Run Sequence strictly mapped to newly drawn path
    userAvatar.x = nodes.gate.x;
    userAvatar.y = nodes.gate.y;
    userAvatar.path = activeOptimizedPath;
    userAvatar.targetIndex = 1;
    userAvatar.active = true;
    userAvatar.isPaused = false;
    userAvatar.state = result.type !== 'primary' ? 'DETOURING' : 'MOVING';
    userAvatar.cooldownTicks = 1;
    userAvatar.waitTicks = 0;

    redrawActiveLines();
    evalAnalytics();
    updateUI(destKey);
}

function updateUI(destKey) {
    document.getElementById('route-info').style.display = 'block';
    const nameMap = { food: 'Food Court', washroom: 'Washroom', seat: 'Seat A12' };
    document.getElementById('info-dest').innerText = nameMap[destKey];
    document.getElementById('info-eta').innerText = currentlyBlockedLine ? "~3 mins" : "~2 mins";

    // Clear legacy elements not used safely
    document.getElementById('info-crowd-density').style.display = 'none';

    const congestionEl = document.getElementById('info-congestion');
    const alertEl = document.getElementById('info-alert');

    if (currentlyBlockedLine) {
        congestionEl.className = 'alert-text alert-red';
        congestionEl.innerText = "High Congestion Area";
        alertEl.style.display = 'block';
        alertEl.className = 'alert-text alert-blue';
        alertEl.innerText = "Taking local detour to avoid congestion";
    } else {
        congestionEl.className = 'alert-text alert-green';
        congestionEl.innerText = "Clear path ahead";
        alertEl.style.display = 'none';
        alertEl.className = 'alert-text';
    }
}

// Bootstrap
window.onload = init;
window.navigateTo = navigateTo;
window.setScenario = setScenario;
