const columns = [
  { key: "boundaryType", label: "Boundary Type" },
  { key: "image", label: "Image" },
  { key: "movement", label: "Movement" },
  { key: "features", label: "Features" },
  { key: "examples", label: "Examples" },
];

const boundarySets = [
  {
    id: "continental-continental",
    label: "Converging (Continental-Continental)",
    boundaryType: "Converging",
    image: "images/continental-continental-convergence.png",
    movement: "Two continental plates move toward each other",
    features:
      "When two continents meet head-on, the crust tends to buckle and be pushed upward or sideways.",
    examples: "Himalayan mountains",
  },
  {
    id: "oceanic-oceanic",
    label: "Converging (Oceanic-Oceanic)",
    boundaryType: "Converging",
    image: "images/oceanic-oceanic-convergence.png",
    movement: "Oceanic and oceanic plates move toward each other",
    features:
      "When two oceanic plates converge one is usually subducted under the other and in the process a deep oceanic trench is formed. Oceanic-oceanic plate convergence also results in the formation of undersea volcanoes.",
    examples: "Islands of Japan, Caribbean, Indonesia",
  },
  {
    id: "oceanic-continental",
    label: "Converging (Oceanic-Continental)",
    boundaryType: "Converging",
    image: "images/oceanic-continental-convergence.png",
    movement: "Oceanic and continental plates move toward each other",
    features:
      "When an oceanic plate pushes into and subducts under a continental plate, the overriding continental plate is lifted up and a mountain range is created.",
    examples: "Andes mountains",
  },
  {
    id: "transform",
    label: "Transform",
    boundaryType: "Transform",
    image: "images/transform.png",
    movement: "Plates slide against each other",
    features:
      "These do not make mountains or volcanoes but do produce lots of earthquakes.",
    examples: "Los Angeles close to San Francisco",
  },
  {
    id: "divergent",
    label: "Divergent",
    boundaryType: "Divergent",
    image: "images/divergence.png",
    movement: "Plates move away from each other",
    features:
      "Plates move apart and the crust expands. When two pieces of crust move away from each other, molten rock rises into the opening.",
    examples:
      "Mid-oceanic ridges or rift valleys, such as Mt. Kilimanjaro, Dead Sea, and the Sea of Galilee.",
  },
];

const allCards = boundarySets.flatMap((set) =>
  columns.map((column) => ({
    id: `${set.id}:${column.key}`,
    rowId: set.id,
    rowLabel: set.label,
    boundaryType: set.boundaryType,
    column: column.key,
    columnLabel: column.label,
    value: set[column.key],
    type: column.key === "image" ? "image" : "text",
  }))
);

const rowsNeededByType = boundarySets.reduce((acc, set) => {
  acc[set.boundaryType] = (acc[set.boundaryType] ?? 0) + 1;
  return acc;
}, {});

const tableBody = document.getElementById("table-body");
const currentCardHost = document.getElementById("current-card");
const hint = document.getElementById("card-hint");
const progressCount = document.getElementById("progress-count");
const toast = document.getElementById("toast");
const finalOverlay = document.getElementById("final-overlay");
const confettiLayer = document.getElementById("confetti-layer");
const restartBtn = document.getElementById("restart-btn");
const playAgainBtn = document.getElementById("play-again-btn");

const state = {
  deck: [],
  rows: [],
  currentCard: null,
  placed: 0,
  animating: false,
};

let toastTimer = null;

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function setupRows() {
  state.rows = Array.from({ length: boundarySets.length }, () => ({
    assignedBoundaryType: null,
    cells: Object.fromEntries(columns.map((col) => [col.key, null])),
    complete: false,
  }));
}

function buildTable() {
  tableBody.replaceChildren();

  for (let rowIndex = 0; rowIndex < boundarySets.length; rowIndex += 1) {
    const row = document.createElement("tr");
    row.className = "match-row";
    row.dataset.row = String(rowIndex);

    for (const column of columns) {
      const td = document.createElement("td");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "drop-cell is-empty";
      button.dataset.row = String(rowIndex);
      button.dataset.col = column.key;
      button.setAttribute(
        "aria-label",
        `Row ${rowIndex + 1}, ${column.label}. Place card here.`
      );
      button.addEventListener("click", onCellClick);
      td.append(button);
      row.append(td);
    }

    tableBody.append(row);
  }
}

function resetGame() {
  state.deck = shuffle(allCards);
  setupRows();
  state.currentCard = state.deck.shift() ?? null;
  state.placed = 0;
  state.animating = false;
  finalOverlay.hidden = true;
  confettiLayer.replaceChildren();

  buildTable();
  renderCurrentCard();
  updateProgress();
  showToast("New game started", "success");
}

function renderCurrentCard() {
  currentCardHost.replaceChildren();

  if (!state.currentCard) {
    const done = document.createElement("p");
    done.className = "card-text";
    done.textContent = "All cards placed.";
    currentCardHost.append(done);
    hint.textContent = "Great work. The table is complete.";
    return;
  }

  const face = createCardFace(state.currentCard);
  currentCardHost.append(face);
  hint.textContent = `Select a cell in the ${state.currentCard.columnLabel} column.`;
}

function createCardFace(card) {
  const face = document.createElement("article");
  face.className = "card-face";

  const label = document.createElement("p");
  label.className = "card-column";
  label.textContent = card.columnLabel;

  face.append(label);

  if (card.type === "image") {
    const img = document.createElement("img");
    img.className = "card-image";
    img.src = card.value;
    img.alt = `${card.rowLabel} sketch`;
    face.append(img);
  } else {
    const text = document.createElement("p");
    text.className = "card-text";
    text.textContent = card.value;
    face.append(text);
  }

  return face;
}

function onCellClick(event) {
  if (state.animating || !state.currentCard) {
    return;
  }

  const cell = event.currentTarget;
  const rowIndex = Number(cell.dataset.row);
  const columnKey = cell.dataset.col;
  const card = state.currentCard;

  const validation = validatePlacement(card, rowIndex, columnKey, cell);
  if (!validation.valid) {
    flashConflict(validation.conflicts);
    showToast(validation.reason, "error");
    return;
  }

  placeCard(card, rowIndex, columnKey, cell);
}

function validatePlacement(card, rowIndex, columnKey, targetCell) {
  const rowState = state.rows[rowIndex];
  const conflicts = new Set([targetCell]);

  if (rowState.cells[columnKey]) {
    return {
      valid: false,
      reason: "That cell is already filled.",
      conflicts,
    };
  }

  if (columnKey !== card.column) {
    const expectedCell = getCell(rowIndex, card.column);
    if (expectedCell) {
      conflicts.add(expectedCell);
    }

    return {
      valid: false,
      reason: `This card belongs in the ${card.columnLabel} column.`,
      conflicts,
    };
  }

  if (
    rowState.assignedBoundaryType &&
    rowState.assignedBoundaryType !== card.boundaryType
  ) {
    getFilledCellsForRow(rowIndex).forEach((cell) => conflicts.add(cell));

    return {
      valid: false,
      reason: "That row already contains a different boundary type.",
      conflicts,
    };
  }

  if (!rowState.assignedBoundaryType) {
    const usedRowsForType = state.rows.filter(
      (row) => row.assignedBoundaryType === card.boundaryType
    ).length;
    const maxRowsForType = rowsNeededByType[card.boundaryType] ?? 0;

    if (usedRowsForType >= maxRowsForType) {
      return {
        valid: false,
        reason: "This belongs somewhere else.",
        conflicts,
      };
    }
  }

  return {
    valid: true,
    conflicts,
  };
}

function placeCard(card, rowIndex, columnKey, cell) {
  state.animating = true;
  animateCardToCell(cell, () => {
    const rowState = state.rows[rowIndex];

    if (!rowState.assignedBoundaryType) {
      rowState.assignedBoundaryType = card.boundaryType;
    }

    rowState.cells[columnKey] = card;
    state.placed += 1;
    renderCardInCell(cell, card);

    if (!rowState.complete && isRowComplete(rowState)) {
      rowState.complete = true;
      const rowEl = tableBody.querySelector(`tr[data-row='${rowIndex}']`);
      rowEl?.classList.add("row-complete");
      showToast(`Row complete: ${rowState.assignedBoundaryType}`, "success");
    }

    state.currentCard = state.deck.shift() ?? null;
    renderCurrentCard();
    updateProgress();

    state.animating = false;

    if (state.placed === allCards.length) {
      finishGame();
    }
  });
}

function animateCardToCell(targetCell, onDone) {
  const source = currentCardHost.querySelector(".card-face");

  if (!source) {
    onDone();
    return;
  }

  const sourceRect = source.getBoundingClientRect();
  const targetRect = targetCell.getBoundingClientRect();
  const flying = source.cloneNode(true);
  flying.classList.add("flying-card");

  flying.style.left = `${sourceRect.left}px`;
  flying.style.top = `${sourceRect.top}px`;
  flying.style.width = `${sourceRect.width}px`;
  flying.style.height = `${sourceRect.height}px`;

  document.body.append(flying);

  const scaleX = targetRect.width / sourceRect.width;
  const scaleY = targetRect.height / sourceRect.height;
  const dx = targetRect.left - sourceRect.left;
  const dy = targetRect.top - sourceRect.top;

  requestAnimationFrame(() => {
    flying.style.transform = `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`;
    flying.style.opacity = "0.8";
  });

  let finished = false;
  const fallbackTimer = window.setTimeout(() => {
    finish();
  }, 500);

  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;
    window.clearTimeout(fallbackTimer);
    flying.removeEventListener("transitionend", finish);
    flying.remove();
    onDone();
  };

  flying.addEventListener("transitionend", finish);
}

function renderCardInCell(cell, card) {
  cell.classList.remove("is-empty");
  cell.classList.add("filled");
  cell.replaceChildren(createCellContent(card));
}

function createCellContent(card) {
  const wrap = document.createElement("div");
  wrap.className = "cell-content";

  if (card.type === "image") {
    const img = document.createElement("img");
    img.src = card.value;
    img.alt = `${card.rowLabel} sketch`;
    wrap.append(img);
  } else {
    const text = document.createElement("p");
    text.textContent = card.value;
    wrap.append(text);
  }

  return wrap;
}

function getCell(rowIndex, columnKey) {
  return tableBody.querySelector(
    `button.drop-cell[data-row='${rowIndex}'][data-col='${columnKey}']`
  );
}

function getFilledCellsForRow(rowIndex) {
  return Array.from(
    tableBody.querySelectorAll(`button.drop-cell[data-row='${rowIndex}']`)
  ).filter((cell) => cell.classList.contains("filled"));
}

function isRowComplete(rowState) {
  return columns.every((column) => Boolean(rowState.cells[column.key]));
}

function flashConflict(conflicts) {
  for (const cell of conflicts) {
    cell.classList.remove("error-flash");
    // Force a reflow to replay the animation on repeated errors.
    // eslint-disable-next-line no-unused-expressions
    cell.offsetWidth;
    cell.classList.add("error-flash");
    window.setTimeout(() => cell.classList.remove("error-flash"), 520);
  }
}

function updateProgress() {
  progressCount.textContent = `${state.placed} / ${allCards.length}`;
}

function showToast(message, tone = "") {
  toast.textContent = message;
  toast.className = "toast show";

  if (tone) {
    toast.classList.add(tone);
  }

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
}

function finishGame() {
  showToast("Table complete. Outstanding matching!", "success");
  launchConfetti();
  finalOverlay.hidden = false;
}

function launchConfetti() {
  confettiLayer.replaceChildren();
  const colors = ["#f2b544", "#f57a53", "#32c7a1", "#79d8f2", "#ffffff"];

  for (let i = 0; i < 170; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = `${2.3 + Math.random() * 2}s`;
    piece.style.animationDelay = `${Math.random() * 0.35}s`;
    piece.style.setProperty("--drift", `${-120 + Math.random() * 240}px`);
    confettiLayer.append(piece);
    window.setTimeout(() => piece.remove(), 4600);
  }
}

restartBtn.addEventListener("click", resetGame);
playAgainBtn.addEventListener("click", resetGame);

resetGame();
