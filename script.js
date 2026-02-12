const TOTAL_TO_WIN = 12;
const SKY_HEIGHT_PX = 175;
const BASE_SCALE_PX_PER_KM = 0.23;
const CONVECTION_ARROW_WIDTH = 40;
const CONVECTION_ARROW_HEIGHT = 24;
const BOTTOM_PADDING_PX = 120;
const CHEAT_CODE = "idkfa";

const EARTH_SEGMENTS = [
  { name: "Crust", className: "crust", thicknessKm: 110 },
  { name: "Mantle", className: "mantle mantle-zone", thicknessKm: 2780 },
  { name: "Outer Core", className: "outer-core", thicknessKm: 2260 },
  { name: "Inner Core", className: "inner-core", thicknessKm: 1220 }
];

const STAGE_DEPTHS_KM = [
  110,
  805,
  1500,
  2195,
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
const drillHoleEl = document.getElementById("drillHole");
const streakEl = document.getElementById("streakDisplay");
const layerEl = document.getElementById("layerDisplay");
const progressTrackEl = document.getElementById("progressTrack");
const loadingEl = document.getElementById("loading");
const quizEl = document.getElementById("quiz");
const questionTextEl = document.getElementById("questionText");
const feedbackEl = document.getElementById("feedback");
const restartBtn = document.getElementById("restartBtn");
const successOverlayEl = document.getElementById("successOverlay");
const fireworksLayerEl = document.getElementById("fireworksLayer");
const confettiLayerEl = document.getElementById("confettiLayer");
const playAgainBtn = document.getElementById("playAgainBtn");
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
let fireworksIntervalId = null;
let successHideTimerId = null;

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

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clearCelebrationEffects() {
  if (fireworksIntervalId !== null) {
    clearInterval(fireworksIntervalId);
    fireworksIntervalId = null;
  }

  if (fireworksLayerEl) {
    fireworksLayerEl.innerHTML = "";
  }

  if (confettiLayerEl) {
    confettiLayerEl.innerHTML = "";
  }
}

function spawnFirework(xPct = randomBetween(12, 88), yPct = randomBetween(16, 58)) {
  if (!fireworksLayerEl) {
    return;
  }

  const firework = document.createElement("div");
  firework.className = "firework";
  firework.style.left = `${xPct}%`;
  firework.style.top = `${yPct}%`;

  const hue = randomBetween(8, 52);
  const sparkCount = 14;
  let longestSpark = 0;

  for (let i = 0; i < sparkCount; i += 1) {
    const spark = document.createElement("span");
    spark.className = "firework-spark";
    spark.style.setProperty("--angle", `${(360 / sparkCount) * i}deg`);
    spark.style.setProperty("--spark-color", `hsl(${hue + randomBetween(-10, 36)} 96% 63%)`);
    const sparkDuration = randomBetween(880, 1320);
    spark.style.setProperty("--spark-duration", `${sparkDuration}ms`);
    spark.style.setProperty("--spark-distance", `${randomBetween(34, 58)}px`);
    firework.appendChild(spark);
    longestSpark = Math.max(longestSpark, sparkDuration);
  }

  const flash = document.createElement("span");
  flash.className = "firework-flash";
  flash.style.setProperty("--spark-color", `hsl(${hue + 14} 100% 66%)`);
  firework.appendChild(flash);

  fireworksLayerEl.appendChild(firework);

  setTimeout(() => {
    firework.remove();
  }, longestSpark + 120);
}

function createConfettiRain() {
  if (!confettiLayerEl) {
    return;
  }

  confettiLayerEl.innerHTML = "";
  const confettiColors = ["#ffd84e", "#ff6e4d", "#5de0ff", "#6ef0a8", "#d98bff", "#ffffff"];
  const pieceCount = 90;

  for (let i = 0; i < pieceCount; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${randomBetween(0, 100)}%`;
    piece.style.setProperty("--confetti-color", confettiColors[Math.floor(Math.random() * confettiColors.length)]);
    piece.style.setProperty("--fall-duration", `${randomBetween(2.6, 4.8)}s`);
    piece.style.setProperty("--fall-delay", `${randomBetween(0, 0.9)}s`);
    piece.style.setProperty("--confetti-drift", `${randomBetween(-90, 90)}px`);
    piece.style.setProperty("--confetti-spin", `${randomBetween(-560, 560)}deg`);
    confettiLayerEl.appendChild(piece);
  }
}

function showSuccessScreen() {
  if (!successOverlayEl) {
    return;
  }

  if (successHideTimerId !== null) {
    clearTimeout(successHideTimerId);
    successHideTimerId = null;
  }

  clearCelebrationEffects();
  createConfettiRain();

  for (let i = 0; i < 4; i += 1) {
    spawnFirework(randomBetween(18, 82), randomBetween(18, 54));
  }

  fireworksIntervalId = setInterval(() => {
    spawnFirework();
  }, 520);

  successOverlayEl.classList.remove("hidden");
  successOverlayEl.classList.remove("active");
  void successOverlayEl.offsetWidth;
  successOverlayEl.classList.add("active");
}

function hideSuccessScreen() {
  if (!successOverlayEl) {
    return;
  }

  if (
    successOverlayEl.classList.contains("hidden") &&
    !successOverlayEl.classList.contains("active")
  ) {
    clearCelebrationEffects();
    return;
  }

  if (successHideTimerId !== null) {
    clearTimeout(successHideTimerId);
    successHideTimerId = null;
  }

  successOverlayEl.classList.remove("active");
  clearCelebrationEffects();

  successHideTimerId = setTimeout(() => {
    if (!successOverlayEl.classList.contains("active")) {
      successOverlayEl.classList.add("hidden");
    }
    successHideTimerId = null;
  }, 340);
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

    arrow.element.style.transform = `translate(${x - CONVECTION_ARROW_WIDTH / 2}px, ${
      y - CONVECTION_ARROW_HEIGHT / 2
    }px) rotate(${rotationDeg}deg)`;
    arrow.element.style.setProperty("--arrow-color", arrowColor);
    arrow.element.style.opacity = `${0.5 + depthRatio * 0.5}`;
  }

  convectionAnimationFrame = requestAnimationFrame(animateConvectionArrows);
}

function addMantleConvection(topPx, heightPx, className) {
  const isUpperMantle = className.includes("upper-mantle");
  const overlay = document.createElement("div");
  overlay.className = `convection-overlay ${isUpperMantle ? "upper" : "deep"}`;
  overlay.style.top = `${topPx}px`;
  overlay.style.height = `${heightPx}px`;
  worldEl.appendChild(overlay);

  const cellConfig = isUpperMantle
    ? [
        { cxPct: 0.32, cyPct: 0.56, rxPct: 0.22, ryPct: 0.36 },
        { cxPct: 0.72, cyPct: 0.56, rxPct: 0.22, ryPct: 0.36 }
      ]
    : [{ cxPct: 0.5, cyPct: 0.53, rxPct: 0.42, ryPct: 0.38 }];

  const arrowsPerCell = isUpperMantle ? 4 : 6;
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
  worldHeightPx = SKY_HEIGHT_PX + totalDepthPx + BOTTOM_PADDING_PX;
}

function createLayerLabel(label, topPx) {
  const layerLabel = document.createElement("span");
  layerLabel.className = "layer-label";
  layerLabel.style.top = `${topPx}px`;
  layerLabel.textContent = label;
  worldEl.appendChild(layerLabel);
}

function createLayer(top, height, className, label, options = {}) {
  const layer = document.createElement("div");
  layer.className = `layer ${className}`;

  if (options.circleRadiusPx > 0) {
    const diameterPx = options.circleRadiusPx * 2;
    layer.classList.add("layer-circle");
    layer.style.width = `${diameterPx}px`;
    layer.style.height = `${diameterPx}px`;
    layer.style.left = "50%";
    layer.style.top = `${options.circleCenterYPx - options.circleRadiusPx}px`;
    layer.style.transform = "translateX(-50%)";
  } else {
    layer.style.top = `${top}px`;
    layer.style.height = `${height}px`;
  }

  if (options.showLabel !== false) {
    createLayerLabel(label, options.labelTopPx ?? top + 14);
  }

  worldEl.appendChild(layer);
}

function renderWorld() {
  worldEl
    .querySelectorAll(".layer, .layer-label, .convection-overlay")
    .forEach((node) => node.remove());
  convectionArrows = [];

  createLayerLabel("Atmosphere", 20);

  const earthSurfaceRadiusPx = Math.max(
    viewportEl.clientWidth * 3.2,
    totalDepthPx + 650
  );
  const earthCenterYPx = SKY_HEIGHT_PX + earthSurfaceRadiusPx;

  for (let i = 0; i < segmentModel.length; i += 1) {
    const segment = segmentModel[i];
    const boundaryY = SKY_HEIGHT_PX + segment.startPx;
    const labelOffsetPx = Math.max(18, Math.min(62, 18 + segment.startPx * 0.08));

    createLayer(
      0,
      0,
      segment.className,
      segment.name,
      {
        circleRadiusPx: earthSurfaceRadiusPx - segment.startPx,
        circleCenterYPx: earthCenterYPx,
        labelTopPx: boundaryY + labelOffsetPx
      }
    );

    if (segment.className.includes("mantle-zone")) {
      addMantleConvection(boundaryY, segment.heightPx, segment.className);
    }
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
  const drillDepthY = SKY_HEIGHT_PX + depthKmToPx(currentDepthKm);

  if (!animate) {
    drillEl.style.transition = "none";
    if (drillHoleEl) {
      drillHoleEl.style.transition = "none";
    }
    worldEl.style.transition = "none";
  }

  drillEl.style.top = `${drillDepthY}px`;

  if (drillHoleEl) {
    const holeStartY = SKY_HEIGHT_PX;
    const drillVisualTop = drillDepthY - drillEl.offsetHeight;
    const holeHeight = Math.max(0, drillVisualTop - holeStartY);
    drillHoleEl.style.top = `${holeStartY}px`;
    drillHoleEl.style.height = `${holeHeight}px`;
    drillHoleEl.style.opacity = holeHeight > 1 ? "1" : "0";
  }

  const cameraTarget = clamp(
    drillDepthY - viewportEl.clientHeight * 0.34,
    0,
    Math.max(0, worldHeightPx - viewportEl.clientHeight)
  );

  worldEl.style.transform = `translateY(${-cameraTarget}px)`;

  if (!animate) {
    requestAnimationFrame(() => {
      drillEl.style.transition = "";
      if (drillHoleEl) {
        drillHoleEl.style.transition = "";
      }
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
  hideSuccessScreen();

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
  const shuffledOptions = shuffle([
    { sourceLetter: "a", text: question.answers.a },
    { sourceLetter: "b", text: question.answers.b },
    { sourceLetter: "c", text: question.answers.c },
    { sourceLetter: "d", text: question.answers.d }
  ]);

  for (let i = 0; i < answerButtons.length; i += 1) {
    const button = answerButtons[i];
    const option = shuffledOptions[i];
    button.dataset.choiceLetter = option.sourceLetter;
    button.querySelector(".answer-text").textContent = option.text;
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
  restartBtn.classList.add("hidden");
  updateHud();
  showSuccessScreen();
}

function onWrongAnswer(correctLetter) {
  hideSuccessScreen();
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

  const chosenButton = answerButtons.find((btn) => btn.dataset.letter === letter);
  if (!chosenButton) {
    return;
  }

  state.locked = true;
  setAnswersDisabled(true);

  const correctLetter = state.currentQuestion.correct;
  const chosenChoiceLetter = chosenButton.dataset.choiceLetter;
  const correctButton = answerButtons.find((btn) => btn.dataset.choiceLetter === correctLetter);

  if (chosenChoiceLetter === correctLetter) {
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
  hideSuccessScreen();
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
  if (playAgainBtn) {
    playAgainBtn.addEventListener("click", restartGame);
  }

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
