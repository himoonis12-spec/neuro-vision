const BASE_STRATS = [
  { id: 'numerologist', name: 'Нумеролог', icon: '🔢' },
  { id: 'joker', name: 'Джокер', icon: '🃏' },
  { id: 'careerist', name: 'Карьерист', icon: '📈' },
];

const EXTRA_STRATS = [
  { id: 'gambler', name: 'Игрок', cost: 10 },
  { id: 'alchemist', name: 'Алхимик', cost: 10 },
  { id: 'architect', name: 'Архитектор', cost: 10 },
  { id: 'chronomancer', name: 'Хромант', cost: 10 },
  { id: 'necromancer', name: 'Некромант', cost: 10 },
];

const ARTIFACTS = [
  { id: 'mirror', name: 'Зеркало', desc: 'Копирует редкость лучшей кости на обычную', cost: 15, type: 'active' },
  { id: 'magnet', name: 'Магнит', desc: '30% шанс на 7 для d8+', cost: 12, type: 'passive' },
  { id: 'totem', name: 'Тотем', desc: '+10% к финальному счёту', cost: 20, type: 'passive' },
  { id: 'extra', name: '4-й Бросок', desc: '+1 переброс в бою', cost: 25, type: 'passive' },
];

const TARGETS = [200, 300, 450, 700, 1000, 1500, 2200, 3500];
const rarityMult = { common: 1, silver: 2, gold: 8, chaos: 20 };

const state = {
  strategy: null,
  extraStrategy: null,
  round: 1,
  money: 0,
  hearts: 3,
  targetScore: TARGETS[0],
  artifacts: [],
  collection: [],
  field: [],
  rerollsLeft: 3,
  maxRerolls: 3,
  isTurnActive: false,
  hasExtraStrat: false,
};

const $ = (id) => document.getElementById(id);
const sample = (arr, count) => [...arr].sort(() => Math.random() - 0.5).slice(0, count);
const uid = () => Math.random().toString(36).slice(2, 10);

function initStartScreen() {
  const wrap = $('strategyList');
  wrap.innerHTML = '';
  BASE_STRATS.forEach((s) => {
    const card = document.createElement('button');
    card.className = 'btn glass-panel card';
    card.innerHTML = `<h3>${s.icon} ${s.name}</h3><p>${s.id}</p>`;
    card.onclick = () => startGame(s);
    wrap.append(card);
  });
}

function startGame(strategy) {
  Object.assign(state, {
    strategy,
    extraStrategy: null,
    round: 1,
    money: 0,
    hearts: 3,
    targetScore: TARGETS[0],
    artifacts: [],
    collection: Array.from({ length: 12 }, () => ({ id: uid(), sides: 4, value: 1, rarity: 'common', selected: false })),
    maxRerolls: 3,
    rerollsLeft: 3,
    hasExtraStrat: false,
  });
  $('startScreen').classList.add('hidden');
  $('gameScreen').classList.remove('hidden');
  updateHeader();
  startRound();
}

function startRound() {
  $('resultOverlay').classList.add('hidden');
  state.targetScore = TARGETS[state.round - 1] ?? Math.floor((TARGETS.at(-1)) * 1.5 ** (state.round - 8));
  state.field = sample(state.collection, 6);
  state.field.forEach((d) => {
    d.value = rollValue(d);
    d.selected = false;
  });
  state.rerollsLeft = state.maxRerolls;
  state.isTurnActive = true;
  updateHeader();
  renderField();
  renderCollection();
  updateButtons();
}

function rollValue(die) {
  if (state.artifacts.some((a) => a.id === 'magnet') && die.sides >= 8 && Math.random() < 0.3) return 7;
  return Math.floor(Math.random() * die.sides) + 1;
}

function renderField() {
  const field = $('diceField');
  field.innerHTML = '';
  state.field.forEach((die) => {
    const scene = document.createElement('div');
    scene.className = 'scene';
    const cube = document.createElement('div');
    cube.className = `cube ${die.rarity} ${die.selected ? 'selected' : ''}`;
    for (let i = 1; i <= 6; i++) {
      const face = document.createElement('div');
      face.className = 'face';
      face.textContent = i;
      cube.append(face);
    }
    applyRotation(cube, die.value);
    cube.onclick = () => {
      if (!state.isTurnActive) return;
      die.selected = !die.selected;
      cube.classList.toggle('selected', die.selected);
      updateButtons();
    };
    scene.append(cube);
    field.append(scene);
  });
}

function applyRotation(cube, value) {
  const map = {
    1: [0, 0],
    2: [0, 180],
    3: [0, 90],
    4: [0, -90],
    5: [90, 0],
    6: [-90, 0],
    7: [180, 90],
    8: [-180, -90],
    9: [90, 90],
    10: [-90, -90],
    11: [180, 0],
    12: [0, 270],
  };
  const [x, y] = map[value] ?? [0, 0];
  cube.style.transform = `rotateX(${x}deg) rotateY(${y}deg)`;
}

function rerollSelected() {
  const selected = state.field.filter((d) => d.selected);
  if (!state.isTurnActive || state.rerollsLeft <= 0 || !selected.length) return;
  state.rerollsLeft -= 1;
  const cubes = [...document.querySelectorAll('.cube')];
  selected.forEach((die) => {
    const idx = state.field.findIndex((d) => d.id === die.id);
    const cube = cubes[idx];
    cube.classList.add('shake');
    cube.style.transition = 'none';
  });

  setTimeout(() => {
    selected.forEach((die) => {
      const idx = state.field.findIndex((d) => d.id === die.id);
      const cube = cubes[idx];
      die.value = rollValue(die);
      die.selected = false;
      cube.classList.remove('shake', 'selected');
      cube.style.transition = '';
      applyRotation(cube, die.value);
    });
    updateButtons();
  }, 300);
  updateButtons();
}

function calculateScore() {
  const dice = state.field;
  let base = 0;
  const vals = dice.map((d) => {
    let value = d.value;
    if (effectiveStrategies().includes('necromancer') && value === 1) value = 10;
    base += value;
    return value;
  });

  let mult = 1;
  const active = effectiveStrategies();
  if (active.includes('numerologist')) {
    const counts = vals.reduce((acc, v) => ((acc[v] = (acc[v] || 0) + 1), acc), {});
    const [most, c] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    mult *= Number(most) + c;
  }
  if (active.includes('joker')) {
    mult *= vals.every((v) => v === vals[0]) ? 50 : 1;
  }
  if (active.includes('careerist')) {
    const uniq = [...new Set(vals)].sort((a, b) => a - b);
    let best = 1;
    let current = 1;
    for (let i = 1; i < uniq.length; i++) {
      current = uniq[i] === uniq[i - 1] + 1 ? current + 1 : 1;
      best = Math.max(best, current);
    }
    mult *= best >= 3 ? 12 + (best - 3) : 1;
  }
  if (active.includes('gambler')) mult *= base > 20 ? 10 : 0.5;
  if (active.includes('alchemist')) mult *= base % 5 === 0 ? 3 : 1;
  if (active.includes('architect')) {
    const counts = vals.reduce((acc, v) => ((acc[v] = (acc[v] || 0) + 1), acc), {});
    const pairs = Object.values(counts).reduce((acc, n) => acc + Math.floor(n / 2), 0);
    mult *= pairs > 0 ? 2 ** pairs : 1;
  }
  if (active.includes('chronomancer')) {
    const allEven = vals.every((v) => v % 2 === 0);
    const allOdd = vals.every((v) => v % 2 === 1);
    mult *= allEven || allOdd ? 4 : 1;
  }

  let rarity = 1;
  dice.forEach((d) => (rarity *= rarityMult[d.rarity]));
  if (state.artifacts.some((a) => a.id === 'totem')) mult *= 1.1;

  const score = Math.floor(base * mult * rarity);
  return { score, base, mult, rarity, vals };
}

function effectiveStrategies() {
  return [state.strategy.id, state.extraStrategy?.id].filter(Boolean);
}

function bankScore() {
  if (!state.isTurnActive) return;
  state.isTurnActive = false;
  const data = calculateScore();
  const win = data.score >= state.targetScore;
  showResult(data, win);
  const progress = Math.min(100, Math.floor((data.score / state.targetScore) * 100));
  $('scoreBar').style.width = `${progress}%`;

  setTimeout(() => {
    if (win) {
      const reward = Math.max(0, 6 + Math.floor((data.score - state.targetScore) / 100) + Math.min(5, Math.floor(state.money / 50)));
      state.money += reward;
      floatText(`+${reward} фаворов`);
      openShop();
    } else {
      state.hearts -= 1;
      if (state.hearts <= 0) endRun(false);
      else startRound();
    }
  }, 1200);
  updateHeader();
}

function showResult(data, win) {
  const o = $('resultOverlay');
  const content = $('resultContent');
  content.innerHTML = `
    <h2 style="color:${win ? 'var(--success)' : 'var(--danger)'}">${win ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ'}</h2>
    <p>Счёт: ${data.score} / ${state.targetScore}</p>
    <p>Сумма: ${data.base} • Страт.×${data.mult.toFixed(2)} • Редк.×${data.rarity}</p>
    <p>Значения: ${data.vals.join(', ')}</p>
  `;
  o.classList.remove('hidden');
}

function openShop() {
  if (state.round >= 8) {
    endRun(true);
    return;
  }
  $('shopModal').classList.remove('hidden');
  renderShop();
}

function renderShop() {
  $('shopMoney').textContent = state.money;
  const shaman = $('shopShaman');
  const jeweler = $('shopJeweler');
  shaman.innerHTML = '';
  jeweler.innerHTML = '';

  const artifacts = sample(ARTIFACTS.filter((a) => !state.artifacts.some((x) => x.id === a.id)), 2);
  artifacts.forEach((a) => shaman.append(shopItem(a.name, a.cost, () => buyArtifact(a))));

  if (state.round > 1 && !state.hasExtraStrat) {
    const s = sample(EXTRA_STRATS, 1)[0];
    shaman.append(shopItem(`Стратегия: ${s.name}`, s.cost, () => buyStrategy(s)));
  }

  state.field.forEach((die) => {
    const nextSides = { 4: 6, 6: 8, 8: 10, 10: 12 }[die.sides];
    const upgrades = document.createElement('div');
    upgrades.className = 'shop-item';
    upgrades.innerHTML = `<span>d${die.sides} ${die.rarity}</span>`;
    const wrap = document.createElement('div');
    if (nextSides) {
      const cost = 10 * die.sides;
      const btn = btnInline(`d${nextSides} (${cost})`, () => upgradeSides(die, nextSides, cost));
      wrap.append(btn);
    }
    const rarityNext = { common: 'silver', silver: 'gold', gold: 'chaos' }[die.rarity];
    if (rarityNext) {
      const cost = 15 * rarityMult[rarityNext];
      const btn = btnInline(`${rarityNext} (${cost})`, () => upgradeRarity(die, rarityNext, cost));
      wrap.append(btn);
    }
    upgrades.append(wrap);
    jeweler.append(upgrades);
  });
}

function shopItem(name, cost, onBuy) {
  const el = document.createElement('div');
  el.className = 'shop-item';
  el.innerHTML = `<span>${name}</span><span>${cost}</span>`;
  const b = btnInline('Купить', onBuy);
  el.append(b);
  return el;
}
function btnInline(label, onClick) {
  const b = document.createElement('button');
  b.className = 'btn';
  b.textContent = label;
  b.onclick = onClick;
  return b;
}

function pay(cost) {
  if (state.money < cost) return false;
  state.money -= cost;
  return true;
}

function buyArtifact(a) {
  if (!pay(a.cost)) return;
  state.artifacts.push(a);
  if (a.id === 'extra') state.maxRerolls = 4;
  if (a.id === 'mirror') mirrorEffect();
  renderShop();
  updateHeader();
}

function mirrorEffect() {
  const best = [...state.field].sort((a, b) => rarityMult[b.rarity] - rarityMult[a.rarity])[0];
  const common = sample(state.collection.filter((d) => d.rarity === 'common'), 1)[0];
  if (best && common) common.rarity = best.rarity;
}

function buyStrategy(s) {
  if (state.hasExtraStrat || !pay(s.cost)) return;
  state.extraStrategy = s;
  state.hasExtraStrat = true;
  renderShop();
  updateHeader();
}

function upgradeSides(die, next, cost) {
  if (!pay(cost)) return;
  die.sides = next;
  renderShop();
}

function upgradeRarity(die, next, cost) {
  if (!pay(cost)) return;
  die.rarity = next;
  renderShop();
}

function nextRound() {
  $('shopModal').classList.add('hidden');
  state.round += 1;
  startRound();
}

function updateHeader() {
  $('money').textContent = state.money;
  $('hearts').textContent = state.hearts;
  $('round').textContent = state.round;
  $('rerollsLeft').textContent = state.rerollsLeft;
  $('strategyName').textContent = `Стратегия: ${state.strategy?.name ?? '-'}${state.extraStrategy ? ` + ${state.extraStrategy.name}` : ''}`;
  $('targetLabel').textContent = `Цель: ${state.targetScore}`;
}

function renderCollection() {
  const strip = $('collectionStrip');
  strip.innerHTML = '';
  state.collection.slice(0, 6).forEach((d) => {
    const el = document.createElement('div');
    el.className = 'collection-item';
    el.textContent = `d${d.sides} ${d.rarity}`;
    strip.append(el);
  });
}

function updateButtons() {
  const selected = state.field.some((d) => d.selected);
  $('rerollBtn').disabled = !state.isTurnActive || state.rerollsLeft <= 0 || !selected;
  $('bankBtn').disabled = !state.isTurnActive;
  $('rerollsLeft').textContent = state.rerollsLeft;
}

function floatText(text) {
  const el = document.createElement('div');
  el.className = 'floating-text';
  el.textContent = text;
  document.body.append(el);
  setTimeout(() => el.remove(), 1000);
}

function endRun(win) {
  $('gameOverModal').classList.remove('hidden');
  $('gameOverTitle').textContent = win ? 'Победа! Вы прошли 8 раундов' : 'Поражение';
  $('gameOverText').textContent = `Раунд: ${state.round}, Фаворы: ${state.money}`;
}

$('rerollBtn').onclick = rerollSelected;
$('bankBtn').onclick = bankScore;
$('nextRoundBtn').onclick = nextRound;
$('restartBtn').onclick = () => {
  $('gameOverModal').classList.add('hidden');
  $('gameScreen').classList.add('hidden');
  $('startScreen').classList.remove('hidden');
};

initStartScreen();
