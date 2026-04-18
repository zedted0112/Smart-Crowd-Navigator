/**
 * Global Simulation State
 * Central source of truth for all simulation data, settings, and UI status.
 */
import { INITIAL_FACILITIES } from './constants.js';

export const state = {
    personIdCounter: 0,
    grid: [],
    people: [],
    facilities: JSON.parse(JSON.stringify(INITIAL_FACILITIES)), // Deep copy of initial state
    
    userAvatar: {
        active: false,
        x: 150,
        y: 400,
        path: [],
        targetIndex: 0,
        speed: 0.8,
        isPaused: false,
        state: 'MOVING',
        waitTicks: 0,
        cooldownTicks: 0,
        finalDestination: null,
        assignedSeat: { x: 810, y: 390, label: "VIP Seat A12" }
    },
    
    friendAvatar: {
        x: 750,
        y: 200,
        tx: 750,
        ty: 200,
        speed: 0.05,
        routeSnapshotX: null,
        routeSnapshotY: null
    },
    
    settings: {
        numPeople: 60,
        speedMultiplier: 1.0,
        corridorBias: true,
        smartRoutingEnabled: true,
        detourMode: 'local',
        blockedThreshold: 3,
        currentScenario: 'normal',
        useAI: true
    },
    
    ui: {
        isChatOpen: false,
        currentlyBlockedLine: null,
        currentDestination: null,
        manualBlocks: new Set(),
        lastInteractionTime: 0
    }
};
