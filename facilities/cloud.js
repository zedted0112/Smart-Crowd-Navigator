import { state } from '../core/state.js';

export function transmitToCloud() {
    const payload = { timestamp: Date.now(), facilities: {} };
    ['washroom', 'food'].forEach(type => {
        state.facilities[type].forEach(f => {
            payload.facilities[f.id] = { queue: f.queue.length, serving: f.serving.length };
        });
    });
    console.log("[Firebase Sync Hub]", payload);
}
