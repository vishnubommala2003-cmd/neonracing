# Neon Racing (Apex Rush 3D)

A next-generation, high-performance 3D arcade street racing game built with Three.js, Vite, and a Node.js Express backend.

## 🚀 Features

- **Authentic 3D Toyota GT 86**:
  - Detailed 3D model featuring elevated GT sports rear wing spoiler, twin angular taillights with circular LED projectors, front/rear `GT 86` license plates, Toyota badges, carbon splitter & canards, diffuser strakes, and dual chrome exhausts.
  - Interactive garage showroom with 6 factory paint swatches and color filtering.
- **Cinematic 3D Starting Grid Showcase**:
  - Pre-race dynamic 3-second camera pan showcasing the 3D car:
    - **Count 3**: Low-angle front 3/4 hero shot (grille, headlights, license plate).
    - **Count 2**: Sweeping side profile (dark 10-spoke sports wheels, red Brembo brake calipers).
    - **Count 1**: Swooping rear wing, circular LED taillights, and dual exhausts.
    - **Count GO!**: Seamless handoff directly into the standard chase camera.
  - Realistic engine idle suspension rumble on the grid for player and 7 AI rivals.
- **Starting Gantry & 3-2-1 Countdown**:
  - Pulsing pop animations, sequential gantry stage lights, stage banners (`STAGE 1 • GET READY` ➔ `STAGE 2 • REV ENGINES` ➔ `STAGE 3 • GET SET` ➔ `GREEN FLAG`), and synchronized Web Audio API beeps.
- **Side Barrier Impact & 3-Blink Recovery**:
  - When the car touches or crashes into the side track barrier, speed immediately drops to 0 (`player.speed = 0`), barrier sparks burst out, and screen shakes.
  - The car blinks 3 times (invulnerability window) and allows the player to accelerate immediately from that place onwards with a recovery acceleration boost.
- **Dynamic Arcade Street Racing**:
  - Real-time drift mechanics with distance counter and combo multipliers.
  - Nitro boost surge with expanding camera FOV and exhaust flame sparks.
  - 8-car grid racing with adaptive AI opponents.
  - Dynamic mini-map radar and custom HUD speedometer gauge.
- **Full-Stack Node.js Backend**:
  - Express.js backend on port `3001` with RESTful API endpoints for wallet, garage upgrades, career level progression, and race results.

## 🕹️ Controls

| Action | Keyboard | Touch / Mobile | Gamepad |
| :--- | :--- | :--- | :--- |
| **Accelerate** | `W` or `↑ Up` | ACCELERATE Button | Right Trigger / A |
| **Brake / Reverse** | `S` or `↓ Down` | BRAKE Button | Left Trigger / X |
| **Steer Left** | `A` or `← Left` | ◀ LEFT Button | Left Stick / D-Pad |
| **Steer Right** | `D` or `→ Right` | RIGHT ▶ Button | Left Stick / D-Pad |
| **Nitro Boost** | `Shift` | NITRO ⚡ Button | LB / Y |
| **Drift / Handbrake** | `Spacebar` | Hold Steering + Brake | B Button |
| **Switch Camera** | `C` | Cam Toggle in HUD | Select |

## 🛠️ Tech Stack

- **Frontend**: Three.js (WebGL), HTML5 Canvas, Modern CSS
- **Bundler**: Vite
- **Backend**: Node.js, Express, CORS
- **Audio**: Web Audio API (procedural engine synthesis, drift screech, turbo & beeps)

## 🏁 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Backend Server
```bash
npm run server
```

### 3. Run Frontend Dev Server
```bash
npm run dev
```

Visit `http://localhost:5173/` in your browser.

