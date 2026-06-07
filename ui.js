// ============================================================
// UI 전용 스크립트
// 게임 화면 → 메뉴(뒤로가기)와 조작법/게임 규칙 팝업 토글만 담당한다.
// 메뉴 → 게임 화면 전환과 실제 게임 시작은 script.js가 전담한다.
// ============================================================

(function () {
  const startScreen = document.getElementById("startScreen");
  const gameScreen = document.getElementById("gameScreen");
  const backButton = document.getElementById("backButton");
  const howtoButton = document.getElementById("howtoButton");
  const howtoPanel = document.getElementById("howtoPanel");
  const rulesButton = document.getElementById("rulesButton");
  const rulesPanel = document.getElementById("rulesPanel");

  // 게임 화면 → 시작 화면
  // (시작 화면 → 게임 화면 전환과 실제 게임 시작은 script.js가 전담)
  function showStart() {
    if (typeof stopGameForMenu === "function") {
      stopGameForMenu();
    }

    gameScreen.hidden = true;
    startScreen.hidden = false;

    window.scrollTo({ top: 0, behavior: "smooth" });
  }
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
    togglePanel(howtoPanel, howtoButton, "조작법 닫기", "조작법", rulesPanel, rulesButton, "게임 규칙");
  });

  rulesButton.addEventListener("click", () => {
    togglePanel(rulesPanel, rulesButton, "게임 규칙 닫기", "게임 규칙", howtoPanel, howtoButton, "조작법");
  });

  // 패널 닫기 (닫기 버튼 · 어두운 배경 클릭 · ESC)
  function closePanel(panel, button, closedLabel) {
    panel.hidden = true;
    button.textContent = closedLabel;
  }

  function bindPanelClose(panel, button, closedLabel) {
    // 배경(오버레이) 직접 클릭 시 닫힘 — 안쪽 박스 클릭은 통과
    panel.addEventListener("click", (e) => {
      if (e.target === panel) closePanel(panel, button, closedLabel);
    });
    // 내부 닫기 버튼
    const closeBtn = panel.querySelector("[data-close-panel]");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => closePanel(panel, button, closedLabel));
    }
  }

  bindPanelClose(howtoPanel, howtoButton, "조작법");
  bindPanelClose(rulesPanel, rulesButton, "게임 규칙");

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!howtoPanel.hidden) closePanel(howtoPanel, howtoButton, "조작법");
    if (!rulesPanel.hidden) closePanel(rulesPanel, rulesButton, "게임 규칙");
  });
})();
