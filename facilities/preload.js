import { state } from '../core/state.js';
import { createSVGElement } from '../ui/render.js';

// nextPersonId moved to state.personIdCounter

export function preloadQueue(facilityId, count) {
    let f = null;
    ['washroom', 'food'].forEach(type => {
        const found = state.facilities[type].find(item => item.id === facilityId);
        if (found) f = found;
    });
    if (!f) return;

    for (let i = 0; i < count; i++) {
        preloadAgent(f, i);
    }
}

function preloadAgent(f, index) {
    // Vector away from map center (450, 400)
    const vecX = f.x - 450;
    const vecY = f.y - 400;
    const len = Math.hypot(vecX, vecY) || 1;
    const dx = vecX / len;
    const dy = vecY / len;

    const p = {
        id: state.people.length, // Simple ID assignment
        x: f.x + dx * 25 * (index + 1),
        y: f.y + dy * 25 * (index + 1),
        tx: f.x, ty: f.y,
        speed: Math.random() * 0.1 + 0.05,
        state: 'QUEUING',
        targetFacility: f,
        patience: Math.random() * 0.5 + 0.5
    };

    f.queue.push(p);
    state.people.push(p);

    const circle = createSVGElement('circle', {
        id: `person-${p.id}`, cx: p.x, cy: p.y, r: 4, class: 'person-dot person-queuing'
    });
    document.getElementById('people-layer').appendChild(circle);
}
