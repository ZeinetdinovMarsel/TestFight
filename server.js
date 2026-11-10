const http = require('http');
const path = require('path');
const os = require('os');
const express = require('express');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const ADMIN_USER = 'sas';
const ADMIN_PASS = 'tat';

app.use(express.static(path.join(__dirname, 'public')));

// 15 unique, witty pencil-and-paper roles matching original animations
const ROLES = [
  // --- 🛡️ ТИТАНЫ (Тяжеловесы, вампиризм, хуки, ярость, сокрушают Теней) ---
  {
    id: 0,
    race: 'titan',
    raceName: 'Титан',
    raceIcon: '🛡️',
    roleName: 'Вампир-Ластик',
    weaponName: 'Кровавый ластик',
    kind: 'sword',
    color: '#c33c70',
    range: 85, cd: 0.88, damage: 6.2, speed: 95,
    skill1: { name: 'Вампиризм', desc: 'Каждый удар высасывает 10% урона в своё здоровье.' },
    skill2: { name: 'Стирание крови', desc: 'При HP < 35% даёт щит +10 HP и стирает чужие снаряды.' },
    ult: { name: 'Кровавая жатва', desc: 'Вихрь вытягивает здоровье у всех вокруг, нанося урон и восстанавливая вампиру до 20 HP.' }
  },
  {
    id: 1,
    race: 'titan',
    raceName: 'Титан',
    raceIcon: '🛡️',
    roleName: 'Магнитный Мясник',
    weaponName: 'Мясницкий магнит',
    kind: 'axe',
    color: '#d45132',
    range: 110, cd: 0.98, damage: 10.8, speed: 96,
    skill1: { name: 'Железный Хук', desc: 'Выбрасывает трос: притягивает врага в упор и станит на 0.5с.' },
    skill2: { name: 'Тяжелый тесак', desc: 'Удар в упор отбрасывает цель с +45% бонусного урона.' },
    ult: { name: 'Магнитный шторм', desc: 'Стягивает ВСЕХ врагов с арены к себе в ловушку и сокрушает топором.' }
  },
  {
    id: 5,
    race: 'titan',
    raceName: 'Титан',
    raceIcon: '🛡️',
    roleName: 'Пружинный Берсерк',
    weaponName: 'Сапог ярости',
    kind: 'hammer',
    color: '#317bc0',
    range: 98, cd: 1.1, damage: 9.6, speed: 97,
    skill1: { name: 'Бешеный прыжок', desc: 'Прыгает на врага с воздуха, сотрясая арену землетрясением.' },
    skill2: { name: 'Кровь берсерка', desc: 'Чем меньше HP, тем выше урон (до +60%) и скорость атаки!' },
    ult: { name: 'Апокалиптический дроп', desc: 'Сейсмический метеор с радиусом 140 раскидывает всех врагов.' }
  },
  {
    id: 10,
    race: 'titan',
    raceName: 'Титан',
    raceIcon: '🛡️',
    roleName: 'Инженер-Строитель',
    weaponName: 'Зонт-Баррикада',
    kind: 'shield',
    color: '#277c60',
    range: 85, cd: 0.88, damage: 8.5, speed: 95,
    skill1: { name: 'Линейка-Баррикада', desc: 'Ставит деревянную стену, блокирующую врагов и снаряды.' },
    skill2: { name: 'Отражающий щит', desc: 'Каждый 3-й удар рикошетит снаряды обратно в стрелявших.' },
    ult: { name: 'Железный Бастион', desc: 'Непробиваемый купол с автоматической пушкой, отстреливающей всех вокруг.' }
  },
  {
    id: 11,
    race: 'titan',
    raceName: 'Титан',
    raceIcon: '🛡️',
    roleName: 'Стальной Панчер',
    weaponName: 'Перчатки нокаута',
    kind: 'fist',
    color: '#d33d46',
    range: 115, cd: 0.88, damage: 8.2, speed: 96,
    skill1: { name: 'Оглушающий апперкот', desc: 'Каждый 3-й удар отправляет цель в нокаут (стан на 0.6с).' },
    skill2: { name: 'Резиновый таран', desc: 'Рывок сквозь поле боя на резинке с сильным отбросом.' },
    ult: { name: 'Шквал нокаутов', desc: 'Серия из 6 сокрушительных ударов по площади, вырубающих противников.' }
  },

  // --- ⚡ ТЕНИ (Ловкачи, скорость, блинки, ассасины, режут Мистиков) ---
  {
    id: 6,
    race: 'shadow',
    raceName: 'Тень',
    raceIcon: '⚡',
    roleName: 'Теневой Шиноби',
    weaponName: 'Клинок теней',
    kind: 'dagger',
    color: '#7350b8',
    range: 88, cd: 0.38, damage: 7.8, speed: 120,
    skill1: { name: 'Теневой шаг (Телепорт)', desc: 'Телепортируется ЗА СПИНУ врага с ударом в спину (+60% урона)!' },
    skill2: { name: 'Дымовая тень', desc: 'После телепорта оставляет чернильный след, дающий 45% уклонения.' },
    ult: { name: 'Танец тысячи теней', desc: 'Серия из 4 мгновенных блинков сквозь всех врагов на арене.' }
  },
  {
    id: 7,
    race: 'shadow',
    raceName: 'Тень',
    raceIcon: '⚡',
    roleName: 'Дворовый Трюкач',
    weaponName: 'Йо-йо мастер',
    kind: 'trident',
    color: '#d16c21',
    range: 135, cd: 0.82, damage: 8.2, speed: 104,
    skill1: { name: 'Ниточная петля', desc: 'Опутывает цель нитью йо-йо, связывая её передвижение на 1.2с.' },
    skill2: { name: 'Орбитальное вращение', desc: 'Круговое вращение катушки отталкивает нападающих.' },
    ult: { name: 'Бесконечный слип', desc: 'Вихрь йо-йо непрерывно засасывает врагов в режущую зону.' }
  },
  {
    id: 8,
    race: 'shadow',
    raceName: 'Тень',
    raceIcon: '⚡',
    roleName: 'Неаполитанский Курьер',
    weaponName: 'Пицца-бумеранг',
    kind: 'boomerang',
    color: '#b57925',
    range: 220, cd: 0.95, damage: 10.2, speed: 107,
    skill1: { name: 'Двойной срез', desc: 'Бумеранг наносит урон при броске и +50% урона при возврате в спину!' },
    skill2: { name: 'Сырная смазка', desc: 'Оставляет скользкую дорожку, на которой враги пробуксовывают.' },
    ult: { name: 'Метровая Пепперони', desc: 'Гигантский слайс пиццы проносится сквозь всё поле боя, отскакивая 4 раза.' }
  },
  {
    id: 12,
    race: 'shadow',
    raceName: 'Тень',
    raceIcon: '⚡',
    roleName: 'Острый Кактус',
    weaponName: 'Шипастая вертушка',
    kind: 'saw',
    color: '#4b8b42',
    range: 86, cd: 0.62, damage: 7.2, speed: 108,
    skill1: { name: 'Игольчатый вихрь', desc: 'Круговое вращение режет всех врагов в контактной зоне.' },
    skill2: { name: 'Возвратные шипы', desc: 'Отражает 22% входящего контактного урона обратно нападающему!' },
    ult: { name: 'Игольчатая сверхновая', desc: 'Залп из 12 пробивающих насквозь игл во все стороны арены.' }
  },
  {
    id: 14,
    race: 'shadow',
    raceName: 'Тень',
    raceIcon: '⚡',
    roleName: 'Грозовой Дуэлянт',
    weaponName: 'Клинок-Тесла',
    kind: 'lightning',
    color: '#5268b0',
    range: 175, cd: 1.05, damage: 7.1, speed: 106,
    skill1: { name: 'Шаровая молния', desc: 'Выпускает электрический шар (от него можно увернуться ловкостью).' },
    skill2: { name: 'Цепной разряд', desc: 'Каждый 3-й удар вызывает взрыв статики на соседних врагов.' },
    ult: { name: 'Шторм Теслы', desc: '3 прицельных удара молнии с задержкой и визуальным предупреждением на полу.' }
  },

  // --- 🔮 МИСТИКИ (Маги, призыватели, ловушки, зоны, кайтят Титанов) ---
  {
    id: 2,
    race: 'mystic',
    raceName: 'Мистик',
    raceIcon: '🔮',
    roleName: 'Огородный Снайпер',
    weaponName: 'Горошкомёт',
    kind: 'gun',
    color: '#4e9329',
    range: 290, cd: 1.08, damage: 4.4, speed: 90,
    skill1: { name: 'Тетрадный рикошет', desc: 'Горошины отскакивают от полей тетради с +25% урона за каждый отскок.' },
    skill2: { name: 'Дальний кайт', desc: 'Урон по целям дальше 180 пикселей возрастает на +35%.' },
    ult: { name: 'Гороховый пулемёт', desc: 'Шквал скорострельных горошин по площади арены.' }
  },
  {
    id: 3,
    race: 'mystic',
    raceName: 'Мистик',
    raceIcon: '🔮',
    roleName: 'Киношный Подрывник',
    weaponName: 'Попкорн-мина',
    kind: 'bomb',
    color: '#ba850d',
    range: 240, cd: 1.38, damage: 9.8, speed: 91,
    skill1: { name: 'Горячая мина', desc: 'Оставляет мину, детонирующую при приближении врага.' },
    skill2: { name: 'Масляная волна', desc: 'Взрыв оставляет липкое масло, сбивающее бег врагов.' },
    ult: { name: 'Ядерный попкорн', desc: '3 гигантских зерна взрывают ключевые зоны мощной волной.' }
  },
  {
    id: 4,
    race: 'mystic',
    raceName: 'Мистик',
    raceIcon: '🔮',
    roleName: 'Чернильный Призыватель',
    weaponName: 'Лук пчеловода',
    kind: 'bow',
    color: '#9e6909',
    range: 270, cd: 1.15, damage: 4.8, speed: 90,
    skill1: { name: 'Призыв чернильного шмеля', desc: 'Призывает живого летающего шмеля, который атакует и отвлекает врагов.' },
    skill2: { name: 'Жалящая стрела', desc: 'Выстрел из лука помечает цель, удваивая урон призванных шмелей.' },
    ult: { name: 'Рой Королевы', desc: 'Призывает 2 свирепых шмелей-стражей, летающих вокруг хозяина.' }
  },
  {
    id: 9,
    race: 'mystic',
    raceName: 'Мистик',
    raceIcon: '🔮',
    roleName: 'Мыльный Иллюзионист',
    weaponName: 'Посох пузырей',
    kind: 'magic',
    color: '#008f9b',
    range: 255, cd: 1.1, damage: 7.2, speed: 92,
    skill1: { name: 'Блуждающий пузырь', desc: 'Запирает врага в левитирующий пузырь на 0.8с (лопается от любого удара).' },
    skill2: { name: 'Мыльная иллюзия', desc: 'При резкой атаке врага оставляет пузырь-приманку и отскакивает назад.' },
    ult: { name: 'Мыльный шторм', desc: 'Купол из пузырей, отражающий вражеские снаряды и наносящий брызговый урон.' }
  },
  {
    id: 13,
    race: 'mystic',
    raceName: 'Мистик',
    raceIcon: '🔮',
    roleName: 'Карманная Сингулярность',
    weaponName: 'Чёрная дыра',
    kind: 'dynamite',
    color: '#8b43b1',
    range: 245, cd: 1.35, damage: 10.8, speed: 92,
    skill1: { name: 'Микро-воронка', desc: 'Создает воронку, стягивающую всех врагов в эпицентр.' },
    skill2: { name: 'Гравитационный импульс', desc: 'В ближнем бою отталкивает нападающих мощной волной.' },
    ult: { name: 'Коллапс пространства', desc: 'Гигантская сингулярность засасывает арену с финальным взрывом.' }
  }
];

// Race Advantage Map: Титаны сокрушают Теней, Тени режут Мистиков, Мистики кайтят Титанов
const RACE_ADVANTAGE = {
  titan: 'shadow',
  shadow: 'mystic',
  mystic: 'titan'
};

// Calibration & footwork from original pencil engine
const footwork = [
  [.66, .14, 1.2], [.60, .18, 1.4], [.62, .36, 1.4], [.60, .44, 1.1], [.58, .60, 1.0],
  [.67, .12, 1.5], [.65, .65, 2.5], [.80, .35, 1.6], [.58, .44, 1.2], [.59, .48, 1.4],
  [.65, .23, 1.1], [.74, .26, 1.8], [.60, .62, 1.3], [.56, .38, 0.8], [.65, .30, 1.2]
];

const W = 1000, H = 645;
const MAX_PLAYERS = 15;
const DEFAULT_ROUND_DURATION = 60;

// Game State
const state = {
  status: 'LOBBY', // 'LOBBY' | 'COUNTDOWN' | 'BATTLE' | 'INTERMISSION' | 'GAME_OVER'
  roundDuration: DEFAULT_ROUND_DURATION,
  currentRound: 1,
  totalRounds: 1,
  roundTimeLeft: DEFAULT_ROUND_DURATION,
  countdownTimeLeft: 3,
  intermissionTimeLeft: 4,
  players: new Map(), // socketId -> player object
  activeFighterIds: [], // socketIds participating in current round
  safePlayerIds: [], // socketIds that escaped (safe from losing)
  fallenPlayerIds: [], // socketIds that died in the current round
  bracketHistory: [], // records of each round's results
  loser: null, // the ultimate loser
  autoCountdown: null,
  autoCountdownSec: 5
};

// Simulation state during battle
let fighters = [];
let shots = [];
let zones = [];
let effects = [];
let simInterval = null;
let lastTickTime = Date.now();

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

function getConnectedPlayers() {
  return Array.from(state.players.values()).map(p => ({
    id: p.id,
    name: p.name,
    roleId: p.roleId,
    stats: p.stats,
    ready: p.ready,
    isAdmin: p.isAdmin,
    isSpectator: p.isSpectator
  }));
}

function broadcast(msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(data);
  });
}

function sendTo(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function broadcastLobbyState() {
  broadcast({
    type: 'lobby_update',
    status: state.status,
    roundDuration: state.roundDuration,
    players: getConnectedPlayers(),
    roles: ROLES.map(r => ({
      ...r,
      takenBy: Array.from(state.players.values()).find(p => p.roleId === r.id)?.name || null
    })),
    autoCountdown: state.autoCountdown !== null ? state.autoCountdownSec : null
  });
}

function checkAutoStart() {
  if (state.status !== 'LOBBY') return;
  const list = Array.from(state.players.values()).filter(p => !p.isSpectator && p.name && p.roleId !== null);
  const allReady = list.length >= 2 && list.every(p => p.ready);

  if (allReady && state.autoCountdown === null) {
    state.autoCountdownSec = 5;
    state.autoCountdown = setInterval(() => {
      state.autoCountdownSec--;
      if (state.autoCountdownSec <= 0) {
        clearInterval(state.autoCountdown);
        state.autoCountdown = null;
        startTournament();
      } else {
        broadcastLobbyState();
      }
    }, 1000);
    broadcastLobbyState();
  } else if (!allReady && state.autoCountdown !== null) {
    clearInterval(state.autoCountdown);
    state.autoCountdown = null;
    broadcastLobbyState();
  }
}

function startTournament() {
  if (state.status !== 'LOBBY') return;
  if (state.autoCountdown) {
    clearInterval(state.autoCountdown);
    state.autoCountdown = null;
  }
  broadcastLobbyState();

  const validPlayers = Array.from(state.players.values()).filter(p => !p.isSpectator && p.name && p.roleId !== null && (p.ready || p.isAdmin));
  if (validPlayers.length < 2) return;

  // Non-ready, missing role, or spectator players automatically become spectators!
  state.players.forEach(p => {
    if (!validPlayers.includes(p)) p.isSpectator = true;
  });

  state.currentRound = 1;
  state.safePlayerIds = [];
  state.bracketHistory = [];
  state.loser = null;
  state.activeFighterIds = validPlayers.map(p => p.id);

  // Compute total rounds roughly
  let count = state.activeFighterIds.length;
  let r = 1;
  while (count > 2) {
    if (count === 3) count = 2;
    else count = Math.floor(count / 2);
    r++;
  }
  state.totalRounds = r;

  prepareRound(1);
}

function prepareRound(roundNum) {
  state.status = 'COUNTDOWN';
  state.currentRound = roundNum;
  state.roundTimeLeft = state.roundDuration;
  state.countdownTimeLeft = 3;
  state.fallenPlayerIds = [];

  const roundParticipants = state.activeFighterIds.map(id => state.players.get(id)).filter(Boolean);

  // Setup fighters with stats and circle positions
  fighters = roundParticipants.map((p, i) => {
    const role = ROLES.find(r => r.id === p.roleId) || ROLES[0];
    const str = (p.stats && p.stats.str) || 0;
    const agi = (p.stats && p.stats.agi) || 0;
    const int = (p.stats && p.stats.int) || 0;

    const maxHp = 130 + str * 20; // 0 STR = 130 HP, 10 STR = 330 HP!
    const speedMult = 0.80 + agi * 0.06; // up to +60% run speed
    const cdMult = 1 / (1 + agi * 0.075); // up to +75% attack speed
    const damageMult = (1 + str * 0.04) * (1 + int * 0.045);
    const ultRate = 0.85 + int * 0.12;
    const scale = 0.85 + str * 0.05; // Visual character scale on canvas
    const radius = 21 * scale;
    const dodgeCooldown = 3.8 / (1 + agi * 0.12);
    const dodgeSpeed = 130 + agi * 15;
    const dodgeChance = agi * 0.035; // up to 35% chance to dodge attacks/spells!

    const a = (i * Math.PI * 2) / roundParticipants.length - Math.PI / 2;
    const r = Math.min(235, 120 + roundParticipants.length * 9);

    return {
      socketId: p.id,
      name: p.name,
      id: i,
      roleId: role.id,
      weapon: role,
      roleName: role.roleName,
      weaponName: role.weaponName,
      color: role.color,
      race: role.race,
      raceName: role.raceName,
      raceIcon: role.raceIcon,
      scale,
      radius,
      dodgeCooldown,
      dodgeSpeed,
      dodgeChance,
      x: W / 2 + Math.cos(a) * r,
      y: H / 2 + Math.sin(a) * r,
      vx: rand(-20, 20),
      vy: rand(-20, 20),
      hp: maxHp,
      maxHp: maxHp,
      alive: true,
      cd: rand(0.1, 0.6),
      dodge: rand(1.5, 3.5),
      angle: a + Math.PI,
      flash: 0,
      attack: 0,
      phase: rand(0, 6),
      kills: 0,
      guard: 0,
      slow: 0,
      combo: 0,
      specialGlow: 0,
      leap: null,
      ultCharge: 0, // 0 to 100
      ultCooldown: 4, // 4s grace period before charging ult
      ultRate,
      speedMult,
      cdMult,
      damageMult,
      str, agi, int
    };
  });

  shots = [];
  zones = [];
  effects = [];

  broadcast({
    type: 'round_countdown',
    round: state.currentRound,
    totalRounds: state.totalRounds,
    participants: fighters.map(f => ({ name: f.name, role: f.roleName, hp: f.hp, maxHp: f.maxHp }))
  });

  let cdInterval = setInterval(() => {
    state.countdownTimeLeft--;
    broadcast({ type: 'countdown_tick', left: state.countdownTimeLeft });
    if (state.countdownTimeLeft <= 0) {
      clearInterval(cdInterval);
      startBattleRound();
    }
  }, 1000);
}

function startBattleRound() {
  state.status = 'BATTLE';
  lastTickTime = Date.now();
  if (simInterval) clearInterval(simInterval);
  simInterval = setInterval(gameTick, 33); // ~30 fps simulation
}

function gameTick() {
  const now = Date.now();
  const dt = Math.min((now - lastTickTime) / 1000, 0.05);
  lastTickTime = now;

  state.roundTimeLeft = Math.max(0, state.roundTimeLeft - dt);

  // Update Combat Physics & Logic
  updateCombat(dt);

  // Check Round Ending Conditions
  const liveCount = fighters.filter(f => f.alive).length;
  const totalInRound = fighters.length;

  let roundEnded = false;

  if (totalInRound === 2) {
    // Final round: ends if someone died or time ran out
    if (liveCount <= 1 || state.roundTimeLeft <= 0) roundEnded = true;
  } else if (totalInRound === 3) {
    // 3 player rule: top 1 is saved, 2 go to final!
    // Round ends when 1 dies or timer reaches 0
    if (liveCount <= 2 || state.roundTimeLeft <= 0) roundEnded = true;
  } else {
    // 4+ players: eliminate half into danger bracket
    // Safe count: ceil(N/2), Danger count: floor(N/2)
    const dangerCount = Math.floor(totalInRound / 2);
    const deadCount = totalInRound - liveCount;
    if (deadCount >= dangerCount || state.roundTimeLeft <= 0) roundEnded = true;
  }

  // Broadcast combat tick to all clients
  broadcastSnapshot();

  if (roundEnded) {
    clearInterval(simInterval);
    simInterval = null;
    finishCurrentRound();
  }
}

function updateCombat(dt) {
  const live = fighters.filter(f => f.alive);

  for (const f of live) {
    f.guard = Math.max(0, (f.guard || 0) - dt);
    f.slow = Math.max(0, (f.slow || 0) - dt);
    f.hitGrace = Math.max(0, (f.hitGrace || 0) - dt);
    f.flash = Math.max(0, f.flash - dt);
    f.attack = Math.max(0, f.attack - dt);
    f.cd -= dt;
    f.dodge -= dt;
    f.phase += dt;

    // Ult charges strictly via combat activity (damage dealt and taken)
    if (f.ultCooldown > 0) {
      f.ultCooldown -= dt;
    }

    let targets = fighters.filter(x => x.alive && x !== f);
    if (!targets.length) continue;

    // Target closest enemy
    let b = targets.reduce((a, x) => Math.hypot(x.x - f.x, x.y - f.y) < Math.hypot(a.x - f.x, a.y - f.y) ? x : a);
    let dx = b.x - f.x, dy = b.y - f.y, dist = Math.hypot(dx, dy) || 1;
    f.angle = Math.atan2(dy, dx);

    const kind = f.weapon.kind;
    const style = footwork[f.roleId] || [0.65, 0.3, 1.2];
    let ranged = ['gun', 'bow', 'magic', 'bomb', 'dynamite', 'boomerang', 'lightning'].includes(kind);
    let desired = f.weapon.range * style[0];
    let direction = dist > desired ? 1 : dist < desired * 0.65 ? -0.75 : 0;
    let strafe = (kind === 'bow' || kind === 'saw' ? (f.id % 2 ? 1 : -1) : Math.sin(f.phase * style[2] + f.id)) * style[1];
    let speed = f.weapon.speed * f.speedMult * (f.slow > 0 ? 0.65 : 1) * (ranged && direction < 0 ? 0.65 : !ranged && dist > f.weapon.range ? 1.25 : 1);

    if (kind === 'axe' && dist < 170) {
      b.vx -= (dx / dist) * 90 * dt;
      b.vy -= (dy / dist) * 90 * dt;
    }

    f.vx += ((dx / dist) * direction - (dy / dist) * strafe) * speed * dt * 2.5;
    f.vy += ((dy / dist) * direction + (dx / dist) * strafe) * speed * dt * 2.5;

    // Anti-clumping repulsion: spread fighters out if crowd is forming in one point
    for (const o of live) {
      if (o === f) continue;
      let cdx = f.x - o.x, cdy = f.y - o.y, cdist = Math.hypot(cdx, cdy) || 1;
      if (cdist < 100) {
        let repulse = ((100 - cdist) / 100) * 130;
        f.vx += (cdx / cdist) * repulse * dt;
        f.vy += (cdy / cdist) * repulse * dt;
      }
    }

    let damping = Math.exp(-2.8 * dt);
    f.vx *= damping;
    f.vy *= damping;

    // Dodge mechanism heavily boosted by agility (fast darting side-steps)
    if (f.dodge <= 0 && dist < 140) {
      let side = Math.random() < 0.5 ? -1 : 1;
      let dodgeDist = f.dodgeSpeed || (130 + f.agi * 12);
      f.vx += (-dy / dist) * dodgeDist * side;
      f.vy += (dx / dist) * dodgeDist * side;
      f.dodge = (f.dodgeCooldown || (3.8 / (1 + f.agi * 0.1))) * rand(0.85, 1.15);
      effects.push({ x: f.x, y: f.y, t: 0.25, max: 0.25, dash: true, color: f.color });
    }

    if (f.cd <= 0 && dist < f.weapon.range) {
      attack(f, b);
    }

    f.x += f.vx * dt;
    f.y += f.vy * dt;

    if (f.x < 30 || f.x > W - 30) {
      f.x = clamp(f.x, 30, W - 30);
      f.vx *= -0.7;
    }
    if (f.y < 42 || f.y > H - 30) {
      f.y = clamp(f.y, 42, H - 30);
      f.vy *= -0.7;
    }
  }

  // Strong elastic collision separation based on dynamic fighter radius
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      let a = live[i], b = live[j];
      let minD = (a.radius || 21) + (b.radius || 21) + 8;
      let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      if (d < minD) {
        let push = (minD - d) * 0.55;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;

        // Velocity bounce
        let bounce = 45;
        a.vx -= (dx / d) * bounce;
        a.vy -= (dy / d) * bounce;
        b.vx += (dx / d) * bounce;
        b.vy += (dy / d) * bounce;
      }
    }
  }

  // Update projectiles
  for (const s of shots) {
    if (s.erased) continue;
    s.t -= dt;

    if (s.kind === 'boomerang' && s.t < 0.9) {
      if (!s.returning) {
        s.returning = true;
        s.hit.clear();
      }
      let dx = s.owner.x - s.x, dy = s.owner.y - s.y, d = Math.hypot(dx, dy) || 1;
      s.vx += (dx / d) * 320 * dt;
      s.vy += (dy / d) * 320 * dt;
    }

    if (s.kind === 'bow') {
      if (!s.target.alive) {
        const candidates = fighters.filter(f => f.alive && f !== s.owner);
        s.target = candidates.sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y))[0] || s.target;
      }
      if (s.target && s.target.alive) {
        let a = Math.atan2(s.target.y - s.y, s.target.x - s.x);
        // Moderate turn rate: agile opponents can dodge by sidestepping!
        s.vx += (Math.cos(a) * 200 - s.vx) * dt * 1.3;
        s.vy += (Math.sin(a) * 200 - s.vy) * dt * 1.3;
      }
    }

    if (s.kind === 'dynamite') {
      if (s.t < 0.4) {
        s.vx *= Math.exp(-12 * dt);
        s.vy *= Math.exp(-12 * dt);
      }
      for (const b of fighters) {
        if (b !== s.owner && b.alive) {
          let dx = s.x - b.x, dy = s.y - b.y, d = Math.hypot(dx, dy) || 1;
          if (d < 130) {
            b.vx += (dx / d) * 150 * dt;
            b.vy += (dy / d) * 150 * dt;
          }
        }
      }
    }

    s.x += s.vx * dt;
    s.y += s.vy * dt;

    if (!['bomb', 'dynamite'].includes(s.kind)) {
      for (const b of fighters) {
        if (b.alive && b !== s.owner && !s.hit.has(b.id) && Math.hypot(b.x - s.x, b.y - s.y) < 25) {
          hit(s.owner, b, s.damage, s.kind === 'boomerang' ? 75 : 45, s.isUlt || false);
          if (s.kind === 'magic') b.slow = 0.45;
          s.hit.add(b.id);
          if (s.kind !== 'boomerang') s.t = 0;
          break;
        }
      }
    }

    if (s.x < 0 || s.x > W || s.y < 0 || s.y > H) {
      if (s.kind === 'gun') {
        if (s.x < 0 || s.x > W) s.vx *= -1;
        if (s.y < 0 || s.y > H) s.vy *= -1;
        s.x = clamp(s.x, 1, W - 1);
        s.y = clamp(s.y, 1, H - 1);
      } else {
        s.t = 0;
      }
    }

    if (s.t <= 0 && ['bomb', 'dynamite'].includes(s.kind)) {
      explode(s);
    }
  }

  shots = shots.filter(s => s.t > 0);

  // Update zones / traps
  updateZones(dt);

  // Effects decay
  effects.forEach(e => e.t -= dt);
  effects = effects.filter(e => e.t > 0);
}

function hit(a, b, rawDamage, knock = 100, isUlt = false) {
  if (!a.alive || !b.alive || a === b) return;

  // Agility Dodge Check: agile fighters can dodge incoming non-ult attacks!
  if (!isUlt && b.dodgeChance && Math.random() < b.dodgeChance) {
    effects.push({ x: b.x, y: b.y - 18, t: 0.35, max: 0.35, text: '💨 УВОРОТ!', color: '#4ba0d8' });
    return;
  }

  b.received = (b.received || 0) + 1;
  let shield = b.weapon.kind === 'shield' && b.received % 3 === 0 ? 0.25 : 1;
  let dmg = rawDamage * a.damageMult * shield * (b.guard > 0 ? 0.7 : 1) * rand(0.9, 1.1);

  // Berserker passive: below 50% HP, hammer deals up to +55% bonus damage!
  if (a.weapon.kind === 'hammer') {
    if (a.hp < a.maxHp * 0.5) {
      const fury = 1 + (1 - a.hp / a.maxHp) * 0.55;
      dmg *= fury;
      effects.push({ x: a.x, y: a.y - 20, t: 0.35, max: 0.35, text: '🔥 ЯРОСТЬ!', color: '#e64234' });
    }
  }

  // Race Advantage Logic (Титаны > Тени > Мистики > Титаны)
  const aRace = a.race || (a.weapon && a.weapon.race);
  const bRace = b.race || (b.weapon && b.weapon.race);
  let isCrit = false;

  if (aRace && bRace) {
    if (RACE_ADVANTAGE[aRace] === bRace) {
      dmg *= 1.25;
      isCrit = true;
    } else if (RACE_ADVANTAGE[bRace] === aRace) {
      dmg *= 0.85;
    }
  }

  // Anti-burst dampening if focused by crowd in the same instant
  if (b.hitGrace > 0) dmg *= 0.65;
  b.hitGrace = 0.16;

  b.hp = Math.max(0, b.hp - dmg);
  b.flash = 0.14;

  let dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
  // Knockback scaled by attacker STR and absorbed by victim STR poise
  let kb = (knock + 40) * (1 + a.str * 0.08) / (1 + b.str * 0.06);
  if (isCrit) kb *= 1.2;

  b.vx += (dx / l) * kb;
  b.vy += (dy / l) * kb;

  // Vampire Paladin lifesteal: heals on hit
  if (a.weapon.kind === 'sword' && !isUlt) {
    let heal = dmg * (0.09 + (a.int || 0) * 0.01);
    a.hp = Math.min(a.maxHp, a.hp + heal);
    effects.push({ x: a.x, y: a.y - 18, t: 0.35, max: 0.35, text: '+' + Math.round(heal) + ' HP', color: '#2ea854' });
  }

  // Race special crit procs
  if (isCrit && !isUlt) {
    if (aRace === 'mystic') {
      b.slow = Math.max(b.slow || 0, 0.45 * (1 + (a.int || 0) * 0.05));
    }
  }

  // Charge Ultimates strictly by combat activity (damage dealt and taken):
  // Attacker builds ult from dealing damage (INT + AGI scaling)
  // Defender builds ult from taking damage (INT + STR scaling)
  if (!isUlt) {
    if (a.ultCooldown <= 0) {
      const dealtRate = 0.65 * (1 + (a.int || 0) * 0.10) * (1 + (a.agi || 0) * 0.06);
      a.ultCharge = Math.min(100, a.ultCharge + dmg * dealtRate);
      if (a.ultCharge >= 100) {
        triggerUltimate(a);
      }
    }
    if (b.ultCooldown <= 0) {
      const takenRate = 0.55 * (1 + (b.int || 0) * 0.08) * (1 + (b.str || 0) * 0.07);
      b.ultCharge = Math.min(100, b.ultCharge + dmg * takenRate);
      if (b.ultCharge >= 100) {
        triggerUltimate(b);
      }
    }
  }

  // Cactus reflect passive (only on non-ult hits)
  if (b.weapon.kind === 'saw' && !isUlt) {
    let refl = dmg * 0.22;
    a.hp = Math.max(0, a.hp - refl);
    effects.push({ x: a.x, y: a.y, t: 0.35, max: 0.35, text: '−' + Math.round(refl), color: '#4b8b42' });
  }

  // Eraser low-HP shield passive
  if (b.weapon.kind === 'sword' && !b.shieldUsed && b.hp > 0 && b.hp < b.maxHp * 0.35) {
    b.shieldUsed = true;
    b.guard = 0.8;
    b.hp = Math.min(b.maxHp, b.hp + 9);
    effects.push({ x: b.x, y: b.y, t: 0.8, max: 0.8, text: '+9 ЩИТ!', color: '#6a9cb3' });
  }

  let floatText = '−' + Math.round(dmg);
  let textColor = isUlt ? '#e6b943' : isCrit ? '#d33d46' : '#c76e60';
  if (isCrit) {
    const icon = aRace === 'titan' ? '🛡️' : aRace === 'shadow' ? '⚡' : '🔮';
    floatText = `${icon} −${Math.round(dmg)}`;
  }
  effects.push({ x: b.x, y: b.y, t: 0.38, max: 0.38, text: floatText, color: textColor });

  if (b.hp <= 0) {
    b.alive = false;
    a.kills = (a.kills || 0) + 1;
    if (!state.fallenPlayerIds.includes(b.socketId)) {
      state.fallenPlayerIds.push(b.socketId);
    }
    effects.push({ x: b.x, y: b.y, t: 0.8, max: 0.8, burst: true, color: b.color });
  }
}

function projectile(a, b, kind, offset = 0, isUlt = false) {
  let angle = Math.atan2(b.y - a.y, b.x - a.x) + rand(-0.06, 0.06) + offset;
  let speed = kind === 'gun' ? 300 : kind === 'bow' ? 210 : kind === 'magic' ? 165 : kind === 'boomerang' ? 230 : 175;
  let life = kind === 'bomb' || kind === 'dynamite' ? Math.min(1.3, Math.hypot(b.x - a.x, b.y - a.y) / speed) : kind === 'boomerang' ? 1.8 : 2;

  const shot = {
    owner: a,
    target: b,
    x: a.x + Math.cos(angle) * 25,
    y: a.y + Math.sin(angle) * 25,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    t: life,
    kind,
    damage: a.weapon.damage,
    angle,
    hit: new Set(),
    returning: false,
    isUlt
  };
  shots.push(shot);
  return shot;
}

function zone(a, kind, x, y, r, life, damage, isUlt = false) {
  const z = {
    owner: a,
    kind,
    x: clamp(x, 28, W - 28),
    y: clamp(y, 42, H - 28),
    r,
    t: life,
    max: life,
    damage,
    hit: new Set(),
    isUlt
  };
  zones.push(z);
  return z;
}

function special(a, b) {
  const k = a.weapon.kind;
  const comboFreq = (a.int || 0) >= 5 ? 3 : 4;
  if (a.combo % comboFreq !== 0) return false;
  a.specialGlow = 0.8;

  const aoeR = base => base * (1 + (a.int || 0) * 0.05);

  switch (k) {
    case 'dagger': {
      // Теневой Шиноби: Телепорт за спину цели!
      effects.push({ x: a.x, y: a.y, t: 0.3, max: 0.3, burst: true, color: '#7350b8' });
      let angle = b.angle || 0;
      a.x = clamp(b.x - Math.cos(angle) * 44, 35, W - 35);
      a.y = clamp(b.y - Math.sin(angle) * 44, 45, H - 35);
      a.angle = Math.atan2(b.y - a.y, b.x - a.x);
      effects.push({ x: a.x, y: a.y, t: 0.3, max: 0.3, burst: true, color: '#7350b8' });
      effects.push({ x: a.x, y: a.y - 18, t: 0.5, max: 0.5, text: '⚡ ТЕЛЕПОРТ!', color: '#a07bf0' });
      hit(a, b, a.weapon.damage * 1.85, 120);
      break;
    }
    case 'axe': {
      // Магнитный Мясник: Железный Хук (притягивает цель в упор!)
      let dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 1;
      if (dist > 70) {
        b.x = a.x + (dx / dist) * 50;
        b.y = a.y + (dy / dist) * 50;
        b.vx = -(dx / dist) * 160;
        b.vy = -(dy / dist) * 160;
        b.slow = 0.5;
        effects.push({ x: a.x, y: a.y, x2: b.x, y2: b.y, t: 0.35, max: 0.35, lightning: true, color: '#d45132' });
        effects.push({ x: b.x, y: b.y - 18, t: 0.6, max: 0.6, text: '🧲 ХУК!', color: '#d45132' });
        hit(a, b, a.weapon.damage * 1.55, 40);
      }
      break;
    }
    case 'shield': {
      // Инженер-Строитель: Защитная стена-линейка (блокирует снаряды и путь)
      let angle = Math.atan2(b.y - a.y, b.x - a.x);
      let wallX = a.x + Math.cos(angle) * 48;
      let wallY = a.y + Math.sin(angle) * 48;
      zone(a, 'barricade', wallX, wallY, aoeR(65), 3.2, a.weapon.damage * 0.6);
      effects.push({ x: wallX, y: wallY - 18, t: 0.6, max: 0.6, text: '🛡️ СТЕНА!', color: '#277c60' });
      break;
    }
    case 'bow': {
      // Чернильный Призыватель: Призыв автономного шмеля-миньона!
      zone(a, 'summon_bee', a.x + rand(-30, 30), a.y + rand(-30, 30), aoeR(115), 3.0, a.weapon.damage * 0.38);
      effects.push({ x: a.x, y: a.y - 18, t: 0.6, max: 0.6, text: '🐝 ПРИЗЫВ!', color: '#9e6909' });
      break;
    }
    case 'sword': {
      // Вампир-Ластик: Стирание снарядов и исцеляющий выпад
      a.hp = Math.min(a.maxHp, a.hp + 5);
      shots.forEach(s => {
        if (s.owner !== a && Math.hypot(s.x - a.x, s.y - a.y) < 110) {
          s.erased = true;
          s.t = 0;
          effects.push({ x: s.x, y: s.y, t: 0.3, max: 0.3, burst: true, color: '#c33c70' });
        }
      });
      effects.push({ x: a.x, y: a.y - 18, t: 0.5, max: 0.5, text: '🩸 СТИРАНИЕ!', color: '#c33c70' });
      hit(a, b, a.weapon.damage * 1.1, 100);
      break;
    }
    case 'fist': {
      // Стальной Панчер: Оглушающий апперкот
      b.slow = 0.5;
      b.vx = 0; b.vy = 0;
      effects.push({ x: b.x, y: b.y - 20, t: 0.5, max: 0.5, text: '🥊 НОКАУТ!', color: '#d33d46' });
      hit(a, b, a.weapon.damage * 1.35, 240);
      break;
    }
    case 'bomb':
      zone(a, 'popcorn', b.x + b.vx * 0.25, b.y + b.vy * 0.25, aoeR(68), 2.2, a.weapon.damage * 0.95);
      effects.push({ x: b.x, y: b.y - 15, t: 0.4, max: 0.4, text: '🍿 МИНА!', color: '#ba850d' });
      break;
    case 'hammer': {
      const z = zone(a, 'landing', b.x + b.vx * 0.18, b.y + b.vy * 0.18, aoeR(78), 0.42, a.weapon.damage * 1.15);
      a.leap = { x: a.x, y: a.y, endX: z.x, endY: z.y, t: 0.42, max: 0.42 };
      break;
    }
    case 'magic':
      zone(a, 'bubble', b.x + b.vx * 0.15, b.y + b.vy * 0.15, aoeR(58), 1.6, a.weapon.damage * 0.85);
      effects.push({ x: a.x, y: a.y - 18, t: 0.4, max: 0.4, text: '🫧 ПУЗЫРЬ!', color: '#008f9b' });
      break;
    case 'saw':
      zone(a, 'spin', a.x, a.y, aoeR(95), 0.7, a.weapon.damage * 0.85);
      break;
    case 'dynamite':
      zone(a, 'gravity', b.x, b.y, aoeR(105), 1.0, a.weapon.damage * 0.9);
      break;
    case 'lightning':
      zone(a, 'storm', b.x + b.vx * 0.15, b.y + b.vy * 0.15, aoeR(66), 0.5, a.weapon.damage * 1.05);
      effects.push({ x: a.x, y: a.y - 18, t: 0.4, max: 0.4, text: '⚡ ТЕСЛА!', color: '#e2bd48' });
      break;
  }
  return true;
}

function updateZones(dt) {
  for (const f of fighters) {
    f.specialGlow = Math.max(0, (f.specialGlow || 0) - dt);
    if (f.leap) {
      f.leap.t -= dt;
      let p = clamp(1 - f.leap.t / f.leap.max, 0, 1);
      f.x = f.leap.x + (f.leap.endX - f.leap.x) * p;
      f.y = f.leap.y + (f.leap.endY - f.leap.y) * p;
      if (f.leap.t <= 0) f.leap = null;
    }
  }

  for (const z of zones) {
    if (!z.owner.alive) {
      z.t = 0;
      continue;
    }
    z.t -= dt;
    const age = z.max - z.t;

    if (z.kind === 'spin' || z.kind === 'parry') {
      z.x = z.owner.x;
      z.y = z.owner.y;
    }

    // Barricade wall: deflects/absorbs incoming projectiles and pushes enemies away
    if (z.kind === 'barricade') {
      shots.forEach(s => {
        if (s.owner !== z.owner && Math.hypot(s.x - z.x, s.y - z.y) < z.r) {
          s.erased = true;
          s.t = 0;
          effects.push({ x: s.x, y: s.y, t: 0.3, max: 0.3, burst: true, color: '#7a6546' });
        }
      });
      for (const b of fighters) {
        if (b.alive && b !== z.owner) {
          let dx = b.x - z.x, dy = b.y - z.y, d = Math.hypot(dx, dy) || 1;
          if (d < z.r + 15) {
            b.vx += (dx / d) * 140 * dt;
            b.vy += (dy / d) * 140 * dt;
          }
        }
      }
    }

    // Summon Bee: flies alongside owner and periodically stings nearest enemy!
    if (z.kind === 'summon_bee') {
      let dx = z.owner.x - z.x, dy = z.owner.y - z.y;
      z.x += dx * dt * 2.2;
      z.y += dy * dt * 2.2;
      z.stingCooldown = (z.stingCooldown || 0) - dt;
      if (z.stingCooldown <= 0) {
        z.stingCooldown = 0.95;
        const enemy = fighters.find(f => f.alive && f !== z.owner && Math.hypot(f.x - z.x, f.y - z.y) < z.r);
        if (enemy) {
          hit(z.owner, enemy, z.damage, 35);
          effects.push({ x: enemy.x, y: enemy.y - 12, t: 0.35, max: 0.35, text: '🐝 УЖАЛЕН!', color: '#9e6909' });
        }
      }
    }

    if (z.kind === 'gravity') {
      for (const b of fighters) {
        if (b.alive && b !== z.owner) {
          let dx = z.x - b.x, dy = z.y - b.y, d = Math.hypot(dx, dy) || 1;
          if (d < z.r + 40) {
            b.vx += (dx / d) * 165 * dt;
            b.vy += (dy / d) * 165 * dt;
          }
        }
      }
    }

    const targets = fighters.filter(b => b.alive && b !== z.owner && Math.hypot(b.x - z.x, b.y - z.y) < z.r);
    const trap = z.kind === 'popcorn' || z.kind === 'bubble';
    const triggered = trap && age > 0.3 && targets.length > 0;
    const active = z.kind === 'spin' || triggered || (!trap && z.t <= 0 && z.kind !== 'barricade' && z.kind !== 'summon_bee');

    if (active) {
      for (const b of targets) {
        if (z.hit.has(b.id)) continue;
        z.hit.add(b.id);
        hit(z.owner, b, z.damage, z.kind === 'gravity' ? -70 : z.kind === 'landing' ? 230 : 90, z.isUlt || false);
        if (z.kind === 'bubble') b.slow = 0.45;
      }
      if (z.kind !== 'spin' && z.kind !== 'barricade' && z.kind !== 'summon_bee') {
        effects.push({ x: z.x, y: z.y, t: 0.55, max: 0.55, explosion: true, color: z.owner.color, style: z.kind });
        if (z.kind === 'storm') {
          effects.push({ x: z.x - 8, y: Math.max(0, z.y - 130), x2: z.x, y2: z.y, t: 0.3, max: 0.3, lightning: true, color: '#d4ab32' });
        }
        z.t = 0;
      }
    }
  }
  zones = zones.filter(z => z.t > 0 && z.owner.alive);
}

function attack(a, b) {
  const k = a.weapon.kind;
  a.attack = 0.3;
  a.cd = (a.weapon.cd * rand(0.9, 1.1)) * a.cdMult;
  a.combo = (a.combo || 0) + 1;

  if (special(a, b)) return;

  if (['gun', 'bow', 'bomb', 'dynamite', 'magic', 'boomerang'].includes(k)) {
    projectile(a, b, k);
    if (k === 'gun') {
      const spread = a.combo % 2 ? 0.25 : 0.09;
      projectile(a, b, k, -spread);
      projectile(a, b, k, spread);
    }
    return;
  }

  if (k === 'lightning') {
    effects.push({ x: a.x, y: a.y, x2: b.x, y2: b.y, t: 0.23, max: 0.23, lightning: true, color: '#e2bd48' });
    hit(a, b, a.weapon.damage, 60);
    const c = fighters.filter(o => o.alive && o !== a && o !== b && Math.hypot(o.x - b.x, o.y - b.y) < 110).sort((c, d) => Math.hypot(c.x - b.x, c.y - b.y) - Math.hypot(d.x - b.x, d.y - b.y))[0];
    if (c) {
      effects.push({ x: b.x, y: b.y, x2: c.x, y2: c.y, t: 0.23, max: 0.23, lightning: true, color: '#e2bd48' });
      hit(a, c, a.weapon.damage * 0.45, 40);
    }
    return;
  }

  let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, third = a.combo % 3 === 0;
  const power = k === 'fist' ? (third ? 1.5 : 0.75) : k === 'sword' && third ? 0.9 : 1;
  const knock = k === 'hammer' ? 240 : k === 'fist' ? (third ? 240 : 90) : k === 'axe' ? (third ? 190 : -115) : k === 'trident' ? (a.combo % 2 ? -65 : -165) : 65;

  hit(a, b, a.weapon.damage * power, knock);

  if (k === 'sword') {
    a.guard = 0.55;
    if (third) {
      const s = shots.find(s => s.owner !== a && s.t > 0 && Math.hypot(s.x - a.x, s.y - a.y) < 105);
      if (s) {
        s.erased = true;
        s.t = 0;
        effects.push({ x: s.x, y: s.y, t: 0.4, max: 0.4, burst: true, color: '#c38d9e' });
      }
    }
  }

  if (k === 'hammer') {
    a.vx += (dx / d) * 210;
    a.vy += (dy / d) * 210;
  }
  if (k === 'dagger' && third) {
    a.cd = 1.15 * a.cdMult;
    const side = a.id % 2 ? 1 : -1;
    a.vx -= (dy / d) * side * 150;
    a.vy += (dx / d) * side * 150;
  }
  if (k === 'fist') {
    a.vx -= (dx / d) * (third ? 120 : 60);
    a.vy -= (dy / d) * (third ? 120 : 60);
  }
  if (k === 'saw') {
    fighters.forEach(o => {
      if (o !== a && o !== b && o.alive && Math.hypot(o.x - a.x, o.y - a.y) < 95) {
        hit(a, o, a.weapon.damage * 0.5, 65);
      }
    });
  }

  effects.push({ x: a.x, y: a.y, x2: b.x, y2: b.y, t: 0.22, max: 0.22, swipe: k, color: a.color });
}

function explode(s) {
  effects.push({ x: s.x, y: s.y, t: 0.5, max: 0.5, explosion: true, color: s.kind === 'bomb' ? '#d99677' : '#e8be62' });
  fighters.forEach(b => {
    if (b.alive && b !== s.owner) {
      let d = Math.hypot(b.x - s.x, b.y - s.y);
      if (d < 95) hit(s.owner, b, s.damage * (1 - d / 190), 190, s.isUlt || false);
    }
  });
}

function triggerUltimate(f) {
  f.ultCharge = 0;
  f.ultCooldown = 18; // Internal cooldown prevents charging ult for 18 seconds
  effects.push({
    x: f.x,
    y: f.y - 35,
    t: 1.5,
    max: 1.5,
    text: '★ УЛЬТА: ' + f.weapon.ult.name + '!',
    color: f.color,
    isUlt: true
  });

  const k = f.weapon.kind;
  const enemies = fighters.filter(e => e.alive && e !== f);

  switch (k) {
    case 'sword': // Кровавая жатва
      f.hp = Math.min(f.maxHp, f.hp + 30);
      shots.forEach(s => {
        if (s.owner !== f && Math.hypot(s.x - f.x, s.y - f.y) < 160) s.erased = true;
      });
      enemies.forEach(e => {
        let d = Math.hypot(e.x - f.x, e.y - f.y);
        if (d < 150) hit(f, e, 17, 240, true);
      });
      effects.push({ x: f.x, y: f.y, t: 0.7, max: 0.7, burst: true, color: '#c33c70' });
      break;

    case 'axe': // Магнитный шторм
      enemies.forEach(e => {
        let dx = f.x - e.x, dy = f.y - e.y, d = Math.hypot(dx, dy) || 1;
        e.vx += (dx / d) * 260;
        e.vy += (dy / d) * 260;
        hit(f, e, 16, -90, true);
      });
      effects.push({ x: f.x, y: f.y, t: 0.8, max: 0.8, explosion: true, color: f.color, style: 'gravity' });
      break;

    case 'gun': // Гороховый пулемёт
      for (let i = 0; i < 8; i++) {
        setTimeout(() => {
          if (!f.alive) return;
          let target = enemies[Math.floor(Math.random() * enemies.length)];
          if (target) {
            let s = projectile(f, target, 'gun', rand(-0.35, 0.35), true);
            s.damage = 5.5;
          }
        }, i * 75);
      }
      break;

    case 'bomb': // Ядерный попкорн
      for (let i = 0; i < 3; i++) {
        let target = enemies[i % enemies.length] || f;
        zone(f, 'popcorn', target.x + rand(-40, 40), target.y + rand(-40, 40), 75, 1.2, 14, true);
      }
      break;

    case 'bow': // Рой Королевы
      for (let i = 0; i < 2; i++) {
        zone(f, 'summon_bee', f.x + rand(-35, 35), f.y + rand(-35, 35), 140, 7.0, 7.5, true);
      }
      effects.push({ x: f.x, y: f.y - 25, t: 1.0, max: 1.0, burst: true, color: '#e5b634' });
      break;

    case 'hammer': // Апокалиптический дроп
      let cluster = enemies[0] || f;
      zone(f, 'landing', cluster.x, cluster.y, 140, 0.5, 20, true);
      f.leap = { x: f.x, y: f.y, endX: cluster.x, endY: cluster.y, t: 0.5, max: 0.5 };
      break;

    case 'dagger': // Танец тысячи теней
      enemies.slice(0, 4).forEach((e, i) => {
        setTimeout(() => {
          if (!f.alive) return;
          f.x = clamp(e.x - 25, 35, W - 35);
          f.y = clamp(e.y - 25, 45, H - 35);
          hit(f, e, 14, 130, true);
          effects.push({ x: e.x, y: e.y, t: 0.3, max: 0.3, burst: true, color: '#7350b8' });
        }, i * 120);
      });
      break;

    case 'trident': // Бесконечный слип
      zone(f, 'spin', f.x, f.y, 130, 2.0, 9, true);
      break;

    case 'boomerang': // Метровая Пепперони
      enemies.forEach(e => {
        let s = projectile(f, e, 'boomerang', 0, true);
        s.damage = 13;
      });
      break;

    case 'magic': // Мыльный шторм
      zone(f, 'spin', f.x, f.y, 120, 2.0, 9, true);
      for (let i = 0; i < 4; i++) {
        let target = enemies[i % enemies.length] || f;
        let s = projectile(f, target, 'magic', rand(-0.4, 0.4), true);
        s.damage = 8;
      }
      break;

    case 'shield': // Железный Бастион
      f.guard = 2.5;
      zone(f, 'barricade', f.x, f.y, 110, 4.0, 14, true);
      enemies.forEach(e => {
        let d = Math.hypot(e.x - f.x, e.y - f.y);
        if (d < 120) hit(f, e, 15, 200, true);
      });
      break;

    case 'fist': // Ураган нокаутов
      f.cd = 0.15;
      enemies.slice(0, 3).forEach(e => hit(f, e, 16, 260, true));
      break;

    case 'saw': // Игольчатая сверхновая
      zone(f, 'spin', f.x, f.y, 130, 1.0, 14, true);
      for (let i = 0; i < 10; i++) {
        let angle = (i * Math.PI * 2) / 10;
        let s = {
          owner: f,
          x: f.x,
          y: f.y,
          vx: Math.cos(angle) * 250,
          vy: Math.sin(angle) * 250,
          t: 0.8,
          kind: 'gun',
          damage: 5.5,
          hit: new Set(),
          isUlt: true
        };
        shots.push(s);
      }
      break;

    case 'dynamite': // Большой Бряк
      zone(f, 'gravity', W / 2, H / 2, 200, 1.4, 20, true);
      break;

    case 'lightning': // Шторм Зевса
      for (let i = 0; i < 4; i++) {
        setTimeout(() => {
          if (!f.alive) return;
          let target = enemies[Math.floor(Math.random() * enemies.length)];
          if (target) {
            effects.push({ x: target.x - 10, y: 0, x2: target.x, y2: target.y, t: 0.4, max: 0.4, lightning: true, color: '#e2bd48' });
            hit(f, target, 14, 70, true);
          }
        }, i * 220);
      }
      break;
  }
}

function broadcastSnapshot() {
  broadcast({
    type: 'battle_tick',
    round: state.currentRound,
    totalRounds: state.totalRounds,
    roundTimeLeft: Math.ceil(state.roundTimeLeft),
    fighters: fighters.map(f => ({
      id: f.id,
      name: f.name,
      roleId: f.roleId,
      weaponKind: f.weapon.kind,
      weaponName: f.weaponName,
      color: f.color,
      race: f.race,
      raceName: f.raceName,
      raceIcon: f.raceIcon,
      scale: f.scale,
      x: f.x,
      y: f.y,
      vx: f.vx,
      vy: f.vy,
      hp: f.hp,
      maxHp: f.maxHp,
      alive: f.alive,
      angle: f.angle,
      flash: f.flash,
      attack: f.attack,
      guard: f.guard,
      slow: f.slow,
      ultCharge: f.ultCharge,
      kills: f.kills,
      specialGlow: f.specialGlow,
      leap: f.leap
    })),
    shots: shots.map(s => ({
      x: s.x,
      y: s.y,
      vx: s.vx,
      vy: s.vy,
      kind: s.kind,
      small: s.small,
      color: s.owner ? s.owner.color : '#333'
    })),
    zones: zones.map(z => ({
      kind: z.kind,
      x: z.x,
      y: z.y,
      r: z.r,
      t: z.t,
      max: z.max,
      color: z.owner ? z.owner.color : '#333'
    })),
    effects: effects.map(e => ({
      x: e.x,
      y: e.y,
      x2: e.x2,
      y2: e.y2,
      t: e.t,
      max: e.max,
      text: e.text,
      color: e.color,
      burst: e.burst,
      explosion: e.explosion,
      style: e.style,
      lightning: e.lightning,
      swipe: e.swipe,
      isUlt: e.isUlt
    }))
  });
}

function finishCurrentRound() {
  // Determine who survived (saved!) and who lost (stays in danger)
  // Rank all participants of this round:
  // 1. Alive fighters ordered by HP descending
  // 2. Dead fighters ordered by reverse time of death (died later = higher rank)
  const aliveList = fighters.filter(f => f.alive).sort((a, b) => b.hp - a.hp);
  const deadList = state.fallenPlayerIds
    .map(sid => fighters.find(f => f.socketId === sid))
    .filter(Boolean)
    .reverse();

  // Full ranking from top to bottom
  const ranked = [...aliveList, ...deadList];
  const total = ranked.length;

  if (total <= 1) {
    // If only 1 player left or all disconnected
    const loserFighter = ranked[0] || fighters[0];
    if (loserFighter) {
      state.loser = {
        name: loserFighter.name,
        roleName: loserFighter.roleName,
        weaponName: loserFighter.weaponName,
        color: loserFighter.color
      };
    }
    state.status = 'GAME_OVER';
    broadcast({
      type: 'game_over',
      loser: state.loser || { name: 'Неизвестный', roleName: '—', weaponName: '—', color: '#888' },
      bracketHistory: state.bracketHistory
    });
    return;
  }

  let safeCount = 0;
  let dangerCount = 0;

  if (total === 2) {
    // Final! Winner is ranked[0], Loser is ranked[1]!
    const winnerFighter = ranked[0];
    const loserFighter = ranked[1];

    state.safePlayerIds.push(winnerFighter.socketId);
    state.loser = {
      name: loserFighter.name,
      roleName: loserFighter.roleName,
      weaponName: loserFighter.weaponName,
      color: loserFighter.color
    };

    state.bracketHistory.push({
      round: state.currentRound,
      title: 'Финал',
      saved: [winnerFighter.name],
      danger: [loserFighter.name]
    });

    state.status = 'GAME_OVER';
    broadcast({
      type: 'game_over',
      loser: state.loser,
      bracketHistory: state.bracketHistory
    });
    return;
  } else if (total === 3) {
    // 3 player special rule: 1 saved, 2 to final
    safeCount = 1;
    dangerCount = 2;
  } else {
    // Halving rule
    safeCount = Math.ceil(total / 2);
    dangerCount = total - safeCount;
  }

  const savedFighters = ranked.slice(0, safeCount);
  const dangerFighters = ranked.slice(safeCount);

  savedFighters.forEach(f => state.safePlayerIds.push(f.socketId));
  state.activeFighterIds = dangerFighters.map(f => f.socketId);

  state.bracketHistory.push({
    round: state.currentRound,
    title: `Раунд ${state.currentRound}`,
    saved: savedFighters.map(f => f.name),
    danger: dangerFighters.map(f => f.name)
  });

  state.status = 'INTERMISSION';
  state.intermissionTimeLeft = 4;

  broadcast({
    type: 'round_finished',
    round: state.currentRound,
    saved: savedFighters.map(f => ({ name: f.name, role: f.roleName })),
    danger: dangerFighters.map(f => ({ name: f.name, role: f.roleName })),
    nextRound: state.currentRound + 1
  });

  let interInterval = setInterval(() => {
    state.intermissionTimeLeft--;
    if (state.intermissionTimeLeft <= 0) {
      clearInterval(interInterval);
      prepareRound(state.currentRound + 1);
    }
  }, 1000);
}

function resetGame() {
  if (simInterval) clearInterval(simInterval);
  simInterval = null;
  if (state.autoCountdown) clearInterval(state.autoCountdown);
  state.autoCountdown = null;

  state.status = 'LOBBY';
  state.currentRound = 1;
  state.roundTimeLeft = state.roundDuration;
  state.activeFighterIds = [];
  state.safePlayerIds = [];
  state.fallenPlayerIds = [];
  state.bracketHistory = [];
  state.loser = null;
  fighters = [];
  shots = [];
  zones = [];
  effects = [];

  state.players.forEach(p => {
    p.ready = false;
    p.isSpectator = false;
  });

  broadcast({
    type: 'reset_to_lobby',
    status: 'LOBBY',
    players: getConnectedPlayers(),
    roles: ROLES.map(r => ({
      ...r,
      takenBy: Array.from(state.players.values()).find(p => p.roleId === r.id)?.name || null
    }))
  });

  broadcastLobbyState();
}

// WebSocket Connection handling
wss.on('connection', ws => {
  const socketId = 'p_' + Math.random().toString(36).substr(2, 9);
  const isSpectatorOnJoin = state.status !== 'LOBBY';

  const player = {
    id: socketId,
    ws,
    name: '',
    roleId: null,
    stats: { str: 4, agi: 4, int: 4 },
    ready: false,
    isAdmin: false,
    isSpectator: isSpectatorOnJoin
  };

  state.players.set(socketId, player);

  // Send initial handshake with complete spectator and match status
  sendTo(ws, {
    type: 'handshake',
    socketId,
    roles: ROLES,
    status: state.status,
    isSpectator: isSpectatorOnJoin,
    roundDuration: state.roundDuration,
    currentRound: state.currentRound,
    totalRounds: state.totalRounds
  });

  broadcastLobbyState();

  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw);
      handleMessage(player, msg);
    } catch (e) {
      console.error('Invalid message:', e);
    }
  });

  ws.on('close', () => {
    handlePlayerDisconnect(player);
  });
});

function handlePlayerDisconnect(player) {
  // If player disconnected or reloaded page:
  // 1. If battle is running and player is an active fighter, kill their fighter immediately!
  if (state.status === 'BATTLE' || state.status === 'COUNTDOWN') {
    const f = fighters.find(x => x.socketId === player.id);
    if (f && f.alive) {
      f.alive = false;
      f.hp = 0;
      if (!state.fallenPlayerIds.includes(player.id)) {
        state.fallenPlayerIds.push(player.id);
      }
      effects.push({ x: f.x, y: f.y, t: 1.0, max: 1.0, burst: true, color: f.color });
      effects.push({ x: f.x, y: f.y - 20, t: 1.5, max: 1.5, text: `${f.name} отключился!`, color: '#d33d46' });
    }
  }

  // 2. Remove from players map & free role
  state.players.delete(player.id);

  // If all players left, automatically reset tournament back to LOBBY
  if (state.players.size === 0 && state.status !== 'LOBBY') {
    resetGame();
    return;
  }

  // 3. Update lobby and check auto start
  checkAutoStart();
  broadcastLobbyState();
}

function handleMessage(player, msg) {
  switch (msg.type) {
    case 'set_profile': {
      if (state.status !== 'LOBBY') return;
      const cleanName = String(msg.name || '').trim().slice(0, 20);
      if (cleanName) {
        // Disconnect any existing ghost session with the exact same name
        for (const [id, p] of state.players.entries()) {
          if (id !== player.id && p.name && p.name.toLowerCase() === cleanName.toLowerCase()) {
            p.ws.close();
            state.players.delete(id);
          }
        }
        player.name = cleanName;
      }

      // Role reservation check (unique per player; spectators cannot hold roles)
      if (!player.isSpectator && typeof msg.roleId === 'number' && msg.roleId >= 0 && msg.roleId < ROLES.length) {
        const taken = Array.from(state.players.values()).some(p => p.id !== player.id && p.roleId === msg.roleId);
        if (!taken) {
          player.roleId = msg.roleId;
        }
      } else if (msg.roleId === null || player.isSpectator) {
        player.roleId = null;
      }

      // Stats check (sum <= 12, each 0..10)
      if (msg.stats) {
        let str = Math.max(0, Math.min(10, Math.floor(Number(msg.stats.str) || 0)));
        let agi = Math.max(0, Math.min(10, Math.floor(Number(msg.stats.agi) || 0)));
        let int = Math.max(0, Math.min(10, Math.floor(Number(msg.stats.int) || 0)));
        if (str + agi + int <= 12) {
          player.stats = { str, agi, int };
        }
      }

      broadcastLobbyState();
      break;
    }

    case 'toggle_spectator': {
      if (state.status !== 'LOBBY') return;
      player.isSpectator = Boolean(msg.isSpectator);
      if (player.isSpectator) {
        player.roleId = null;
        player.ready = false;
      }
      checkAutoStart();
      broadcastLobbyState();
      break;
    }

    case 'toggle_ready': {
      if (state.status !== 'LOBBY') return;
      if (player.isSpectator) return;
      if (!player.name || player.roleId === null) return;
      player.ready = !player.ready;
      checkAutoStart();
      broadcastLobbyState();
      break;
    }

    case 'admin_login': {
      const { user, pass } = msg;
      if (user === ADMIN_USER && pass === ADMIN_PASS) {
        player.isAdmin = true;
        sendTo(player.ws, { type: 'admin_auth_success' });
        broadcastLobbyState();
      } else {
        sendTo(player.ws, { type: 'admin_auth_failed', error: 'Неверный логин или пароль' });
      }
      break;
    }

    case 'admin_start_battle': {
      if (!player.isAdmin) return;
      startTournament();
      break;
    }

    case 'admin_reset_game': {
      if (!player.isAdmin) return;
      resetGame();
      break;
    }

    case 'return_to_lobby': {
      if (state.status === 'GAME_OVER' || player.isAdmin) {
        resetGame();
      }
      break;
    }

    case 'admin_kick_player': {
      if (!player.isAdmin) return;
      const target = state.players.get(msg.targetId);
      if (target && target !== player) {
        sendTo(target.ws, { type: 'kicked', reason: 'Организатор исключил вас из игры' });
        setTimeout(() => {
          try {
            target.ws.close();
          } catch (e) {}
          handlePlayerDisconnect(target);
        }, 50);
      }
      break;
    }

    case 'admin_set_duration': {
      if (!player.isAdmin) return;
      const sec = Math.max(15, Math.min(180, Number(msg.duration) || DEFAULT_ROUND_DURATION));
      state.roundDuration = sec;
      broadcastLobbyState();
      break;
    }
  }
}

function getLocalIps() {
  const ips = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254')) {
        ips.push({ name, address: net.address });
      }
    }
  }
  return ips;
}

function simulateDuel(p1, p2, maxSeconds = 60) {
  const prevFighters = fighters;
  const prevShots = shots;
  const prevZones = zones;
  const prevEffects = effects;

  const role1 = ROLES.find(r => r.id === p1.roleId) || ROLES[0];
  const role2 = ROLES.find(r => r.id === p2.roleId) || ROLES[0];

  const makeFighter = (role, stats, id, x, y, a) => {
    const str = (stats && stats.str) || 0;
    const agi = (stats && stats.agi) || 0;
    const int = (stats && stats.int) || 0;

    const maxHp = 130 + str * 20;
    const speedMult = 0.80 + agi * 0.06;
    const cdMult = 1 / (1 + agi * 0.075);
    const damageMult = (1 + str * 0.04) * (1 + int * 0.045);
    const ultRate = 0.85 + int * 0.12;
    const scale = 0.85 + str * 0.05;
    const radius = 21 * scale;
    const dodgeCooldown = 3.8 / (1 + agi * 0.12);
    const dodgeSpeed = 130 + agi * 15;
    const dodgeChance = agi * 0.035;

    return {
      socketId: 'p_' + id,
      name: role.roleName,
      id,
      roleId: role.id,
      weapon: role,
      roleName: role.roleName,
      weaponName: role.weaponName,
      color: role.color,
      race: role.race,
      raceName: role.raceName,
      raceIcon: role.raceIcon,
      scale,
      radius,
      dodgeCooldown,
      dodgeSpeed,
      dodgeChance,
      x, y,
      vx: 0, vy: 0,
      hp: maxHp,
      maxHp,
      alive: true,
      cd: rand(0.1, 0.4),
      dodge: rand(1.0, 2.5),
      angle: a,
      flash: 0,
      attack: 0,
      phase: rand(0, 6),
      kills: 0,
      guard: 0,
      slow: 0,
      combo: 0,
      specialGlow: 0,
      leap: null,
      ultCharge: 0,
      ultCooldown: 2,
      ultRate,
      speedMult,
      cdMult,
      damageMult,
      str, agi, int
    };
  };

  fighters = [
    makeFighter(role1, p1.stats, 0, W / 2 - 120, H / 2, 0),
    makeFighter(role2, p2.stats, 1, W / 2 + 120, H / 2, Math.PI)
  ];
  shots = [];
  zones = [];
  effects = [];

  const dt = 0.033;
  let t = 0;
  while (t < maxSeconds && fighters[0].alive && fighters[1].alive) {
    updateCombat(dt);
    t += dt;
  }

  let winnerId = -1;
  if (!fighters[0].alive && fighters[1].alive) winnerId = 1;
  else if (!fighters[1].alive && fighters[0].alive) winnerId = 0;
  else winnerId = fighters[0].hp >= fighters[1].hp ? 0 : 1;

  const result = {
    winner: winnerId,
    f0Hp: Math.max(0, fighters[0].hp),
    f1Hp: Math.max(0, fighters[1].hp),
    duration: t
  };

  fighters = prevFighters;
  shots = prevShots;
  zones = prevZones;
  effects = prevEffects;

  return result;
}

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    const localIps = getLocalIps();
    console.log(`\n=============================================================`);
    console.log(`🎮 Битва на карандашах — СЕРВЕР ЗАПУЩЕН!`);
    console.log(`💻 На этом ПК в браузере: http://localhost:${PORT}`);
    if (localIps.length > 0) {
      console.log(`📱 С телефонов и ноутбуков в этой же Wi-Fi/локальной сети:`);
      localIps.forEach(ip => {
        console.log(`   👉 http://${ip.address}:${PORT}  (${ip.name})`);
      });
    }
    console.log(`=============================================================\n`);
  });
}

module.exports = {
  app,
  server,
  ROLES,
  RACE_ADVANTAGE,
  simulateDuel
};
