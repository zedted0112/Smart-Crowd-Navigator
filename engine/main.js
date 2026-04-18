import { state } from '../core/state.js';
import { initGrid, updateGridDensity, autoRerouteIfBlocked } from '../core/grid.js';
import { getCell, isPointInObstacle } from '../core/grid_utils.js';
import { drawObstacles, drawSeats, drawGrid, drawNodes, drawFacilities, redrawActiveLines } from '../ui/render.js';
import { initPeople, adjustPeopleCount, spawnPerson, pickTarget } from '../agents/logic.js';
import { animatePeople } from '../agents/movement.js';
import { updateFacilityMetrics, initDashboardUI } from '../ui/dashboard.js';
import { calculateSafeRoute } from '../core/pathfinding.js';
import { setupPointerEvents, toggleLeftPanel, toggleRightPanel } from '../ui/events.js';
import { toggleChat, handleChatKey, sendChatMessage } from '../ui/chat.js';
import { COLS, ROWS, CELL_SIZE } from '../core/constants.js';
import { navigateTo, navigateToFriend } from '../agents/user.js';

/**
 * Main Initialization and Engine Orchestration
 * Sets up the grid, rendering layers, people, and dashboard event listeners.
 */
export function init() {
    console.log("[Engine] Starting initialization...");
    
    // Core Data Init
    initGrid();
    
    // UI Render Init (Passing explicit targets as suggested)
    drawObstacles(document.getElementById('obstacles-layer'));
    drawSeats(document.getElementById('seats-layer'));
    drawGrid(document.getElementById('grid-layer'));
    drawNodes(document.getElementById('nodes'));
    drawFacilities(document.getElementById('facility-layer'));
    
    initDashboardUI();
    initPeople();

    const svg = document.getElementById('venue-svg');
    if (svg) {
        svg.setAttribute('viewBox', '0 0 1000 800');
        setupPointerEvents(svg);
    } else {
        console.error("[Engine] venue-svg not found!");
    }

    // Bind Dashboard Listeners
    document.getElementById('ctrl-density').addEventListener('input', (e) => {
        state.settings.numPeople = parseInt(e.target.value);
        document.getElementById('val-density').innerText = state.settings.numPeople;
        adjustPeopleCount();
    });
    
    document.getElementById('ctrl-speed').addEventListener('input', (e) => {
        state.settings.speedMultiplier = parseFloat(e.target.value);
        document.getElementById('val-speed').innerText = state.settings.speedMultiplier + 'x';
    });
    
    document.getElementById('ctrl-corridor').addEventListener('change', (e) => {
        state.settings.corridorBias = e.target.checked;
        initPeople();
    });
    
    document.getElementById('ctrl-smart-routing').addEventListener('change', (e) => {
        state.settings.smartRoutingEnabled = e.target.checked;
        if(state.controls.currentDestination) window.navigateTo(state.controls.currentDestination); 
    });
    
    document.getElementById('ctrl-detour-mode').addEventListener('change', (e) => {
        state.settings.detourMode = e.target.value;
        if(state.controls.currentDestination) window.navigateTo(state.controls.currentDestination); 
    });
    
    document.getElementById('ctrl-sensitivity').addEventListener('input', (e) => {
        state.settings.blockedThreshold = 11 - parseInt(e.target.value); 
        document.getElementById('val-sensitivity').innerText = e.target.value;
        updateGridDensity();
    });
    
    document.getElementById('btn-reset').addEventListener('click', resetSimulation);

    // Simulation Loop Start
    console.log(`[Engine] Loop start with ${state.people.length} agents and ${Object.keys(state.facilities).length} facilities.`);
    
    // Debug logging
    setInterval(() => {
        const totalPeople = state.people.length;
        const totalFacilities = Object.values(state.facilities).flat().length;
        console.log(`[Simulation Stats] Agents: ${totalPeople}, Facilities: ${totalFacilities}, Grid: ${COLS}x${ROWS}`);
    }, 5000);

    requestAnimationFrame(animatePeople);
    setInterval(updateGridDensity, 2000); 
}

export function resetSimulation() {
    state.settings.numPeople = 80;
    state.settings.speedMultiplier = 1.0;
    state.settings.corridorBias = true;
    state.settings.smartRoutingEnabled = true;
    state.settings.detourMode = 'local';
    state.settings.blockedThreshold = 3;
    
    document.getElementById('ctrl-density').value = 80;
    document.getElementById('val-density').innerText = '80';
    document.getElementById('ctrl-speed').value = 1;
    document.getElementById('val-speed').innerText = '1x';
    document.getElementById('ctrl-corridor').checked = true;
    document.getElementById('ctrl-smart-routing').checked = true;
    document.getElementById('ctrl-detour-mode').value = 'local';
    document.getElementById('ctrl-sensitivity').value = 8; 
    document.getElementById('val-sensitivity').innerText = '8';
    
    state.ui.manualBlocks.clear();
    document.querySelectorAll('.btn-group .btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-normal').classList.add('active');
    
    const userLayer = document.getElementById('user-layer');
    if (userLayer) userLayer.innerHTML = ''; 
    state.userAvatar.active = false;
    state.userAvatar.finalDestination = null;
    state.ui.currentlyBlockedLine = null;
    redrawActiveLines();
    document.getElementById('route-info').style.display = 'none';
}

export function setScenario(scenario) {
    state.settings.currentScenario = scenario;
    ['washroom', 'food'].forEach(type => {
        state.facilities[type].forEach(f => {
            f.queue = [];
            f.serving = [];
        });
    });

    document.querySelectorAll('.btn-group .btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`btn-${scenario}`);
    if (btn) btn.classList.add('active');
    
    state.people.forEach(p => {
        const rng = Math.random();
        if (scenario === 'washroom') {
            p.goal = rng < 0.95 ? 'washroom' : 'roam';
        } else if (scenario === 'food') {
            p.goal = rng < 0.95 ? 'food' : 'roam';
        } else {
            if (rng < 0.3) p.goal = 'washroom';
            else if (rng < 0.6) p.goal = 'food';
            else p.goal = 'roam';
        }

        p.isRushing = (p.goal === scenario && scenario !== 'normal');
        p.speed = p.isRushing ? (0.1 + Math.random() * 0.1) * 1.8 : (0.1 + Math.random() * 0.1);
        p.frustratedWith = null; 
        pickTarget(p);
    });

    updateGridDensity();
    updateFacilityMetrics();
}

// Global Exports
window.navigateTo = navigateTo;
window.setScenario = setScenario;
window.toggleLeftPanel = toggleLeftPanel;
window.toggleRightPanel = toggleRightPanel;
window.toggleChat = toggleChat;
window.sendChatMessage = sendChatMessage;
window.handleChatKey = handleChatKey;
window.navigateToFriend = navigateToFriend;

// Self-init
init();
