// ============================================================
// config.js — DOM 참조, 논리 좌표(VIEW), 상수, 효과음(Sound), 공용 유틸
// 가장 먼저 로드되어 다른 파일들이 쓰는 전역 값을 정의한다.
// ============================================================

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
  { name: "쉬움", floor: 1, speed: 3.4, timeLimit: 180 },
  { name: "보통", floor: 2, speed: 4.5, timeLimit: 120 },
  { name: "어려움", floor: 3, speed: 5.7, timeLimit: 90 },
];
const SPEED_UP_FACTOR = 1.04; // 한 줄 완파 시 공 속도 4% 가속
const MAX_SPEED = 9; // 최고 속도 상한선
const TNT_BLAST_RADIUS = 2; // TNT 폭발 반경 (1=3x3, 2=5x5)
const TNT_COUNT = 5; // 한 판에 배치할 TNT 개수
const DIAMOND_CHANCE = 0.08;
const BEST_SCORE_KEY = "blockBreakerBestScore";
const MAX_LIVES = 3;
const BLOCK_TYPES = {
  dirt: {
    label: "흙",
    hp: 1,
    score: 10,
    color: "#8a5a37",
    damagedColor: "#6b4527",
    lightColor: "#a87349",
    darkColor: "#5f3d25",
    oreColor: "#6f462a",
    textColor: "#fff7ed",
  },
  stone: {
    label: "돌",
    hp: 2,
    score: 30,
    color: "#8d8d8d",
    damagedColor: "#6e6e6e",
    lightColor: "#aaaaaa",
    darkColor: "#5f5f5f",
    oreColor: "#747474",
    textColor: "#111827",
  },
  iron: {
    label: "철광석",
    hp: 3,
    score: 60,
    color: "#8d8d8d",
    damagedColor: "#6e6e6e",
    lightColor: "#a4a4a4",
    darkColor: "#5d5d5d",
    oreColor: "#d8c0a8",
    textColor: "#1f2937",
  },
  gold: {
    label: "금광석",
    hp: 4,
    score: 100,
    color: "#8d8d8d",
    damagedColor: "#6e6e6e",
    lightColor: "#a4a4a4",
    darkColor: "#5d5d5d",
    oreColor: "#f5c542",
    textColor: "#2b2018",
  },
  diamond: {
    label: "다이아",
    hp: 5,
    score: 200,
    color: "#8d8d8d",
    damagedColor: "#6e6e6e",
    lightColor: "#a7b5b8",
    darkColor: "#51666b",
    oreColor: "#5ad6e0",
    textColor: "#102a43",
  },
  tnt: {
    label: "TNT",
    hp: 1,
    score: 0,
    color: "#d33b2c",
    damagedColor: "#9f241d",
    lightColor: "#f06a5d",
    darkColor: "#8d1f17",
    oreColor: "#fff7ed",
    textColor: "#111827",
  },
};
// 공(광물)별 채굴력 — 한 번 칠 때 깎는 블록 내구도(hp). 색(select 값)으로 식별한다.
// 레드스톤 < 골드 < 에메랄드 < 다이아 순으로 강하다.
const BALL_TYPES = {
  "#e63946": { label: "레드스톤", damage: 1 },
  "#ffba08": { label: "골드", damage: 2 },
  "#70e000": { label: "에메랄드", damage: 3 },
  "#48cae4": { label: "다이아", damage: 4 },
};

// 선택한 색의 채굴력을 돌려준다(미등록 색은 1).
function ballDamageFor(color) {
  return BALL_TYPES[color] ? BALL_TYPES[color].damage : 1;
}

// 벽돌의 줄 수, 크기, 간격을 정한다.
const BRICK = {
  rows: 6,
  cols: 8,
  count: 40,
  minPerRow: 4,
  width: 78,
  height: 22,
  padding: 12,
  offsetTop: 64,
  offsetLeft: 36,
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

// 값이 최소값과 최대값 사이에 있도록 제한한다.
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
