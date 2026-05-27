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
  { name: "쉬움", speed: 3.4, timeLimit: 180, rareChance: 0.10 },
  { name: "보통", speed: 4.5, timeLimit: 120, rareChance: 0.30 },
  { name: "어려움", speed: 5.7, timeLimit: 90, rareChance: 0.60 },
];
const SPEED_UP_FACTOR = 1.12; // 한 줄 완파 시 공 속도 12% 가속
const MAX_SPEED = 14;         // 최고 속도 상한선
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
bricks: createBricks(LEVELS[0].rareChance),
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
function createBricks(rareChance = 0.10) {
  const colors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"];
  const bricks = [];

  for (let row = 0; row < BRICK.rows; row += 1) {
    for (let col = 0; col < BRICK.cols; col += 1) {
      const isRare = Math.random() < rareChance;

      bricks.push({
        x: BRICK.offsetLeft + col * (BRICK.width + BRICK.padding),
        y: BRICK.offsetTop + row * (BRICK.height + BRICK.padding),
        width: BRICK.width,
        height: BRICK.height,
        color: isRare ? "#00f5ff" : colors[row % colors.length], 
        active: true,
        row: row,          
        isRare: isRare,    
        hp: isRare ? 2 : 1 
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
  state.bricks = createBricks(level.rareChance);

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
const currentSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
    ball.dx = hitPoint * (currentSpeed * 0.7);
    ball.dy = -Math.sqrt(Math.max(currentSpeed * currentSpeed - ball.dx * ball.dx * 0.35, currentSpeed));
    ball.y = PADDLE.y - ball.radius;
  }
}

// 공이 벽돌에 닿으면 벽돌을 없애고 점수를 올린다.
function handleBrickCollision() {
  const ball = state.ball;

  for (const brick of state.bricks) {
    if (!brick.active || !circleIntersectsRect(ball, brick)) {
      continue;
    }

    ball.dy *= -1;
    brick.hp -= 1;
    
    if (brick.hp === 0) {
      brick.active = false;
      state.score += brick.isRare ? 40 : 10; // 희귀 광석은 40점
      updateHud("진행 중");

      checkRowClearAndSpeedUp(brick.row); // 줄 완파 검사 함수 호출

      if (state.bricks.every((item) => !item.active)) {
        clearLevel();
      }
    } else {
      brick.color = "#00a8b5"; // 희귀 광석 1대 맞으면 금이 간 연출 (색상 변경)
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
  drawCanvasMessage();
}

// ===== UI 담당(문서인) 작업 영역 시작 =====
// 사용자가 선택한 배경색을 바탕으로 픽셀 동굴 느낌의 배경을 그린다.
// 게임 로직은 건드리지 않고 배경 시각효과만 담당한다.
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

  // 3) 16px 픽셀 격자를 그려 마인크래프트 블록 느낌을 준다.
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
      // 의사난수로 음영을 골라 울퉁불퉁한 돌 느낌을 낸다. (위치 기반이라 매 프레임 동일)
      const seed = (x * 13 + row * 7) % shades.length;
      ctx.fillStyle = shades[seed];
      ctx.fillRect(x, startY + row * cell, cell, cell);
    }
  }
}

// 배경색이 어두운 계열인지 판별한다. (격자/베드락 음영 결정용)
function isDarkColor(hex) {
  const m = hex.replace("#", "");
  if (m.length !== 6) return false;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  // 표준 밝기 공식
  return r * 0.299 + g * 0.587 + b * 0.114 < 120;
}
// ===== UI 담당(문서인) 작업 영역 끝 =====

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
  ball.color = ballColorSelect.value;

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = ball.color;
  ctx.fill();
  ctx.closePath();
}
function checkRowClearAndSpeedUp(rowIndex) {
  const rowBricks = state.bricks.filter(item => item.row === rowIndex);
  if (rowBricks.some(item => item.active === true)) {
    return;
  }

  const dirX = Math.sign(state.ball.dx);
  const dirY = Math.sign(state.ball.dy);

  let newSpeedX = Math.abs(state.ball.dx) * SPEED_UP_FACTOR;
  let newSpeedY = Math.abs(state.ball.dy) * SPEED_UP_FACTOR;

  if (newSpeedX > MAX_SPEED) newSpeedX = MAX_SPEED;
  if (newSpeedY > MAX_SPEED) newSpeedY = MAX_SPEED;

  state.ball.dx = dirX * newSpeedX;
  state.ball.dy = dirY * newSpeedY;

  statusText.textContent = "광맥 완파! 공 가속!";
  setTimeout(() => {
    if (state.status === "running") {
      statusText.textContent = "진행 중";
    }
  }, 1200);
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

// [수정] 브라우저 화면(DOM)이 완벽히 로드된 후 안전하게 초기화 작업을 진행한다.
window.addEventListener("DOMContentLoaded", () => {
  updateHud("대기 중");
  draw();
});
