# 🧠 Venue IQ: Smart Crowd Navigator
### *Intelligent 2D Simulation & Real-time Venue Logistics Engine*

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Vanilla JS](https://img.shields.io/badge/Engine-Vanilla_JS-f7df1e)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Express](https://img.shields.io/badge/Server-Express_8080-lightgrey)](https://expressjs.com/)

**Venue IQ** is a sophisticated, real-time navigator designed to solve the complexities of venue logistics. By blending **state-driven agent behavior** with **advanced A* pathfinding**, the simulator provides a dynamic preview of crowd flow, facility bottlenecks, and optimal user navigation in high-density environments.

---

## 🚀 Key Features

### 👥 1. Behavioral Crowd Simulation
- **Agent Lifecycle**: 100+ individual agents move through the venue with unique states: `MOVING`, `QUEUING`, and `SERVING`.
- **Intelligent Goals**: Agents are driven by probabilistic logic (40% Restrooms, 30% Food, 30% Roaming), mimicking realistic attendee behavior.
- **Patience Traits**: Each agent possesses a "patience" metric; if a queue wait time exceeds their threshold, they abandon the goal and re-evaluate, preventing infinite gridlocks.

### 🧭 2. Real-time A* Pathfinding
- **Congestion Awareness**: The routing engine doesn't just calculate distance; it evaluates cell-based crowd density and applies a "heat-map" penalty cost to avoid high-traffic "red zones".
- **Dynamic Rerouting**: If a corridor becomes blocked or overly congested, the A* engine recalculates a global detour in milliseconds, visualizing the shift from "Primary" to "Optimized" vectors.
- **Grid-Aware Precision**: Operates on a coordinate-precise 50x50 cell grid, allowing navigation to any valid spot in the venue with sub-meter accuracy.

### 📊 3. Facility Analytics Dashboard
- **Queue Metrics**: Live tracking of queue lengths (`Q`) and server availability (`S`) for every washroom (W1–W5) and food stall (F1–F5).
- **ETA & Wait Time Logic**: Predictive wait time calculations based on service capacity and current queue depth.
- **"Best Option" Scoring**: An intelligent recommendation engine highlights the facility with the lowest combined **Travel Time + Wait Time** penalty.

### 🖱️ 4. Interactive Draggable User
- **Precision Tracking**: Drag and drop the user avatar to any cell. The system instantly snaps to the grid and re-computes the entire navigation stream.
- **Silence Period Logic**: Advanced event handling resolves collisions between dragging and clicking, ensuring a smooth, artifact-free interaction.

### 🎭 5. Simulation Scenarios
- **Standard Mode**: Balanced flow.
- **Facility Rush**: Simulates half-time/break periods where restroom demand spikes by 800%.
- **Dining Peak**: Concentrates traffic around the food courts, testing the efficiency of stall service times.

---

## 🎨 Design Aesthetics
- **Pro Dashboard**: A collapsible, glassmorphic UI that allows for a "Full Map View" mode.
- **Vibrant Visuals**: Color-coded facility statuses (Green/Yellow/Red) and glowing A* path vectors.
- **Micro-animations**: Smooth linear movement for all agents and the user avatar, eliminating visual "bouncing" and jitter.

---

## 🛠️ Technical Stack
- **Frontend**: Native HTML5 SVG, Vanilla JavaScript (ES6+), Modern CSS3 with Flex/Grid and Blur filters.
- **Backend**: Express.js (Node.js) for static asset delivery and future Firebase integration.
- **Engine Logic**: Vector-based pathfinding, Priority Queue implementation for A*, and deterministic agent state-machines.

---

## 🏁 Quick Start

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Locally**:
   ```bash
   npm start
   ```

3. **Access the App**:
   Navigate to `http://localhost:8080` in your browser.

---

## 🛤️ Pathfinding Heuristic
The navigation engine uses a modified Manhattan distance heuristic combined with dynamic density weights:
$$f(n) = g(n) + h(n) + \text{DensityWeight}(n)$$
Where `DensityWeight` is proportional to the number of agents currently occupying a specific grid cell.

---

## 📜 License
Distributed under the MIT License. See `LICENSE` for more information.

---
*Curated by Himalayan Coder | Smart Venue Navigation Simulator 2026*
