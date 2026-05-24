import React, { useEffect, useMemo, useRef, useState } from "react";

const W = 960;
const H = 320;
const GROUND_Y = 242;
const INITIAL_SPEED = 6;
const MAX_SPEED = 18;
const GRAVITY = 0.72;
const JUMP_FORCE = -13.8;
const DOUBLE_JUMP_FORCE = -12.2;
const HORSE_X = 92;
const HORSE_W = 68;
const HORSE_H = 52;
const DUCK_H = 32;
const MAX_OBSTACLES = 18;
const MAX_PARTICLES = 80;
const LEADERBOARD_KEY = "horse_game_top12_local";
const BEST_SCORE_KEY = "horse_best_score_advanced";

const OBSTACLE_TYPES = {
  fence_low: {
    type: "fence_low",
    group: "ground",
    w: 28,
    h: 28,
    minScore: 0,
  },
  fence_high: {
    type: "fence_high",
    group: "ground",
    w: 28,
    h: 48,
    minScore: 60,
  },
  fence_double: {
    type: "fence_double",
    group: "ground-double",
    w: 64,
    h: 30,
    minScore: 120,
    segmentW: 24,
    gap: 12,
  },
  bird: {
    type: "bird",
    group: "air",
    w: 38,
    h: 24,
    minScore: 180,
    minY: GROUND_Y - 100,
    maxY: GROUND_Y - 64,
  },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function intersects(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function getLocalLeaderboard() {
  try {
    return JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocalLeaderboard(score) {
  const current = getLocalLeaderboard();
  const next = [...current, {
    name: "Jogador",
    score,
    createdAt: new Date().toISOString(),
  }]
    .sort((a, b) => b.score - a.score || new Date(a.createdAt) - new Date(b.createdAt))
    .slice(0, 12);

  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(next));
  return next;
}

function createObstaclePool() {
  return Array.from({ length: MAX_OBSTACLES }, () => ({
    active: false,
    type: "fence_low",
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    segmentW: 0,
    gap: 0,
    flap: 0,
  }));
}

function createParticlePool() {
  return Array.from({ length: MAX_PARTICLES }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    size: 0,
    life: 0,
    maxLife: 0,
    kind: "dust",
  }));
}

function playHorseJumpSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    gain.connect(ctx.destination);

    const oscA = ctx.createOscillator();
    oscA.type = "triangle";
    oscA.frequency.setValueAtTime(240, now);
    oscA.frequency.exponentialRampToValueAtTime(150, now + 0.22);
    oscA.connect(gain);
    oscA.start(now);
    oscA.stop(now + 0.24);

    const oscB = ctx.createOscillator();
    oscB.type = "square";
    oscB.frequency.setValueAtTime(320, now + 0.03);
    oscB.frequency.exponentialRampToValueAtTime(190, now + 0.23);
    oscB.connect(gain);
    oscB.start(now + 0.03);
    oscB.stop(now + 0.24);
  } catch {}
}

function playHitSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    gain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.2);
  } catch {}
}

function resetGameState(soundEnabled = true) {
  return {
    running: false,
    gameOver: false,
    score: 0,
    speed: INITIAL_SPEED,
    nextSpawnIn: 90,
    spawnTimer: 0,
    leaderboard: getLocalLeaderboard(),
    soundEnabled,
    bg: {
      skyOffset: 0,
      mountainOffset: 0,
      groundOffset: 0,
      clouds: [
        { x: 160, y: 50, size: 26 },
        { x: 380, y: 76, size: 20 },
        { x: 760, y: 58, size: 24 },
      ],
      mountains: [
        { x: 40, w: 220, h: 74 },
        { x: 320, w: 250, h: 90 },
        { x: 650, w: 260, h: 66 },
      ],
    },
    horse: {
      x: HORSE_X,
      y: GROUND_Y - HORSE_H,
      w: HORSE_W,
      h: HORSE_H,
      vy: 0,
      grounded: true,
      jumpCount: 0,
      maxJumps: 2,
      ducking: false,
      normalH: HORSE_H,
      duckH: DUCK_H,
      animState: "run",
      animFrame: 0,
      animTimer: 0,
      dead: false,
      deathRotation: 0,
      deathVy: -6,
      runCycle: 0,
      shadowScale: 1,
    },
    obstaclePool: createObstaclePool(),
    particlePool: createParticlePool(),
  };
}

function updateDifficulty(state) {
  const rawSpeed = INITIAL_SPEED + Math.pow(state.score / 100, 1.2);
  state.speed = clamp(rawSpeed, INITIAL_SPEED, MAX_SPEED);

  const minSpawn = 28;
  const maxSpawn = 88;
  const reduction = Math.min(46, state.score * 0.12);
  state.nextSpawnIn = clamp(maxSpawn - reduction + rand(0, 18), minSpawn, maxSpawn);
}

function getHorseHitboxes(horse) {
  if (horse.ducking && horse.grounded) {
    return [
      { x: horse.x + 10, y: horse.y + 16, w: 36, h: 14 },
      { x: horse.x + 40, y: horse.y + 10, w: 18, h: 10 },
    ];
  }

  return [
    { x: horse.x + 10, y: horse.y + 18, w: 34, h: 18 },
    { x: horse.x + 42, y: horse.y + 6, w: 18, h: 12 },
  ];
}

function getObstacleHitboxes(obstacle) {
  if (!obstacle.active) return [];

  if (obstacle.type === "fence_double") {
    return [
      { x: obstacle.x, y: obstacle.y, w: obstacle.segmentW, h: obstacle.h },
      { x: obstacle.x + obstacle.segmentW + obstacle.gap, y: obstacle.y, w: obstacle.segmentW, h: obstacle.h },
    ];
  }

  return [{ x: obstacle.x, y: obstacle.y, w: obstacle.w, h: obstacle.h }];
}

function spawnParticles(pool, x, y, count, kind = "dust") {
  for (let i = 0; i < count; i++) {
    const particle = pool.find((p) => !p.active);
    if (!particle) return;
    particle.active = true;
    particle.kind = kind;
    particle.x = x + rand(-6, 8);
    particle.y = y + rand(-3, 3);
    particle.vx = rand(-2.4, 1.2);
    particle.vy = kind === "dust" ? rand(-1.6, -0.2) : rand(-3.4, -1.2);
    particle.size = kind === "dust" ? rand(3, 7) : rand(2, 5);
    particle.life = rand(18, 34);
    particle.maxLife = particle.life;
  }
}

function updateParticles(pool, dt) {
  for (const p of pool) {
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.active = false;
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 0.08 * dt;
  }
}

function chooseObstacleType(score) {
  const available = Object.values(OBSTACLE_TYPES).filter((item) => score >= item.minScore);
  return available[Math.floor(Math.random() * available.length)] || OBSTACLE_TYPES.fence_low;
}

function canSpawnObstacle(pool, nextX) {
  let rightMost = -Infinity;
  for (const item of pool) {
    if (!item.active) continue;
    rightMost = Math.max(rightMost, item.x + item.w + (item.gap || 0));
  }
  return nextX - rightMost > 120;
}

function activateObstacle(obstacle, config) {
  obstacle.active = true;
  obstacle.type = config.type;
  obstacle.w = config.w;
  obstacle.h = config.h;
  obstacle.x = W + rand(0, 32);
  obstacle.segmentW = config.segmentW || 0;
  obstacle.gap = config.gap || 0;
  obstacle.flap = 0;

  if (config.type === "bird") {
    obstacle.y = rand(config.minY, config.maxY);
  } else {
    obstacle.y = GROUND_Y - config.h;
  }
}

function trySpawnObstacle(state) {
  if (!canSpawnObstacle(state.obstaclePool, W + 10)) return;
  const obstacle = state.obstaclePool.find((item) => !item.active);
  if (!obstacle) return;
  const config = chooseObstacleType(state.score);
  activateObstacle(obstacle, config);
}

function updateObstacles(state, dt) {
  for (const obstacle of state.obstaclePool) {
    if (!obstacle.active) continue;
    obstacle.x -= state.speed * dt;
    if (obstacle.type === "bird") {
      obstacle.flap += dt * 0.22;
    }
    if (obstacle.x + obstacle.w + obstacle.gap < -40) {
      obstacle.active = false;
    }
  }
}

function validateState(state) {
  state.speed = clamp(state.speed, INITIAL_SPEED, MAX_SPEED);
  state.nextSpawnIn = clamp(state.nextSpawnIn, 24, 96);
  state.horse.jumpCount = clamp(state.horse.jumpCount, 0, state.horse.maxJumps);

  if (state.horse.grounded) {
    state.horse.vy = 0;
  }

  if (state.gameOver) {
    state.running = false;
  }
}

function createHorseSpriteSheet() {
  const canvas = document.createElement("canvas");
  const frameW = 92;
  const frameH = 72;
  const frames = [
    { state: "run", count: 6 },
    { state: "duck", count: 2 },
    { state: "jump", count: 1 },
    { state: "fall", count: 1 },
    { state: "dead", count: 1 },
  ];
  const totalFrames = frames.reduce((acc, item) => acc + item.count, 0);
  canvas.width = frameW * totalFrames;
  canvas.height = frameH;
  const ctx = canvas.getContext("2d");

  const frameMap = {};
  let offset = 0;

  function drawHorseFrame(x, y, variant) {
    const body = "#7a4a28";
    const dark = "#2f1b14";
    const eye = "#ffffff";
    const liftA = variant === "runA" ? 6 : variant === "runB" ? 1 : variant === "duck" ? 0 : 4;
    const liftB = variant === "runA" ? 1 : variant === "runB" ? 6 : variant === "duck" ? 0 : 4;
    const baseY = variant === "duck" ? y + 14 : y + 4;

    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(x + 18, baseY + 18, 40, variant === "duck" ? 16 : 20, 8);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 24, baseY + 28, 9, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 54, baseY + 28, 10, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(x + 52, baseY + 20);
    ctx.rotate(variant === "dead" ? 0.4 : -0.42);
    ctx.beginPath();
    ctx.roundRect(0, 0, 12, variant === "duck" ? 10 : 22, 5);
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.ellipse(x + 70, baseY + 15, 11, 8, variant === "dead" ? 0.18 : -0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 78, baseY + 17, 6, 4.6, -0.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(x + 63, baseY + 5);
    ctx.lineTo(x + 67, baseY + 11);
    ctx.lineTo(x + 60, baseY + 10);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 69, baseY + 4);
    ctx.lineTo(x + 73, baseY + 11);
    ctx.lineTo(x + 66, baseY + 10);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x + 40, baseY + 14);
    ctx.quadraticCurveTo(x + 49, baseY + 0, x + 61, baseY + 12);
    ctx.lineTo(x + 56, baseY + 20);
    ctx.quadraticCurveTo(x + 47, baseY + 12, x + 42, baseY + 18);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x + 14, baseY + 18);
    ctx.quadraticCurveTo(x + 4, baseY + 22, x + 10, baseY + 35);
    ctx.quadraticCurveTo(x + 18, baseY + 30, x + 18, baseY + 20);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = body;
    const legY = variant === "duck" ? baseY + 30 : baseY + 34;
    const legH = variant === "dead" ? 8 : 14;
    ctx.fillRect(x + 22, legY, 5, legH + liftA);
    ctx.fillRect(x + 34, legY, 5, legH + liftB);
    ctx.fillRect(x + 46, legY, 5, legH + liftB);
    ctx.fillRect(x + 58, legY, 5, legH + liftA);

    ctx.fillStyle = dark;
    ctx.fillRect(x + 22, legY + legH + liftA, 5, 3);
    ctx.fillRect(x + 34, legY + legH + liftB, 5, 3);
    ctx.fillRect(x + 46, legY + legH + liftB, 5, 3);
    ctx.fillRect(x + 58, legY + legH + liftA, 5, 3);

    ctx.fillStyle = eye;
    ctx.beginPath();
    ctx.arc(x + 71, baseY + 13, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.arc(x + 71.5, baseY + 13, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  const sequence = [
    ["run", ["runA", "runB", "runA", "runB", "runA", "runB"]],
    ["duck", ["duck", "duck"]],
    ["jump", ["jump"]],
    ["fall", ["fall"]],
    ["dead", ["dead"]],
  ];

  sequence.forEach(([state, variants]) => {
    frameMap[state] = [];
    variants.forEach((variant) => {
      const sx = offset * frameW;
      frameMap[state].push({ sx, sy: 0, sw: frameW, sh: frameH });
      drawHorseFrame(sx, 6, variant);
      offset += 1;
    });
  });

  return { image: canvas, frameMap, frameW, frameH };
}

function drawCloud(ctx, x, y, size) {
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.arc(x + size * 0.8, y + 3, size * 0.85, 0, Math.PI * 2);
  ctx.arc(x - size * 0.8, y + 5, size * 0.72, 0, Math.PI * 2);
  ctx.fill();
}

function drawMountains(ctx, mountains, offset) {
  ctx.fillStyle = "#cbd5e1";
  for (const mountain of mountains) {
    const x = mountain.x - offset;
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(x + mountain.w * 0.5, GROUND_Y - mountain.h);
    ctx.lineTo(x + mountain.w, GROUND_Y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawFence(ctx, obstacle) {
  const drawSingle = (x, y, w, h) => {
    ctx.fillStyle = "#8b5a2b";
    ctx.fillRect(x + 2, y + 2, 5, h - 2);
    ctx.fillRect(x + w - 7, y + 2, 5, h - 2);
    ctx.fillStyle = "#c0843d";
    ctx.fillRect(x, y + 8, w, 5);
    ctx.fillRect(x, y + 18, w, 5);
    ctx.fillStyle = "#6b4423";
    ctx.fillRect(x, y + h - 2, w, 2);
  };

  if (obstacle.type === "fence_double") {
    drawSingle(obstacle.x, obstacle.y, obstacle.segmentW, obstacle.h);
    drawSingle(obstacle.x + obstacle.segmentW + obstacle.gap, obstacle.y, obstacle.segmentW, obstacle.h);
    return;
  }

  drawSingle(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
}

function drawBird(ctx, obstacle) {
  const wing = Math.sin(obstacle.flap) > 0 ? 1 : -1;
  ctx.fillStyle = "#475569";
  ctx.beginPath();
  ctx.ellipse(obstacle.x + 18, obstacle.y + 12, 12, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(obstacle.x + 12, obstacle.y + 12);
  ctx.lineTo(obstacle.x + 2, obstacle.y + 6 + wing * 4);
  ctx.lineTo(obstacle.x + 10, obstacle.y + 16);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(obstacle.x + 23, obstacle.y + 11);
  ctx.lineTo(obstacle.x + 34, obstacle.y + 6 - wing * 4);
  ctx.lineTo(obstacle.x + 27, obstacle.y + 16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#111827";
  ctx.fillRect(obstacle.x + 30, obstacle.y + 10, 6, 2);
}

function drawParticles(ctx, pool) {
  for (const p of pool) {
    if (!p.active) continue;
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.kind === "jump" ? "#c0843d" : "#a16207";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function getHorseDrawSize(horse) {
  return {
    w: horse.w,
    h: horse.ducking && horse.grounded ? horse.duckH + 12 : horse.normalH + 18,
  };
}

export default function DinoGameSimples() {
  const canvasRef = useRef(null);
  const animationRef = useRef(0);
  const lastTimeRef = useRef(0);
  const stateRef = useRef(resetGameState(true));
  const inputRef = useRef({ down: false });
  const horseSheetRef = useRef(null);

  const [ui, setUi] = useState({
    score: 0,
    best: 0,
    running: false,
    gameOver: false,
    soundEnabled: true,
    leaderboard: getLocalLeaderboard(),
  });

  const bestScore = useMemo(() => Number(localStorage.getItem(BEST_SCORE_KEY) || 0), []);

  useEffect(() => {
    horseSheetRef.current = createHorseSpriteSheet();
    setUi((prev) => ({ ...prev, best: bestScore, leaderboard: getLocalLeaderboard() }));
  }, [bestScore]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jumpOrStart();
      }
      if (e.code === "ArrowDown") {
        e.preventDefault();
        inputRef.current.down = true;
      }
      if (e.code === "KeyR") {
        e.preventDefault();
        restart();
      }
      if (e.code === "KeyM") {
        e.preventDefault();
        toggleSound();
      }
    };

    const onKeyUp = (e) => {
      if (e.code === "ArrowDown") {
        inputRef.current.down = false;
      }
    };

    const onPointerDown = () => jumpOrStart();
    const onPointerUp = () => {
      inputRef.current.down = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);

    startLoop();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  function syncUI(force = false) {
    const s = stateRef.current;
    setUi((prev) => {
      const best = Number(localStorage.getItem(BEST_SCORE_KEY) || 0);
      const leaderboard = s.leaderboard;
      const next = {
        score: Math.floor(s.score),
        running: s.running,
        gameOver: s.gameOver,
        best,
        soundEnabled: s.soundEnabled,
        leaderboard,
      };

      if (!force && JSON.stringify(prev) === JSON.stringify(next)) {
        return prev;
      }

      return next;
    });
  }

  function jumpOrStart() {
    const s = stateRef.current;
    const horse = s.horse;

    if (s.gameOver) {
      restart();
      return;
    }

    if (!s.running) {
      s.running = true;
    }

    if (horse.dead) return;

    if (horse.jumpCount < horse.maxJumps) {
      horse.vy = horse.jumpCount === 0 ? JUMP_FORCE : DOUBLE_JUMP_FORCE;
      horse.jumpCount += 1;
      horse.grounded = false;
      horse.ducking = false;
      horse.h = horse.normalH;
      spawnParticles(s.particlePool, horse.x + 14, GROUND_Y - 2, 7, "jump");
      if (s.soundEnabled) playHorseJumpSound();
    }

    syncUI();
  }

  function restart() {
    stateRef.current = {
      ...resetGameState(stateRef.current.soundEnabled),
      running: true,
    };
    inputRef.current.down = false;
    syncUI(true);
  }

  function toggleSound() {
    stateRef.current.soundEnabled = !stateRef.current.soundEnabled;
    syncUI(true);
  }

  function startLoop() {
    const loop = (time) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const rawDelta = (time - lastTimeRef.current) / 16.6667;
      const dt = clamp(rawDelta, 0.6, 1.8);
      lastTimeRef.current = time;

      update(dt);
      render();

      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);
  }

  function update(dt) {
    const s = stateRef.current;
    const horse = s.horse;

    updateDifficulty(s);

    if (!s.running && !s.gameOver) {
      renderBackgroundMotion(s, dt * 0.5);
      updateParticles(s.particlePool, dt);
      return;
    }

    if (!s.gameOver) {
      s.score += 0.2 * dt * (s.speed / INITIAL_SPEED);
      renderBackgroundMotion(s, dt);
      updateHorse(s, dt);
      updateSpawn(s, dt);
      updateObstacles(s, dt);
      updateParticles(s.particlePool, dt);
      handleCollisions(s);
      validateState(s);
    } else {
      updateDeathAnimation(s, dt);
      renderBackgroundMotion(s, dt * 0.7);
      updateObstacles(s, dt);
      updateParticles(s.particlePool, dt);
    }

    if (Math.floor(s.score) % 5 === 0) {
      syncUI();
    }
  }

  function renderBackgroundMotion(state, dt) {
    const bg = state.bg;
    bg.skyOffset = (bg.skyOffset + 0.3 * dt) % (W + 160);
    bg.mountainOffset = (bg.mountainOffset + 1 * dt) % (W + 260);
    bg.groundOffset = (bg.groundOffset + state.speed * dt) % 40;

    for (const cloud of bg.clouds) {
      cloud.x -= 0.3 * dt;
      if (cloud.x < -90) {
        cloud.x = W + rand(20, 120);
        cloud.y = rand(34, 88);
      }
    }
  }

  function updateHorse(state, dt) {
    const horse = state.horse;

    horse.ducking = inputRef.current.down && horse.grounded;
    horse.h = horse.ducking ? horse.duckH : horse.normalH;
    horse.y += horse.vy * dt;
    horse.vy += GRAVITY * dt;
    horse.runCycle += dt * (horse.grounded ? state.speed * 0.16 : 0.08);

    const floorY = GROUND_Y - horse.h;
    if (horse.y >= floorY) {
      if (!horse.grounded && horse.vy > 0) {
        spawnParticles(state.particlePool, horse.x + 18, GROUND_Y - 1, 8, "dust");
      }
      horse.y = floorY;
      horse.vy = 0;
      horse.grounded = true;
      horse.jumpCount = 0;
    } else {
      horse.grounded = false;
    }

    horse.shadowScale = clamp(1 - Math.abs((GROUND_Y - horse.h) - horse.y) / 100, 0.45, 1);

    if (horse.dead) {
      horse.animState = "dead";
    } else if (!horse.grounded) {
      horse.animState = horse.vy < 0 ? "jump" : "fall";
    } else if (horse.ducking) {
      horse.animState = "duck";
    } else {
      horse.animState = "run";
    }

    const framesByState = { run: 6, duck: 2, jump: 1, fall: 1, dead: 1 };
    horse.animTimer += dt / 60;
    const frameDuration = horse.animState === "run" ? 0.07 : horse.animState === "duck" ? 0.09 : 0.12;
    if (horse.animTimer >= frameDuration) {
      horse.animTimer = 0;
      horse.animFrame = (horse.animFrame + 1) % framesByState[horse.animState];
    }

    if (horse.grounded && !horse.ducking && state.running && Math.floor(state.score) % 12 === 0) {
      spawnParticles(state.particlePool, horse.x + 8, GROUND_Y - 1, 1, "dust");
    }
  }

  function updateSpawn(state, dt) {
    state.spawnTimer += dt;
    if (state.spawnTimer >= state.nextSpawnIn) {
      trySpawnObstacle(state);
      state.spawnTimer = 0;
    }
  }

  function handleCollisions(state) {
    const horseBoxes = getHorseHitboxes(state.horse);

    for (const obstacle of state.obstaclePool) {
      if (!obstacle.active) continue;
      const obstacleBoxes = getObstacleHitboxes(obstacle);
      const hit = horseBoxes.some((hb) => obstacleBoxes.some((ob) => intersects(hb, ob)));
      if (hit) {
        state.gameOver = true;
        state.horse.dead = true;
        state.horse.grounded = false;
        state.horse.deathRotation = 0;
        state.horse.deathVy = -5.2;
        spawnParticles(state.particlePool, state.horse.x + 30, state.horse.y + 24, 12, "jump");
        if (state.soundEnabled) playHitSound();

        const score = Math.floor(state.score);
        const currentBest = Number(localStorage.getItem(BEST_SCORE_KEY) || 0);
        const nextBest = Math.max(currentBest, score);
        localStorage.setItem(BEST_SCORE_KEY, String(nextBest));
        state.leaderboard = saveLocalLeaderboard(score);
        syncUI(true);
        break;
      }
    }
  }

  function updateDeathAnimation(state, dt) {
    const horse = state.horse;
    if (!horse.dead) return;
    horse.deathVy += GRAVITY * 0.85 * dt;
    horse.y += horse.deathVy * dt;
    horse.deathRotation = clamp(horse.deathRotation + 0.05 * dt, 0, 1.3);

    const deadFloor = GROUND_Y - horse.h;
    if (horse.y >= deadFloor) {
      horse.y = deadFloor;
      horse.deathVy = 0;
      horse.grounded = true;
    }
  }

  function render() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const s = stateRef.current;

    ctx.clearRect(0, 0, W, H);

    renderBackground(ctx, s);
    renderGround(ctx, s);
    drawParticles(ctx, s.particlePool);
    renderHorse(ctx, s);
    renderObstacles(ctx, s);
    renderUI(ctx, s);
  }

  function renderBackground(ctx, state) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#dbeafe");
    sky.addColorStop(1, "#f8fafc");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    for (const cloud of state.bg.clouds) {
      drawCloud(ctx, cloud.x, cloud.y, cloud.size);
    }

    drawMountains(ctx, state.bg.mountains, state.bg.mountainOffset);
    drawMountains(ctx, state.bg.mountains.map((m) => ({ ...m, x: m.x + W + 120 })), state.bg.mountainOffset);
  }

  function renderGround(ctx, state) {
    ctx.fillStyle = "#bbf7d0";
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(W, GROUND_Y);
    ctx.stroke();

    ctx.strokeStyle = "#94a3b8";
    for (let i = -1; i < W / 40 + 2; i++) {
      const x = i * 40 - state.bg.groundOffset;
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y + 9);
      ctx.lineTo(x + 20, GROUND_Y + 9);
      ctx.stroke();
    }
  }

  function renderHorse(ctx, state) {
    const sheet = horseSheetRef.current;
    const horse = state.horse;
    if (!sheet) return;

    const frames = sheet.frameMap[horse.animState] || sheet.frameMap.run;
    const frame = frames[horse.animFrame % frames.length];
    const drawSize = getHorseDrawSize(horse);

    ctx.fillStyle = "rgba(15,23,42,0.18)";
    ctx.beginPath();
    ctx.ellipse(horse.x + 34, GROUND_Y + 7, 24 * horse.shadowScale, 7 * horse.shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(horse.x + drawSize.w * 0.5, horse.y + drawSize.h * 0.6);
    ctx.rotate(horse.dead ? horse.deathRotation : 0);
    ctx.drawImage(
      sheet.image,
      frame.sx,
      frame.sy,
      frame.sw,
      frame.sh,
      -drawSize.w * 0.55,
      -drawSize.h * 0.72,
      drawSize.w * 1.22,
      drawSize.h * 1.14,
    );
    ctx.restore();
  }

  function renderObstacles(ctx, state) {
    for (const obstacle of state.obstaclePool) {
      if (!obstacle.active) continue;
      if (obstacle.type === "bird") {
        drawBird(ctx, obstacle);
      } else {
        drawFence(ctx, obstacle);
      }
    }
  }

  function renderUI(ctx, state) {
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 18px monospace";
    ctx.fillText(`SCORE ${String(Math.floor(state.score)).padStart(5, "0")}`, W - 230, 28);
    ctx.fillText(`BEST ${String(ui.best).padStart(5, "0")}`, W - 230, 52);

    if (!state.running && !state.gameOver) {
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.fillRect(W / 2 - 230, 74, 460, 110);
      ctx.fillStyle = "#0f172a";
      ctx.textAlign = "center";
      ctx.font = "bold 28px sans-serif";
      ctx.fillText("Jogo do Cavalo — Runner Avançado", W / 2, 112);
      ctx.font = "16px sans-serif";
      ctx.fillText("Espaço/↑ = pulo | ↓ = abaixar | pulo duplo habilitado", W / 2, 142);
      ctx.fillText("Desvie de cercas baixas, altas, duplas e pássaros", W / 2, 166);
      ctx.textAlign = "left";
    }

    if (state.gameOver) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(W / 2 - 190, 78, 380, 92);
      ctx.fillStyle = "#7f1d1d";
      ctx.textAlign = "center";
      ctx.font = "bold 28px sans-serif";
      ctx.fillText("Game Over", W / 2, 115);
      ctx.fillStyle = "#111827";
      ctx.font = "16px sans-serif";
      ctx.fillText("Clique, espaço ou R para reiniciar", W / 2, 145);
      ctx.textAlign = "left";
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl rounded-3xl bg-white p-5 shadow-xl ring-1 ring-slate-200">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Jogo do Cavalo — runner avançado</h1>
            <p className="text-sm text-slate-600">
              Dificuldade progressiva, pulo duplo, abaixar, múltiplas hitboxes, parallax, sprite sheet em canvas, partículas, pooling e ranking local Top 12.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div className="rounded-2xl bg-slate-100 px-4 py-2"><span className="font-semibold">Score:</span> {ui.score}</div>
            <div className="rounded-2xl bg-slate-100 px-4 py-2"><span className="font-semibold">Recorde:</span> {ui.best}</div>
            <div className="rounded-2xl bg-slate-100 px-4 py-2"><span className="font-semibold">Som:</span> {ui.soundEnabled ? "Ligado" : "Desligado"}</div>
            <div className="rounded-2xl bg-slate-100 px-4 py-2"><span className="font-semibold">Ranking:</span> Top 12</div>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="w-full rounded-2xl border border-slate-200 bg-white"
        />

        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          <button onClick={jumpOrStart} className="rounded-2xl bg-slate-900 px-4 py-3 font-medium text-white transition hover:opacity-90">Pular / Iniciar</button>
          <button onClick={restart} className="rounded-2xl bg-slate-200 px-4 py-3 font-medium text-slate-900 transition hover:bg-slate-300">Reiniciar</button>
          <button onClick={toggleSound} className="rounded-2xl bg-amber-100 px-4 py-3 font-medium text-amber-900 transition hover:bg-amber-200">{ui.soundEnabled ? "Desligar som" : "Ligar som"}</button>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">Controles: <span className="font-semibold">Espaço</span>, <span className="font-semibold">↑</span>, <span className="font-semibold">↓</span>, <span className="font-semibold">R</span> e <span className="font-semibold">M</span>.</div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200">
            <p className="font-semibold">Melhorias implementadas</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Dificuldade progressiva por curva e spawn dinâmico.</li>
              <li>Cerca baixa, cerca alta, cerca dupla e pássaro.</li>
              <li>Múltiplas hitboxes no cavalo e nos obstáculos.</li>
              <li>Pulo duplo, abaixar, animação de morte e partículas.</li>
              <li>Parallax com céu, montanhas e chão.</li>
              <li>Object pooling para obstáculos e partículas.</li>
              <li>Arquitetura separada em <code>update()</code> e <code>render()</code>.</li>
            </ul>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200">
            <p className="font-semibold">Top 12 local</p>
            <div className="mt-2 space-y-2">
              {ui.leaderboard.length === 0 ? (
                <div className="rounded-xl bg-white px-3 py-2 text-slate-500 ring-1 ring-slate-200">Ainda não há scores salvos.</div>
              ) : ui.leaderboard.map((item, index) => (
                <div key={`${item.createdAt}-${index}`} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
                  <span><span className="font-semibold">#{index + 1}</span> {item.name}</span>
                  <span className="font-bold">{item.score}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">O ranking ficou local neste arquivo. Para Supabase real, falta conectar URL/chave e criar a tabela.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
