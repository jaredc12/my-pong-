// Pong with 10 levels — improved playability (responsive canvas, single AudioContext, touch controls)
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// logical game size (we keep game logic in this coordinate space)
const LOGICAL_W = 900;
const LOGICAL_H = 600;

const ui = {
  playerScore: document.getElementById('player-score'),
  aiScore: document.getElementById('ai-score'),
  levelDisplay: document.getElementById('level'),
  messages: document.getElementById('messages'),
  startOverlay: document.getElementById('startOverlay'),
  startBtn: document.getElementById('startBtn'),
  muteBtn: document.getElementById('muteBtn'),
  touchUp: document.getElementById('touchUp'),
  touchDown: document.getElementById('touchDown'),
  touchControls: document.getElementById('touchControls'),
  gameWrap: document.getElementById('game-wrap')
};

let audioCtx = null;
let soundEnabled = true;
function ensureAudio(){
  if(audioCtx) return;
  try{
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }catch(e){
    audioCtx = null;
  }
}

function playTone(freq, time=0.06, vol=0.02){
  if(!soundEnabled) return;
  if(!audioCtx) return;
  try{
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    o.start(now);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + time);
    o.stop(now + time + 0.02);
  }catch(e){}
}

// high-DPI / responsive canvas setup
function resizeCanvas(){
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  // canvas CSS size follows its element size; we set internal size scaled by dpr
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  // map logical coordinate space to physical canvas
  ctx.setTransform(canvas.width / LOGICAL_W, 0, 0, canvas.height / LOGICAL_H, 0, 0);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let paused = true;
let running = false;

const levels = [
  {ballSpeed: 3, paddleHeight: 120, aiSkill: 0.40, obstacles: 0},
  {ballSpeed: 3.6, paddleHeight: 110, aiSkill: 0.45, obstacles: 0},
  {ballSpeed: 4.2, paddleHeight: 100, aiSkill: 0.50, obstacles: 0},
  {ballSpeed: 4.8, paddleHeight: 92, aiSkill: 0.55, obstacles: 1},
  {ballSpeed: 5.4, paddleHeight: 86, aiSkill: 0.60, obstacles: 1},
  {ballSpeed: 6.1, paddleHeight: 80, aiSkill: 0.66, obstacles: 2},
  {ballSpeed: 6.8, paddleHeight: 74, aiSkill: 0.72, obstacles: 2},
  {ballSpeed: 7.6, paddleHeight: 68, aiSkill: 0.78, obstacles: 3},
  {ballSpeed: 8.4, paddleHeight: 62, aiSkill: 0.84, obstacles: 3},
  {ballSpeed: 9.4, paddleHeight: 56, aiSkill: 0.90, obstacles: 4}
];

let state = { level: 1, playerScore: 0, aiScore: 0 };

const paddle = (x, height, color) => ({
  x, y: (LOGICAL_H - height) / 2, w: 12, h: height, color
});

let player = paddle(20, levels[0].paddleHeight, '#ff3b3b');
let ai = paddle(LOGICAL_W - 32, levels[0].paddleHeight, '#3b8bff');

let ball = {
  x: LOGICAL_W / 2, y: LOGICAL_H / 2, r: 9,
  vx: levels[0].ballSpeed * (Math.random() > 0.5 ? 1 : -1),
  vy: (Math.random() * 2 - 1) * 2,
  color: '#ffffff'
};

let obstacles = [];

function resetBall(direction = 0) {
  ball.x = LOGICAL_W / 2;
  ball.y = LOGICAL_H / 2;
  const lvl = levels[state.level - 1];
  const base = lvl.ballSpeed;
  const angle = (Math.random() * Math.PI / 4) - (Math.PI / 8);
  const dir = direction === 0 ? (Math.random() > 0.5 ? 1 : -1) : direction;
  ball.vx = base * dir * Math.cos(angle);
  ball.vy = base * Math.sin(angle);
}

function applyLevelSettings() {
  const lvl = levels[state.level - 1];
  player.h = lvl.paddleHeight;
  ai.h = lvl.paddleHeight;
  obstacles = [];
  for (let i = 0; i < lvl.obstacles; i++) {
    const ow = 14, oh = 70;
    const ox = LOGICAL_W / 2 + (i % 2 ? 60 : -60) + (i * 18);
    const oy = 60 + Math.random() * (LOGICAL_H - 120 - oh);
    obstacles.push({ x: ox, y: oy, w: ow, h: oh, color: '#2a354f' });
  }
}

function drawNet(){
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  const step = 18;
  for(let y=10;y<LOGICAL_H;y+=step){
    ctx.fillRect(LOGICAL_W/2 -2, y, 4, 10);
  }
}

function draw(){
  // clear logical area
  ctx.clearRect(0,0,LOGICAL_W,LOGICAL_H);

  // subtle bg
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  ctx.fillRect(0,0,LOGICAL_W,LOGICAL_H);

  drawNet();

  // paddles
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.w, player.h);

  ctx.fillStyle = ai.color;
  ctx.fillRect(ai.x, ai.y, ai.w, ai.h);

  // obstacles
  obstacles.forEach(o=>{
    ctx.fillStyle = o.color;
    ctx.fillRect(o.x - o.w/2, o.y, o.w, o.h);
  });

  // ball
  ctx.fillStyle = ball.color;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2);
  ctx.fill();

  // UI text
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.font = '12px Inter, system-ui, Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`Difficulty Level ${state.level}`, LOGICAL_W/2, 20);
}

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

function rectCircleCollide(rx, ry, rw, rh, cx, cy, cr){
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx*dx + dy*dy <= cr*cr;
}

function update(dt){
  if(paused) return;

  // move ball (dt in seconds)
  ball.x += ball.vx * dt * 60;
  ball.y += ball.vy * dt * 60;

  // walls
  if(ball.y - ball.r < 0){
    ball.y = ball.r;
    ball.vy *= -1;
    playTone(420, 0.04, 0.02);
  } else if(ball.y + ball.r > LOGICAL_H) {
    ball.y = LOGICAL_H - ball.r;
    ball.vy *= -1;
    playTone(420, 0.04, 0.02);
  }

  // paddle collisions
  if(ball.vx < 0 && rectCircleCollide(player.x, player.y, player.w, player.h, ball.x, ball.y, ball.r)){
    ball.x = player.x + player.w + ball.r;
    ball.vx = Math.abs(ball.vx) * 1.03;
    const rel = (ball.y - (player.y + player.h/2)) / (player.h/2);
    ball.vy += rel * 2;
    playTone(720, 0.03, 0.02);
  }
  if(ball.vx > 0 && rectCircleCollide(ai.x, ai.y, ai.w, ai.h, ball.x, ball.y, ball.r)){
    ball.x = ai.x - ball.r;
    ball.vx = -Math.abs(ball.vx) * 1.03;
    const rel = (ball.y - (ai.y + ai.h/2)) / (ai.h/2);
    ball.vy += rel * 2;
    playTone(520, 0.03, 0.02);
  }

  // obstacles collisions
  obstacles.forEach(o=>{
    if(rectCircleCollide(o.x - o.w/2, o.y, o.w, o.h, ball.x, ball.y, ball.r)){
      ball.vx *= -1.02;
      ball.vy *= 1.01;
      playTone(320, 0.03, 0.02);
    }
  });

  // scoring
  if(ball.x < -30){
    state.aiScore++;
    ui.aiScore.textContent = state.aiScore;
    ui.messages.textContent = 'AI scored — press Space to continue';
    playTone(160, 0.18, 0.04);
    paused = true;
    running = false;
  } else if(ball.x > LOGICAL_W + 30){
    state.playerScore++;
    ui.playerScore.textContent = state.playerScore;
    playTone(880, 0.18, 0.04);
    paused = true;
    running = false;
    ui.messages.textContent = 'You scored — press Space to continue';
    if(state.level < 10){
      state.level++;
      applyLevelSettings();
      ui.levelDisplay.textContent = `Level: ${state.level} / 10`;
    } else {
      ui.messages.textContent = 'You scored! Max level reached — press Space to replay';
    }
  }

  // AI movement
  const lvl = levels[state.level - 1];
  const targetY = ball.y - (ai.h / 2);
  const skill = lvl.aiSkill;
  ai.y += (targetY - ai.y) * (skill * 0.12 * Math.min(1, dt * 60));
  ai.y = clamp(ai.y, 0, LOGICAL_H - ai.h);

  player.y = clamp(player.y, 0, LOGICAL_H - player.h);

  // small damping
  ball.vx *= 0.999;
  ball.vy *= 0.999;
}

let lastTime = performance.now();
function loop(now){
  const seconds = (now - lastTime) / 1000;
  const dt = Math.min(1/15, seconds); // clamp dt to avoid big jumps (in seconds)
  update(dt);
  draw();
  lastTime = now;
  requestAnimationFrame(loop);
}

// input
const keys = {};
window.addEventListener('keydown', e=>{
  keys[e.key.toLowerCase()] = true;

  // start on Space
  if(e.code === 'Space'){
    e.preventDefault();
    if(!running){
      startRound();
    }
  } else if(e.key.toLowerCase() === 'p'){
    paused = !paused;
    ui.messages.textContent = paused ? 'Paused' : '';
  }
});
window.addEventListener('keyup', e=>{
  keys[e.key.toLowerCase()] = false;
});

function processInput(dt){
  const speed = 6 * Math.max(0.8, (player.h / 120));
  if(keys['w'] || keys['arrowup']){
    player.y -= speed * 60 * dt;
  }
  if(keys['s'] || keys['arrowdown']){
    player.y += speed * 60 * dt;
  }
}

const baseUpdate = update;
update = function(dt){
  processInput(dt);
  baseUpdate(dt);
};

// start / focus handling
function startRound(){
  ensureAudio();
  // resume audio context if suspended (user gesture required)
  if(audioCtx && audioCtx.state === 'suspended'){
    audioCtx.resume().catch(()=>{});
  }
  ui.startOverlay.style.display = 'none';
  ui.touchControls.setAttribute('aria-hidden', 'false');
  paused = false;
  running = true;
  ui.messages.textContent = '';
  applyLevelSettings();
  resetBall();
  ui.gameWrap.focus();
}

// make sure game-wrap is focusable and clicking focuses
ui.gameWrap.addEventListener('click', () => ui.gameWrap.focus());
ui.startBtn.addEventListener('click', () => startRound());
ui.muteBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  ui.muteBtn.textContent = soundEnabled ? 'Mute Sounds' : 'Unmute';
});

// touch controls -> simulate key press while pressed
let touchInterval = null;
function startTouch(up){
  if(up) {
    keys['arrowup'] = true;
  } else {
    keys['arrowdown'] = true;
  }
}
function stopTouch(){
  keys['arrowup'] = false;
  keys['arrowdown'] = false;
}
ui.touchUp.addEventListener('touchstart', (e)=>{ e.preventDefault(); startTouch(true); }, {passive:false});
ui.touchUp.addEventListener('touchend', (e)=>{ e.preventDefault(); stopTouch(); }, {passive:false});
ui.touchDown.addEventListener('touchstart', (e)=>{ e.preventDefault(); startTouch(false); }, {passive:false});
ui.touchDown.addEventListener('touchend', (e)=>{ e.preventDefault(); stopTouch(); }, {passive:false});

// keyboard focus on load
ui.gameWrap.addEventListener('keydown', e => {
  // keep keyboard inside game-wrap
});

// initial UI
ui.playerScore.textContent = state.playerScore;
ui.aiScore.textContent = state.aiScore;
ui.levelDisplay.textContent = `Level: ${state.level} / 10`;
ui.messages.textContent = 'Press Space or Start to begin';

// initial settings
applyLevelSettings();
resetBall(1);

// begin loop
requestAnimationFrame(loop);

// expose for debugging
window._pong = {state, player, ai, ball, levels, obstacles};
