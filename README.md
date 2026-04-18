# 🧠 Venue IQ — Smart Crowd Navigation & Queue Intelligence System

## 🚀 Overview

**Venue IQ** is a smart, real-time crowd navigation assistant designed for large venues like stadiums, concerts, and events.

It helps users find the **fastest and safest routes** to facilities (washrooms, food stalls, seating, or friends) by combining:

- Dynamic crowd simulation  
- Queue-aware decision making  
- Real-time pathfinding  
- AI-powered natural language interaction  

---

## 🎯 Challenge Vertical

**Smart Assistant for Real-World Navigation & Crowd Management**

This solution focuses on building a **context-aware intelligent assistant** that helps users navigate complex environments efficiently while also providing value to venue operators through queue and crowd insights.

---

## 🧩 Key Features

### 🧭 Smart Navigation Engine
- Grid-based pathfinding using optimized A* algorithm  
- Avoids congested zones dynamically  
- Computes best route based on:
  - distance  
  - crowd density  
  - queue wait time  

---

### 👥 Behavioral Crowd Simulation
- Agents follow realistic lifecycle:
  - Moving → Queuing → Serving → Exit  
- Goal-driven behavior (food, washroom, roaming)  
- Simulates real-world crowd flow instead of random movement  

---

### 🚻 Queue Intelligence System
- Facilities have:
  - capacity  
  - service time  
  - real-time queue length  

- Wait Time Formula:

### 5. AI Integration Strategy

- Local parser ensures offline reliability  
- Gemini integration layer added for future enhancement  
- System remains fully functional without API dependency  

---

- Users are guided to **optimal facility**, not just nearest  

---

### 🎛️ Scenario Engine
Predefined real-world scenarios:

- **Standard Mode** → Balanced crowd  
- **Facility Rush** → High washroom demand  
- **Dining Peak** → Food stalls overloaded  

Allows testing system behavior under pressure  

---

### 🤖 AI Chat Assistant (Gemini-Ready)

Users can interact naturally:

- "find washroom"  
- "I'm hungry"  
- "track my friend"  

System:
1. Parses intent (local + Gemini-ready)  
2. Finds optimal solution  
3. Explains decision (wait time, queue, reasoning)  

---

### 🧑‍🤝‍🧑 Friend Tracking
- Place friend anywhere on map  
- System computes safest route to reach them  

---

### 🎮 Interactive Controls
- Drag user to any location  
- Real-time rerouting  
- Adjustable:
  - crowd density  
  - simulation speed  
  - rerouting sensitivity  

---

## 🧠 Approach & Logic

### 1. Grid-Based Environment
- Venue mapped into discrete cells  
- Each cell holds:
  - occupancy  
  - cost (for routing)  

---

### 2. Cost-Based Pathfinding

Each cell cost is calculated as:

## 🧪 Assumptions

- Crowd behavior is simulated (not real sensor data)  
- Facilities operate with fixed service time  
- Queue formation is linear (simplified model)  
- Pathfinding operates on grid abstraction of venue  

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

## ☁️ Google Services Usage

- Designed for integration with:
  - Google Gemini API (intent understanding)  
  - Google Cloud Run (deployment-ready frontend)  

- Architecture allows extension to:
  - Firebase (real-time crowd data)  
  - BigQuery (analytics)  

## 🚀 Future Enhancements

- Real-time crowd data using IoT / sensors  
- Reinforcement learning for routing optimization  
- Multi-user coordination  
- Predictive congestion modeling  

---

## 💡 Why This Matters

> People don’t just need directions — they need *smart decisions* in crowded environments.

Venue IQ transforms navigation into an **intelligent, context-aware experience**.
*Designed by Himalayan Coder Nitin Rana*

