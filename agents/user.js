import { state } from '../core/state.js';
import { calculateSafeRoute } from '../core/pathfinding.js';
import { createSVGElement, drawTargetPing, redrawActiveLines } from '../ui/render.js';
import { snapTargetNode } from '../core/grid_utils.js';
import { findBestFacility } from '../facilities/logic.js';

export function navigateToFriend() {
    let fEl = document.getElementById('friend-avatar-dot');
    if (!fEl) {
        fEl = createSVGElement('circle', {
            id: 'friend-avatar-dot', r: 10, class: 'friend-dot',
            style: 'cursor: grab;'
        });
        document.getElementById('user-layer').appendChild(fEl);
    }
    fEl.setAttribute('cx', state.friendAvatar.x);
    fEl.setAttribute('cy', state.friendAvatar.y);

    const snappedFriend = snapTargetNode(state.friendAvatar.x, state.friendAvatar.y);
    drawTargetPing(state.friendAvatar.x, state.friendAvatar.y);
    navigateToCustom(snappedFriend, state.friendAvatar);
    
    state.friendAvatar.routeSnapshotX = state.friendAvatar.x;
    state.friendAvatar.routeSnapshotY = state.friendAvatar.y;
    state.controls.currentDestination = 'friend';
    document.getElementById('info-dest').innerText = 'Friend';
    document.getElementById('route-info').style.display = 'block';
}

export function navigateToCustom(snappedDestNode, clickedDestNode) {
    state.userAvatar.finalDestination = clickedDestNode;
    const startPoint = { x: state.userAvatar.x, y: state.userAvatar.y };
    const result = calculateSafeRoute([startPoint, snappedDestNode]);
    state.userAvatar.path = result.path;
    state.userAvatar.targetIndex = 0;
    state.userAvatar.active = true;
    updateUserAvatarViz();
    redrawActiveLines();
}

export function navigateTo(destType, specificId = null) {
    let best = null;
    if (specificId) {
        // Direct ID lookup
        ['washroom', 'food'].forEach(type => {
            const found = state.facilities[type].find(f => f.id === specificId);
            if (found) best = found;
        });
    } else if (destType === 'washroom' || destType === 'food') {
        best = findBestFacility(destType);
    } else if (destType === 'seat') {
        state.userAvatar.finalDestination = state.userAvatar.assignedSeat || { x: 810, y: 390, label: "VIP Seat A12" };
    }
    
    if (best) {
        state.userAvatar.finalDestination = { x: best.x, y: best.y, id: best.id, label: best.label };
    }
    
    if (!state.userAvatar.finalDestination) return;
    const result = calculateSafeRoute([{ x: state.userAvatar.x, y: state.userAvatar.y }, state.userAvatar.finalDestination]);
    state.userAvatar.path = result.path;
    state.userAvatar.targetIndex = 0;
    state.userAvatar.active = true;
    updateUserAvatarViz();
    document.getElementById('route-info').style.display = 'block';
    document.getElementById('info-dest').innerText = state.userAvatar.finalDestination.label;
    redrawActiveLines();
}

export function updateUserAvatarViz() {
    let existing = document.getElementById('user-avatar-dot');
    if (existing && existing.parentElement?.id !== 'user-layer') {
        existing.remove();
        existing = null;
    }
    
    let uEl = existing;
    if (!uEl) {
        uEl = createSVGElement('circle', {
            id: 'user-avatar-dot', r: 8, class: 'user-dot',
            style: 'cursor: grab;'
        });
        document.getElementById('user-layer').appendChild(uEl);
    }
    uEl.setAttribute('cx', state.userAvatar.x);
    uEl.setAttribute('cy', state.userAvatar.y);
}
