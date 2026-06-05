// ============================================================
// main.js — 입력과 이벤트 연결, 초기화
// 패드 이동(movePaddle), 마우스/터치/버튼/키보드 리스너,
// 최초 로드·창 크기 변경·게임화면 진입 시 초기화. 마지막에 로드된다.
// ============================================================

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
  { passive: false },
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

// 브라우저 화면(DOM)이 완벽히 로드된 후 안전하게 초기화 작업을 진행한다.
window.addEventListener("DOMContentLoaded", () => {
  updateHud("대기 중");
  resizeCanvas();
});

// 창 크기가 바뀌면 해상도 보정을 다시 적용한다.
window.addEventListener("resize", resizeCanvas);
// 시작 화면에서 게임 화면으로 진입한다.
enterButton.addEventListener("click", () => {
  startScreen.hidden = true;
  gameScreen.hidden = false;
  state.status = "ready";

  state.ball.color = ballColorSelect.value; // 선택한 공 색 동기화
  updateHud("대기 중");
  resizeCanvas(); // 화면이 보인 뒤 실제 크기로 보정 후 그린다
});
