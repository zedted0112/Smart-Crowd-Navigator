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
    text = text.toLowerCase();
  
    if (text.includes("washroom") || text.includes("toilet") || text.includes("wc") || text.includes("pee")) {
      return { intent: "FIND_WASHROOM" };
    }
  
    if (text.includes("food") || text.includes("eat") || text.includes("hungry") || text.includes("restaurant") || text.includes("buffet")) {
      return { intent: "FIND_FOOD" };
    }
  
    if (text.includes("friend") || text.includes("locate") || text.includes("track")) {
      return { intent: "FIND_FRIEND" };
    }

    if (text.includes("seat") || text.includes("chair")) {
        return { intent: "NAVIGATE_TO", type: "seat" };
    }
  
    return { intent: "UNKNOWN" };
}
  
export async function parseIntentWithAI(text) {
    console.log("[Gemini AI] Parsing intent for: " + text);
    try {
        const response = await fetch('/api/chat/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                text, 
                context: getVenueContext()
            })
        });
        if (!response.ok) throw new Error("AI Endpoint failed");
        
        const data = await response.json();
        const rawRes = JSON.stringify(data);
        console.log("AI RAW:", rawRes);

        // Robust JSON extraction even if server sends a string
        let parsed = data;
        if (typeof data === 'string') {
            const jsonMatch = data.match(/\{.*\}/);
            if (!jsonMatch) throw new Error("No JSON found");
            parsed = JSON.parse(jsonMatch[0]);
        }

        if (!parsed.intent) throw new Error("Invalid format");
        return parsed;

    } catch (error) {
        console.warn("AI failed, using fallback:", error);
        return parseIntent(text);
    }
}

export async function processIntent(text) {
    let intent;
    if (state.settings.useAI) {
        intent = await parseIntentWithAI(text);
    } else {
        intent = parseIntent(text);
    }
    console.log("FINAL INTENT:", intent);
    handleIntent(intent, intent.message || null);
}

export function handleIntent(data, aiMessage = null) {
    let response = aiMessage;
    
    // Normalize intent for switch case
    const intentName = (data.intent === 'FIND_FACILITY') ? (data.type === 'food' ? 'FIND_FOOD' : 'FIND_WASHROOM') : data.intent;

    switch(intentName) {
        case 'FIND_WASHROOM':
        case 'FIND_FOOD':
            const type = (intentName === 'FIND_FOOD') ? 'food' : 'washroom';
            const specificId = data.specificId || null;
            const best = findBestFacility(type); 
            
            navigateTo(type, specificId);
            if (!response) {
                const target = specificId ? (['washroom','food'].reduce((acc, t) => acc || state.facilities[t].find(f => f.id === specificId), null)) : best;
                if (target) {
                    const ewt = Math.round((target.queue.length / target.capacity) * (target.serviceTime / 50));
                    response = `I've found the best ${type} for you: **${target.label}**. \n\nDistance: ${Math.round(Math.hypot(target.x-state.userAvatar.x, target.y-state.userAvatar.y))}m\nWait time: ${ewt}s.\n\nI've plotted the fastest route for you!`;
                } else {
                    response = `I couldn't find any available ${type} facilities right now.`;
                }
            }
            break;
        case 'FIND_FRIEND':
            navigateToFriend();
            if (!response) response = "Tracking your friend's current location. They are currently moving through the venue. Follow the purple path!";
            break;
        case 'NAVIGATE_TO':
            navigateTo(data.type);
            if (!response) {
                if (data.type === 'seat') {
                    response = `Of course! I've located your assigned seat: **${state.userAvatar.assignedSeat.label}**. \n\nI've plotted the optimized path to get you there safely.`;
                } else {
                    response = `Understood. Navigating you to your ${data.type}. Follow the optimized path on your map.`;
                }
            }
            break;
        default:
            if (!response) response = "I'm not quite sure how to help with that yet. Try asking 'find washroom', 'I'm hungry', or 'track my friend'.";
    }
    addChatMessage(response, 'assistant');
}

function getVenueContext() {
    const facilities = [];
    ['washroom', 'food'].forEach(type => {
        state.facilities[type].forEach(f => {
            const dist = Math.hypot(f.x - state.userAvatar.x, f.y - state.userAvatar.y);
            const wait = Math.round((f.queue.length / f.capacity) * (f.serviceTime / 50));
            facilities.push({
                id: f.id,
                label: f.label,
                type: type,
                waitTime: wait,
                distance: Math.round(dist),
                queueLength: f.queue.length
            });
        });
    });
    return {
        scenario: state.settings.currentScenario,
        density: state.people.length > 100 ? 'High' : (state.people.length > 40 ? 'Moderate' : 'Low'),
        facilities: facilities,
        userPos: { x: Math.round(state.userAvatar.x), y: Math.round(state.userAvatar.y) }
    };
}
