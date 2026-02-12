const TOTAL_TO_WIN = 12;
const SKY_HEIGHT_PX = 175;
const BASE_SCALE_PX_PER_KM = 0.23;
const CHEAT_CODE = "idkfa";

const EARTH_SEGMENTS = [
  { name: "Crust", className: "crust", thicknessKm: 55 },
  { name: "Mantle", className: "mantle mantle-zone", thicknessKm: 2835 },
  { name: "Outer Core", className: "outer-core", thicknessKm: 2260 },
  { name: "Inner Core", className: "inner-core", thicknessKm: 1220 }
];

const STAGE_DEPTHS_KM = [
  55,
  763.75,
  1472.5,
  2181.25,
  2890,
  3455,
  4020,
  4585,
  5150,
  5760,
  6065,
  6370
];

const worldEl = document.getElementById("world");
const viewportEl = document.getElementById("viewport");
const drillEl = document.getElementById("drill");
const streakEl = document.getElementById("streakDisplay");
const layerEl = document.getElementById("layerDisplay");
const progressTrackEl = document.getElementById("progressTrack");
const loadingEl = document.getElementById("loading");
const quizEl = document.getElementById("quiz");
const questionTextEl = document.getElementById("questionText");
const feedbackEl = document.getElementById("feedback");
const restartBtn = document.getElementById("restartBtn");
const answerButtons = Array.from(document.querySelectorAll(".answer-btn"));

let segmentModel = [];
let totalDepthKm = 0;
let totalDepthPx = 0;
let worldHeightPx = 0;

let questions = [];
let questionPool = [];
let convectionArrows = [];
let convectionAnimationFrame = null;
let convectionStartTime = 0;
let cheatIndex = 0;
let cheatTimerId = null;

const state = {
  streak: 0,
  gameOver: false,
  locked: false,
  currentQuestion: null
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function startConvectionAnimation() {
  if (convectionAnimationFrame !== null) {
    return;
  }

  convectionAnimationFrame = requestAnimationFrame(animateConvectionArrows);
}

function animateConvectionArrows(timestamp) {
  if (!convectionStartTime) {
    convectionStartTime = timestamp;
  }

  const elapsedSeconds = (timestamp - convectionStartTime) / 1000;

  for (const arrow of convectionArrows) {
    const width = arrow.overlay.clientWidth;
    const height = arrow.overlay.clientHeight;

    if (!width || !height) {
      continue;
    }

    const cx = arrow.cxPct * width;
    const cy = arrow.cyPct * height;
    const rx = arrow.rxPct * width;
    const ry = arrow.ryPct * height;
    const theta = arrow.phaseOffset + elapsedSeconds * arrow.speed;

    const x = cx + rx * Math.cos(theta);
    const y = cy + ry * Math.sin(theta);
    const dx = -rx * Math.sin(theta);
    const dy = ry * Math.cos(theta);
    const rotationDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

    const depthRatio = clamp(y / height, 0, 1);
    const saturation = 72 + depthRatio * 24;
    const lightness = 27 + depthRatio * 30;
    const arrowColor = `hsl(4 ${saturation}% ${lightness}%)`;

    arrow.element.style.transform = `translate(${x - 10}px, ${y - 6}px) rotate(${rotationDeg}deg)`;
    arrow.element.style.setProperty("--arrow-color", arrowColor);
    arrow.element.style.opacity = `${0.5 + depthRatio * 0.5}`;
  }

  convectionAnimationFrame = requestAnimationFrame(animateConvectionArrows);
}

function addMantleConvection(layer, className) {
  const isUpperMantle = className.includes("upper-mantle");
  const overlay = document.createElement("div");
  overlay.className = `convection-overlay ${isUpperMantle ? "upper" : "deep"}`;
  layer.appendChild(overlay);

  const cellConfig = isUpperMantle
    ? [
        { cxPct: 0.32, cyPct: 0.56, rxPct: 0.22, ryPct: 0.36 },
        { cxPct: 0.72, cyPct: 0.56, rxPct: 0.22, ryPct: 0.36 }
      ]
    : [
        { cxPct: 0.32, cyPct: 0.53, rxPct: 0.24, ryPct: 0.38 },
        { cxPct: 0.68, cyPct: 0.53, rxPct: 0.24, ryPct: 0.38 }
      ];

  const arrowsPerCell = isUpperMantle ? 4 : 5;
  const speed = isUpperMantle ? 0.85 : 0.68;

  for (let cellIndex = 0; cellIndex < cellConfig.length; cellIndex += 1) {
    const cell = cellConfig[cellIndex];
    const track = document.createElement("div");
    track.className = "convection-track";
    track.style.left = `${(cell.cxPct - cell.rxPct) * 100}%`;
    track.style.top = `${(cell.cyPct - cell.ryPct) * 100}%`;
    track.style.width = `${cell.rxPct * 200}%`;
    track.style.height = `${cell.ryPct * 200}%`;
    overlay.appendChild(track);

    for (let i = 0; i < arrowsPerCell; i += 1) {
      const arrow = document.createElement("div");
      arrow.className = "convection-arrow";
      overlay.appendChild(arrow);

      convectionArrows.push({
        element: arrow,
        overlay,
        cxPct: cell.cxPct,
        cyPct: cell.cyPct,
        rxPct: cell.rxPct,
        ryPct: cell.ryPct,
        phaseOffset: Math.PI / 2 + (Math.PI * 2 * i) / arrowsPerCell + cellIndex * 0.35,
        speed
      });
    }
  }
}

function buildEarthModel() {
  segmentModel = [];
  totalDepthKm = 0;
  totalDepthPx = 0;

  let kmCursor = 0;
  let pxCursor = 0;

  for (const segment of EARTH_SEGMENTS) {
    const rawHeightPx = segment.thicknessKm * BASE_SCALE_PX_PER_KM;
    const heightPx = segment.name === "Crust" ? Math.max(12, rawHeightPx) : rawHeightPx;

    const record = {
      ...segment,
      startKm: kmCursor,
      endKm: kmCursor + segment.thicknessKm,
      startPx: pxCursor,
      endPx: pxCursor + heightPx,
      heightPx
    };

    segmentModel.push(record);

    kmCursor += segment.thicknessKm;
    pxCursor += heightPx;
  }

  totalDepthKm = kmCursor;
  totalDepthPx = pxCursor;
  worldHeightPx = SKY_HEIGHT_PX + totalDepthPx + 120;
}

function createLayer(top, height, className, label) {
  const layer = document.createElement("div");
  layer.className = `layer ${className}`;
  layer.style.top = `${top}px`;
  layer.style.height = `${height}px`;

  if (className.includes("mantle-zone")) {
    addMantleConvection(layer, className);
  }

  const layerLabel = document.createElement("span");
  layerLabel.className = "layer-label";
  layerLabel.textContent = label;
  layer.appendChild(layerLabel);

  worldEl.appendChild(layer);
}

function renderWorld() {
  worldEl.querySelectorAll(".layer").forEach((node) => node.remove());
  convectionArrows = [];

  createLayer(0, SKY_HEIGHT_PX, "sky", "Atmosphere");

  for (const segment of segmentModel) {
    createLayer(
      SKY_HEIGHT_PX + segment.startPx,
      segment.heightPx,
      segment.className,
      segment.name
    );
  }

  worldEl.style.height = `${worldHeightPx}px`;
  startConvectionAnimation();
}

function depthKmToPx(depthKm) {
  const safeDepth = clamp(depthKm, 0, totalDepthKm);

  for (const segment of segmentModel) {
    if (safeDepth <= segment.endKm) {
      const localRangeKm = segment.endKm - segment.startKm;
      const localDepthKm = safeDepth - segment.startKm;
      const ratio = localRangeKm === 0 ? 0 : localDepthKm / localRangeKm;
      return segment.startPx + ratio * (segment.endPx - segment.startPx);
    }
  }

  return totalDepthPx;
}

function getLayerNameAtDepth(depthKm) {
  const segment = segmentModel.find((item) => depthKm <= item.endKm + 0.0001);
  return segment ? segment.name : "Inner Core";
}

function updateProgressTrack() {
  const dots = Array.from(progressTrackEl.children);
  dots.forEach((dot, index) => {
    const stepNumber = index + 1;
    dot.classList.toggle("complete", stepNumber <= state.streak);
    dot.classList.toggle("active", !state.gameOver && stepNumber === state.streak + 1);
  });
}

function updateHud() {
  streakEl.textContent = `Streak: ${state.streak} / ${TOTAL_TO_WIN}`;

  if (state.streak === 0) {
    layerEl.textContent = "Current Layer: Surface";
  } else if (state.streak >= TOTAL_TO_WIN) {
    layerEl.textContent = "Current Layer: Center of Inner Core";
  } else {
    const stageDepth = STAGE_DEPTHS_KM[state.streak - 1];
    layerEl.textContent = `Current Layer: ${getLayerNameAtDepth(stageDepth)}`;
  }

  updateProgressTrack();
}

function setFeedback(message, type = "") {
  feedbackEl.textContent = message;
  feedbackEl.className = "feedback";
  if (type) {
    feedbackEl.classList.add(type);
  }
}

function moveDrill(animate = true) {
  const currentDepthKm = state.streak > 0 ? STAGE_DEPTHS_KM[state.streak - 1] : 0;
  const drillTop = SKY_HEIGHT_PX + depthKmToPx(currentDepthKm);

  if (!animate) {
    drillEl.style.transition = "none";
    worldEl.style.transition = "none";
  }

  drillEl.style.top = `${drillTop}px`;

  const cameraTarget = clamp(
    drillTop - viewportEl.clientHeight * 0.34,
    0,
    Math.max(0, worldHeightPx - viewportEl.clientHeight)
  );

  worldEl.style.transform = `translateY(${-cameraTarget}px)`;

  if (!animate) {
    requestAnimationFrame(() => {
      drillEl.style.transition = "";
      worldEl.style.transition = "";
    });
  }
}

function clearAnswerStates() {
  answerButtons.forEach((btn) => {
    btn.classList.remove("correct", "wrong");
  });
}

function setAnswersDisabled(disabled) {
  answerButtons.forEach((btn) => {
    btn.disabled = disabled;
  });
}

function resetCheatProgress() {
  cheatIndex = 0;
  if (cheatTimerId) {
    clearTimeout(cheatTimerId);
    cheatTimerId = null;
  }
}

function armCheatTimeout() {
  if (cheatTimerId) {
    clearTimeout(cheatTimerId);
  }
  cheatTimerId = setTimeout(() => {
    cheatIndex = 0;
    cheatTimerId = null;
  }, 1600);
}

function activateCheatSkip() {
  const targetStreak = Math.min(TOTAL_TO_WIN - 2, 10);

  if (state.gameOver) {
    state.gameOver = false;
    restartBtn.classList.add("hidden");
  }

  state.locked = false;
  state.streak = targetStreak;
  clearAnswerStates();
  setAnswersDisabled(false);
  updateHud();
  moveDrill(true);
  setFeedback("Cheat activated: jumped to question 11.", "good");
  nextQuestion();
}

function handleCheatKey(key) {
  if (key === CHEAT_CODE[cheatIndex]) {
    cheatIndex += 1;
    armCheatTimeout();

    if (cheatIndex === CHEAT_CODE.length) {
      resetCheatProgress();
      activateCheatSkip();
    }
    return true;
  }

  if (key === CHEAT_CODE[0]) {
    cheatIndex = 1;
    armCheatTimeout();
    return true;
  }

  if (cheatIndex > 0) {
    resetCheatProgress();
  }

  return false;
}

function refillQuestionPool() {
  questionPool = shuffle(questions);
}

function renderQuestion(question) {
  questionTextEl.textContent = question.question;
  for (const letter of ["a", "b", "c", "d"]) {
    const button = answerButtons.find((btn) => btn.dataset.letter === letter);
    button.querySelector(".answer-text").textContent = question.answers[letter];
  }
}

function nextQuestion() {
  if (questionPool.length === 0) {
    refillQuestionPool();
  }

  state.currentQuestion = questionPool.pop();
  renderQuestion(state.currentQuestion);
  clearAnswerStates();
  setAnswersDisabled(false);
  state.locked = false;
}

function onWin() {
  state.gameOver = true;
  state.locked = false;
  setFeedback("You reached the center of Earth. 12 in a row achieved!", "win");
  setAnswersDisabled(true);
  restartBtn.classList.remove("hidden");
  updateHud();
}

function onWrongAnswer(correctLetter) {
  state.gameOver = true;
  state.locked = false;
  const correctText = state.currentQuestion.answers[correctLetter];
  setFeedback(
    `Incorrect. Correct answer: ${correctLetter.toUpperCase()} - ${correctText}. Restart to try again.`,
    "bad"
  );
  restartBtn.classList.remove("hidden");
  setAnswersDisabled(true);
  updateHud();
}

function submitAnswer(letter) {
  if (state.gameOver || state.locked || !state.currentQuestion) {
    return;
  }

  state.locked = true;
  setAnswersDisabled(true);

  const chosenButton = answerButtons.find((btn) => btn.dataset.letter === letter);
  const correctLetter = state.currentQuestion.correct;
  const correctButton = answerButtons.find((btn) => btn.dataset.letter === correctLetter);

  if (letter === correctLetter) {
    chosenButton.classList.add("correct");
    state.streak += 1;
    setFeedback("Correct. The drill moves deeper.", "good");
    updateHud();
    moveDrill(true);

    if (state.streak >= TOTAL_TO_WIN) {
      setTimeout(onWin, 780);
    } else {
      setTimeout(() => {
        nextQuestion();
      }, 780);
    }
    return;
  }

  chosenButton.classList.add("wrong");
  correctButton.classList.add("correct");
  onWrongAnswer(correctLetter);
}

function restartGame() {
  state.streak = 0;
  state.gameOver = false;
  state.locked = false;
  state.currentQuestion = null;

  restartBtn.classList.add("hidden");
  setFeedback("");

  refillQuestionPool();
  updateHud();
  moveDrill(false);
  nextQuestion();
}

function buildProgressTrack() {
  progressTrackEl.innerHTML = "";
  for (let i = 0; i < TOTAL_TO_WIN; i += 1) {
    const dot = document.createElement("div");
    dot.className = "progress-dot";
    progressTrackEl.appendChild(dot);
  }
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const isEscapedQuote = inQuotes && line[i + 1] === '"';
      if (isEscapedQuote) {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function parseQuestionsCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  let startIndex = 0;
  if (lines[0].toLowerCase().startsWith("question,")) {
    startIndex = 1;
  }

  const parsed = [];

  for (let i = startIndex; i < lines.length; i += 1) {
    const rawCells = parseCsvLine(lines[i]);
    if (rawCells.length < 6) {
      continue;
    }

    const normalized =
      rawCells.length === 6
        ? rawCells
        : [rawCells.slice(0, rawCells.length - 5).join(","), ...rawCells.slice(rawCells.length - 5)];

    const [question, a, b, c, d, correctRaw] = normalized.map((item) => item.trim());
    const correct = correctRaw.toLowerCase();

    if (!question || !a || !b || !c || !d) {
      continue;
    }

    if (!["a", "b", "c", "d"].includes(correct)) {
      continue;
    }

    parsed.push({
      question,
      answers: { a, b, c, d },
      correct
    });
  }

  return parsed;
}

async function loadQuestions() {
  const response = await fetch("questions.csv", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load questions.csv (${response.status})`);
  }

  const csvText = await response.text();
  const parsed = parseQuestionsCsv(csvText);
  if (parsed.length < TOTAL_TO_WIN) {
    throw new Error(`Question bank has only ${parsed.length} valid questions. Need at least ${TOTAL_TO_WIN}.`);
  }

  return parsed;
}

function bindEvents() {
  answerButtons.forEach((button) => {
    button.addEventListener("click", () => {
      submitAnswer(button.dataset.letter);
    });
  });

  restartBtn.addEventListener("click", restartGame);

  window.addEventListener("keydown", (event) => {
    if (event.repeat) {
      return;
    }

    const key = event.key.toLowerCase();

    if (handleCheatKey(key)) {
      event.preventDefault();
      return;
    }

    if (["a", "b", "c", "d"].includes(key)) {
      event.preventDefault();
      submitAnswer(key);
    }

    if ((key === "enter" || key === "r") && state.gameOver) {
      event.preventDefault();
      restartGame();
    }
  });

  window.addEventListener("resize", () => {
    moveDrill(false);
  });
}

async function init() {
  buildEarthModel();
  renderWorld();
  buildProgressTrack();
  bindEvents();
  moveDrill(false);

  try {
    questions = await loadQuestions();
    loadingEl.classList.add("hidden");
    quizEl.classList.remove("hidden");
    restartGame();
  } catch (error) {
    loadingEl.textContent = `Error: ${error.message}`;
    setFeedback("Fix questions.csv and reload.", "bad");
  }
}

init();
