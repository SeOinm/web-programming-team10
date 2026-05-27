// ============================================================
// UI 전용 스크립트 (문서인 담당)
// 시작 화면 ↔ 게임 화면 전환과 조작법 패널 토글만 담당한다.
// 게임 로직(script.js)과는 완전히 분리되어 있어 충돌 없이 합쳐진다.
// ============================================================

(function () {
  const startScreen = document.getElementById("startScreen");
  const gameScreen = document.getElementById("gameScreen");
  const enterButton = document.getElementById("enterButton");
  const backButton = document.getElementById("backButton");
  const howtoButton = document.getElementById("howtoButton");
  const howtoPanel = document.getElementById("howtoPanel");
  const rulesButton = document.getElementById("rulesButton");
  const rulesPanel = document.getElementById("rulesPanel");

  // 시작 화면 → 게임 화면
function showGame() {
    startScreen.hidden = true;
    gameScreen.hidden = false;
    
    // [보완] 화면이 바뀔 때 기존에 돌고 있던 게임을 대기 상태(ready)로 깔끔하게 셋팅해 줌
    if (typeof window.updateHud === "function") {
      window.updateHud("대기 중");
    }
    if (typeof window.draw === "function") {
      window.draw();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 게임 화면 → 시작 화면
function showStart() {
    gameScreen.hidden = true;
    startScreen.hidden = false;
    
    // [보완] 메인 메뉴로 나가면 게임 루프와 타이머를 즉시 정지시킴
    if (window.state) {
      window.state.status = "ready";
      if (window.state.animationId !== null) {
        cancelAnimationFrame(window.state.animationId);
        window.state.animationId = null;
      }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  enterButton.addEventListener("click", showGame);
  backButton.addEventListener("click", showStart);

  // 두 패널은 동시에 열리지 않는다 (한쪽 열면 다른 쪽 닫힘)
  function togglePanel(targetPanel, targetButton, openLabel, closedLabel, otherPanel, otherButton, otherClosedLabel) {
    const willOpen = targetPanel.hidden;
    targetPanel.hidden = !willOpen;
    targetButton.textContent = willOpen ? openLabel : closedLabel;
    if (willOpen) {
      otherPanel.hidden = true;
      otherButton.textContent = otherClosedLabel;
    }
  }

  howtoButton.addEventListener("click", () => {
    togglePanel(
      howtoPanel, howtoButton, "조작법 닫기", "조작법",
      rulesPanel, rulesButton, "게임 규칙"
    );
  });

  rulesButton.addEventListener("click", () => {
    togglePanel(
      rulesPanel, rulesButton, "게임 규칙 닫기", "게임 규칙",
      howtoPanel, howtoButton, "조작법"
    );
  });
})();
