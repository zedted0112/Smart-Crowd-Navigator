import { state } from '../core/state.js';
import { processFacilityQueues } from '../facilities/logic.js';
import { pickTarget, spawnPerson } from './logic.js';
import { updateUserAvatarViz } from './user.js';

export function animatePeople() {
    processFacilityQueues();
    const deadAgents = [];

    state.people.forEach(p => {
        const el = document.getElementById(`person-${p.id}`);
        if (!el) return;

        if (p.state === 'MOVING') {
            const dx = p.tx - p.x;
            const dy = p.ty - p.y;
            const dist = Math.hypot(dx, dy);

            let distFac = Infinity;
            if (p.targetFacility) {
                distFac = Math.hypot(p.targetFacility.x - p.x, p.targetFacility.y - p.y);
            }

            if (distFac < 45 || dist < 25) { 
                if (p.targetFacility) {
                    p.state = 'QUEUING';
                    p.targetFacility.queue.push(p);
                } else {
                    pickTarget(p);
                }
            } else {
                p.x += (dx / dist) * p.speed * state.settings.speedMultiplier;
                p.y += (dy / dist) * p.speed * state.settings.speedMultiplier;
            }
        } else if (p.state === 'QUEUING') {
            const qIdxRaw = p.targetFacility.queue.indexOf(p);
            if (qIdxRaw > -1) {
                const qIdx = Math.min(qIdxRaw, 10);
                const vecX = p.targetFacility.x - 450;
                const vecY = p.targetFacility.y - 400;
                const len = Math.hypot(vecX, vecY) || 1;
                const dx = vecX / len;
                const dy = vecY / len;

                const targetX = p.targetFacility.x + dx * 25 * (qIdx + 1);
                const targetY = p.targetFacility.y + dy * 25 * (qIdx + 1);
                p.x += (targetX - p.x) * 0.1;
                p.y += (targetY - p.y) * 0.1;
            }

            if (Math.random() < 0.005 * (1 - p.patience)) {
                if (p.targetFacility) {
                    p.frustratedWith = p.targetFacility.id; 
                    const qIdx = p.targetFacility.queue.indexOf(p);
                    if (qIdx > -1) p.targetFacility.queue.splice(qIdx, 1);
                }
                p.state = 'MOVING';
                p.targetFacility = null;
                pickTarget(p);
            }
        } else if (p.state === 'SERVING') {
            p.frustratedWith = null;
            p.serviceTicks -= 1 * state.settings.speedMultiplier;
            if (p.serviceTicks <= 0) deadAgents.push(p);
        }

        if (p.state === 'SERVING') {
            el.style.opacity = '0';
        } else {
            el.style.opacity = '1';
        }

        el.setAttribute('cx', p.x);
        el.setAttribute('cy', p.y);
    });

    deadAgents.forEach(p => {
        const idx = state.people.indexOf(p);
        if (idx > -1) state.people.splice(idx, 1);
        if (p.targetFacility) {
            const sIdx = p.targetFacility.serving.indexOf(p);
            if (sIdx > -1) p.targetFacility.serving.splice(sIdx, 1);
        }
        const el = document.getElementById(`person-${p.id}`);
        if (el) el.remove();
        spawnPerson();
    });

    if (state.userAvatar.active && state.userAvatar.path && state.userAvatar.path.length > 0) {
        const targetPt = state.userAvatar.path[state.userAvatar.targetIndex];
        const dx = targetPt.x - state.userAvatar.x;
        const dy = targetPt.y - state.userAvatar.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 5) {
            state.userAvatar.targetIndex++;
            if (state.userAvatar.targetIndex >= state.userAvatar.path.length) {
                state.userAvatar.active = false;
                state.userAvatar.path = [];
                state.userAvatar.targetIndex = 0;
            }
        } else {
            const moveStep = state.userAvatar.speed * state.settings.speedMultiplier * 5;
            state.userAvatar.x += (dx / dist) * moveStep;
            state.userAvatar.y += (dy / dist) * moveStep;
        }
        updateUserAvatarViz();
    }

    requestAnimationFrame(animatePeople);
}
