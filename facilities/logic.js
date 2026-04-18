import { state } from '../core/state.js';
import { findAStarPath } from '../core/pathfinding.js';

export function findBestFacility(type, startPos = null, addNoise = false, excludeId = null) {
    const options = state.facilities[type];
    const origin = startPos || { x: state.userAvatar.x, y: state.userAvatar.y };
    let best = null, minScore = Infinity;

    options.forEach(f => {
        if (f.id === excludeId) return; 
        
        const path = findAStarPath(origin, { x: f.x, y: f.y }, true);
        if (!path) return;
        
        const dist = calculatePathDistance(path);
        const ewt = (f.queue.length / f.capacity) * (f.serviceTime / 50); 
        
        let score = dist + (ewt * 35.0);
        
        if (addNoise) {
            score *= (0.8 + Math.random() * 0.4); 
        }

        if (score < minScore) { minScore = score; best = f; }
    });
    return best;
}

export function calculatePathDistance(path) {
    let d = 0;
    for (let i = 0; i < path.length - 1; i++) d += Math.hypot(path[i+1].x - path[i].x, path[i+1].y - path[i].y);
    return d;
}

export function processFacilityQueues() {
    ['washroom', 'food'].forEach(type => {
        state.facilities[type].forEach(f => {
            if (f.serving.length < f.capacity && f.queue.length > 0) {
                const nextAgent = f.queue.shift();
                nextAgent.state = 'SERVING';
                nextAgent.serviceTicks = f.serviceTime * (0.8 + Math.random() * 0.4);
                f.serving.push(nextAgent);
            }
        });
    });
}
