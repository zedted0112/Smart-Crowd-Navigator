# Standalone Smart Venue Navigator

A lightweight, purely vanilla HTML/CSS/JavaScript web application to demonstrate dynamic SVG-graph routing and smart crowd avoidance within a 2D venue plan.

## Features

- **No Output Dependencies**: Exclusively built with native HTML5 `<svg>`, standard web CSS, and vanilla JavaScript (no React, Next.js, or external Map APIs).
- **Interactive SVG Venue**: Uses explicit coordinate topology and SVG nodes/paths to physically map out a stadium/venue setting. Let the user navigate visually to predefined hubs (e.g., Gate, Food Court, Washroom, Seat A12).
- **Smart Path Selector**: Employs an intelligent routing check. Before drawing a path between points, the browser verifies if the "primary" vector route passes through an actively blocked high-density (red) crowd zone.
- **Visual Detouring**: If blocked, it immediately renders an "alternate" route in glowing blue to bypass the crowd, whilst still mapping the original blocked route in dashed gray as visual feedback.
- **Live 5s Crowd Simulation**: Background clock cycles every 5 seconds to randomly pick a venue zone and randomize its crowd density setting (Green, Yellow, Red). All visuals map natively on the fly—seamlessly rerouting any actively requested path immediately in real-time.
- **Dynamic Status Readout**: Fully reactive UI control panel that instantly evaluates congestion logic, updating elements with color-coded "High congestion detected", "Route optimized to avoid crowd", or "Clear path ahead" states alongside context ETAs.

## Quickstart

Since the project operates entirely offline via simple web components:
1. Download or clone this repository.
2. Open `index.html` directly in any modern JavaScript-enabled web browser.
3. Test navigation by clicking the UI buttons and wait for the real-time background simulation to interact dynamically with your paths over time!


---
*Last deployed via GitHub Actions: Fri Apr 17 15:23:54 IST 2026*
