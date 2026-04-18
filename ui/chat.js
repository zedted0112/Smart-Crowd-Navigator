import { state } from '../core/state.js';
import { findBestFacility } from '../facilities/logic.js';
import { navigateTo, navigateToFriend } from '../agents/user.js';

export function toggleChat() {
    const widget = document.getElementById('chat-widget');
    const body = document.getElementById('chat-body');
    const icon = document.getElementById('chat-toggle-icon');
    
    state.ui.isChatOpen = !state.ui.isChatOpen;
    
    if (state.ui.isChatOpen) {
        widget.classList.remove('chat-minimized');
        body.style.display = 'flex';
        icon.textContent = '▼';
        document.getElementById('chat-input').focus();
    } else {
        widget.classList.add('chat-minimized');
        body.style.display = 'none';
        icon.textContent = '▲';
    }
}

export function handleChatKey(e) {
    if (e.key === 'Enter') sendChatMessage();
}

export function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    
    addChatMessage(text, 'user');
    input.value = '';
    
    const thinkingId = addThinkingIndicator();
    
    setTimeout(() => {
        removeThinkingIndicator(thinkingId);
        processIntent(text);
    }, 600);
}

export function addChatMessage(text, sender) {
    const container = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.className = `message ${sender}`;
    msg.textContent = text;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

export function addThinkingIndicator() {
    const container = document.getElementById('chat-messages');
    const id = 'thinking-' + Date.now();
    const msg = document.createElement('div');
    msg.id = id;
    msg.className = 'message assistant chat-thinking';
    msg.innerHTML = '<div class="chat-dot"></div><div class="chat-dot" style="animation-delay: 0.2s"></div><div class="chat-dot" style="animation-delay: 0.4s"></div>';
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return id;
}

export function removeThinkingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

export function parseIntent(text) {
    const t = text.toLowerCase();
    if (t.includes('seat') || t.includes('chair')) {
        return { intent: 'NAVIGATE_TO', type: 'seat' };
    }
    if (t.includes('washroom') || t.includes('toilet') || t.includes('wc') || t.includes('pee')) {
        return { intent: 'FIND_FACILITY', type: 'washroom' };
    }
    const hungryKeywords = /\b(food|hungry|eat|restaurant|buffet)\b/;
    if (hungryKeywords.test(t)) {
        return { intent: 'FIND_FACILITY', type: 'food' };
    }
    if (t.includes('friend') || t.includes('track') || t.includes('locate')) {
        return { intent: 'FIND_FRIEND' };
    }
    return { intent: 'UNKNOWN' };
}

export async function parseIntentWithAI(text) {
    console.log("[Gemini AI] Parsing intent for: " + text);
    try {
        const response = await fetch('/api/chat/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        if (!response.ok) throw new Error("AI Endpoint failed");
        const data = await response.json();
        return data;
    } catch (error) {
        console.warn("[Gemini AI] Fallback triggered:", error);
        return parseIntent(text);
    }
}

export async function processIntent(text) {
    let intentData;
    if (state.settings.useAI) {
        intentData = await parseIntentWithAI(text);
    } else {
        intentData = parseIntent(text);
    }
    handleIntent(intentData);
}

export function handleIntent(data) {
    let response = "";
    switch(data.intent) {
        case 'FIND_FACILITY':
            const best = findBestFacility(data.type);
            if (best) {
                navigateTo(data.type);
                const ewt = Math.round((best.queue.length / best.capacity) * (best.serviceTime / 50));
                response = `I've found the best ${data.type} for you: **${best.label}**. \n\nDistance: ${Math.round(Math.hypot(best.x-state.userAvatar.x, best.y-state.userAvatar.y))}m\nWait time: ${ewt}s.\n\nI've plotted the fastest route for you!`;
            } else {
                response = `I couldn't find any available ${data.type} facilities right now.`;
            }
            break;
        case 'FIND_FRIEND':
            navigateToFriend();
            response = "Tracking your friend's current location. They are currently moving through the venue. Follow the purple path!";
            break;
        case 'NAVIGATE_TO':
            navigateTo(data.type);
            if (data.type === 'seat') {
                response = `Of course! I've located your assigned seat: **${state.userAvatar.assignedSeat.label}**. \n\nI've plotted the optimized path to get you there safely. Follow the purple line on your map!`;
            } else {
                response = `Understood. Navigating you to your ${data.type}. Follow the optimized path on your map.`;
            }
            break;
        default:
            response = "I'm not quite sure how to help with that yet. Try asking 'find washroom', 'I'm hungry', or 'track my friend'.";
    }
    addChatMessage(response, 'assistant');
}
