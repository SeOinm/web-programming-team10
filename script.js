const startScreen = document.getElementById("startScreen");
const gameScreen = document.getElementById("gameScreen");
const enterButton = document.getElementById("enterButton");
const howtoButton = document.getElementById("howtoButton");
const rulesButton = document.getElementById("rulesButton");
const howtoPanel = document.getElementById("howtoPanel");
const rulesPanel = document.getElementById("rulesPanel");
// 캔버스와 화면 요소들을 가져온다.
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// 게임 로직이 사용하는 "논리 좌표 공간" (디자인 기준 해상도).
// 공/패드/블록 좌표·충돌은 모두 이 공간(780x520)에서 계산한다.
// 실제 캔버스 백킹스토어는 devicePixelRatio에 맞춰 따로 키우고(ctx 변환으로 매핑),
// 덕분에 좌표는 그대로 두면서 텍스트/도형만 고해상도로 선명하게 렌더된다.
const VIEW = { width: 780, height: 520 };
const backgroundSelect = document.getElementById("backgroundSelect");
const ballColorSelect = document.getElementById("ballColorSelect");
const difficultySelect = document.getElementById("difficultySelect");
const startButton = document.getElementById("startButton");
const nextButton = document.getElementById("nextButton");
const scoreText = document.getElementById("scoreText");
const levelText = document.getElementById("levelText");
const healthText = document.getElementById("healthText");
const timeText = document.getElementById("timeText");
const statusText = document.getElementById("statusText");
const resultModal = document.getElementById("resultModal");
const resultTitle = document.getElementById("resultTitle");
const resultMessage = document.getElementById("resultMessage");
const finalScoreText = document.getElementById("finalScoreText");
const bestScoreText = document.getElementById("bestScoreText");
const resultRestartButton = document.getElementById("resultRestartButton");
const resultCloseButton = document.getElementById("resultCloseButton");

// 난이도별 공 속도와 제한 시간을 정한다.
const LEVELS = [
  { name: "쉬움", floor: 1, speed: 3.4, timeLimit: 180, tntChance: 0.08 },
  { name: "보통", floor: 2, speed: 4.5, timeLimit: 120, tntChance: 0.10 },
  { name: "어려움", floor: 3, speed: 5.7, timeLimit: 90, tntChance: 0.12 },
];
const SPEED_UP_FACTOR = 1.075; // 한 줄 완파 시 공 속도 7.5% 가속 (플레이감 보고 조정)
const MAX_SPEED = 11;          // 최고 속도 상한선
const TNT_BLAST_RADIUS = 2;    // TNT 폭발 반경 (1=3x3, 2=5x5)
const DIAMOND_CHANCE = 0.08;
const BEST_SCORE_KEY = "blockBreakerBestScore";
const MAX_LIVES = 3;
const BLOCK_TYPES = {
  dirt: { label: "흙", hp: 1, score: 10, color: "#8a5a37", damagedColor: "#6b4527", lightColor: "#a87349", darkColor: "#5f3d25", oreColor: "#6f462a", textColor: "#fff7ed" },
  stone: { label: "돌", hp: 2, score: 30, color: "#8d8d8d", damagedColor: "#6e6e6e", lightColor: "#aaaaaa", darkColor: "#5f5f5f", oreColor: "#747474", textColor: "#111827" },
  iron: { label: "철광석", hp: 3, score: 60, color: "#8d8d8d", damagedColor: "#6e6e6e", lightColor: "#a4a4a4", darkColor: "#5d5d5d", oreColor: "#d8c0a8", textColor: "#1f2937" },
  gold: { label: "금광석", hp: 4, score: 100, color: "#8d8d8d", damagedColor: "#6e6e6e", lightColor: "#a4a4a4", darkColor: "#5d5d5d", oreColor: "#f5c542", textColor: "#2b2018" },
  diamond: { label: "다이아", hp: 5, score: 200, color: "#8d8d8d", damagedColor: "#6e6e6e", lightColor: "#a7b5b8", darkColor: "#51666b", oreColor: "#5ad6e0", textColor: "#102a43" },
  tnt: { label: "TNT", hp: 1, score: 0, color: "#d33b2c", damagedColor: "#9f241d", lightColor: "#f06a5d", darkColor: "#8d1f17", oreColor: "#fff7ed", textColor: "#111827" },
};
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
  y: VIEW.height - 42,
};

// 브라우저 기본 오디오로 효과음을 만든다. 별도 음원 파일 없이 즉시 재생된다.
const Sound = (() => {
  let audioContext = null;

  function getContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }

    if (!audioContext) {
      audioContext = new AudioContextClass();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    return audioContext;
  }

  function playTone(frequency, duration, type = "square", gain = 0.05, delay = 0) {
    const context = getContext();
    if (!context) {
      return;
    }

    const startTime = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gainNode.gain.setValueAtTime(gain, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  }

  function playNoise(duration = 0.25, gain = 0.08) {
    const context = getContext();
    if (!context) {
      return;
    }

    const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }

    const source = context.createBufferSource();
    const gainNode = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    gainNode.gain.value = gain;

    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(context.destination);
    source.start();
    source.stop(context.currentTime + duration);
  }

  return {
    unlock() {
      getContext();
    },
    hit() {
      playTone(180, 0.06, "square", 0.035);
    },
    breakBlock() {
      playTone(520, 0.08, "triangle", 0.045);
      playTone(760, 0.06, "triangle", 0.025, 0.04);
    },
    bounce() {
      playTone(260, 0.035, "sine", 0.025);
    },
    rowClear() {
      playTone(440, 0.07, "triangle", 0.04);
      playTone(660, 0.08, "triangle", 0.04, 0.08);
    },
    explosion() {
      playNoise(0.32, 0.12);
      playTone(90, 0.2, "sawtooth", 0.07);
      playTone(55, 0.24, "square", 0.045, 0.04);
    },
    gameOver() {
      playTone(220, 0.12, "sawtooth", 0.045);
      playTone(140, 0.18, "sawtooth", 0.04, 0.12);
    },
    levelClear() {
      playTone(560, 0.08, "triangle", 0.045);
      playTone(720, 0.09, "triangle", 0.045, 0.08);
      playTone(920, 0.12, "triangle", 0.04, 0.17);
    },
  };
})();

// 게임 진행에 필요한 현재 상태를 저장한다.
const state = {
  status: "ready",
  levelIndex: 0,
  score: 0,
  lives: MAX_LIVES,
  timeLeft: LEVELS[0].timeLimit,
  lastTime: 0,
  nextLevelIndex: null,
  animationId: null,
  runId: 0,
  paddleX: (VIEW.width - PADDLE.width) / 2,
  ball: createBall(LEVELS[0].speed),
  bricks: createBricks(0),
  clearedRows: new Set(),
};

// 새 공을 만든다. 시작 위치는 패드 위쪽이다.
function createBall(speed) {
  return {
    x: VIEW.width / 2,
    y: PADDLE.y - 18,
    radius: 8,
    dx: speed,
    dy: -speed,
    color: ballColorSelect.value,
  };
}

// 화면 위쪽에 현재 층에 맞는 블록들을 여러 줄로 만든다.
function createBricks(levelIndex = 0) {
  const level = LEVELS[levelIndex];
  const bricks = [];

  for (let row = 0; row < BRICK.rows; row += 1) {
    for (let col = 0; col < BRICK.cols; col += 1) {
      const typeKey = pickBlockType(level);
      const brick = {
        x: BRICK.offsetLeft + col * (BRICK.width + BRICK.padding),
        y: BRICK.offsetTop + row * (BRICK.height + BRICK.padding),
        width: BRICK.width,
        height: BRICK.height,
        active: true,
        row: row,
        col: col,
      };
      applyBlockType(brick, typeKey);
      bricks.push(brick);
    }
  }

  ensureTntBlock(bricks);

  return bricks;
}

function applyBlockType(brick, typeKey) {
  const type = BLOCK_TYPES[typeKey];
  brick.type = typeKey;
  brick.label = type.label;
  brick.color = type.color;
  brick.baseColor = type.color;
  brick.damagedColor = type.damagedColor;
  brick.lightColor = type.lightColor;
  brick.darkColor = type.darkColor;
  brick.oreColor = type.oreColor;
  brick.textColor = type.textColor;
  brick.hp = type.hp;
  brick.maxHp = type.hp;
  brick.score = type.score;
}

function ensureTntBlock(bricks) {
  if (bricks.some((brick) => brick.type === "tnt")) {
    return;
  }

  const index = Math.floor(Math.random() * bricks.length);
  applyBlockType(bricks[index], "tnt");
}

function pickBlockType(level) {
  if (Math.random() < level.tntChance) {
    return "tnt";
  }

  const roll = Math.random();
  if (level.floor === 1) {
    return roll < 0.65 ? "dirt" : "stone";
  }

  if (level.floor === 2) {
    return roll < 0.55 ? "stone" : "iron";
  }

  if (roll < DIAMOND_CHANCE) {
    return "diamond";
  }

  return roll < 0.48 ? "iron" : "gold";
}

// 시작 버튼을 누르거나 다음 난이도를 시작할 때 새 게임을 준비한다.
// resetScore=true(기본): 타이틀/재시작 → 점수 0부터
// resetScore=false        : 다음 스테이지 진입 → 점수 누적(보존)
function startGame(levelIndex = Number(difficultySelect.value), resetScore = true) {
  const level = LEVELS[levelIndex];

  hideResultModal();

  if (state.animationId !== null) {
    cancelAnimationFrame(state.animationId);
  }

  state.status = "running";
  state.runId += 1;
  state.levelIndex = levelIndex;
  if (resetScore) {
    state.score = 0;
  }
  state.lives = MAX_LIVES;
  state.timeLeft = level.timeLimit;
  state.lastTime = 0;
  state.nextLevelIndex = null;
  state.paddleX = (VIEW.width - PADDLE.width) / 2;
  state.ball = createBall(level.speed);
  state.bricks = createBricks(levelIndex);
  state.clearedRows = new Set();

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

  if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= VIEW.width) {
    ball.dx *= -1;
    ball.x = clamp(ball.x, ball.radius, VIEW.width - ball.radius);
    Sound.bounce();
  }

  if (ball.y - ball.radius <= 0) {
    ball.dy *= -1;
    ball.y = ball.radius;
    Sound.bounce();
  }

  handlePaddleCollision();
  handleBrickCollision();

  if (ball.y - ball.radius > VIEW.height) {
    loseLife();
  }
}

function loseLife() {
  state.lives -= 1;

  if (state.lives <= 0) {
    state.lives = 0;
    endGame("체력을 모두 잃었습니다! 게임 종료");
    return;
  }

  const currentSpeed = Math.sqrt(state.ball.dx * state.ball.dx + state.ball.dy * state.ball.dy);
  const resetSpeed = clamp(currentSpeed / Math.SQRT2, LEVELS[state.levelIndex].speed, MAX_SPEED);
  state.paddleX = (VIEW.width - PADDLE.width) / 2;
  state.ball = createBall(resetSpeed);
  state.lastTime = 0;
  updateHud(`공을 놓쳤습니다! 남은 체력 ${state.lives}`);
  draw();
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
    Sound.bounce();
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
    damageBrick(brick);

    break;
  }
}

function damageBrick(brick) {
  if (brick.type === "tnt") {
    explodeTnt(brick);
    return;
  }

  brick.hp -= 1;

  if (brick.hp <= 0) {
    destroyBrick(brick);
    Sound.breakBlock();
    finishBrickChanges(new Set([brick.row]), "진행 중");
    return;
  }

  brick.color = brick.damagedColor;
  Sound.hit();
  updateHud("진행 중");
}

function explodeTnt(startBrick) {
  const queue = [startBrick];
  const explodedKeys = new Set();
  const affectedRows = new Set();
  let destroyedCount = 0;

  while (queue.length > 0) {
    const tnt = queue.shift();
    const key = `${tnt.row}:${tnt.col}`;
    if (!tnt.active || tnt.type !== "tnt" || explodedKeys.has(key)) {
      continue;
    }

    explodedKeys.add(key);
    destroyBrick(tnt);
    affectedRows.add(tnt.row);
    destroyedCount += 1;

    for (const nearby of getNearbyBricks(tnt)) {
      if (!nearby.active || nearby === tnt) {
        continue;
      }

      if (nearby.type === "tnt") {
        queue.push(nearby);
        continue;
      }

      destroyBrick(nearby);
      affectedRows.add(nearby.row);
      destroyedCount += 1;
    }
  }

  Sound.explosion();
  finishBrickChanges(affectedRows, `TNT 폭발! ${destroyedCount}개 파괴`);
}

function getNearbyBricks(centerBrick) {
  // 실제 존재하는 블록만 filter로 추리므로, 가장자리에서도 배열 범위 밖 접근이 없다.
  return state.bricks.filter((brick) => (
    Math.abs(brick.row - centerBrick.row) <= TNT_BLAST_RADIUS
    && Math.abs(brick.col - centerBrick.col) <= TNT_BLAST_RADIUS
  ));
}

function destroyBrick(brick) {
  if (!brick.active) {
    return;
  }

  brick.active = false;
  brick.hp = 0;
  state.score += brick.score;
}

function finishBrickChanges(affectedRows, statusMessage) {
  updateHud(statusMessage);

  for (const rowIndex of affectedRows) {
    checkRowClearAndSpeedUp(rowIndex);
  }

  if (state.bricks.every((item) => !item.active)) {
    clearLevel();
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
  Sound.levelClear();

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
  showResultModal("최종 승리!", "모든 난이도를 완료했습니다.");
}

// 공을 놓치거나 시간이 끝났을 때 게임을 종료한다.
function endGame(message) {
  state.status = "game-over";
  state.nextLevelIndex = null;
  nextButton.hidden = true;
  Sound.gameOver();
  updateHud(message);
  draw();
  showResultModal("게임 종료", message);
}

function getBestScore() {
  const savedScore = Number(localStorage.getItem(BEST_SCORE_KEY));
  return Number.isFinite(savedScore) ? savedScore : 0;
}

function saveBestScore(score) {
  const bestScore = Math.max(getBestScore(), score);
  localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  return bestScore;
}

function showResultModal(title, message) {
  const bestScore = saveBestScore(state.score);

  resultTitle.textContent = title;
  resultMessage.textContent = message;
  finalScoreText.textContent = String(state.score);
  bestScoreText.textContent = String(bestScore);
  resultModal.hidden = false;
  resultRestartButton.focus();
}

function hideResultModal() {
  resultModal.hidden = true;
}

// 점수판에 점수, 난이도, 시간, 상태를 표시한다.
function updateHud(statusMessage) {
  scoreText.textContent = String(state.score);
  levelText.textContent = LEVELS[state.levelIndex].name;
  updateHealthMeter();
  timeText.textContent = String(Math.ceil(state.timeLeft));
  statusText.textContent = statusMessage;
}

function updateHealthMeter() {
  const hearts = healthText.querySelectorAll(".pixel-heart");

  hearts.forEach((heart, index) => {
    const isActive = index < state.lives;
    heart.classList.toggle("is-active", isActive);
    heart.classList.toggle("is-lost", !isActive);
  });

  healthText.setAttribute("aria-label", `체력 ${state.lives}`);
}

// 캔버스 백킹스토어를 표시 크기 × devicePixelRatio로 맞춰 선명하게 만든다.
// 이후 ctx 변환으로 "논리 좌표(VIEW)"를 실제 픽셀 버퍼에 매핑하므로,
// 게임 로직의 좌표/충돌 계산(VIEW 기준)은 전혀 바뀌지 않는다.
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  // 게임화면이 숨겨져 있어 크기가 0이면 논리 크기로 폴백한다.
  const cssWidth = rect.width || VIEW.width;
  const cssHeight = rect.height || VIEW.height;

  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);

  // 논리 좌표(VIEW.width x VIEW.height) → 실제 픽셀 버퍼로 스케일 매핑.
  ctx.setTransform(canvas.width / VIEW.width, 0, 0, canvas.height / VIEW.height, 0, 0);
  ctx.imageSmoothingEnabled = false;

  draw();
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
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  // 2) 위에서 아래로 갈수록 살짝 어두워지는 동굴 그라데이션을 얹는다.
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, dark ? "rgba(0,0,0,0.35)" : "rgba(40,30,20,0.14)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  // 3) 16px 픽셀 격자를 그려 마인크래프트 블록 느낌을 준다.
  const cell = 26;
  ctx.strokeStyle = dark ? "rgba(255,255,255,0.05)" : "rgba(23,32,51,0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= VIEW.width; x += cell) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, VIEW.height);
    ctx.stroke();
  }
  for (let y = 0; y <= VIEW.height; y += cell) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(VIEW.width, y + 0.5);
    ctx.stroke();
  }

  // 4) 바닥 쪽에 기반암(베드락) 느낌의 픽셀 띠를 깐다.
  drawBedrock(dark);
}

// 바닥에 마인크래프트 기반암 같은 픽셀 블록 띠를 그린다.
function drawBedrock(dark) {
  const cell = 26;
  const rows = 2;
  const startY = VIEW.height - rows * cell;
  const shades = dark
    ? ["#2b2b33", "#202028", "#34343d"]
    : ["#6b6b73", "#5a5a61", "#7a7a82"];

  for (let row = 0; row < rows; row += 1) {
    for (let x = 0; x < VIEW.width; x += cell) {
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

    drawMinecraftBlock(brick);
  }
}

function drawMinecraftBlock(brick) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
  ctx.fillRect(brick.x + 3, brick.y + 3, brick.width, brick.height);

  ctx.fillStyle = brick.hp < brick.maxHp ? brick.damagedColor : brick.baseColor;
  ctx.fillRect(brick.x, brick.y, brick.width, brick.height);

  drawBlockFace(brick);

  if (brick.type === "tnt") {
    drawTntBlock(brick);
  } else {
    drawOrePixels(brick);
  }

  if (brick.hp < brick.maxHp) {
    drawBrickCracks(brick);
  }

  ctx.strokeStyle = "#1f1712";
  ctx.lineWidth = 2;
  ctx.strokeRect(brick.x + 1, brick.y + 1, brick.width - 2, brick.height - 2);
  ctx.restore();
}

function drawBlockFace(brick) {
  const pixel = 6;

  ctx.fillStyle = brick.lightColor;
  ctx.fillRect(brick.x, brick.y, brick.width, 4);
  ctx.fillRect(brick.x, brick.y, 4, brick.height);

  ctx.fillStyle = brick.darkColor;
  ctx.fillRect(brick.x, brick.y + brick.height - 4, brick.width, 4);
  ctx.fillRect(brick.x + brick.width - 4, brick.y, 4, brick.height);

  for (let y = brick.y + 5; y < brick.y + brick.height - 5; y += pixel) {
    for (let x = brick.x + 5; x < brick.x + brick.width - 5; x += pixel) {
      const seed = (x * 17 + y * 31 + brick.row * 11 + brick.col * 7) % 5;
      if (seed === 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
        ctx.fillRect(x, y, 4, 4);
      } else if (seed === 1) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.13)";
        ctx.fillRect(x, y, 4, 4);
      }
    }
  }
}

function drawOrePixels(brick) {
  if (brick.type === "dirt" || brick.type === "stone") {
    return;
  }

  const spots = [
    [14, 6, 10, 6],
    [36, 5, 8, 8],
    [57, 8, 9, 6],
    [24, 15, 9, 5],
    [48, 15, 12, 5],
  ];

  for (const [offsetX, offsetY, width, height] of spots) {
    ctx.fillStyle = brick.oreColor;
    ctx.fillRect(brick.x + offsetX, brick.y + offsetY, width, height);
    ctx.fillStyle = "rgba(255, 255, 255, 0.38)";
    ctx.fillRect(brick.x + offsetX, brick.y + offsetY, Math.max(3, width - 5), 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    ctx.fillRect(brick.x + offsetX + width - 3, brick.y + offsetY + 2, 3, Math.max(2, height - 2));
  }
}

function drawTntBlock(brick) {
  ctx.fillStyle = brick.lightColor;
  ctx.fillRect(brick.x + 5, brick.y + 4, brick.width - 10, 5);
  ctx.fillStyle = brick.darkColor;
  ctx.fillRect(brick.x + 5, brick.y + brick.height - 8, brick.width - 10, 4);
  ctx.fillStyle = "#fff7ed";
  ctx.fillRect(brick.x + 7, brick.y + 9, brick.width - 14, 7);
  ctx.fillStyle = "#111827";
  ctx.font = "700 10px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TNT", brick.x + brick.width / 2, brick.y + 13);
}

function drawBrickCracks(brick) {
  const damageRatio = 1 - brick.hp / brick.maxHp;
  ctx.save();
  ctx.strokeStyle = "rgba(31, 41, 55, 0.55)";
  ctx.lineWidth = 1 + damageRatio;
  ctx.beginPath();
  ctx.moveTo(brick.x + brick.width * 0.28, brick.y + 5);
  ctx.lineTo(brick.x + brick.width * 0.4, brick.y + brick.height * 0.5);
  ctx.lineTo(brick.x + brick.width * 0.34, brick.y + brick.height - 5);
  if (damageRatio > 0.45) {
    ctx.moveTo(brick.x + brick.width * 0.58, brick.y + 4);
    ctx.lineTo(brick.x + brick.width * 0.52, brick.y + brick.height * 0.46);
    ctx.lineTo(brick.x + brick.width * 0.68, brick.y + brick.height - 6);
  }
  ctx.stroke();
  ctx.restore();
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
  if (state.clearedRows.has(rowIndex)) {
    return;
  }

  const rowBricks = state.bricks.filter(item => item.row === rowIndex);
  if (rowBricks.some(item => item.active === true)) {
    return;
  }

  state.clearedRows.add(rowIndex);
  const dirX = Math.sign(state.ball.dx);
  const dirY = Math.sign(state.ball.dy);

  let newSpeedX = Math.abs(state.ball.dx) * SPEED_UP_FACTOR;
  let newSpeedY = Math.abs(state.ball.dy) * SPEED_UP_FACTOR;

  if (newSpeedX > MAX_SPEED) newSpeedX = MAX_SPEED;
  if (newSpeedY > MAX_SPEED) newSpeedY = MAX_SPEED;

  state.ball.dx = dirX * newSpeedX;
  state.ball.dy = dirY * newSpeedY;

  Sound.rowClear();
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
  ctx.fillText(messages[state.status], VIEW.width / 2, 270);
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
  const scaleX = VIEW.width / rect.width;
  const x = (clientX - rect.left) * scaleX;
  state.paddleX = clamp(x - PADDLE.width / 2, 0, VIEW.width - PADDLE.width);

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
  Sound.unlock();
  startGame(Number(difficultySelect.value));
});

// 한 단계를 클리어한 뒤 다음 난이도를 시작한다.
nextButton.addEventListener("click", () => {
  if (state.nextLevelIndex !== null) {
    Sound.unlock();
    difficultySelect.value = String(state.nextLevelIndex);
    startGame(state.nextLevelIndex, false); // 다음 스테이지: 점수 누적 유지
  }
});

resultRestartButton.addEventListener("click", () => {
  Sound.unlock();
  startGame(Number(difficultySelect.value));
});

resultCloseButton.addEventListener("click", hideResultModal);

resultModal.addEventListener("click", (event) => {
  if (event.target === resultModal) {
    hideResultModal();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !resultModal.hidden) {
    hideResultModal();
  }
});

// [수정] 브라우저 화면(DOM)이 완벽히 로드된 후 안전하게 초기화 작업을 진행한다.
window.addEventListener("DOMContentLoaded", () => {
  updateHud("대기 중");
  resizeCanvas();
});

// 창 크기가 바뀌면 해상도 보정을 다시 적용한다.
window.addEventListener("resize", resizeCanvas);
// ====== [추가] 메인 화면 인터랙션 및 화면 전환 리스너 ======
// 1) [게임 시작] 버튼을 누르면 첫 화면을 숨기고 진짜 게임 화면을 보여줍니다.
enterButton.addEventListener("click", () => {
  startScreen.hidden = true;   // 메인 메뉴 숨기기
  gameScreen.hidden = false;   // 인게임 제어판/캔버스 보여주기
  state.status = "ready";      // 게임 상태를 대기 중으로 설정
  
  // [보완] 공의 색상 선택 값을 현재 select 박스 값으로 다시 한 번 동기화
  state.ball.color = ballColorSelect.value;
  updateHud("대기 중");         // 상단 UI 스코어보드 텍스트 갱신

  // 게임화면이 막 보이게 됐으니, 실제 표시 크기 기준으로 해상도 보정 후 그린다.
  resizeCanvas();
});

// 2) 조작법 / 게임 규칙 패널 토글은 ui.js가 전담한다.
//    (여기서 또 핸들러를 달면 클릭이 두 번 토글돼 열렸다 즉시 닫혀버림 → 제거)
// ============================================================
