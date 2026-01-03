// Pong with 10 levels — player (left/red), AI (right/blue)
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const W = canvas.width;
const H = canvas.height;

const ui = {
  playerScore: document.getElementById('player-score'),
  aiScore: document.getElementById('ai-score'),
  levelDisplay: document.getElementById('level'),
  messages: document.getElementById('messages')
};

let paused = true;
let running = false;

const levels = [
  // 10 levels (index 0 -> level 1)
  {ballSpeed: 3, paddleHeight: 120, aiSkill: 0.40, obstacles: 0},
  {ballSpeed: 3.6, paddleHeight: 110, aiSkill: 0.45, obstacles: 0},
  {ballSpeed: 4.2, paddleHeight: 100, aiSkill: 0.50, obstacles: 0},
  {ballSpeed: 4.8, paddleHeight: 92, aiSkill: 0.55, obstacles: 1},
  {ballSpeed: 5.4, paddleHeight: 86, aiSkill: 0.60, obstacles: 1},
  {ballSpeed: 6.1, paddleHeight: 80, aiSkill: 0.66, obstacles: 2},
  {ballSpeed: 6.8, paddleHeight: 74, aiSkill: 0.72, obstacles: 2},
  {ballSpeed: 7.6, paddleHeight: 68, aiSkill: 0.78, obstacles: 3},
  {ballSpeed: 8.4, paddleHeight: 62, aiSkill: 0.84, obstacles: 3},
  {ballSpeed: 9.4, paddleHeight: 56, aiSkill: 0.90, obstacles: 4} // Level 10
];

let state = {
  level: 1,
  playerScore: 0,
  aiScore: 0
};

const paddle = (x, height, color) => ({
  x, y: (H - height) / 2, w: 12, h: height, color
});

let player = paddle(20, levels[0].paddleHeight, '#ff3b3b');
let ai = paddle(W - 32, levels[0].paddleHeight, '#3b8bff');

let ball = {
  x: W / 2, y: H / 2, r: 9,
  vx: levels[0].ballSpeed * (Math.random() > 0.5 ? 1 : -1),
  vy: (Math.random() * 2 - 1) * 2,
  color: '#ffffff'
};

let obstacles = [];

function resetBall(direction = 0) {
  ball.x = W / 2;
  ball.y = H / 2;
  const lvl = levels[state.level - 1];
  const base = lvl.ballSpeed;
  const angle = (Math.random() * Math.PI / 4) - (Math.PI / 8); // small angle
  const dir = direction === 0 ? (Math.random() > 0.5 ? 1 : -1) : direction;
  ball.vx = base * dir * Math.cos(angle);
  ball.vy = base * Math.sin(angle);
}

function applyLevelSettings() {
  const lvl = levels[state.level - 1];
  player.h = lvl.paddleHeight;
  ai.h = lvl.paddleHeight;
  // regenerate obstacles:
  obstacles = [];
  for (let i = 0; i < lvl.obstacles; i++) {
    // fixed-size obstacles at random Y
    const ow = 14, oh = 70;
    const ox = W/2 + (i%2 ? 60 : -60) + (i*18);
    const oy = 60 + Math.random()*(H - 120 - oh);
    obstacles.push({x:ox, y:oy, w:ow, h:oh, color:'#2a354f'});
  }
}

function drawNet(){
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  const step = 18;
  for(let y=10;y<H;y+=step){
    ctx.fillRect(W/2 -2, y, 4, 10);
  }
}

function draw(){
  ctx.clearRect(0,0,W,H);
  // background
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  ctx.fillRect(0,0,W,H);

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

  // UI overlay text inside canvas (center)
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.font = '12px Inter, system-ui, Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`Difficulty Level ${state.level}`, W/2, 20);
}

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

function rectCircleCollide(rx, ry, rw, rh, cx, cy, cr){
  // Find closest point to circle
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx*dx + dy*dy <= cr*cr;
}

function playTone(freq, time=0.06, vol=0.02){
  if(!window.AudioContext) return;
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    g.gain.setTargetAtTime(0, ctx.currentTime + time*0.8, 0.01);
    o.stop(ctx.currentTime + time);
    setTimeout(()=>{ try{ ctx.close(); }catch(e){} }, 200);
  }catch(e){}
}

function update(dt){
  if(paused) return;

  // move ball
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // walls
  if(ball.y - ball.r < 0){
    ball.y = ball.r;
    ball.vy *= -1;
    playTone(420, 0.04, 0.02);
  } else if(ball.y + ball.r > H) {
    ball.y = H - ball.r;
    ball.vy *= -1;
    playTone(420, 0.04, 0.02);
  }

  // paddle collisions
  // player
  if(ball.vx < 0 && rectCircleCollide(player.x, player.y, player.w, player.h, ball.x, ball.y, ball.r)){
    ball.x = player.x + player.w + ball.r;
    ball.vx = Math.abs(ball.vx) * 1.03; // slightly accelerate
    // adjust angle depending on hit position
    const rel = (ball.y - (player.y + player.h/2)) / (player.h/2);
    ball.vy += rel * 2;
    playTone(720, 0.03, 0.02);
  }
  // ai
  if(ball.vx > 0 && rectCircleCollide(ai.x, ai.y, ai.w, ai.h, ball.x, ball.y, ball.r)){
    ball.x = ai.x - ball.r;
    ball.vx = -Math.abs(ball.vx) * 1.03;
    const rel = (ball.y - (ai.y + ai.h/2)) / (ai.h/2);
    ball.vy += rel * 2;
    playTone(520, 0.03, 0.02);
  }

  // obstacles collisions (bounce and reverse X)
  obstacles.forEach(o=>{
    if(rectCircleCollide(o.x - o.w/2, o.y, o.w, o.h, ball.x, ball.y, ball.r)){
      // simple reflect
      ball.vx *= -1.02;
      ball.vy *= 1.01;
      playTone(320, 0.03, 0.02);
    }
  });

  // score
  if(ball.x < -30){
    state.aiScore++;
    ui.aiScore.textContent = state.aiScore;
    ui.messages.textContent = 'AI scored — press Space to continue';
    playTone(160, 0.18, 0.04);
    paused = true;
    running = false;
    // do not change level on AI point
  } else if(ball.x > W + 30){
    state.playerScore++;
    ui.playerScore.textContent = state.playerScore;
    playTone(880, 0.18, 0.04);
    paused = true;
    running = false;
    ui.messages.textContent = 'You scored — press Space to continue';
    // advance level when player scores (up to 10)
    if(state.level < 10){
      state.level++;
      applyLevelSettings();
      ui.levelDisplay.textContent = `Level: ${state.level} / 10`;
    } else {
      ui.messages.textContent = 'You scored! Max level reached — press Space to replay';
    }
  }

  // AI movement (simple predictive with skill factor)
  const lvl = levels[state.level - 1];
  const targetY = ball.y - (ai.h / 2);
  // move fraction towards the target scaled by aiSkill and dt
  const skill = lvl.aiSkill;
  ai.y += (targetY - ai.y) * (skill * 0.12 * Math.min(1, dt*60));
  ai.y = clamp(ai.y, 0, H - ai.h);

  // enforce player boundaries
  player.y = clamp(player.y, 0, H - player.h);

  // simple friction on velocities so it stays numeric-stable
  ball.vx *= 0.999;
  ball.vy *= 0.999;
}

let lastTime = performance.now();
function loop(now){
  const dt = Math.min(1/30, (now - lastTime) / (1000 / 60)); // normalized delta
  update(dt);
  draw();
  lastTime = now;
  requestAnimationFrame(loop);
}

// keyboard
const keys = {};
window.addEventListener('keydown', e=>{
  keys[e.key.toLowerCase()] = true;

  if(e.key === ' '){
    if(!running){
      // start round
      applyLevelSettings();
      resetBall();
      paused = false;
      running = true;
      ui.messages.textContent = '';
    } else {
      // space during running does nothing
    }
    e.preventDefault();
  } else if(e.key.toLowerCase() === 'p'){
    paused = !paused;
    ui.messages.textContent = paused ? 'Paused' : '';
  }
});
window.addEventListener('keyup', e=>{
  keys[e.key.toLowerCase()] = false;
});

function processInput(dt){
  // player input: W/S and ArrowUp/ArrowDown
  const speed = 6 * Math.max(0.8, (player.h / 120)); // smaller paddles slightly faster control
  if(keys['w'] || keys['arrowup']){
    player.y -= speed * 60 * dt;
  }
  if(keys['s'] || keys['arrowdown']){
    player.y += speed * 60 * dt;
  }
}

// hook into update to handle input
const baseUpdate = update;
update = function(dt){
  processInput(dt);
  baseUpdate(dt);
};

// initial UI
ui.playerScore.textContent = state.playerScore;
ui.aiScore.textContent = state.aiScore;
ui.levelDisplay.textContent = `Level: ${state.level} / 10`;
ui.messages.textContent = 'Press Space to Start';

// initial settings
applyLevelSettings();
resetBall(1);

// start loop
requestAnimationFrame(loop);

// expose a simple debug function
window._pong = {state, player, ai, ball, levels, obstacles};
