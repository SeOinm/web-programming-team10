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
    // 화면이 보이게 된 직후 캔버스를 한 번 다시 그려준다.
    if (typeof window.draw === "function") {
      window.draw();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 게임 화면 → 시작 화면
  function showStart() {
    gameScreen.hidden = true;
    startScreen.hidden = false;
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
