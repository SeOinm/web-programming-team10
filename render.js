// ============================================================
// render.js — 화면 출력 전부
// 캔버스 그리기(배경/블록/공/패드/메시지), HUD 갱신, 결과 모달, 최고점수 저장,
// HiDPI 해상도 보정(resizeCanvas)
// ============================================================

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
  resultMessage.textContent = createResultMessage(message);
  finalScoreText.textContent = String(state.score);
  bestScoreText.textContent = String(bestScore);
  resultModal.hidden = false;
  resultRestartButton.focus();
}

function hideResultModal() {
  resultModal.hidden = true;
}

function createResultMessage(message) {
  return message
    .replace(/\s*!?\s*게임 종료\s*$/u, "")
    .trim();
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

// ===== UI 영역  =====
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
  const shades = dark ? ["#2b2b33", "#202028", "#34343d"] : ["#6b6b73", "#5a5a61", "#7a7a82"];

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

// 픽셀 보석(다이아몬드 컷) 도트맵.
// 0=투명, 1=외곽선, 2=어두운 면, 3=기본 면, 4=밝은 면, 5=하이라이트
const GEM_SHAPE = [
  [0, 0, 1, 1, 1, 1, 0, 0],
  [0, 1, 5, 5, 4, 4, 1, 0],
  [1, 5, 5, 4, 4, 3, 2, 1],
  [1, 4, 4, 3, 3, 2, 2, 1],
  [1, 4, 3, 3, 2, 2, 2, 1],
  [0, 1, 3, 3, 2, 2, 1, 0],
  [0, 0, 1, 2, 2, 1, 0, 0],
  [0, 0, 0, 1, 1, 0, 0, 0],
];

// 기준 색을 흰색/검정 쪽으로 t(0~1)만큼 섞어 면별 음영을 만든다.
function shadeColor(hex, t, toWhite) {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  const target = toWhite ? 255 : 0;
  const mix = (c) => Math.round(c + (target - c) * t);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

// 선택한 색으로 입체감 있는 픽셀 보석을 그린다.
function drawBall() {
  const ball = state.ball;
  ball.color = ballColorSelect.value;

  // 도트맵 값 → 실제 색 (기준 색에서 자동 생성)
  const palette = {
    1: shadeColor(ball.color, 0.62, false), // 외곽선
    2: shadeColor(ball.color, 0.34, false), // 어두운 면
    3: ball.color, // 기본 면
    4: shadeColor(ball.color, 0.4, true), // 밝은 면
    5: shadeColor(ball.color, 0.78, true), // 하이라이트
  };

  const size = GEM_SHAPE.length;
  const px = (ball.radius * 2) / size; // 도트 한 칸 크기
  const originX = ball.x - ball.radius;
  const originY = ball.y - ball.radius;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const v = GEM_SHAPE[row][col];
      if (v === 0) continue;
      ctx.fillStyle = palette[v];
      // +0.6은 도트 사이 미세 틈(seam) 방지
      ctx.fillRect(originX + col * px, originY + row * px, px + 0.6, px + 0.6);
    }
  }
  ctx.restore();
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
