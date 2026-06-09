const shortcutPairs = [
  { id: "move", action: "移动工具", shortcut: "V" },
  { id: "brush", action: "画笔工具", shortcut: "B" },
  { id: "eraser", action: "橡皮擦工具", shortcut: "E" },
  { id: "lasso", action: "套索工具", shortcut: "L" },
  { id: "quick-select", action: "快速选择工具", shortcut: "W" },
  { id: "eyedropper", action: "滴管工具", shortcut: "I" },
  { id: "marquee", action: "选框工具组", shortcut: "M" },
  { id: "fill-gradient", action: "填充 / 渐变工具组", shortcut: "G" },
  { id: "swap-colors", action: "切换前景色和背景色", shortcut: "X" },
  { id: "undo", action: "撤销", shortcut: "Ctrl + Z" },
  { id: "redo", action: "重做", shortcut: "Shift + Ctrl + Z" },
  { id: "select-all", action: "全选", shortcut: "Ctrl + A" },
  { id: "deselect", action: "取消选择", shortcut: "Ctrl + D" },
  { id: "inverse", action: "反选", shortcut: "Shift + Ctrl + I" },
  { id: "save", action: "保存", shortcut: "Ctrl + S" },
  { id: "duplicate-layer", action: "复制图层", shortcut: "Ctrl + J" },
];

const state = {
  cards: [],
  flipped: [],
  matchedIds: new Set(),
  attempts: 0,
  mistakes: 0,
  score: 0,
  streak: 0,
  hintsLeft: 3,
  timerStarted: false,
  startTime: 0,
  elapsedSeconds: 0,
  timerId: null,
  locked: false,
  mistakesByPair: new Map(),
};

const screens = {
  start: document.querySelector("#start-screen"),
  rules: document.querySelector("#rules-screen"),
  game: document.querySelector("#game-screen"),
  result: document.querySelector("#result-screen"),
};

const board = document.querySelector("#board");
const statusLine = document.querySelector("#status-line");
const timeValue = document.querySelector("#time-value");
const attemptsValue = document.querySelector("#attempts-value");
const matchesValue = document.querySelector("#matches-value");
const mistakesValue = document.querySelector("#mistakes-value");
const scoreValue = document.querySelector("#score-value");
const hintButton = document.querySelector("#hint-button");
const shortcutDialog = document.querySelector("#shortcut-dialog");
const shortcutList = document.querySelector("#shortcut-list");

document.querySelector("#start-button").addEventListener("click", startGame);
document.querySelector("#rules-start-button").addEventListener("click", startGame);
document.querySelector("#rules-button").addEventListener("click", () => showScreen("rules"));
document.querySelector("#rules-back-button").addEventListener("click", () => showScreen("start"));
document.querySelector("#restart-button").addEventListener("click", startGame);
document.querySelector("#play-again-button").addEventListener("click", startGame);
document.querySelector("#hint-button").addEventListener("click", useHint);
document.querySelector("#view-shortcuts-button").addEventListener("click", openShortcutDialog);
document.querySelector("#close-shortcuts-button").addEventListener("click", () => shortcutDialog.close());

renderShortcutList();

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("is-active"));
  screens[name].classList.add("is-active");
}

function startGame() {
  stopTimer();
  state.cards = buildDeck();
  state.flipped = [];
  state.matchedIds = new Set();
  state.attempts = 0;
  state.mistakes = 0;
  state.score = 0;
  state.streak = 0;
  state.hintsLeft = 3;
  state.timerStarted = false;
  state.startTime = 0;
  state.elapsedSeconds = 0;
  state.locked = false;
  state.mistakesByPair = new Map();

  renderBoard();
  updateStats();
  setStatus("翻开两张卡牌，找到正确组合。");
  showScreen("game");
}

function buildDeck() {
  const cards = shortcutPairs.flatMap((pair) => [
    {
      cardId: `${pair.id}-action`,
      pairId: pair.id,
      kind: "功能",
      type: "action",
      value: pair.action,
    },
    {
      cardId: `${pair.id}-shortcut`,
      pairId: pair.id,
      kind: "快捷键",
      type: "shortcut",
      value: pair.shortcut,
    },
  ]);

  return shuffle(cards);
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function renderBoard() {
  board.innerHTML = "";
  const fragment = document.createDocumentFragment();

  state.cards.forEach((card) => {
    const button = document.createElement("button");
    button.className = "card";
    button.type = "button";
    button.dataset.cardId = card.cardId;
    button.dataset.pairId = card.pairId;
    button.dataset.kind = card.type;
    button.setAttribute("aria-label", `未翻开卡牌，${card.kind}`);
    button.innerHTML = `
      <span class="card-inner">
        <span class="card-face card-back"></span>
        <span class="card-face card-front">
          <span>
            <span class="card-kind">${card.kind}</span>
            <span class="card-value">${card.value}</span>
          </span>
        </span>
      </span>
    `;
    button.addEventListener("click", () => flipCard(card.cardId));
    fragment.append(button);
  });

  board.append(fragment);
}

function flipCard(cardId) {
  if (state.locked) return;

  const card = state.cards.find((item) => item.cardId === cardId);
  const cardElement = getCardElement(cardId);
  if (!card || !cardElement) return;
  if (state.matchedIds.has(card.pairId) || state.flipped.some((item) => item.cardId === cardId)) return;

  startTimerOnFirstFlip();
  openCard(cardElement, card);
  state.flipped.push(card);

  if (state.flipped.length === 2) {
    state.attempts += 1;
    checkPair();
  }

  updateStats();
}

function startTimerOnFirstFlip() {
  if (state.timerStarted) return;
  state.timerStarted = true;
  state.startTime = Date.now();
  state.timerId = window.setInterval(() => {
    state.elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);
    timeValue.textContent = formatTime(state.elapsedSeconds);
  }, 1000);
}

function openCard(cardElement, card) {
  cardElement.classList.add("is-open");
  cardElement.setAttribute("aria-label", `${card.kind}：${card.value}`);
}

function closeCard(cardElement, card) {
  cardElement.classList.remove("is-open", "is-hinted");
  cardElement.setAttribute("aria-label", `未翻开卡牌，${card.kind}`);
}

function checkPair() {
  const [first, second] = state.flipped;
  const isMatch = first.pairId === second.pairId && first.type !== second.type;

  if (isMatch) {
    handleMatch(first.pairId);
    return;
  }

  handleMismatch(first, second);
}

function handleMatch(pairId) {
  state.matchedIds.add(pairId);
  state.score += 10;
  state.streak += 1;

  if (state.streak === 2) {
    state.score += 5;
    setStatus("二连击！快捷键记忆力不错", "success");
  } else if (state.streak >= 3) {
    state.score += 10;
    setStatus(state.streak >= 5 ? "快捷键大师连击！" : "三连击！继续保持", "success");
  } else {
    setStatus("配对成功！", "success");
  }

  state.flipped.forEach((card) => {
    const element = getCardElement(card.cardId);
    element.classList.add("is-matched");
    element.disabled = true;
  });

  state.flipped = [];
  updateStats();

  if (state.matchedIds.size === shortcutPairs.length) {
    finishGame();
  } else if (shortcutPairs.length - state.matchedIds.size === 1) {
    setStatus("最后一组了！", "warn");
  }
}

function handleMismatch(first, second) {
  state.locked = true;
  state.mistakes += 1;
  state.score -= 2;
  state.streak = 0;
  recordMistake(first);
  recordMistake(second);
  setStatus("不对哦，再试一次", "danger");
  updateStats();

  window.setTimeout(() => {
    [first, second].forEach((card) => {
      const element = getCardElement(card.cardId);
      closeCard(element, card);
    });
    state.flipped = [];
    state.locked = false;
  }, 850);
}

function recordMistake(card) {
  const current = state.mistakesByPair.get(card.pairId) || 0;
  state.mistakesByPair.set(card.pairId, current + 1);
}

function useHint() {
  if (state.locked || state.hintsLeft <= 0 || state.matchedIds.size === shortcutPairs.length) return;

  startTimerOnFirstFlip();
  state.hintsLeft -= 1;
  state.score -= 5;

  const availablePair = shortcutPairs.find((pair) => !state.matchedIds.has(pair.id));
  if (!availablePair) return;

  state.locked = true;
  const hintCards = state.cards.filter((card) => card.pairId === availablePair.id);
  hintCards.forEach((card) => {
    const element = getCardElement(card.cardId);
    element.classList.add("is-hinted");
    element.setAttribute("aria-label", `提示，${card.kind}：${card.value}`);
  });

  setStatus(`${availablePair.action} = ${availablePair.shortcut}`, "warn");
  updateStats();

  window.setTimeout(() => {
    hintCards.forEach((card) => {
      if (!state.matchedIds.has(card.pairId)) {
        closeCard(getCardElement(card.cardId), card);
      }
    });
    state.locked = false;
    setStatus("提示已结束，继续挑战。");
  }, 1200);
}

function finishGame() {
  stopTimer();
  const finalSeconds = state.elapsedSeconds;
  const timeBonus = Math.max(0, 60 - Math.floor(finalSeconds / 3));
  state.score += timeBonus;
  updateStats();

  document.querySelector("#final-time").textContent = formatTime(finalSeconds);
  document.querySelector("#final-attempts").textContent = `${state.attempts} 次`;
  document.querySelector("#final-mistakes").textContent = `${state.mistakes} 次`;
  document.querySelector("#final-score").textContent = `${state.score} 分`;
  document.querySelector("#rating-value").textContent = getRating(finalSeconds, state.mistakes);
  renderReview();

  window.setTimeout(() => showScreen("result"), 500);
}

function getRating(seconds, mistakes) {
  if (seconds <= 60 && mistakes <= 3) return "设计效率怪物";
  if (mistakes === 0) return "PS 快捷键大师";
  if (mistakes < 5 && seconds <= 120) return "图层管理达人";
  if (mistakes < 8) return "快捷键熟练工";
  return "PS 入门学徒";
}

function renderReview() {
  const reviewList = document.querySelector("#review-list");
  const mistakeItems = [...state.mistakesByPair.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([pairId, count]) => {
      const pair = shortcutPairs.find((item) => item.id === pairId);
      return { ...pair, count };
    });

  if (!mistakeItems.length) {
    reviewList.innerHTML = '<p class="review-empty">零失误通关，这轮没有错题。</p>';
    return;
  }

  reviewList.innerHTML = mistakeItems
    .map(
      (item) => `
        <div class="review-item">
          <span>${item.action}<br><code>${item.shortcut}</code></span>
          <strong>${item.count} 次</strong>
        </div>
      `,
    )
    .join("");
}

function renderShortcutList() {
  shortcutList.innerHTML = shortcutPairs
    .map(
      (pair) => `
        <div class="shortcut-item">
          <span>${pair.action}</span>
          <code>${pair.shortcut}</code>
        </div>
      `,
    )
    .join("");
}

function openShortcutDialog() {
  if (typeof shortcutDialog.showModal === "function") {
    shortcutDialog.showModal();
  } else {
    shortcutDialog.setAttribute("open", "");
  }
}

function updateStats() {
  timeValue.textContent = formatTime(state.elapsedSeconds);
  attemptsValue.textContent = state.attempts;
  matchesValue.textContent = `${state.matchedIds.size} / ${shortcutPairs.length}`;
  mistakesValue.textContent = state.mistakes;
  scoreValue.textContent = state.score;
  hintButton.textContent = `提示 ${state.hintsLeft}`;
  hintButton.disabled = state.hintsLeft <= 0 || state.matchedIds.size === shortcutPairs.length;
}

function setStatus(message, tone = "") {
  statusLine.textContent = message;
  statusLine.className = `status-line${tone ? ` ${tone}` : ""}`;
}

function getCardElement(cardId) {
  return board.querySelector(`[data-card-id="${cardId}"]`);
}

function stopTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
