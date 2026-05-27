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
  { name: "쉬움 (석탄 등급)", speed: 3.4, timeLimit: 180, rareChance: 0.10 },
  { name: "보통 (철 등급)", speed: 4.5, timeLimit: 120, rareChance: 0.15 },
  { name: "어려움 (다이아 등급)", speed: 5.7, timeLimit: 90, rareChance: 0.20 },
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
// 가속 알림 타이머 변수 추가
let accelerationTextTimer = null;
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
  ball: null, // 초기화 시점에 생성
  bricks: [],  // 초기화 시점에 생성
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
function handlePaddleCollision() {
  const ball = state.ball;
  
  if (ball.dy > 0 && 
      ball.x + ball.radius > state.paddleX && 
      ball.x - ball.radius < state.paddleX + PADDLE.width) {
      
    if (ball.y + ball.radius >= PADDLE.y && ball.y - ball.radius <= PADDLE.y + PADDLE.height) {
      ball.dy = -Math.abs(ball.dy);
      ball.y = PADDLE.y - ball.radius;
    }
  }
}
// 화면 위쪽에 벽돌들을 여러 줄로 만든다.
function createBricks() {
  const colors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"];
  const bricks = [];
  const currentLevel = LEVELS[state.levelIndex || 0]; // 현재 난이도 정보

  for (let row = 0; row < BRICK.rows; row += 1) {
    for (let col = 0; col < BRICK.cols; col += 1) {
      // 설정한 확률에 따라 희귀 광석(true) 결정
      const isRare = Math.random() < currentLevel.rareChance;

      bricks.push({
        row: row,
        x: BRICK.offsetLeft + col * (BRICK.width + BRICK.padding),
        y: BRICK.offsetTop + row * (BRICK.height + BRICK.padding),
        width: BRICK.width,
        height: BRICK.height,
        color: isRare ? "#5ad6e0" : colors[row % colors.length], 
        isRare: isRare, // 희귀 광석 여부 저장
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
// [수정] 가속 알림 타이머가 돌고 있을 때는 "진행 중"으로 덮어쓰지 않습니다.
if (!accelerationTextTimer) {
  updateHud("진행 중");
}
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

function handleBrickCollision() {
  const ball = state.ball;

  for (const brick of state.bricks) {
    if (!brick.active || !circleIntersectsRect(ball, brick)) {
      continue;
    }

    brick.active = false;
    
    // 희귀 광석은 50점, 일반은 10점
    state.score += brick.isRare ? 50 : 10;
    ball.dy *= -1;

    // --- [실시간 줄 계산 및 가속 로직] ---
    const rowStatus = Array(BRICK.rows).fill(false);
    state.bricks.forEach(b => {
      if (b.active) rowStatus[b.row] = true;
    });
    
    const clearedRows = rowStatus.filter(hasActive => !hasActive).length;
    
    // 줄 제거에 따른 배율 계산 (1줄=1.15배, 2줄=1.30배...)
    const speedMultiplier = 1 + (clearedRows * 0.15);
    const baseSpeed = LEVELS[state.levelIndex].speed;
    const newSpeed = baseSpeed * speedMultiplier;

    // 공의 속도 벡터 갱신
    const currentMagnitude = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
    ball.dx = (ball.dx / currentMagnitude) * newSpeed;
    ball.dy = (ball.dy / currentMagnitude) * newSpeed;

    // --- [실시간 가속 알림 텍스트 연동 - 1.5초 유지] ---
    if (clearedRows > 0) {
      const percent = Math.round(speedMultiplier * 100);

      if (accelerationTextTimer) clearTimeout(accelerationTextTimer);

      updateHud(`⚡ 가속! 공 속도 증가 (${percent}%)`);

      accelerationTextTimer = setTimeout(() => {
        accelerationTextTimer = null;
        updateHud("진행 중");
      }, 1500);

    } else {
      if (!accelerationTextTimer) {
        updateHud("진행 중");
      }
    }

    if (state.bricks.every((item) => !item.active)) {
      clearLevel();
    }

    break;
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
function updateHud(status) {
  document.getElementById("scoreText").textContent = state.score;
  document.getElementById("levelText").textContent = LEVELS[state.levelIndex].name;
  document.getElementById("timeText").textContent = Math.ceil(state.timeLeft);
  document.getElementById("statusText").textContent = status; 
}

// 캔버스 전체를 다시 그린다.
function draw() {
  drawBackground();
  drawBricks();
  drawPaddle();
  drawBall();
  drawCanvasMessage();
}

// 사용자가 선택한 배경색을 바탕으로 픽셀 동굴 느낌의 배경을 그린다.
function drawBackground() {
  const base = backgroundSelect.value;
  const dark = isDarkColor(base);

  // 1) 바탕을 칠한다.
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2) 위에서 아래로 갈수록 살짝 어두워지는 동굴 그라데이션을 얹는다.
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, dark ? "rgba(0,0,0,0.35)" : "rgba(40,30,20,0.14)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 3) 26px 픽셀 격자를 그려 마인크래프트 블록 느낌을 준다.
  const cell = 26;
  ctx.strokeStyle = dark ? "rgba(255,255,255,0.05)" : "rgba(23,32,51,0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += cell) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += cell) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(canvas.width, y + 0.5);
    ctx.stroke();
  }

  // 4) 바닥 쪽에 기반암(베드락) 느낌의 픽셀 띠를 깐다.
  drawBedrock(dark);
}

// 바닥에 마인크래프트 기반암 같은 픽셀 블록 띠를 그린다.
function drawBedrock(dark) {
  const cell = 26;
  const rows = 2;
  const startY = canvas.height - rows * cell;
  const shades = dark
    ? ["#2b2b33", "#202028", "#34343d"]
    : ["#6b6b73", "#5a5a61", "#7a7a82"];

  for (let row = 0; row < rows; row += 1) {
    for (let x = 0; x < canvas.width; x += cell) {
      const seed = (x * 13 + row * 7) % shades.length;
      ctx.fillStyle = shades[seed];
      ctx.fillRect(x, startY + row * cell, cell, cell);
    }
  }
}

// 배경색이 어두운 계열인지 판별한다.
function isDarkColor(hex) {
  const m = hex.replace("#", "");
  if (m.length !== 6) return false;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 < 120;
}

// 아직 깨지지 않은 벽돌만 화면에 그린다.
function drawBricks() {
  for (const brick of state.bricks) {
    if (!brick.active) {
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

// 아래쪽 패드를 그린다.
function drawPaddle() {
  ctx.fillStyle = "#111827";
  roundRect(state.paddleX, PADDLE.y, PADDLE.width, PADDLE.height, 8);
  ctx.fill();
}

// 사용자가 선택한 색상으로 공을 그린다.
function drawBall() {
  const ball = state.ball;
  if (!ball) return;
  ball.color = ballColorSelect.value;

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = ball.color;
  ctx.fill();
  ctx.closePath();
}

// 안내 문구를 캔버스 위에 표시한다.
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

// 패드를 좌우로 움직인다.
function movePaddle(clientX) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const x = (clientX - rect.left) * scaleX;
  state.paddleX = clamp(x - PADDLE.width / 2, 0, canvas.width - PADDLE.width);

  if (state.status !== "running") {
    draw();
  }
}

// 마우스 및 터치 이벤트 리스너 등록
canvas.addEventListener("mousemove", (event) => {
  movePaddle(event.clientX);
});

canvas.addEventListener("touchmove", (event) => {
  event.preventDefault();
  movePaddle(event.touches[0].clientX);
}, { passive: false });

backgroundSelect.addEventListener("change", draw);
ballColorSelect.addEventListener("change", draw);

startButton.addEventListener("click", () => {
  startGame(Number(difficultySelect.value));
});

nextButton.addEventListener("click", () => {
  if (state.nextLevelIndex !== null) {
    difficultySelect.value = String(state.nextLevelIndex);
    startGame(state.nextLevelIndex);
  }
});

// 초기화 실행
window.addEventListener("DOMContentLoaded", () => {
  state.ball = createBall(LEVELS[0].speed);
  state.bricks = createBricks();
  updateHud("대기 중");
  window.draw = draw; // ui.js에서 호출 가능하도록 연동
  draw();
});
