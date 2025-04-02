# 🚗 Autonomous Driving Simulation

A 3D autonomous driving simulation built with **React** and **Three.js**, demonstrating lane keeping and adaptive cruise control systems.  
![Tech Stack](https://img.shields.io/badge/-React-%2361DAFB) ![Tech Stack](https://img.shields.io/badge/-Three.js-%23000000)

---

## ✨ Features

### 🛣️ Realistic 3D Environment
- Road with asphalt texture and lane markings
- Dynamic surroundings (trees, barriers, skybox)

### 🤖 Autonomous Driving Systems
- **Lane Keeping Assistant**  
  Maintains vehicle position within lane boundaries
- **Adaptive Cruise Control**  
  Automatically adjusts speed based on obstacles

### 🎮 Interactive Controls
- Toggle driving assistance systems on/off
- Start/Stop simulation button

### 🌟 Advanced Capabilities
- Procedurally generated roads with random curves/obstacles
- Real-time metrics display (speed/distance)
- Third-person follow camera

---

## ⚙️ Technical Implementation

### 🧩 Core Components
| Component | Description |
|-----------|-------------|
| `RoadSystem` | Procedural asphalt road generation |
| `VehicleModel` | 3D car model with articulated wheels |
| `SensorSystem` | Raycasting-based obstacle detection |
| `DrivingPhysics` | Steering/speed control algorithms |