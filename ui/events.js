import { state } from '../core/state.js';
import { getCell, snapTargetNode, isPointInObstacle } from '../core/grid_utils.js';
import { navigateToFriend, navigateToCustom, navigateTo, updateUserAvatarViz } from '../agents/user.js';
import { drawTargetPing, redrawActiveLines } from './render.js';
import { calculateSafeRoute } from '../core/pathfinding.js';
import { updateGridDensity } from '../core/grid.js';

export function toggleLeftPanel() {
    document.getElementById('control-panel').classList.toggle('collapsed');
}

export function toggleRightPanel() {
    document.querySelector('.dashboard-panel').classList.toggle('collapsed');
}

export function setupPointerEvents(svg) {
    let isDraggingFriend = false;
    let friendWasDragged = false;
    let isDraggingUser = false;
    let userWasDragged = false;
    let dragStartX = 0;
    let dragStartY = 0;

    svg.addEventListener('pointerdown', (e) => {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());

        const fEl = document.getElementById('friend-avatar-dot');
        if (fEl) {
            let distF = Math.hypot(svgP.x - state.friendAvatar.x, svgP.y - state.friendAvatar.y);
            if (distF <= 25) { 
                isDraggingFriend = true;
                friendWasDragged = false;
                fEl.style.cursor = 'grabbing';
                e.stopPropagation();
                return;
            }
        }

        if (state.userAvatar.active) {
            let distU = Math.hypot(svgP.x - state.userAvatar.x, svgP.y - state.userAvatar.y);
            if (distU <= 25) {
                isDraggingUser = true;
                userWasDragged = false;
                const uEl = document.getElementById('user-avatar-dot');
                if (uEl) uEl.style.cursor = 'grabbing';
                dragStartX = svgP.x;
                dragStartY = svgP.y;
                e.preventDefault();
                e.stopPropagation();
            }
        }
    });

    svg.addEventListener('pointermove', (e) => {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());

        if (isDraggingFriend) {
            state.friendAvatar.x = Math.max(20, Math.min(980, svgP.x)); 
            state.friendAvatar.y = Math.max(20, Math.min(780, svgP.y));
            friendWasDragged = true;
            const fEl = document.getElementById('friend-avatar-dot');
            if (fEl) { fEl.setAttribute('cx', state.friendAvatar.x); fEl.setAttribute('cy', state.friendAvatar.y); }
            drawTargetPing(state.friendAvatar.x, state.friendAvatar.y);
            if (state.controls.currentDestination === 'friend') redrawActiveLines();
        }

        if (isDraggingUser) {
            const moveDist = Math.hypot(svgP.x - dragStartX, svgP.y - dragStartY);
            if (moveDist > 5) {
                userWasDragged = true;
                state.userAvatar.x = Math.max(10, Math.min(990, svgP.x)); 
                state.userAvatar.y = Math.max(10, Math.min(790, svgP.y));
                const uEl = document.getElementById('user-avatar-dot');
                if (uEl) uEl.classList.add('dragging');
                updateUserAvatarViz();
                if (state.userAvatar.finalDestination) {
                    const result = calculateSafeRoute([{ x: state.userAvatar.x, y: state.userAvatar.y }, state.userAvatar.finalDestination]);
                    state.userAvatar.path = result.path;
                    state.userAvatar.targetIndex = 0;
                    redrawActiveLines();
                }
            }
        }
    });

    svg.addEventListener('pointerup', () => {
        if (isDraggingFriend) {
            isDraggingFriend = false;
            document.getElementById('friend-avatar-dot').style.cursor = 'grab';
            const snappedFriend = snapTargetNode(state.friendAvatar.x, state.friendAvatar.y);
            navigateToCustom(snappedFriend, state.friendAvatar);
            state.friendAvatar.routeSnapshotX = state.friendAvatar.x;
            state.friendAvatar.routeSnapshotY = state.friendAvatar.y;
            setTimeout(() => friendWasDragged = false, 100);
        }

        if (isDraggingUser) {
            isDraggingUser = false;
            const uEl = document.getElementById('user-avatar-dot');
            if (uEl) {
                uEl.style.cursor = 'grab';
                uEl.classList.remove('dragging');
            }
            const cell = getCell(state.userAvatar.x, state.userAvatar.y);
            state.userAvatar.x = cell.cx;
            state.userAvatar.y = cell.cy;
            updateUserAvatarViz();
            if (state.controls.currentDestination === 'washroom' || state.controls.currentDestination === 'food') {
                navigateTo(state.controls.currentDestination); 
            } else {
                navigateToCustom(state.userAvatar.finalDestination, state.userAvatar.finalDestination);
            }
            setTimeout(() => userWasDragged = false, 200);
            state.ui.lastInteractionTime = Date.now();
        }
    });

    svg.addEventListener('click', (e) => {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
        
        if (Date.now() - state.ui.lastInteractionTime < 400) return;
        if (friendWasDragged || userWasDragged) return;

        if (e.shiftKey) {
            const cell = getCell(svgP.x, svgP.y);
            const key = `${cell.col},${cell.row}`;
            if (state.ui.manualBlocks.has(key)) state.ui.manualBlocks.delete(key);
            else state.ui.manualBlocks.add(key);
            updateGridDensity();
        } else {
            const userDist = Math.hypot(svgP.x - state.userAvatar.x, svgP.y - state.userAvatar.y);
            if (userDist < 30) {
                drawTargetPing(state.userAvatar.x, state.userAvatar.y);
                return;
            }
            const friendDist = Math.hypot(svgP.x - state.friendAvatar.x, svgP.y - state.friendAvatar.y);
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
}
