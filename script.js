// 캔버스와 화면 요소들을 가져온다.
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const backgroundSelect = document.getElementById("backgroundSelect");
const ballColorSelect = document.getElementById("ballColorSelect");
const difficultySelect = document.getElementById("difficultySelect");
const startButton = document.getElementById("startButton");
const nextButton = document.getElementById("nextButton");
const scoreText = document.getElementById("scoreText");
const levelText = document.getElementById("levelText");
const timeText = document.getElementById("timeText");
const statusText = document.getElementById("statusText");

// 난이도별 공 속도와 제한 시간을 정한다.
const LEVELS = [
  { name: "쉬움", speed: 3.4, timeLimit: 180 },
  { name: "보통", speed: 4.5, timeLimit: 120 },
  { name: "어려움", speed: 5.7, timeLimit: 90 },
];

// 벽돌의 줄 수, 크기, 간격을 정한다.
const BRICK = {
  rows: 5,
  cols: 8,
  width: 78,
  height: 22,
  padding: 12,
  offsetTop: 64,
  offsetLeft: 48,
};

// 아래쪽 검정 패드의 크기와 위치를 정한다.
const PADDLE = {
  width: 116,
  height: 16,
  y: canvas.height - 42,
};

// TNT(폭발 블록) 관련 설정값
const TNT_RATIO = 0.10;                       // 전체 블록 중 약 10%가 TNT
const EXPLOSION_RADIUS = BRICK.width * 1.6;   // 폭발 반경(약 125px, 자기 + 주변 8칸 정도)
const TNT_BONUS = 20;                         // TNT 자체를 깼을 때 점수(일반 블록 10보다 높음)

// 게임 진행에 필요한 현재 상태를 저장한다.
const state = {
  status: "ready",
  levelIndex: 0,
  score: 0,
  timeLeft: LEVELS[0].timeLimit,
  lastTime: 0,
  nextLevelIndex: null,
  animationId: null,
  runId: 0,
  paddleX: (canvas.width - PADDLE.width) / 2,
  ball: createBall(LEVELS[0].speed),
  bricks: createBricks(),
  particles: [],
  flashes: [],
};

// 새 공을 만든다. 시작 위치는 패드 위쪽이다.
function createBall(speed) {
  return {
    x: canvas.width / 2,
    y: PADDLE.y - 18,
    radius: 8,
    dx: speed,
    dy: -speed,
    color: ballColorSelect.value,
  };
}

// 화면 위쪽에 벽돌들을 여러 줄로 만든다.
function createBricks() {
  const colors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"];
  const bricks = [];

  for (let row = 0; row < BRICK.rows; row += 1) {
    for (let col = 0; col < BRICK.cols; col += 1) {
      bricks.push({
        x: BRICK.offsetLeft + col * (BRICK.width + BRICK.padding),
        y: BRICK.offsetTop + row * (BRICK.height + BRICK.padding),
        width: BRICK.width,
        height: BRICK.height,
        color: colors[row % colors.length],
        type: Math.random() < TNT_RATIO ? "tnt" : "normal",
        active: true,
      });
    }
  }

  return bricks;
}

// 시작 버튼을 누르거나 다음 난이도를 시작할 때 새 게임을 준비한다.
function startGame(levelIndex = Number(difficultySelect.value)) {
  const level = LEVELS[levelIndex];

  if (state.animationId !== null) {
    cancelAnimationFrame(state.animationId);
  }

  state.status = "running";
  state.runId += 1;
  state.levelIndex = levelIndex;
  state.score = 0;
  state.timeLeft = level.timeLimit;
  state.lastTime = 0;
  state.nextLevelIndex = null;
  state.paddleX = (canvas.width - PADDLE.width) / 2;
  state.ball = createBall(level.speed);
  state.bricks = createBricks();
  state.particles = [];
  state.flashes = [];

  nextButton.hidden = true;
  updateHud("진행 중");
  state.animationId = requestAnimationFrame((timestamp) => gameLoop(timestamp, state.runId));
}

// requestAnimationFrame으로 계속 호출되는 메인 게임 반복 함수이다.
function gameLoop(timestamp, runId) {
  if (runId !== state.runId || state.status !== "running") {
    return;
  }

  if (!state.lastTime) {
    state.lastTime = timestamp;
  }

  const deltaSeconds = Math.min((timestamp - state.lastTime) / 1000, 0.05);
  state.lastTime = timestamp;

  updateTimer(deltaSeconds);

  if (state.status === "running") {
    updateBall(deltaSeconds);
  }

  updateParticles(deltaSeconds);

  draw();

  if (state.status === "running") {
    state.animationId = requestAnimationFrame((nextTimestamp) => gameLoop(nextTimestamp, runId));
  } else {
    state.animationId = null;
  }
}

// 남은 시간을 줄이고 시간이 끝나면 게임을 종료한다.
function updateTimer(deltaSeconds) {
  state.timeLeft -= deltaSeconds;

  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    endGame("시간 초과! 게임 종료");
    return;
  }

  updateHud("진행 중");
}

// 공의 위치를 이동시키고 벽, 패드, 벽돌 충돌을 확인한다.
function updateBall(deltaSeconds) {
  const frameScale = deltaSeconds * 60;
  const ball = state.ball;

  ball.x += ball.dx * frameScale;
  ball.y += ball.dy * frameScale;

  if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= canvas.width) {
    ball.dx *= -1;
    ball.x = clamp(ball.x, ball.radius, canvas.width - ball.radius);
  }

  if (ball.y - ball.radius <= 0) {
    ball.dy *= -1;
    ball.y = ball.radius;
  }

  handlePaddleCollision();
  handleBrickCollision();

  if (ball.y - ball.radius > canvas.height) {
    endGame("공을 놓쳤습니다! 게임 종료");
  }
}

// 공이 패드에 닿으면 위쪽으로 튕기게 한다.
function handlePaddleCollision() {
  const ball = state.ball;
  const isFalling = ball.dy > 0;
  const hitPaddleY = ball.y + ball.radius >= PADDLE.y && ball.y - ball.radius <= PADDLE.y + PADDLE.height;
  const hitPaddleX = ball.x >= state.paddleX && ball.x <= state.paddleX + PADDLE.width;

  if (isFalling && hitPaddleY && hitPaddleX) {
    const hitPoint = (ball.x - (state.paddleX + PADDLE.width / 2)) / (PADDLE.width / 2);
    const speed = LEVELS[state.levelIndex].speed;
    ball.dx = hitPoint * speed;
    ball.dy = -Math.sqrt(Math.max(speed * speed - ball.dx * ball.dx * 0.35, speed));
    ball.y = PADDLE.y - ball.radius;
  }
}

// 공이 벽돌에 닿으면 벽돌을 없애고 점수를 올린다. TNT는 폭발해서 주변 블록도 함께 깬다.
function handleBrickCollision() {
  const ball = state.ball;

  for (const brick of state.bricks) {
    if (!brick.active || !circleIntersectsRect(ball, brick)) {
      continue;
    }

    if (brick.type === "tnt") {
      detonate(brick);
    } else {
      brick.active = false;
      state.score += 10;
      ball.dy *= -1;
    }

    updateHud("진행 중");

    if (state.bricks.every((item) => !item.active)) {
      clearLevel();
    }

    break;
  }
}

// 블록 중심이 폭발 중심에서 반경 안에 들어오는지 검사한다(sqrt 회피).
function isInBlastRadius(brick, cx, cy, radius) {
  const bx = brick.x + brick.width / 2;
  const by = brick.y + brick.height / 2;
  const dx = bx - cx;
  const dy = by - cy;
  return dx * dx + dy * dy <= radius * radius;
}

// 폭발 시각 효과(섬광 1개 + 사방으로 튀는 파티클 24개)를 생성한다.
function spawnExplosionEffect(cx, cy) {
  state.flashes.push({
    x: cx,
    y: cy,
    radius: 0,
    maxRadius: EXPLOSION_RADIUS * 0.9,
    life: 0.25,
    maxLife: 0.25,
  });

  const particleColors = ["#ffeb3b", "#ff9800", "#f44336", "#5d4037"];
  const count = 24;
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
    const speed = 80 + Math.random() * 100;
    const life = 0.4 + Math.random() * 0.3;
    state.particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      maxLife: life,
      color: particleColors[Math.floor(Math.random() * particleColors.length)],
      size: 2 + Math.random() * 3,
    });
  }
}

// 매 프레임 파티클과 섬광의 위치/수명을 갱신하고 만료된 것을 제거한다.
function updateParticles(deltaSeconds) {
  for (const p of state.particles) {
    p.x += p.vx * deltaSeconds;
    p.y += p.vy * deltaSeconds;
    p.vy += 200 * deltaSeconds;
    p.life -= deltaSeconds;
  }
  state.particles = state.particles.filter((p) => p.life > 0);

  for (const f of state.flashes) {
    const t = 1 - f.life / f.maxLife;
    f.radius = f.maxRadius * t;
    f.life -= deltaSeconds;
  }
  state.flashes = state.flashes.filter((f) => f.life > 0);
}

// 폭발 섬광(원형 그라데이션)과 파티클(작은 사각형)을 그린다.
function drawEffects() {
  for (const f of state.flashes) {
    const alpha = f.life / f.maxLife;
    const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius);
    grad.addColorStop(0, `rgba(255, 240, 180, ${alpha * 0.9})`);
    grad.addColorStop(1, "rgba(255, 180, 80, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const p of state.particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// TNT를 터트린다. 폭발 반경 안의 일반 블록은 즉시 제거, TNT는 큐에 넣어 연쇄 폭발한다.
function detonate(originBrick) {
  const queue = [originBrick];
  originBrick.active = false;
  let chainCount = 0;

  while (queue.length > 0) {
    const tnt = queue.shift();
    const cx = tnt.x + tnt.width / 2;
    const cy = tnt.y + tnt.height / 2;

    spawnExplosionEffect(cx, cy);
    state.score += TNT_BONUS;
    chainCount += 1;

    for (const brick of state.bricks) {
      if (!brick.active) continue;
      if (!isInBlastRadius(brick, cx, cy, EXPLOSION_RADIUS)) continue;

      if (brick.type === "tnt") {
        brick.active = false;
        queue.push(brick);
      } else {
        brick.active = false;
        state.score += 10;
      }
    }
  }

  if (chainCount >= 2) {
    state.score += chainCount * 15;
  }
}

// 원 모양 공과 사각형 벽돌이 충돌했는지 검사한다.
function circleIntersectsRect(circle, rect) {
  const nearestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const distanceX = circle.x - nearestX;
  const distanceY = circle.y - nearestY;

  return distanceX * distanceX + distanceY * distanceY <= circle.radius * circle.radius;
}

// 모든 벽돌을 깨면 다음 난이도 또는 최종 승리를 처리한다.
function clearLevel() {
  if (state.levelIndex < LEVELS.length - 1) {
    state.status = "level-clear";
    state.nextLevelIndex = state.levelIndex + 1;
    nextButton.hidden = false;
    updateHud(`${LEVELS[state.levelIndex].name} 클리어! 다음 난이도에 도전하세요`);
    draw();
    return;
  }

  state.status = "final-win";
  state.nextLevelIndex = null;
  nextButton.hidden = true;
  updateHud("어려움 단계 클리어! 최종 승리");
  draw();
}

// 공을 놓치거나 시간이 끝났을 때 게임을 종료한다.
function endGame(message) {
  state.status = "game-over";
  state.nextLevelIndex = null;
  nextButton.hidden = true;
  updateHud(message);
  draw();
}

// 점수판에 점수, 난이도, 시간, 상태를 표시한다.
function updateHud(statusMessage) {
  scoreText.textContent = String(state.score);
  levelText.textContent = LEVELS[state.levelIndex].name;
  timeText.textContent = String(Math.ceil(state.timeLeft));
  statusText.textContent = statusMessage;
}

// 캔버스 전체를 다시 그린다.
function draw() {
  drawBackground();
  drawBricks();
  drawPaddle();
  drawBall();
  drawEffects();
  drawCanvasMessage();
}

// 사용자가 선택한 배경색으로 캔버스 배경을 칠한다.
function drawBackground() {
  ctx.fillStyle = backgroundSelect.value;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(23, 32, 51, 0.12)";
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
}

// 아직 깨지지 않은 벽돌만 화면에 그린다. TNT 블록은 별도 함수로 그린다.
function drawBricks() {
  for (const brick of state.bricks) {
    if (!brick.active) {
      continue;
    }

    if (brick.type === "tnt") {
      drawTntBrick(brick);
      continue;
    }

    ctx.fillStyle = brick.color;
    roundRect(brick.x, brick.y, brick.width, brick.height, 6);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

// 마인크래프트 풍 TNT 블록을 픽셀아트 톤으로 그린다.
function drawTntBrick(brick) {
  const { x, y, width, height } = brick;

  ctx.fillStyle = "#c0392b";
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle = "#3a2418";
  ctx.fillRect(x, y, width, 4);
  ctx.fillRect(x, y + height - 4, width, 4);

  ctx.fillStyle = "#e74c3c";
  ctx.fillRect(x + 2, y + 6, width - 4, 2);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TNT", x + width / 2, y + height / 2 + 1);
}

// 아래쪽 패드를 그린다.
function drawPaddle() {
  ctx.fillStyle = "#111827";
  roundRect(state.paddleX, PADDLE.y, PADDLE.width, PADDLE.height, 8);
  ctx.fill();
}

// 사용자가 선택한 색상으로 공을 그린다.
function drawBall() {
  const ball = state.ball;
  ball.color = ballColorSelect.value;

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = ball.color;
  ctx.fill();
  ctx.closePath();
}

// 대기, 승리, 게임 종료 같은 안내 문구를 캔버스 위에 표시한다.
function drawCanvasMessage() {
  const messages = {
    ready: "설정 후 게임 시작을 누르세요",
    "level-clear": `${LEVELS[state.levelIndex].name} 클리어!`,
    "final-win": "최종 승리! 모든 난이도를 완료했습니다",
    "game-over": "게임 종료 - 다시 시작할 수 있습니다",
  };

  if (!messages[state.status]) {
    return;
  }

  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
  roundRect(155, 220, 470, 82, 18);
  ctx.fill();
  ctx.fillStyle = "#172033";
  ctx.font = "700 24px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(messages[state.status], canvas.width / 2, 270);
  ctx.restore();
}

// 모서리가 둥근 사각형을 그릴 때 사용하는 함수이다.
function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// 값이 최소값과 최대값 사이에 있도록 제한한다.
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// 마우스나 터치 위치에 맞게 패드를 좌우로 움직인다.
function movePaddle(clientX) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const x = (clientX - rect.left) * scaleX;
  state.paddleX = clamp(x - PADDLE.width / 2, 0, canvas.width - PADDLE.width);

  if (state.status !== "running") {
    draw();
  }
}

// 마우스를 움직이면 패드도 같이 움직인다.
canvas.addEventListener("mousemove", (event) => {
  movePaddle(event.clientX);
});

// 모바일 화면에서도 손가락으로 패드를 움직일 수 있게 한다.
canvas.addEventListener(
  "touchmove",
  (event) => {
    event.preventDefault();
    movePaddle(event.touches[0].clientX);
  },
  { passive: false }
);

// 설정을 바꾸면 대기 화면에도 바로 반영한다.
backgroundSelect.addEventListener("change", draw);
ballColorSelect.addEventListener("change", draw);

// 게임 시작 버튼을 눌렀을 때 선택한 난이도로 시작한다.
startButton.addEventListener("click", () => {
  startGame(Number(difficultySelect.value));
});

// 한 단계를 클리어한 뒤 다음 난이도를 시작한다.
nextButton.addEventListener("click", () => {
  if (state.nextLevelIndex !== null) {
    difficultySelect.value = String(state.nextLevelIndex);
    startGame(state.nextLevelIndex);
  }
});

// 처음 페이지가 열렸을 때 기본 화면을 그린다.
updateHud("대기 중");
draw();
