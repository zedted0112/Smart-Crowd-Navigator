const SVGNs = "http://www.w3.org/2000/svg";

const colors = {
    red: "rgba(255, 50, 50, 0.5)",
    yellow: "rgba(255, 200, 0, 0.4)",
    green: "rgba(50, 255, 50, 0.3)"
};

// Define Coordinates
const nodes = {
    gate: { x: 150, y: 400, label: "Gate (Entry)" },
    food: { x: 450, y: 700, label: "Food Court" },
    washroom: { x: 450, y: 100, label: "Washroom" },
    seat: { x: 800, y: 400, label: "Seat A12" },
    centerJunction: { x: 450, y: 400, label: "" }
};

// Define predefined paths (arrays of coordinates)
const routes = {
    food: {
        primary: [nodes.gate, nodes.centerJunction, nodes.food],
        alternate: [nodes.gate, { x: 150, y: 700 }, nodes.food],
        zoneIndexToCheck: 0 // Which zone primarily blocks this
    },
    washroom: {
        primary: [nodes.gate, nodes.centerJunction, nodes.washroom],
        alternate: [nodes.gate, { x: 150, y: 100 }, nodes.washroom],
        zoneIndexToCheck: 1
    },
    seat: {
        primary: [nodes.gate, nodes.centerJunction, nodes.seat],
        alternate: [nodes.gate, { x: 450, y: 100 }, { x: 800, y: 100 }, nodes.seat],
        zoneIndexToCheck: 2
    }
};

// Crowd Zones
const zones = [
    { cx: 450, cy: 550, r: 80, level: 'green' }, // Zone 0: Blocks Food
    { cx: 450, cy: 250, r: 80, level: 'yellow' }, // Zone 1: Blocks Washroom
    { cx: 650, cy: 400, r: 90, level: 'red' }     // Zone 2: Blocks Seat
];

let currentDestination = null;

function init() {
    drawBackgroundPaths();
    drawZones();
    drawNodes();
    startLiveSimulation();
    
    // Scale SVG properly
    const svg = document.getElementById('venue-svg');
    svg.setAttribute('viewBox', '0 0 1000 800');
}

function createSVGElement(tag, attributes) {
    const el = document.createElementNS(SVGNs, tag);
    for (const key in attributes) {
        el.setAttribute(key, attributes[key]);
    }
    return el;
}

function pathArrayToString(pathArr) {
    return pathArr.map((pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `L ${pt.x} ${pt.y}`)).join(' ');
}

// 1. Draw static background connections in light gray
function drawBackgroundPaths() {
    const bgGroup = document.getElementById('all-paths');
    const allSegments = [
        [nodes.gate, nodes.centerJunction],
        [nodes.centerJunction, nodes.food],
        [nodes.centerJunction, nodes.washroom],
        [nodes.centerJunction, nodes.seat],
        // Alternatives
        [nodes.gate, { x: 150, y: 700 }], [{ x: 150, y: 700 }, nodes.food],
        [nodes.gate, { x: 150, y: 100 }], [{ x: 150, y: 100 }, nodes.washroom],
        [nodes.centerJunction, { x: 450, y: 100 }], [{ x: 450, y: 100 }, { x: 800, y: 100 }], [{ x: 800, y: 100 }, nodes.seat]
    ];

    allSegments.forEach(seg => {
        bgGroup.appendChild(createSVGElement('path', {
            d: pathArrayToString(seg),
            class: 'path-base'
        }));
    });
}

// 2. Draw active crowd zones
function drawZones() {
    const zoneGroup = document.getElementById('zones');
    zoneGroup.innerHTML = ''; // clear

    zones.forEach((z, i) => {
        const circle = createSVGElement('circle', {
            cx: z.cx,
            cy: z.cy,
            r: z.r,
            fill: colors[z.level],
            class: 'zone-circle',
            id: `zone-${i}`
        });
        zoneGroup.appendChild(circle);
    });
}

// 3. Draw nodes & labels
function drawNodes() {
    const nodeGroup = document.getElementById('nodes');
    
    for (const key in nodes) {
        const n = nodes[key];
        if (!n.label) continue; // Skip junction rendering if no label

        const g = createSVGElement('g', { class: 'node-group' });
        
        g.appendChild(createSVGElement('circle', {
            cx: n.x,
            cy: n.y,
            r: 12,
            class: 'node-circle'
        }));

        const text = createSVGElement('text', {
            x: n.x,
            y: n.y - 20,
            class: 'node-label'
        });
        text.textContent = n.label;
        g.appendChild(text);

        nodeGroup.appendChild(g);
    }
}

// Navigational Logic
function navigateTo(destKey) {
    currentDestination = destKey;
    const destData = routes[destKey];
    const blockingZone = zones[destData.zoneIndexToCheck];
    
    // Check if primary path is blocked by a red zone
    const isBlocked = blockingZone.level === 'red';
    
    const activePath = isBlocked ? destData.alternate : destData.primary;
    
    // Draw Paths
    drawActivePath(activePath, isBlocked, destData.primary);
    
    // Update UI
    updateUI(destKey, isBlocked);
}

function drawActivePath(pathArr, isBlocked, primaryArr) {
    const origGroup = document.getElementById('active-path-original');
    const optGroup = document.getElementById('active-path-optimized');
    
    origGroup.innerHTML = '';
    optGroup.innerHTML = '';

    if (isBlocked) {
        // Draw the primary path as a dashed gray line to show it's blocked
        origGroup.appendChild(createSVGElement('path', {
            d: pathArrayToString(primaryArr),
            class: 'path-original'
        }));
    }

    // Draw the actual taken route as blue
    optGroup.appendChild(createSVGElement('path', {
        d: pathArrayToString(pathArr),
        class: 'path-optimized'
    }));
}

function updateUI(destKey, isOptimized) {
    document.getElementById('route-info').style.display = 'block';
    
    const nameMap = { food: 'Food Court', washroom: 'Washroom', seat: 'Seat A12' };
    document.getElementById('info-dest').innerText = nameMap[destKey];
    document.getElementById('info-eta').innerText = isOptimized ? "~4 mins" : "~2 mins";
    
    const congestionEl = document.getElementById('info-congestion');
    const alertEl = document.getElementById('info-alert');
    
    if (isOptimized) {
        // Red zone detected on primary patch
        congestionEl.className = 'alert-text alert-red';
        congestionEl.innerText = "High congestion detected";
        
        alertEl.className = 'alert-text alert-blue';
        alertEl.innerText = "Route optimized to avoid crowd";
    } else {
        // No red zones
        congestionEl.className = 'alert-text alert-green';
        congestionEl.innerText = "Clear path ahead";
        
        // Hide the second alert
        alertEl.className = 'alert-text';
        alertEl.style.display = 'none';
    }
}

// 5-second interval simulation
function startLiveSimulation() {
    setInterval(() => {
        // Pick a random zone
        const zIndex = Math.floor(Math.random() * zones.length);
        const z = zones[zIndex];

        // Randomly assign a new color
        const levels = ['green', 'yellow', 'red'];
        const newLevel = levels[Math.floor(Math.random() * levels.length)];
        
        if (z.level !== newLevel) {
            z.level = newLevel;
            
            // Update SVG element seamlessly
            const circle = document.getElementById(`zone-${zIndex}`);
            if (circle) {
                circle.setAttribute('fill', colors[newLevel]);
            }

            // Immediately recalculate active route to react to changes
            if (currentDestination) {
                navigateTo(currentDestination); 
            }
        }
    }, 5000);
}

// Bootstrap
window.onload = init;
window.navigateTo = navigateTo;
