import { state } from '../core/state.js';
import { isPointBlocked } from '../core/grid_utils.js';
import { findBestFacility } from '../facilities/logic.js';
import { createSVGElement } from '../ui/render.js';

// nextPersonId moved to state.personIdCounter

/**
 * Agent Spawning Logic
 * Creates new simulator agents with specific goals and corridor biases.
 */
export function spawnPerson() {
    let corridor = -1; 
    let isScenarioFocused = false;

    if (state.settings.corridorBias) {
        isScenarioFocused = Math.random() < 0.85;
        if (isScenarioFocused && state.settings.currentScenario === 'washroom') {
            corridor = Math.random() > 0.4 ? 1 : 0; 
        } else if (isScenarioFocused && state.settings.currentScenario === 'food') {
            corridor = Math.random() > 0.4 ? 2 : 0; 
        } else if (isScenarioFocused && state.settings.currentScenario === 'normal') {
            corridor = Math.floor(Math.random() * 4); 
        }
    }

    const getInitialPos = () => {
        if (corridor === 0) return { x: 100 + Math.random() * 100, y: 400 + (Math.random() * 40 - 20) };
        if (corridor === 1) return { x: 450 + (Math.random() * 20 - 10), y: 150 + Math.random() * 150 };
        if (corridor === 2) return { x: 450 + (Math.random() * 20 - 10), y: 450 + Math.random() * 150 };
        if (corridor === 3) return { x: 500 + Math.random() * 400, y: 400 + (Math.random() * 40 - 20) };
        return { x: Math.random() * 900 + 50, y: Math.random() * 700 + 50 };
    };

    let { x: startX, y: startY } = getInitialPos();
    let attempts = 0;
    while(isPointBlocked(startX, startY) && attempts < 15) {
        ({ x: startX, y: startY } = getInitialPos());
        attempts++;
    }

    const p = {
        id: state.personIdCounter++,
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
    if (state.settings.currentScenario === 'washroom') {
        p.goal = rng < 0.95 ? 'washroom' : 'roam';
    } else if (state.settings.currentScenario === 'food') {
        p.goal = rng < 0.95 ? 'food' : 'roam';
    } else {
        if (rng < 0.3) p.goal = 'washroom';
        else if (rng < 0.6) p.goal = 'food';
        else p.goal = 'roam';
    }

    p.isRushing = (p.goal === state.settings.currentScenario && state.settings.currentScenario !== 'normal');
    if (p.isRushing) {
        p.speed *= 1.8; 
    }

    pickTarget(p);
    state.people.push(p);

    const circle = createSVGElement('circle', {
        id: `person-${p.id}`, cx: p.x, cy: p.y, r: p.isRushing ? 5 : 4, 
        class: `person-dot ${p.isRushing ? 'person-rushing' : ''}`
    });

    const peopleGroup = document.getElementById('people-layer');
    if (peopleGroup) peopleGroup.appendChild(circle);
}

export function pickTarget(p) {
    let chosenFac = null;

    if (p.goal === 'washroom' || p.goal === 'food') {
        chosenFac = findBestFacility(p.goal, { x: p.x, y: p.y }, true, p.frustratedWith);
    }

    if (chosenFac) {
        p.tx = chosenFac.x + (Math.random() * 20 - 10);
        p.ty = chosenFac.y + (Math.random() * 20 - 10);
        p.targetFacility = chosenFac;
    } else {
        const corridors = [
            { x: 150 + Math.random() * 300, y: 400 + (Math.random() * 40 - 20) }, 
            { x: 450 + (Math.random() * 40 - 20), y: 100 + Math.random() * 300 }, 
            { x: 450 + (Math.random() * 40 - 20), y: 400 + Math.random() * 300 }, 
            { x: 450 + Math.random() * 350, y: 400 + (Math.random() * 40 - 20) }  
        ];
        const target = corridors[Math.floor(Math.random() * corridors.length)];
        p.tx = target.x;
        p.ty = target.y;
        p.targetFacility = null;
    }
    
    let safety = 0;
    while(isPointBlocked(p.tx, p.ty) && safety < 10) {
        p.tx += (Math.random() * 40 - 20);
        p.ty += (Math.random() * 40 - 20);
        safety++;
    }
}

export function initPeople() {
    const peopleGroup = document.getElementById('people-layer');
    if (peopleGroup) peopleGroup.innerHTML = '';
    state.people.length = 0; 
    state.personIdCounter = 0;
    for (let i = 0; i < state.settings.numPeople; i++) spawnPerson();
}

export function adjustPeopleCount() {
    if (state.people.length < state.settings.numPeople) {
        while(state.people.length < state.settings.numPeople) spawnPerson();
    } else if (state.people.length > state.settings.numPeople) {
        while(state.people.length > state.settings.numPeople) {
            const p = state.people.pop();
            const el = document.getElementById(`person-${p.id}`);
            if(el) el.remove();
        }
    }
}
