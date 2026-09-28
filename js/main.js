// Entry point: boot the game, run the loop, handle resize/visibility and surface fatal errors.
import { Game } from './game.js';
import { UI } from './ui.js';

function fatal(msg) {
  const el = document.getElementById('loading') || document.body.appendChild(document.createElement('div'));
  el.id = 'loading'; el.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#1b1320;color:#fff8e7;padding:24px;text-align:center;font:18px sans-serif;z-index:99';
  el.textContent = 'Oops — the raccoon tripped: ' + msg;
}
window.addEventListener('error', (e) => { window.__errors = (window.__errors || []).concat(String(e.message)); });
window.addEventListener('unhandledrejection', (e) => { window.__errors = (window.__errors || []).concat(String(e.reason)); });

try {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  const ui = new UI(game);
  window.__game = game;
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    try { game.frame(dt); } catch (err) { console.error(err); window.__errors = (window.__errors || []).concat(String(err && err.stack || err)); }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  const onResize = () => game.renderer.resize();
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 250));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { game.audio.suspend(); if (game.mode === 'play') ui.openPause(); }
    else if (game.mode !== 'title') game.audio.resume();
  });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
} catch (err) {
  console.error(err);
  fatal(err && err.message ? err.message : String(err));
}
