const { ROLES, RACE_ADVANTAGE, simulateDuel } = require('./server.js');

console.log('=============================================================================');
console.log('📊 ЗАПУСК СИМУЛЯТОРА БАЛАНСА БИТВЫ НА КАРАНДАШАХ (15 РОЛЕЙ)');
console.log('=============================================================================\n');

// 1. ТЕСТ 1: ЗЕРКАЛЬНЫЕ ДУЭЛИ (Mirror Match: Role A vs Role A, 4,4,4)
console.log('--- 1. ТЕСТ: Зеркальные матчи (Правильные одинаковые настройки -> 50% винрейт) ---');
const mirrorTrials = 60;
ROLES.slice(0, 5).forEach(r => {
  let wins0 = 0;
  for (let i = 0; i < mirrorTrials; i++) {
    const res = simulateDuel(
      { roleId: r.id, stats: { str: 4, agi: 4, int: 4 } },
      { roleId: r.id, stats: { str: 4, agi: 4, int: 4 } }
    );
    if (res.winner === 0) wins0++;
  }
  const wr = ((wins0 / mirrorTrials) * 100).toFixed(1);
  console.log(`✓ [${r.raceIcon} ${r.roleName}] vs Сам с собой: ${wr}% побед (ожидается ~50%)`);
});

// 2. ТЕСТ 2: ТУРНИР ВСЕХ 15 РОЛЕЙ НА БАЗОВЫХ СБАЛАНСИРОВАННЫХ НАСТРОЙКАХ (4, 4, 4)
console.log('\n--- 2. ТЕСТ: Общий баланс всех 15 ролей (Круговой турнир 4,4,4 vs 4,4,4) ---');
const totalRoles = ROLES.length;
const winsPerRole = Array(totalRoles).fill(0);
const fightsPerRole = Array(totalRoles).fill(0);
const duelsPerPair = 20;

for (let i = 0; i < totalRoles; i++) {
  for (let j = i + 1; j < totalRoles; j++) {
    const r1 = ROLES[i];
    const r2 = ROLES[j];
    for (let k = 0; k < duelsPerPair; k++) {
      const res = simulateDuel(
        { roleId: r1.id, stats: { str: 4, agi: 4, int: 4 } },
        { roleId: r2.id, stats: { str: 4, agi: 4, int: 4 } }
      );
      if (res.winner === 0) winsPerRole[i]++;
      else winsPerRole[j]++;
      fightsPerRole[i]++;
      fightsPerRole[j]++;
    }
  }
}

console.log('Итоги кругового турнира (цель для каждой роли: около 45% - 55%):');
ROLES.forEach((r, idx) => {
  const wr = ((winsPerRole[idx] / fightsPerRole[idx]) * 100).toFixed(1);
  const status = (wr >= 40 && wr <= 60) ? '✅ ИДЕАЛЬНО' : (wr >= 35 && wr <= 65) ? '✓ В НОРМЕ' : '⚠️ ТРЕБУЕТ ПОДСТРОЙКИ';
  console.log(`  ${r.raceIcon} #${r.id.toString().padEnd(2)} ${r.roleName.padEnd(26)} | Боёв: ${fightsPerRole[idx]} | Винрейт: ${wr.padStart(5)}% | ${status}`);
});

// 3. ТЕСТ 3: ТАКТИЧЕСКИЙ ПОДБОР ХАРАКТЕРИСТИК (ПРАВИЛЬНЫЙ БИЛД vs НЕПРАВИЛЬНЫЙ БИЛД)
console.log('\n--- 3. ТЕСТ: Влияние характеристик (Правильный контр-билд vs Неправильный билд) ---');

function runMatchup(nameA, roleA, statsA, nameB, roleB, statsB, trials = 60) {
  let aWins = 0;
  for (let i = 0; i < trials; i++) {
    const res = simulateDuel(
      { roleId: roleA, stats: statsA },
      { roleId: roleB, stats: statsB }
    );
    if (res.winner === 0) aWins++;
  }
  const wrA = ((aWins / trials) * 100).toFixed(1);
  const wrB = (100 - wrA).toFixed(1);
  console.log(`⚔️  ${nameA} [${wrA}%]  vs  ${nameB} [${wrB}%]`);
  return { wrA, wrB };
}

// Сценарий А: Титаны контрят Теней (Мясник против Шиноби)
console.log('\n[Сценарий А: Титан против Тени]');
runMatchup(
  '🛡️ Мясник (ПРАВИЛЬНО: Танк 8,2,2)', 1, { str: 8, agi: 2, int: 2 },
  '⚡ Шиноби (Сбалансирован 4,4,4)', 6, { str: 4, agi: 4, int: 4 }
);
runMatchup(
  '❌ Мясник (НЕПРАВИЛЬНО: Стеклянный маг 0,2,10)', 1, { str: 0, agi: 2, int: 10 },
  '⚡ Шиноби (Сбалансирован 4,4,4)', 6, { str: 4, agi: 4, int: 4 }
);

// Сценарий Б: Тени контрят Мистиков (Трюкач против Снайпера)
console.log('\n[Сценарий Б: Тень против Мистика]');
runMatchup(
  '⚡ Дворовый Трюкач (ПРАВИЛЬНО: Ловкач 2,8,2)', 7, { str: 2, agi: 8, int: 2 },
  '🔮 Снайпер (Сбалансирован 4,4,4)', 2, { str: 4, agi: 4, int: 4 }
);
runMatchup(
  '❌ Дворовый Трюкач (НЕПРАВИЛЬНО: 0 ловкости и HP 0,0,12)', 7, { str: 0, agi: 0, int: 12 },
  '🔮 Снайпер (Сбалансирован 4,4,4)', 2, { str: 4, agi: 4, int: 4 }
);

// Сценарий В: Мистики контрят Титанов (Снайпер против Панчера)
console.log('\n[Сценарий В: Мистик против Титана]');
runMatchup(
  '🔮 Снайпер (ПРАВИЛЬНО: Кайт/Маг 2,2,8)', 2, { str: 2, agi: 2, int: 8 },
  '🛡️ Стальной Панчер (Сбалансирован 4,4,4)', 11, { str: 4, agi: 4, int: 4 }
);
runMatchup(
  '❌ Снайпер (НЕПРАВИЛЬНО: Неподвижный 0,0,12)', 2, { str: 0, agi: 0, int: 12 },
  '🛡️ Стальной Панчер (Сбалансирован 4,4,4)', 11, { str: 4, agi: 4, int: 4 }
);

console.log('\n=============================================================================');
console.log('🏁 ТЕСТИРОВАНИЕ ЗАВЕРШЕНО');
console.log('=============================================================================');
