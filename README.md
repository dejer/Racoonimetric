# Racoonimetric 🦝

**A 2.5D stealth-sandbox game about a raccoon causing suburban chaos.** Play it in any browser, including on your phone:

### ▶ [Play now: dejer.github.io/Racoonimetric](https://dejer.github.io/Racoonimetric/)

Sneak through a sunny neighbourhood and steal everything that isn't nailed down. Knock over trash cans, soak the gardener, make the grill dad dance, befriend the dog, and drag your loot back to your den. Hoard enough treasure and it becomes a **Trash Throne**.

- **HD-2D look:** pixel-art sprites in a low-poly 3D diorama with pixel textures, tilt-shift depth of field, bloom, vignette and colour grading.
- **Stealth sandbox:** humans have vision cones blocked by walls, they hear noise (running, chittering, crashes), chase you for their stuff and put it back, and lose you in bushes.
- **Environmental puzzles:** steal a trowel to dig under a fence, lure the gardener into the sprinkler so he leaves his hat out to dry, drop a banana peel in someone's path, bribe the chained dog with food, and more.
- **16 objectives** on the Trash-to-Treasure list, each unlocking an **accessory** (hats, shades, scarves, capes…) plus 5 **fur colours** to customise your raccoon.
- **Reactive music:** a sneaky pizzicato-jazz score that picks up when you're sneaking and turns into a chase theme. All sound is synthesised live with WebAudio.
- **Living world:** flowers and grass sway and part around you, bushes rustle, water ripples, cans clatter, gates creak, and houses fade out when you sneak behind them.
- **Progress saves automatically** in your browser.

## Controls

| Action | Phone | Keyboard | Gamepad |
|---|---|---|---|
| Move | Drag the left side (a **gentle push sneaks**) | WASD / arrows | Left stick |
| Run | Hold **Run** | Shift | RT / RB |
| Sneak toggle | **Sneak** | C | X |
| Grab / drop / use | **Grab** (label changes by context) | Space / E | A |
| Chitter (make noise, lure humans) | **Chitter** | Q / F | B |
| To-do list · Wardrobe · Pause | Top buttons | Tab · G · Esc | Back · Y · Start |

On phones, *Add to Home Screen* gives you fullscreen play.

## Tech

Plain ES modules plus [three.js](https://threejs.org), with no build step. All art (sprites, accessories, textures, icons) is generated procedurally at startup with a tiny pixel rasteriser, and all audio is synthesised. Guards find their way with grid A* pathfinding.

```
js/sprites.js   pixel-art characters, items, accessories
js/world.js     the neighbourhood diorama, colliders, routes
js/actors.js    raccoon, human AI, dog, items, particles
js/render.js    HD-2D post-processing (tilt-shift DOF, bloom, grading)
js/audio.js     reactive music + SFX synth
js/game.js      interactions, objectives, saving, camera
```

To run locally, serve the folder with any static server (for example `python -m http.server`) and open `http://localhost:8000`.
