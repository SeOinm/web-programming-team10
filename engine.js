// ============================================================
// engine.js — 게임 상태(state)와 핵심 로직
// 블록 생성, 게임 흐름(시작/루프/종료), 공·패드·블록 충돌, TNT 폭발, 줄완파 가속
// 그리기(render.js)와 HUD 함수를 런타임에 호출한다.
// ============================================================

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
// resetScore=false: 다음 스테이지 진입 → 점수 누적(보존)
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

function stopGameForMenu() {
  state.runId += 1;
  state.status = "ready";
  state.nextLevelIndex = null;

  if (state.animationId !== null) {
    cancelAnimationFrame(state.animationId);
    state.animationId = null;
  }

  nextButton.hidden = true;
  hideResultModal();
  updateHud("대기 중");
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
    const currentSpeed = Math.hypot(ball.dx, ball.dy);
    // 받은 위치로 각도만 바꾸고 속도 크기는 그대로 유지한다(dx²+dy² = currentSpeed²).
    ball.dx = clamp(hitPoint, -1, 1) * currentSpeed * 0.7; // 0.7 = 가장자리 최대 꺾임
    ball.dy = -Math.sqrt(currentSpeed * currentSpeed - ball.dx * ball.dx);
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

  brick.hp -= ballDamageFor(state.ball.color); // 공(광물)별 채굴력만큼 깎는다

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
  let damagedCount = 0;

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

      affectedRows.add(nearby.row);
      if (applyTntBlastDamage(nearby)) {
        destroyedCount += 1;
      } else {
        damagedCount += 1;
      }
    }
  }

  Sound.explosion();
  const damageMessage = damagedCount > 0 ? ` / ${damagedCount}개 손상` : "";
  finishBrickChanges(affectedRows, `TNT 폭발! ${destroyedCount}개 파괴${damageMessage}`);
}

function applyTntBlastDamage(brick) {
  const TNT_DAMAGE = 2;
  brick.hp -= TNT_DAMAGE;

  if (brick.hp <= 0) {
    destroyBrick(brick);
    return true;
  }

  brick.color = brick.damagedColor;
  return false;
}

function getNearbyBricks(centerBrick) {
  // 실제 존재하는 블록만 filter로 추리므로, 가장자리에서도 배열 범위 밖 접근이 없다.
  return state.bricks.filter(
    (brick) => Math.abs(brick.row - centerBrick.row) <= TNT_BLAST_RADIUS && Math.abs(brick.col - centerBrick.col) <= TNT_BLAST_RADIUS,
  );
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

function checkRowClearAndSpeedUp(rowIndex) {
  if (state.clearedRows.has(rowIndex)) {
    return;
  }

  const rowBricks = state.bricks.filter((item) => item.row === rowIndex);
  if (rowBricks.some((item) => item.active === true)) {
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
