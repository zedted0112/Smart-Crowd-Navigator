export const SVGNs = "http://www.w3.org/2000/svg";

export const NODES = {
    gate: { x: 150, y: 400, label: "Gate (Entry)" },
    centerJunction: { x: 450, y: 400, label: "" }
};

export const INITIAL_FACILITIES = {
    washroom: [
        { id: 'W1', x: 80, y: 80, label: 'W1', queue: [], serving: [], capacity: 5, serviceTime: 120 },
        { id: 'W2', x: 80, y: 720, label: 'W2', queue: [], serving: [], capacity: 5, serviceTime: 120 },
        { id: 'W3', x: 920, y: 80, label: 'W3', queue: [], serving: [], capacity: 5, serviceTime: 120 },
        { id: 'W4', x: 920, y: 720, label: 'W4', queue: [], serving: [], capacity: 5, serviceTime: 120 },
        { id: 'W5', x: 450, y: 200, label: 'W5 (Main)', queue: [], serving: [], capacity: 5, serviceTime: 100 }
    ],
    food: [
        { id: 'F1', x: 450, y: 750, label: 'F1 (Main)', queue: [], serving: [], capacity: 5, serviceTime: 180 },
        { id: 'F2', x: 50, y: 400, label: 'F2', queue: [], serving: [], capacity: 5, serviceTime: 150 },
        { id: 'F3', x: 950, y: 400, label: 'F3', queue: [], serving: [], capacity: 5, serviceTime: 150 },
        { id: 'F4', x: 450, y: 50, label: 'F4', queue: [], serving: [], capacity: 5, serviceTime: 150 },
        { id: 'F5', x: 850, y: 650, label: 'F5', queue: [], serving: [], capacity: 5, serviceTime: 150 }
    ]
};

export const STATIC_OBSTACLES = [
    { x: 240, y: 480, w: 160, h: 140, label: "Premium Shop" },
    { x: 240, y: 180, w: 160, h: 140, label: "Research Lab" },
    { x: 580, y: 140, w: 200, h: 100, label: "Tech Kiosk" },
    { x: 580, y: 560, w: 200, h: 100, label: "Grand Buffet" }
];

export const CELL_SIZE = 50;
export const COLS = 20; 
export const ROWS = 16;
