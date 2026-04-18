import { state } from '../core/state.js';
import { transmitToCloud } from '../facilities/cloud.js';

export function initDashboardUI() {
    const grid = document.getElementById('facility-analytics-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    ['washroom', 'food'].forEach(type => {
        state.facilities[type].forEach(f => {
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

export function updateFacilityMetrics() {
    ['washroom', 'food'].forEach(type => {
        state.facilities[type].forEach(f => {
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

export function updateDashboardUI() {
    ['washroom', 'food'].forEach(type => {
        state.facilities[type].forEach(f => {
            const qCount = f.queue.length;
            const sCount = f.serving.length;
            
            const dashQ = document.getElementById(`dash-q-${f.id}`);
            const dashS = document.getElementById(`dash-s-${f.id}`);
            const dashEWT = document.getElementById(`dash-ewt-${f.id}`);
            const card = document.getElementById(`dash-card-${f.id}`);
            const badge = document.getElementById(`badge-${f.id}`);

            if (dashQ) dashQ.innerText = qCount;
            if (dashS) dashS.innerText = sCount;
            
            const waitBase = (qCount === 0 && sCount === f.capacity) ? 0.5 : (qCount / f.capacity);
            const ewt = Math.round(waitBase * (f.serviceTime / 50));

            if (dashEWT) {
                dashEWT.innerText = `${ewt}s`;
                dashEWT.className = 'ewt-val ' + (ewt < 10 ? 'ewt-green' : (ewt < 30 ? 'ewt-yellow' : 'ewt-red'));
            }

            const mapBadgeVal = document.getElementById(`fac-badge-val-${f.id}`);
            const mapBadgeBg = document.getElementById(`fac-badge-bg-${f.id}`);
            if (mapBadgeVal) mapBadgeVal.textContent = qCount + sCount;
            if (mapBadgeBg) {
                const total = qCount + sCount;
                mapBadgeBg.classList.remove('status-green-bg', 'status-yellow-bg', 'status-red-bg');
                if (total < f.capacity) mapBadgeBg.classList.add('status-green-bg');
                else if (total < f.capacity * 3) mapBadgeBg.classList.add('status-yellow-bg');
                else mapBadgeBg.classList.add('status-red-bg');
            }

            const isBest = state.userAvatar.finalDestination && state.userAvatar.finalDestination.id === f.id;
            if (card) {
                if (isBest) card.classList.add('is-best');
                else card.classList.remove('is-best');
            }
            if (badge) badge.style.display = isBest ? 'block' : 'none';
        });
    });
    
    if (Math.random() < 0.05) transmitToCloud();
}
