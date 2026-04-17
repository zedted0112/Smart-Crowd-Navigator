const SVGNs = "http://www.w3.org/2000/svg";

const nodes = {
    gate: { x: 150, y: 400, label: "Gate (Entry)" },
    centerJunction: { x: 450, y: 400, label: "" }
};

const facilities = {
    washroom: [
        { id: 'W1', x: 80, y: 80, label: 'W1', queue: [], serving: [], capacity: 2, serviceTime: 120 },
        { id: 'W2', x: 80, y: 720, label: 'W2', queue: [], serving: [], capacity: 2, serviceTime: 120 },
        { id: 'W3', x: 920, y: 80, label: 'W3', queue: [], serving: [], capacity: 2, serviceTime: 120 },
        { id: 'W4', x: 920, y: 720, label: 'W4', queue: [], serving: [], capacity: 2, serviceTime: 120 },
        { id: 'W5', x: 450, y: 200, label: 'W5 (Main)', queue: [], serving: [], capacity: 4, serviceTime: 100 }
    ],
    food: [
        { id: 'F1', x: 450, y: 750, label: 'F1 (Main)', queue: [], serving: [], capacity: 3, serviceTime: 180 },
        { id: 'F2', x: 50, y: 400, label: 'F2', queue: [], serving: [], capacity: 2, serviceTime: 150 },
        { id: 'F3', x: 950, y: 400, label: 'F3', queue: [], serving: [], capacity: 2, serviceTime: 150 },
        { id: 'F4', x: 450, y: 50, label: 'F4', queue: [], serving: [], capacity: 2, serviceTime: 150 },
        { id: 'F5', x: 850, y: 650, label: 'F5', queue: [], serving: [], capacity: 2, serviceTime: 150 }
    ]
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
    drawNodes();
    drawFacilities();
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
            drawTargetPing(clickedNode.x, clickedNode.y); 
            navigateToCustom(snappedNode, clickedNode);
        }
    });

    requestAnimationFrame(animatePeople);
    setInterval(updateGridDensity, 2000); 
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
    document.getElementById('btn-normal').classList.add('active');
    document.getElementById('btn-washroom').classList.remove('active');
    document.getElementById('btn-food').classList.remove('active');
    
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

function drawGrid() {
    const layer = document.getElementById('grid-layer');
    layer.innerHTML = '';

    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            const cell = grid[c][r];
            const rect = createSVGElement('rect', {
                x: cell.x, y: cell.y,
                width: CELL_SIZE, height: CELL_SIZE,
                fill: 'rgba(255, 50, 50, 0)', 
                stroke: 'rgba(200, 200, 200, 0.1)', 
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
    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 6; col++) {
            const x = 750 + col * 20;
            const y = 350 + row * 20;
            seatGroup.appendChild(createSVGElement('rect', {
                x: x, y: y, width: 12, height: 12, rx: 2, class: 'seat-dot'
            }));
        }
    }
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
    if (!nodeGroup) return;
    nodeGroup.innerHTML = '';
    
    const n = nodes.gate;
    nodeGroup.appendChild(createSVGElement('circle', {
        cx: n.x, cy: n.y, r: 8, class: 'node-circ'
    }));
}

function drawFacilities() {
    const fGroup = document.getElementById('facility-layer');
    if (!fGroup) return;
    fGroup.innerHTML = '';
    
    ['washroom', 'food'].forEach(type => {
        facilities[type].forEach(f => {
            const container = createSVGElement('g', {
                id: `fac-${f.id}`,
                class: 'facility-marker status-green'
            });
            
            const rect = createSVGElement('rect', {
                x: f.x - 12, y: f.y - 12, width: 24, height: 24, rx: 6
            });
            
            const label = createSVGElement('text', {
                x: f.x, y: f.y + 28, class: 'facility-label'
            });
            label.textContent = f.label;
            
            container.appendChild(rect);
            fGroup.appendChild(container);
            fGroup.appendChild(label);
        });
    });
    initDashboardUI();
}

function initDashboardUI() {
    const grid = document.getElementById('facility-analytics-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    ['washroom', 'food'].forEach(type => {
        facilities[type].forEach(f => {
            const card = document.createElement('div');
            card.id = `dash-card-${f.id}`;
            card.className = 'analytics-card';
            card.innerHTML = `
                <div style="font-weight: 600; color: var(--accent-blue); display: flex; justify-content: space-between; align-items: center;">
                    ${f.label}
                    <span id="badge-${f.id}" class="best-badge" style="display: none;">Best</span>
                </div>
                <div style="margin-top: 4px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; color: var(--text-secondary); font-size: 0.7rem;">
                    <span>Q: <span id="dash-q-${f.id}">0</span></span>
                    <span>S: <span id="dash-s-${f.id}">0</span></span>
                </div>
                <div style="margin-top: 4px; border-top: 1px solid var(--glass-border); padding-top: 4px;">
                    Wait: <span id="dash-ewt-${f.id}" class="ewt-val ewt-green">0s</span>
                </div>
            `;
            grid.appendChild(card);
        });
    });
}

function updateFacilityMetrics() {
    ['washroom', 'food'].forEach(type => {
        facilities[type].forEach(f => {
            const el = document.getElementById(`fac-${f.id}`);
            if (el) {
                el.classList.remove('status-green', 'status-yellow', 'status-red');
                const total = f.queue.length + f.serving.length;
                if (total < f.capacity) el.classList.add('status-green');
                else if (total < f.capacity * 3) el.classList.add('status-yellow');
                else el.classList.add('status-red');
            }
        });
    });
    updateDashboardUI();
}

function updateDashboardUI() {
    ['washroom', 'food'].forEach(type => {
        facilities[type].forEach(f => {
            const qCount = f.queue.length;
            const sCount = f.serving.length;
            
            const dashQ = document.getElementById(`dash-q-${f.id}`);
            const dashS = document.getElementById(`dash-s-${f.id}`);
            const dashEWT = document.getElementById(`dash-ewt-${f.id}`);
            const card = document.getElementById(`dash-card-${f.id}`);
            const badge = document.getElementById(`badge-${f.id}`);

            if (dashQ) dashQ.innerText = qCount;
            if (dashS) dashS.innerText = sCount;
            
            const ewt = Math.round((qCount / f.capacity) * (f.serviceTime / 50));
            if (dashEWT) {
                dashEWT.innerText = `${ewt}s`;
                dashEWT.className = 'ewt-val ' + (ewt < 10 ? 'ewt-green' : (ewt < 30 ? 'ewt-yellow' : 'ewt-red'));
            }

            const isBest = userAvatar.finalDestination && userAvatar.finalDestination.id === f.id;
            if (card) {
                if (isBest) card.classList.add('is-best');
                else card.classList.remove('is-best');
            }
            if (badge) badge.style.display = isBest ? 'block' : 'none';
        });
    });
    
    if (Math.random() < 0.05) transmitToCloud();
}

function drawTargetPing(x, y) {
    let old = document.getElementById('click-target-ping');
    if (old) old.remove();
    const svg = document.getElementById('venue-svg');
    const ping = createSVGElement('circle', {
        id: 'click-target-ping',
        cx: x, cy: y, r: 6, class: 'target-ping'
    });
    svg.insertBefore(ping, document.getElementById('seats-layer'));
}

function snapTargetNode(px, py) {
    const segments = [
        { x1: 150, y1: 400, x2: 450, y2: 400 }, 
        { x1: 450, y1: 400, x2: 800, y2: 400 }, 
        { x1: 450, y1: 400, x2: 450, y2: 700 }, 
        { x1: 450, y1: 100, x2: 450, y2: 400 }  
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
    
    friendAvatar.routeSnapshotX = friendAvatar.x;
    friendAvatar.routeSnapshotY = friendAvatar.y;
    currentDestination = 'friend';
    document.getElementById('info-dest').innerText = 'Friend';
    document.getElementById('route-info').style.display = 'block';
}

function spawnPerson() {
    let startX = 0;
    let startY = 0;
    let corridor = -1; 
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

    if (corridor === 0) {
        startX = 150 + Math.random() * 300; startY = 400 + (Math.random() * 40 - 20);
    } else if (corridor === 1) {
        startX = 450 + (Math.random() * 40 - 20); startY = 100 + Math.random() * 300;
    } else if (corridor === 2) {
        startX = 450 + (Math.random() * 40 - 20); startY = 400 + Math.random() * 300;
    } else if (corridor === 3) {
        startX = 450 + Math.random() * 350; startY = 400 + (Math.random() * 40 - 20);
    } else {
        startX = Math.random() * 800 + 100; startY = Math.random() * 600 + 100;
    }
    
    if (isPointInObstacle(startX, startY)) return spawnPerson();

    const p = {
        id: nextPersonId++,
        x: startX,
        y: startY,
        tx: startX,
        ty: startY,
        speed: Math.random() * 0.1 + 0.05,
        isScenarioFocused: isScenarioFocused,
        corridor: corridor,
        state: 'MOVING',
        targetFacility: null,
        patience: Math.random() 
    };

    const rng = Math.random();
    if (currentScenario === 'washroom') {
        p.goal = rng < 0.8 ? 'washroom' : (rng < 0.9 ? 'food' : 'roam');
    } else if (currentScenario === 'food') {
        p.goal = rng < 0.8 ? 'food' : (rng < 0.9 ? 'washroom' : 'roam');
    } else {
        if (rng < 0.4) p.goal = 'washroom';
        else if (rng < 0.7) p.goal = 'food';
        else p.goal = 'roam';
    }

    pickTarget(p);
    people.push(p);

    const circle = createSVGElement('circle', {
        id: `person-${p.id}`, cx: p.x, cy: p.y, r: 4, class: 'person-dot'
    });

    const peopleGroup = document.getElementById('people-layer');
    if (peopleGroup) peopleGroup.appendChild(circle);
}

function pickTarget(p) {
    let chosenFac = null;

    if (p.goal === 'washroom' || p.goal === 'food') {
        // Agents use the same intelligent scoring as the user to pick their target
        chosenFac = findBestFacility(p.goal);
    }

    if (chosenFac) {
        p.tx = chosenFac.x + (Math.random() * 20 - 10);
        p.ty = chosenFac.y + (Math.random() * 20 - 10);
        p.targetFacility = chosenFac;
    } else {
        // Roaming/Fallback behavior
        const corridors = [
            { x: 150 + Math.random() * 300, y: 400 + (Math.random() * 40 - 20) }, // Gate-Center
            { x: 450 + (Math.random() * 40 - 20), y: 100 + Math.random() * 300 }, // Center-Washroom
            { x: 450 + (Math.random() * 40 - 20), y: 400 + Math.random() * 300 }, // Center-Food
            { x: 450 + Math.random() * 350, y: 400 + (Math.random() * 40 - 20) }  // Center-Seat
        ];
        const target = corridors[Math.floor(Math.random() * corridors.length)];
        p.tx = target.x;
        p.ty = target.y;
        p.targetFacility = null;
    }
    
    if (isPointInObstacle(p.tx, p.ty)) pickTarget(p);
}

function initPeople() {
    const peopleGroup = document.getElementById('people-layer');
    peopleGroup.innerHTML = '';
    people.length = 0; 
    nextPersonId = 0;
    for (let i = 0; i < NUM_PEOPLE; i++) spawnPerson();
}

function animatePeople() {
    processFacilityQueues();
    const deadAgents = [];

    people.forEach(p => {
        const el = document.getElementById(`person-${p.id}`);
        if (!el) return;

        if (p.state === 'MOVING') {
            const dx = p.tx - p.x;
            const dy = p.ty - p.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 25) { 
                if (p.targetFacility) {
                    p.state = 'QUEUING';
                    p.targetFacility.queue.push(p);
                    console.log(`[Simulation] Agent ${p.id} joined queue at ${p.targetFacility.id}`);
                } else {
                    pickTarget(p);
                }
            } else {
                p.x += (dx / dist) * p.speed * SPEED_MULTIPLIER;
                p.y += (dy / dist) * p.speed * SPEED_MULTIPLIER;
            }
        } else if (p.state === 'QUEUING') {
            if (Math.random() < 0.005 * (1 - p.patience)) {
                p.state = 'MOVING';
                if (p.targetFacility) {
                    const qIdx = p.targetFacility.queue.indexOf(p);
                    if (qIdx > -1) p.targetFacility.queue.splice(qIdx, 1);
                }
                p.targetFacility = null;
                pickTarget(p);
            }
        } else if (p.state === 'SERVING') {
            p.serviceTicks -= 1 * SPEED_MULTIPLIER;
            if (p.serviceTicks <= 0) deadAgents.push(p);
        }

        el.style.opacity = (p.state === 'SERVING') ? '0.3' : '1';
        el.setAttribute('cx', p.x);
        el.setAttribute('cy', p.y);
    });

    deadAgents.forEach(p => {
        const idx = people.indexOf(p);
        if (idx > -1) people.splice(idx, 1);
        if (p.targetFacility) {
            const sIdx = p.targetFacility.serving.indexOf(p);
            if (sIdx > -1) p.targetFacility.serving.splice(sIdx, 1);
        }
        const el = document.getElementById(`person-${p.id}`);
        if (el) el.remove();
        spawnPerson();
    });

    requestAnimationFrame(animatePeople);
}

function updateGridDensity() {
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) grid[c][r].count = 0;
    }
    people.forEach(p => {
        const cell = getCell(p.x, p.y);
        cell.count++;
    });

    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            const cell = grid[c][r];
            const isManualBlock = manualBlocks.has(`${c},${r}`);
            const shouldBeBlocked = cell.count > BLOCKED_THRESHOLD || isManualBlock;

            if (cell.blocked !== shouldBeBlocked) {
                cell.blocked = shouldBeBlocked;
                if (shouldBeBlocked) {
                    cell.svgRect.setAttribute('fill', isManualBlock ? 'rgba(139, 92, 246, 0.3)' : 'rgba(236, 72, 153, 0.3)');
                    cell.svgRect.setAttribute('stroke', isManualBlock ? 'rgba(139, 92, 246, 0.6)' : 'rgba(236, 72, 153, 0.6)');
                } else {
                    cell.svgRect.setAttribute('fill', 'transparent');
                    cell.svgRect.setAttribute('stroke', 'rgba(255, 255, 255, 0.05)');
                }
            }
        }
    }
    updateFacilityMetrics();
}

function setScenario(scenario) {
    currentScenario = scenario;
    
    // Core Reset: Clear all internal facility states
    ['washroom', 'food'].forEach(type => {
        facilities[type].forEach(f => {
            f.queue = [];
            f.serving = [];
        });
    });

    // Reset UI buttons
    document.querySelectorAll('.btn-group .btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-${scenario}`).classList.add('active');
    
    // Wipe and re-init fresh crowd with scenario-biased goals
    initPeople();
    updateGridDensity();

    console.log(`[Scenario Sync] Switched to ${scenario}. Analytics and population reset.`);
}

function isSegmentBlocked(p1, p2) {
    const steps = Math.max(10, Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y)) / 10;
    for (let j = 0; j <= steps; j++) {
        const x = p1.x + (p2.x - p1.x) * (j / steps);
        const y = p1.y + (p2.y - p1.y) * (j / steps);
        if (isPointInObstacle(x, y)) return true;
        const cell = getCell(x, y);
        if (cell.blocked) return true;
    }
    return false;
}

// --- CORE NAVIGATION ENGINE ---
function getGridCost(col, row, ignoreThreshold = false) {
    if (!isValidCell(col, row)) return Infinity;
    const cell = grid[col][row];
    if (manualBlocks.has(`${col},${row}`)) return Infinity;
    if (isPointInObstacle(cell.cx, cell.cy)) return Infinity;

    const CRITICAL_THRESHOLD = 15;
    if (!ignoreThreshold && cell.count > CRITICAL_THRESHOLD) return Infinity;

    return CELL_SIZE + (cell.count * 15);
}

function findAStarPath(start, target, ignoreThreshold = false) {
    const startCell = getCell(start.x, start.y);
    const targetCell = getCell(target.x, target.y);
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
                    const neighbor = grid[nc][nr];
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

function smoothAStarPath(path) {
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

function calculateSafeRoute(baseRoute) {
    if (!SMART_ROUTING_ENABLED) return { path: baseRoute, blockedLine: null, type: 'primary' };
    const start = baseRoute[0], target = baseRoute[baseRoute.length - 1];

    const strictPath = findAStarPath(start, target, false);
    if (strictPath) return { path: strictPath, blockedLine: null, type: 'a-star' };

    const relaxedPath = findAStarPath(start, target, true);
    if (relaxedPath) return { path: relaxedPath, blockedLine: [start, target], type: 'a-star' };

    return { path: baseRoute, blockedLine: [start, target], type: 'primary' };
}

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
}

function navigateToCustom(snappedDestNode, clickedDestNode) {
    userAvatar.finalDestination = clickedDestNode;
    const startPoint = { x: userAvatar.x, y: userAvatar.y };
    const result = calculateSafeRoute([startPoint, snappedDestNode]);
    userAvatar.path = result.path;
    userAvatar.targetIndex = 0;
    userAvatar.active = true;
    redrawActiveLines();
}

function navigateTo(destType) {
    const best = (destType === 'washroom' || destType === 'food') ? findBestFacility(destType) : null;
    if (best) {
        userAvatar.finalDestination = { x: best.x, y: best.y, id: best.id, label: best.label };
    } else if (destType === 'seat') {
        userAvatar.finalDestination = { x: 800, y: 400, label: "Seat A12" };
    }
    
    if (!userAvatar.finalDestination) return;
    const result = calculateSafeRoute([{ x: userAvatar.x, y: userAvatar.y }, userAvatar.finalDestination]);
    userAvatar.path = result.path;
    userAvatar.targetIndex = 0;
    userAvatar.active = true;
    document.getElementById('route-info').style.display = 'block';
    document.getElementById('info-dest').innerText = userAvatar.finalDestination.label;
    redrawActiveLines();
}

function findBestFacility(type) {
    const options = facilities[type];
    const startPos = { x: userAvatar.x, y: userAvatar.y };
    let best = null, minScore = Infinity;

    options.forEach(f => {
        const path = findAStarPath(startPos, { x: f.x, y: f.y }, true);
        if (!path) return;
        const dist = calculatePathDistance(path);
        const ewt = (f.queue.length / f.capacity) * (f.serviceTime / 50); 
        const score = dist + (ewt * 10.0);
        if (score < minScore) { minScore = score; best = f; }
    });
    return best;
}

function calculatePathDistance(path) {
    let d = 0;
    for (let i = 0; i < path.length - 1; i++) d += Math.hypot(path[i+1].x - path[i].x, path[i+1].y - path[i].y);
    return d;
}

function processFacilityQueues() {
    ['washroom', 'food'].forEach(type => {
        facilities[type].forEach(f => {
            if (f.serving.length < f.capacity && f.queue.length > 0) {
                const nextAgent = f.queue.shift();
                nextAgent.state = 'SERVING';
                nextAgent.serviceTicks = f.serviceTime;
                f.serving.push(nextAgent);
            }
        });
    });
}

function transmitToCloud() {
    const payload = { timestamp: Date.now(), facilities: {} };
    ['washroom', 'food'].forEach(type => {
        facilities[type].forEach(f => {
            payload.facilities[f.id] = { queue: f.queue.length, serving: f.serving.length };
        });
    });
    console.log("[Firebase Sync Hub]", payload);
}
function toggleLeftPanel() {
    document.getElementById('control-panel').classList.toggle('collapsed');
}

function toggleRightPanel() {
    document.querySelector('.dashboard-panel').classList.toggle('collapsed');
}

window.onload = init;
window.navigateTo = navigateTo;
window.setScenario = setScenario;
window.toggleLeftPanel = toggleLeftPanel;
window.toggleRightPanel = toggleRightPanel;
