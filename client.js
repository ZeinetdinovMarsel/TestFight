(() => {
  'use strict';

  const W = 1000, H = 645;
  let socketId = null;
  let ws = null;
  let roles = [];
  let currentStatus = 'LOBBY';
  let myRole = null;
  let myStats = { str: 4, agi: 4, int: 4 };
  let myName = localStorage.getItem('pencil_name') || '';
  let isAdmin = false;
  let isReady = false;
  let isKicked = false;
  let lastRosterPlayers = [];

  // Render State
  let fighters = [];
  let shots = [];
  let zones = [];
  let effects = [];
  let roundTimeLeft = 60;
  let currentRound = 1;
  let totalRounds = 1;
  let raf = 0;

  // Visual Juice: Screen Shake, Hit Impact & Particle Engine
  let screenShake = 0;
  let lastFrameTime = performance.now();
  const lastFighterHp = new Map();
  const clientParticles = [];

  function triggerScreenShake(amt) {
    screenShake = Math.max(screenShake, amt);
  }

  function emitHitSparks(x, y, color, isCrit = false) {
    const count = isCrit ? 16 : 8;
    for (let i = 0; i < count; i++) {
      let a = Math.random() * Math.PI * 2;
      let spd = (isCrit ? 95 : 55) + Math.random() * (isCrit ? 140 : 85);
      clientParticles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6,
        size: 2.2 + Math.random() * (isCrit ? 3.5 : 2.0),
        color: Math.random() < 0.35 ? '#ffffff' : Math.random() < 0.7 ? '#ffe066' : color,
        star: isCrit
      });
    }
  }

  function emitUltBurst(x, y, color) {
    for (let i = 0; i < 24; i++) {
      let a = Math.random() * Math.PI * 2;
      let spd = 70 + Math.random() * 180;
      clientParticles.push({
        x, y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 0.55 + Math.random() * 0.45,
        maxLife: 1.0,
        size: 3.5 + Math.random() * 3.5,
        color: Math.random() < 0.5 ? '#ffd700' : Math.random() < 0.8 ? color : '#ffffff',
        star: true
      });
    }
  }

  function updateAndDrawParticles(dt) {
    for (let i = clientParticles.length - 1; i >= 0; i--) {
      let p = clientParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        clientParticles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;

      let alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.star) {
        ctx.beginPath();
        for (let s = 0; s < 4; s++) {
          let a = (s * Math.PI * 2) / 4;
          let r = p.size;
          s ? ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r) : ctx.moveTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
        }
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // DOM Elements
  const $ = id => document.getElementById(id);
  const canvas = $('canvas');
  let ctx = canvas.getContext('2d');

  // WebSocket Connection
  function getWebSocketUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    let custom = urlParams.get('server') || localStorage.getItem('pencil_server_url');

    if (window.location.hostname.includes('github.io') && !custom) {
      custom = prompt('Вы открыли игру с GitHub Pages!\nGitHub Pages статичен, поэтому для сетевой игры укажите адрес вашего бесплатного сервера (с Render.com, Glitch или локального туннеля):', 'https://');
      if (custom && custom !== 'https://') {
        localStorage.setItem('pencil_server_url', custom.trim());
      } else {
        custom = null;
      }
    }

    if (custom) {
      let clean = custom.trim();
      if (clean.startsWith('https://')) clean = clean.replace('https://', 'wss://');
      else if (clean.startsWith('http://')) clean = clean.replace('http://', 'ws://');
      else if (!clean.startsWith('ws://') && !clean.startsWith('wss://')) {
        clean = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + clean;
      }
      return clean;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }

  function connect() {
    const wsUrl = getWebSocketUrl();
    console.log('Connecting to WebSocket:', wsUrl);
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      console.error('WebSocket init error:', e);
      return;
    }

    ws.onopen = () => {
      console.log('Connected to server');
      if (myName) {
        send({ type: 'set_profile', name: myName, stats: myStats });
      }
    };

    ws.onmessage = evt => {
      try {
        const msg = JSON.parse(evt.data);
        handleServerMessage(msg);
      } catch (e) {
        console.error('Error parsing message:', e);
      }
    };

    ws.onclose = () => {
      if (isKicked) return;
      console.log('Disconnected. Reconnecting in 2s...');
      setTimeout(connect, 2000);
    };
  }

  function send(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  function handleServerMessage(msg) {
    switch (msg.type) {
      case 'handshake':
        socketId = msg.socketId;
        roles = msg.roles;
        renderRoleCards();
        break;

      case 'kicked':
        isKicked = true;
        if (ws) ws.close();
        $('overlayBox').innerHTML = `
          <div class="doodle">🚫</div>
          <h2 style="color:#c94036;">ВЫ БЫЛИ ИСКЛЮЧЕНЫ</h2>
          <p>Организатор исключил вас из комнаты.</p>
        `;
        $('overlay').classList.remove('hidden');
        break;

      case 'reset_to_lobby':
        isReady = false;
        $('btnReady').textContent = '⚔ Я ГОТОВ К БИТВЕ ↗';
        $('btnReady').classList.remove('ready-active');
        fighters = [];
        shots = [];
        zones = [];
        effects = [];
        lastFighterHp.clear();
        clientParticles.length = 0;
        screenShake = 0;
        showLobbyView();
        hideOverlay();
        if (msg.players) updateLobbyRoster(msg.players);
        $('toastBanner').classList.remove('hidden');
        $('toastBanner').textContent = 'Организатор сбросил лобби!';
        setTimeout(() => $('toastBanner').classList.add('hidden'), 3500);
        break;

      case 'lobby_update':
        currentStatus = msg.status;
        if (msg.roles) {
          roles = msg.roles;
          updateRolesTakenStatus();
        }
        updateLobbyRoster(msg.players);
        updateLobbyUI(msg);
        break;

      case 'round_countdown':
        $('toastBanner').classList.add('hidden');
        $('toastBanner').textContent = '';
        showArenaView();
        currentRound = msg.round;
        totalRounds = msg.totalRounds;
        $('roundBadge').textContent = getRoundTitle(msg.round, totalRounds);
        showCountdownOverlay(3);
        break;

      case 'countdown_tick':
        $('toastBanner').classList.add('hidden');
        showCountdownOverlay(msg.left);
        break;

      case 'battle_tick':
        if (!$('toastBanner').classList.contains('hidden')) {
          $('toastBanner').classList.add('hidden');
          $('toastBanner').textContent = '';
        }
        hideOverlay();
        currentRound = msg.round;
        totalRounds = msg.totalRounds;
        roundTimeLeft = msg.roundTimeLeft;
        fighters = msg.fighters;
        shots = msg.shots;
        zones = msg.zones;
        effects = msg.effects;

        // Hit Impact detection from HP delta & effect inspection
        if (fighters) {
          fighters.forEach(f => {
            let prevHp = lastFighterHp.get(f.id);
            if (prevHp !== undefined && f.hp < prevHp) {
              let dmg = prevHp - f.hp;
              triggerScreenShake(Math.min(9, 2 + dmg * 0.35));
              emitHitSparks(f.x, f.y, f.color, dmg > 14);
            }
            lastFighterHp.set(f.id, f.hp);
          });
        }
        if (effects) {
          effects.forEach(e => {
            if (e.isUlt) {
              triggerScreenShake(14);
              if (Math.random() < 0.25) emitUltBurst(e.x, e.y, e.color);
            } else if (e.burst || e.explosion) {
              triggerScreenShake(6);
            }
          });
        }

        $('roundBadge').textContent = getRoundTitle(msg.round, totalRounds);
        $('timer').textContent = formatTime(roundTimeLeft);
        $('alive').textContent = fighters.filter(f => f.alive).length + ' / ' + fighters.length;
        break;

      case 'round_finished':
        showIntermissionOverlay(msg);
        break;

      case 'game_over':
        showGameOverOverlay(msg);
        break;

      case 'admin_auth_success':
        isAdmin = true;
        $('adminLoginForm').classList.add('hidden');
        $('adminControls').classList.remove('hidden');
        $('btnOpenAdmin').textContent = '★ Панель Админа';
        $('btnOpenAdmin').classList.add('ready-active');
        $('adminModal').classList.remove('hidden');
        if (lastRosterPlayers) {
          updateLobbyRoster(lastRosterPlayers);
        }
        break;

      case 'admin_auth_failed':
        alert(msg.error || 'Ошибка входа: проверьте логин и пароль');
        break;
    }
  }

  function getRoundTitle(r, total) {
    if (fighters.length === 2) return 'Финал';
    if (fighters.length === 3) return 'Полуфинал';
    return `Раунд ${r}`;
  }

  function formatTime(sec) {
    let s = Math.max(0, Math.ceil(sec));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  // Character preview on role card
  function drawRolePreview(cnv, r) {
    if (!cnv) return;
    const pctx = cnv.getContext('2d');
    pctx.clearRect(0, 0, 75, 75);

    // Warm paper notebook background
    pctx.fillStyle = '#fffdf7';
    pctx.fillRect(0, 0, 75, 75);

    pctx.strokeStyle = '#e6e1d6';
    pctx.lineWidth = 1;
    pctx.beginPath();
    pctx.moveTo(0, 25); pctx.lineTo(75, 25);
    pctx.moveTo(0, 50); pctx.lineTo(75, 50);
    pctx.stroke();

    pctx.save();
    pctx.translate(34, 46);

    // Body outline with handwritten pencil shape & loose ink hatching
    let outline = [];
    for (let i = 0; i < 36; i++) {
      let a = (i * Math.PI) / 18;
      let radius = 17.5 + Math.sin(a * 3 + r.id * 1.7) * 2.6 + Math.cos(a * 5 - r.id) * 1.5;
      outline.push([Math.cos(a) * radius, Math.sin(a) * radius * 0.88]);
    }

    pencilShape(outline, r.color, r.id, pctx);

    // Eyes and smile face in exact in-game pencil stroke style
    pctx.save();
    pctx.strokeStyle = '#392f42';
    pencilLine([[-7, -4], [-6, 0]], pctx);
    pencilLine([[5, -5], [6, -1]], pctx);
    pencilLine([[-2, 6], [1, 8], [5, 5]], pctx);

    // Pink pencil blush
    pctx.strokeStyle = '#db7666';
    pctx.globalAlpha = 0.45;
    pencilLine([[-10, 4], [-6, 3]], pctx);
    pencilLine([[6, 3], [10, 4]], pctx);
    pctx.restore();

    // Draw hat using drawHat
    pctx.save();
    drawHat({ weaponKind: r.kind, color: r.color }, pctx);
    pctx.restore();

    // Draw held weapon
    pctx.save();
    pctx.translate(22, 6);
    pctx.rotate(0.25);
    pctx.scale(0.85, 0.85);
    drawWeapon(r.kind, r.color, pctx);
    pctx.restore();

    pctx.restore();
  }

  // UI Setup & Rendering
  function renderRoleCards() {
    const container = $('rolesContainer');
    container.replaceChildren();

    roles.forEach(r => {
      const card = document.createElement('div');
      card.className = 'role-card';
      card.id = `role-card-${r.id}`;

      const raceClass = r.race || 'titan';
      const raceIcon = r.raceIcon || (r.race === 'titan' ? '🛡️' : r.race === 'shadow' ? '⚡' : '🔮');
      const raceLabel = r.raceName || (r.race === 'titan' ? 'Титан' : r.race === 'shadow' ? 'Тень' : 'Мистик');

      card.innerHTML = `
        <div class="role-top-row">
          <canvas width="75" height="75" class="role-preview-canvas" id="role-preview-${r.id}"></canvas>
          <div class="role-meta">
            <span class="role-type-badge ${raceClass}">${raceIcon} ${raceLabel}</span>
            <h4 class="role-name">${r.roleName}</h4>
            <div class="role-weapon">Оружие: <b>${r.weaponName}</b></div>
          </div>
        </div>
        <div class="skill-list">
          <div><strong>1. ${r.skill1.name}:</strong> ${r.skill1.desc}</div>
          <div><strong>2. ${r.skill2.name}:</strong> ${r.skill2.desc}</div>
          <div class="skill-ult">★ ${r.ult.name}: <span style="font-weight:normal; font-size:10.5px; color:#555;">${r.ult.desc}</span></div>
        </div>
      `;

      card.onclick = () => {
        if (card.classList.contains('taken')) return;
        selectRole(r.id);
      };

      container.appendChild(card);

      const previewCanvas = card.querySelector(`#role-preview-${r.id}`);
      drawRolePreview(previewCanvas, r);
    });
  }

  function selectRole(roleId) {
    myRole = roleId;
    document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
    const active = $(`role-card-${roleId}`);
    if (active) active.classList.add('selected');

    sendProfile();
  }

  function updateRolesTakenStatus() {
    roles.forEach(r => {
      const card = $(`role-card-${r.id}`);
      if (!card) return;

      const takenBy = r.takenBy;
      const isMine = myRole === r.id;

      card.classList.remove('taken', 'selected');
      const existingBadge = card.querySelector('.taken-label');
      if (existingBadge) existingBadge.remove();

      if (takenBy && !isMine) {
        card.classList.add('taken');
        const badge = document.createElement('span');
        badge.className = 'taken-label';
        badge.textContent = `Занял: ${takenBy}`;
        card.appendChild(badge);
      } else if (isMine) {
        card.classList.add('selected');
      }
    });
  }

  function updateLobbyRoster(players) {
    lastRosterPlayers = players || [];
    const list = $('rosterList');
    list.replaceChildren();

    let readyCount = 0;
    lastRosterPlayers.forEach(p => {
      if (p.ready) readyCount++;

      const item = document.createElement('div');
      item.className = 'roster-item';

      const roleObj = roles.find(r => r.id === p.roleId);
      const raceIcon = roleObj ? (roleObj.raceIcon || (roleObj.race === 'titan' ? '🛡️' : roleObj.race === 'shadow' ? '⚡' : '🔮')) : '';
      const roleStr = roleObj ? `${raceIcon} ${roleObj.roleName} (${roleObj.weaponName})` : 'Выбирает...';
      const statsStr = p.stats ? `СИЛ:${p.stats.str} ЛОВ:${p.stats.agi} ИНТ:${p.stats.int}` : '';

      item.innerHTML = `
        <div class="roster-item-info">
          <b>${p.name || 'Аноним'} ${p.isAdmin ? '★' : ''} ${p.id === socketId ? '(Вы)' : ''}</b>
          <span>${roleStr}</span>
          <span style="font-size:10px; color:#888; display:block;">${statsStr}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="roster-status ${p.ready ? 'ready' : 'waiting'}">
            ${p.ready ? '✓ Готов' : '⏳ Ждёт'}
          </span>
          ${isAdmin && p.id !== socketId ? `<button type="button" class="btn-kick" onclick="window.kickPlayer('${p.id}')">Выгнать</button>` : ''}
        </div>
      `;
      list.appendChild(item);
    });

    $('lobbyCount').textContent = `${lastRosterPlayers.length} / 15`;
    renderAdminPlayerList(lastRosterPlayers);
  }

  function renderAdminPlayerList(players) {
    const list = $('adminPlayerList');
    if (!list) return;
    list.replaceChildren();

    if (!players || !players.length) {
      list.innerHTML = '<span style="color:#999; font-size:12px; padding:6px;">Нет подключённых игроков</span>';
      return;
    }

    players.forEach(p => {
      const row = document.createElement('div');
      row.className = 'admin-player-row';
      const roleObj = roles.find(r => r.id === p.roleId);
      const roleStr = roleObj ? roleObj.roleName : 'Выбирает...';

      row.innerHTML = `
        <div style="min-width:0; flex:1;">
          <b>${p.name || 'Аноним'}</b> ${p.id === socketId ? '<span style="color:#216933;">(Вы)</span>' : ''}
          <div style="font-size:11px; color:#777;">${roleStr} · ${p.ready ? '✓ Готов' : '⏳ Ждёт'}</div>
        </div>
        ${p.id !== socketId ? `<button type="button" class="btn-kick" onclick="window.kickPlayer('${p.id}')">Выгнать</button>` : ''}
      `;
      list.appendChild(row);
    });
  }

  function updateLobbyUI(msg) {
    if (msg.status === 'LOBBY') {
      showLobbyView();
      if (msg.autoCountdown !== null && msg.autoCountdown !== undefined) {
        $('toastBanner').classList.remove('hidden');
        $('toastBanner').textContent = `Все игроки готовы! Старт битвы через ${msg.autoCountdown} сек...`;
      } else {
        $('toastBanner').classList.add('hidden');
        $('toastBanner').textContent = '';
      }
    } else {
      $('toastBanner').classList.add('hidden');
      $('toastBanner').textContent = '';
    }
  }

  function sendProfile() {
    myName = $('inputName').value.trim();
    if (myName) localStorage.setItem('pencil_name', myName);

    send({
      type: 'set_profile',
      name: myName,
      roleId: myRole,
      stats: myStats
    });
  }

  // Stat allocation
  function updateStatDisplays() {
    const total = 12;
    const used = myStats.str + myStats.agi + myStats.int;
    const remaining = total - used;

    $('statStr').textContent = myStats.str;
    $('statAgi').textContent = myStats.agi;
    $('statInt').textContent = myStats.int;
    $('pointsLeft').textContent = remaining;

    // Real dynamic stat descriptions showing actual in-game values
    const descStr = $('descStr');
    if (descStr) {
      descStr.textContent = `HP: ${130 + myStats.str * 20} · Стойкость к толчкам · Ярость ульты: +${myStats.str * 7}% (Контрит ассасинов)`;
    }
    const descAgi = $('descAgi');
    if (descAgi) {
      descAgi.textContent = `Бег: +${Math.round(myStats.agi * 6)}% · Темп: +${Math.round(myStats.agi * 7.5)}% · Уворот: ${Math.round(myStats.agi * 3.5)}% (Контрит магов)`;
    }
    const descInt = $('descInt');
    if (descInt) {
      descInt.textContent = `Спецприём: ${myStats.int >= 5 ? 'каждые 3 удара' : 'каждые 4 удара'} · Зоны: +${myStats.int * 5}% · Магия: +${Math.round(myStats.int * 4.5)}% (Контрит танков)`;
    }

    $('btnStrPlus').disabled = remaining <= 0 || myStats.str >= 10;
    $('btnStrMinus').disabled = myStats.str <= 0;
    $('btnAgiPlus').disabled = remaining <= 0 || myStats.agi >= 10;
    $('btnAgiMinus').disabled = myStats.agi <= 0;
    $('btnIntPlus').disabled = remaining <= 0 || myStats.int >= 10;
    $('btnIntMinus').disabled = myStats.int <= 0;
  }

  function changeStat(stat, delta) {
    const total = 12;
    const used = myStats.str + myStats.agi + myStats.int;
    if (delta > 0 && used >= total) return;
    if (delta < 0 && myStats[stat] <= 0) return;
    if (delta > 0 && myStats[stat] >= 10) return;

    myStats[stat] += delta;
    updateStatDisplays();
    sendProfile();
  }

  function applyPreset(str, agi, int) {
    myStats = { str, agi, int };
    updateStatDisplays();
    sendProfile();
  }

  // Ready Toggle
  $('btnReady').onclick = () => {
    myName = $('inputName').value.trim();
    if (!myName) {
      alert('Введите ваше имя!');
      $('inputName').focus();
      return;
    }
    if (myRole === null) {
      alert('Выберите роль!');
      return;
    }
    send({ type: 'toggle_ready' });
    isReady = !isReady;
    if (isReady) {
      $('btnReady').textContent = '✓ ГОТОВ (ОТМЕНА)';
      $('btnReady').classList.add('ready-active');
    } else {
      $('btnReady').textContent = '⚔ ГОТОВ';
      $('btnReady').classList.remove('ready-active');
    }
  };

  if ($('btnServerConfig')) {
    $('btnServerConfig').onclick = () => {
      const cur = localStorage.getItem('pencil_server_url') || (window.location.protocol === 'https:' ? 'https://' : 'http://') + window.location.host;
      const next = prompt('Адрес игрового сервера (например с Render.com, Glitch или IP вашего ПК для игры с телефона):', cur);
      if (next !== null) {
        if (next.trim()) {
          localStorage.setItem('pencil_server_url', next.trim());
        } else {
          localStorage.removeItem('pencil_server_url');
        }
        window.location.reload();
      }
    };
  }

  // Admin Modal
  $('btnOpenAdmin').onclick = () => {
    $('adminModal').classList.remove('hidden');
    if (!isAdmin) {
      setTimeout(() => $('adminUser').focus(), 100);
    }
  };

  $('btnCloseAdmin').onclick = () => {
    $('adminModal').classList.add('hidden');
  };

  function submitAdminLogin() {
    const user = $('adminUser').value.trim();
    const pass = $('adminPass').value.trim();
    if (!user || !pass) {
      alert('Введите логин и пароль организатора!');
      return;
    }
    send({ type: 'admin_login', user, pass });
  }

  $('adminLoginForm').onsubmit = e => {
    e.preventDefault();
    submitAdminLogin();
    return false;
  };

  $('btnAdminLogin').onclick = e => {
    e.preventDefault();
    submitAdminLogin();
  };

  if ($('btnAdminLogout')) {
    $('btnAdminLogout').onclick = () => {
      isAdmin = false;
      $('adminLoginForm').classList.remove('hidden');
      $('adminControls').classList.add('hidden');
      $('btnOpenAdmin').textContent = '🔑 Вход для админа';
      $('btnOpenAdmin').classList.remove('ready-active');
      $('adminUser').value = '';
      $('adminPass').value = '';
      if (lastRosterPlayers) updateLobbyRoster(lastRosterPlayers);
    };
  }

  $('btnAdminStart').onclick = () => {
    send({ type: 'admin_start_battle' });
    $('adminModal').classList.add('hidden');
  };

  $('btnAdminReset').onclick = () => {
    if (confirm('Сбросить текущий матч и вернуть всех игроков в лобби?')) {
      send({ type: 'admin_reset_game' });
    }
  };

  if ($('btnAdminSetDuration')) {
    $('btnAdminSetDuration').onclick = () => {
      const sec = parseInt($('adminDuration').value, 10);
      if (sec >= 15 && sec <= 180) {
        send({ type: 'admin_set_duration', duration: sec });
        alert(`Длительность раунда установлена на ${sec} сек.`);
      } else {
        alert('Введите значение от 15 до 180 секунд.');
      }
    };
  }

  window.kickPlayer = id => {
    const target = lastRosterPlayers.find(p => p.id === id);
    const targetName = target && target.name ? target.name : 'Игрок';
    send({ type: 'admin_kick_player', targetId: id });
    const banner = $('toastBanner');
    if (banner) {
      banner.classList.remove('hidden');
      banner.textContent = `★ ${targetName} исключён из комнаты.`;
      setTimeout(() => banner.classList.add('hidden'), 3500);
    }
  };

  // View Switching
  function showLobbyView() {
    $('lobbyView').style.display = 'block';
    $('arenaView').classList.remove('active');
    hideOverlay();
  }

  function showArenaView() {
    $('lobbyView').style.display = 'none';
    $('arenaView').classList.add('active');
    $('toastBanner').classList.add('hidden');
    $('toastBanner').textContent = '';
  }

  // Overlays
  function showCountdownOverlay(num) {
    const box = $('overlayBox');
    box.innerHTML = `
      <div class="doodle">✎ ⚔ ✎</div>
      <h2>${num > 0 ? num : 'БОЙ!'}</h2>
    `;
    $('overlay').classList.remove('hidden');
  }

  function showIntermissionOverlay(data) {
    const box = $('overlayBox');
    box.innerHTML = `
      <h2>Раунд ${data.round} окончен</h2>
      <div style="background:#eaf6ec; border:1.5px solid #8ab893; border-radius:8px; padding:10px; margin:10px 0; text-align:left;">
        <b style="color:#2b6938;">✓ Спаслись:</b>
        <div>${data.saved.map(s => `<b>${s.name}</b> (${s.role})`).join(', ') || '—'}</div>
      </div>
      <div style="background:#fdeeee; border:1.5px solid #d88a82; border-radius:8px; padding:10px; margin:10px 0; text-align:left;">
        <b style="color:#a83226;">⚠ В опасности (Раунд ${data.nextRound}):</b>
        <div>${data.danger.map(d => `<b>${d.name}</b> (${d.role})`).join(', ')}</div>
      </div>
    `;
    $('overlay').classList.remove('hidden');
  }

  function showGameOverOverlay(data) {
    const box = $('overlayBox');
    const loser = data.loser;

    let bracketHtml = '';
    if (data.bracketHistory && data.bracketHistory.length) {
      bracketHtml = `
        <div class="bracket-log">
          <b>Ход турнира:</b>
          ${data.bracketHistory.map(b => `
            <div class="bracket-row">
              <b>${b.title}:</b> Спаслись: <i>${b.saved.join(', ')}</i> | В опасности: <i>${b.danger.join(', ')}</i>
            </div>
          `).join('')}
        </div>
      `;
    }

    const raceIcon = loser.raceIcon || (loser.race === 'titan' ? '🛡️' : loser.race === 'shadow' ? '⚡' : '🔮');
    box.innerHTML = `
      <div class="doodle">💀</div>
      <h2 class="loser-title">ПРОИГРАВШИЙ</h2>
      <div class="loser-name">${loser.name}</div>
      <div style="font-size:14px; color:#5d5266; margin-bottom:12px;">${raceIcon} ${loser.roleName} · ${loser.weaponName}</div>
      ${bracketHtml}
      <button id="btnReturnLobby" class="button" style="margin-top:16px;">В лобби</button>
    `;

    $('overlay').classList.remove('hidden');

    $('btnReturnLobby').onclick = () => {
      send({ type: 'return_to_lobby' });
      showLobbyView();
    };
  }

  function hideOverlay() {
    $('overlay').classList.add('hidden');
  }

  // ================= CANVAS DRAWING ENGINE =================
  let sketchFrame = 0;
  const sketchFPS = 10;
  const looseInkCache = new Map();

  function looseInk(points, color, pattern, variant) {
    const key = color + ':' + pattern + ':' + variant + ':' + points.map(p => p.map(n => n.toFixed(1)).join(',')).join(';');
    if (looseInkCache.has(key)) return looseInkCache.get(key);

    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const width = maxX - minX, height = maxY - minY, pad = 18;

    const image = document.createElement('canvas');
    image.width = Math.ceil((width + pad * 2) * 2);
    image.height = Math.ceil((height + pad * 2) * 2);
    const p = image.getContext('2d');
    p.scale(2, 2);
    p.translate(pad - minX, pad - minY);
    p.strokeStyle = color;
    p.lineCap = 'round';

    const noise = n => {
      const v = Math.sin(n * 127.1 + pattern * 73.9) * 43758.5453;
      return v - Math.floor(v);
    };
    const redraw = (i, salt) => Math.sin(i * 1.79 + variant * 1.37 + salt * 3.17);

    function inside(x, y) {
      let yes = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        let a = points[i], b = points[j];
        if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
      }
      return yes;
    }

    const count = Math.min(680, Math.max(38, Math.ceil(width * height * 0.21)));
    for (let i = 0; i < count; i++) {
      let baseX = minX + noise(i * 11 + 1) * width, baseY = minY + noise(i * 11 + 2) * height;
      if (!inside(baseX, baseY)) continue;
      let x = baseX + redraw(i, 1) * 1.7, y = baseY + redraw(i, 2) * 1.7;
      let a = Math.sin(baseX * 0.075 + pattern) * 0.85 + Math.cos(baseY * 0.085 - pattern * 0.4) * 0.65 + redraw(i, 3) * 0.25;
      let len = (6 + noise(i * 11 + 4) * 7) * (1 + redraw(i, 4) * 0.18);
      let dx = Math.cos(a) * len, dy = Math.sin(a) * len, bend = (noise(i * 11 + 5) - 0.5) * 1.2 + redraw(i, 5) * 0.8;
      const strokeWidth = 0.6 + noise(i * 11 + 6) * 0.25, alpha = 0.5 + noise(i * 11 + 7) * 0.28;

      p.lineWidth = strokeWidth;
      p.globalAlpha = alpha;
      p.beginPath();
      p.moveTo(x - dx * 0.5, y - dy * 0.5);
      p.lineTo(x + dy / len * bend, y - dx / len * bend);
      p.lineTo(x + dx * 0.5, y + dy * 0.5);
      p.stroke();
    }

    const sprite = { image, x: minX - pad, y: minY - pad, width: image.width / 2, height: image.height / 2 };
    if (looseInkCache.size >= 480) looseInkCache.delete(looseInkCache.keys().next().value);
    looseInkCache.set(key, sprite);
    return sprite;
  }

  function pencilShape(points, color, pattern = 0, targetCtx = ctx) {
    const drawings = [0, 1, 2, 1, 0, 2];
    const variant = drawings[(sketchFrame + pattern) % drawings.length];
    const sprite = looseInk(points, color, pattern, variant);
    targetCtx.drawImage(sprite.image, sprite.x, sprite.y, sprite.width, sprite.height);
  }

  function pencilLine(points, targetCtx = ctx) {
    targetCtx.save();
    const alpha = targetCtx.globalAlpha;
    for (let p = 0; p < 3; p++) {
      targetCtx.globalAlpha = alpha * (p === 0 ? 0.8 : 0.23);
      targetCtx.lineWidth = p === 0 ? 1.3 : 0.65;
      targetCtx.beginPath();
      points.forEach(([x, y], i) => {
        let j = Math.sin(i * 8 + p * 3 + sketchFrame * 1.43) * (p ? 0.85 : 0.4);
        i ? targetCtx.lineTo(x + j, y - j * 0.8) : targetCtx.moveTo(x + j, y - j * 0.8);
      });
      targetCtx.stroke();
    }
    targetCtx.restore();
  }

  function objectLine(points, color = '#514d56', width = 1.25, targetCtx = ctx) {
    targetCtx.save();
    targetCtx.strokeStyle = color;
    targetCtx.lineWidth = width;
    targetCtx.lineCap = 'round';
    targetCtx.lineJoin = 'round';
    targetCtx.beginPath();
    points.forEach(([x, y], i) => i ? targetCtx.lineTo(x, y) : targetCtx.moveTo(x, y));
    targetCtx.stroke();
    targetCtx.restore();
  }

  function objectShape(points, color, targetCtx = ctx) {
    targetCtx.save();
    targetCtx.beginPath();
    points.forEach(([x, y], i) => i ? targetCtx.lineTo(x, y) : targetCtx.moveTo(x, y));
    targetCtx.closePath();
    targetCtx.fillStyle = color;
    targetCtx.fill();
    targetCtx.strokeStyle = '#55505b';
    targetCtx.lineWidth = 1.35;
    targetCtx.lineJoin = 'round';
    targetCtx.stroke();
    targetCtx.restore();
  }

  function objectOval(x, y, rx, ry, color, targetCtx = ctx) {
    const points = [];
    for (let i = 0; i < 24; i++) {
      let a = (i * Math.PI) / 12, r = 1 + Math.sin(i * 3.1) * 0.025;
      points.push([x + Math.cos(a) * rx * r, y + Math.sin(a) * ry * r]);
    }
    objectShape(points, color, targetCtx);
  }

  function drawWeapon(kind, color, targetCtx = ctx) {
    targetCtx.save();
    const line = (p, c = '#514d56', w = 1.25) => objectLine(p, c, w, targetCtx);
    const shape = (p, c = color) => objectShape(p, c, targetCtx);
    const oval = (x, y, rx, ry, c) => objectOval(x, y, rx, ry, c, targetCtx);
    switch (kind) {
      case 'sword':
        shape([[-8, -7], [16, -8], [23, -2], [20, 8], [-7, 7]], '#eb9db1');
        shape([[10, -7], [16, -8], [23, -2], [20, 8], [9, 7]], '#a1b6d0');
        line([[-3, -4], [7, -4]], '#fff4ee', 1.6);
        break;
      case 'dagger':
        shape([[-12, -4], [18, -4], [18, 4], [-12, 4]], '#e7b65e');
        shape([[18, -4], [27, 0], [18, 4]], '#e9d7b6');
        shape([[24, -1.3], [27, 0], [24, 1.3]], '#56505c');
        line([[-5, -1], [16, -1]], '#fbdf91');
        break;
      case 'axe':
        shape([[0, -14], [19, -14], [19, -6], [7, -6], [7, 6], [19, 6], [19, 14], [0, 14], [-5, 7], [-5, -7]], '#db7473');
        shape([[12, -14], [19, -14], [19, -6], [12, -6]], '#bdccd5');
        shape([[12, 6], [19, 6], [19, 14], [12, 14]], '#bdccd5');
        break;
      case 'hammer':
        line([[-12, 0], [-7, -5], [-2, 5], [3, -5], [8, 5], [13, 0]], '#746c7d', 1.8);
        shape([[10, -8], [20, -8], [20, 0], [29, 2], [30, 9], [10, 9]], '#7ea9d7');
        break;
      case 'trident':
        line([[-14, 1], [-3, 9], [18, 0]], '#8d8070', 1);
        oval(18, 0, 11, 10, '#e89b61');
        oval(19, 0, 6, 7, '#f5c885');
        break;
      case 'gun':
        shape([[-3, 3], [5, 3], [3, 13], [-3, 12]], '#ac8f6d');
        shape([[-8, -6], [20, -6], [23, -2], [20, 5], [-8, 5]], '#92b47d');
        oval(21, -0.5, 3, 5, '#495c49');
        line([[-3, -3], [16, -3]], '#d6e7bd', 1.5);
        break;
      case 'bow':
        oval(6, -1, 13, 12, '#e4bc66');
        line([[-4, -8], [16, -8]], '#a17a42');
        line([[-7, -2], [18, -2]], '#a17a42');
        break;
      case 'bomb':
        shape([[-6, -6], [17, -6], [14, 13], [-2, 13]], '#faf0d7');
        shape([[-3, -5], [1, -5], [3, 12], [-1, 12]], '#d87970');
        break;
      case 'dynamite':
        oval(5, 0, 15, 10, '#ac8dc9');
        oval(5, 0, 9, 6, '#685275');
        break;
      case 'boomerang':
        shape([[-8, -13], [21, 0], [-8, 13], [-4, 0]], '#f3cd76');
        line([[-8, -12], [-5, 0], [-8, 12]], '#b8814c', 3);
        break;
      case 'magic':
        line([[-10, 12], [1, 1]], '#8cb0a9', 3);
        oval(9, 0, 12, 12, '#b5e1dc');
        break;
      case 'shield':
        shape([[-11, 0], [-6, -11], [4, -16], [14, -9], [20, 0], [10, -3], [5, 0], [-3, -3]], '#85b99e');
        line([[4, -14], [5, 14], [1, 17], [-3, 14]], '#74635b', 1.7);
        break;
      case 'fist':
        line([[-15, 0], [-10, -4], [-5, 4], [0, -4], [5, 4], [10, 0]], '#8b7988', 1.6);
        shape([[10, -7], [17, -11], [24, -8], [27, 0], [23, 8], [12, 8], [8, 3]], '#df827d');
        break;
      case 'saw':
        shape([[0, 13], [-1, -11], [5, -16], [10, -11], [10, 2], [16, 2], [16, -7], [21, -7], [22, 7], [10, 9], [10, 14]], '#92b47a');
        break;
      case 'lightning':
        shape([[-10, -2], [-13, -9], [-9, -15], [-2, -15], [3, -20], [10, -17], [13, -11], [20, -10], [22, -3], [18, 1], [-9, 1]], '#c1cfe4');
        shape([[4, 2], [0, 10], [6, 9], [2, 18], [14, 6], [8, 7], [10, 2]], '#efce68');
        break;
    }
    targetCtx.restore();
  }

  function drawHat(f, targetCtx = ctx) {
    targetCtx.save();
    const line = (p, c = '#514d56', w = 1.25) => objectLine(p, c, w, targetCtx);
    const shape = (p, c = f.color) => objectShape(p, c, targetCtx);
    const oval = (x, y, rx, ry, c) => objectOval(x, y, rx, ry, c, targetCtx);
    switch (f.weaponKind) {
      case 'sword':
        shape([[-18, -13], [-16, -23], [-8, -28], [9, -26], [17, -18], [17, -12]], '#b8b9cf');
        line([[0, -27], [0, -34], [7, -32]], '#c66f8b', 3);
        break;
      case 'axe':
        line([[-12, -18], [-15, -29]], '#67616b', 2);
        line([[12, -18], [16, -29]], '#67616b', 2);
        oval(-15, -29, 4, 3, '#d88b8b');
        oval(16, -29, 4, 3, '#829fd2');
        break;
      case 'gun':
        shape([[-17, -13], [-12, -23], [6, -26], [17, -17], [23, -13]], '#a3bb85');
        oval(-8, -12, 6, 4, '#d7e6df');
        oval(7, -12, 6, 4, '#d7e6df');
        break;
      case 'bomb':
        shape([[-14, -16], [-17, -29], [15, -29], [13, -16]], '#f5dfab');
        break;
      case 'bow':
        targetCtx.globalAlpha = 0.6;
        oval(-23, 0, 6, 12, '#d5e7e7');
        oval(23, 0, 6, 12, '#d5e7e7');
        targetCtx.globalAlpha = 1;
        break;
      case 'hammer':
        shape([[-10, 30], [10, 30], [12, 34], [-10, 35]], '#91b3d9');
        break;
      case 'dagger':
        shape([[-20, -13], [17, -15], [18, -9], [-20, -7]], '#77709e');
        break;
      case 'trident':
        shape([[-17, -16], [-13, -25], [8, -27], [17, -17], [22, -15]], '#e0a16f');
        break;
      case 'boomerang':
        shape([[-16, -17], [-12, -31], [0, -23], [10, -33], [17, -17]], '#eac66f');
        break;
      case 'magic':
        oval(-10, -22, 5, 5, '#d9edeb');
        oval(0, -29, 6, 6, '#d2e9e6');
        oval(11, -21, 4, 4, '#c5e4e1');
        break;
      case 'shield':
        line([[-12, -16], [-16, -25]], '#658c77');
        line([[12, -16], [16, -25]], '#658c77');
        break;
      case 'fist':
        shape([[-19, -14], [18, -15], [18, -9], [-19, -8]], '#e8d4b6');
        break;
      case 'saw':
        for (let i = 0; i < 9; i++) {
          let a = (i * Math.PI * 2) / 9;
          line([[Math.cos(a) * 21, Math.sin(a) * 19], [Math.cos(a) * 27, Math.sin(a) * 25]], '#68894f');
        }
        break;
      case 'dynamite':
        shape([[-18, -17], [-3, -34], [5, -29], [12, -34], [16, -17]], '#ad90c5');
        break;
      case 'lightning':
        shape([[-19, -16], [-21, -23], [-14, -28], [-7, -26], [-1, -33], [8, -31], [11, -25], [18, -24], [22, -18]], '#c6d2e5');
        break;
    }
    targetCtx.restore();
  }

  let paperTexture;
  function paper() {
    if (!paperTexture) {
      paperTexture = document.createElement('canvas');
      paperTexture.width = W;
      paperTexture.height = H;
      const p = paperTexture.getContext('2d');
      p.fillStyle = '#fffef8';
      p.fillRect(0, 0, W, H);

      // Notebook horizontal blue lines
      p.strokeStyle = '#a7bdcf28';
      p.lineWidth = 0.7;
      for (let y = 30; y < H; y += 34) {
        p.beginPath();
        p.moveTo(0, y);
        p.bezierCurveTo(300, y - 1, 700, y + 2, W, y);
        p.stroke();
      }

      // Notebook red margin line
      p.strokeStyle = '#d494a140';
      p.beginPath();
      p.moveTo(40, 0);
      p.lineTo(43, H);
      p.stroke();
    }
    ctx.drawImage(paperTexture, 0, 0);
  }

  function drawFighter(f) {
    const jump = f.leap ? Math.sin(Math.PI * (1 - f.leap.t / f.leap.max)) * 28 : 0;
    const scale = f.scale || 1.0;
    const now = performance.now() / 1000;
    const hitIntensity = Math.min(1, Math.max(0, (f.flash || 0) / 0.14));

    ctx.save();
    // Hit Impact Recoil Jitter & Translation
    let recoilX = 0, recoilY = 0;
    if (hitIntensity > 0) {
      recoilX = (Math.sin(now * 55 + f.id) * 7) * hitIntensity;
      recoilY = (Math.cos(now * 50 + f.id) * 5) * hitIntensity;
    }
    ctx.translate(f.x + recoilX, f.y - jump + recoilY);
    ctx.rotate(Math.sin((f.phase || 0) * 5) * 0.075);

    // Rubbery Squash & Stretch on Hit Impact!
    if (hitIntensity > 0) {
      ctx.scale(scale * (1 + hitIntensity * 0.32), scale * (1 - hitIntensity * 0.24));
    } else {
      ctx.scale(scale, scale);
    }

    // ULT READY / CHARGED AURA (rising anime golden pencil flames)
    if ((f.ultCharge || 0) >= 100) {
      ctx.save();
      ctx.globalAlpha = 0.8 + Math.sin(now * 8) * 0.2;
      for (let fl = 0; fl < 8; fl++) {
        let fa = (fl * Math.PI * 2) / 8 + now * 1.5;
        let fr = 26 + Math.sin(now * 10 + fl) * 6;
        ctx.strokeStyle = fl % 2 === 0 ? '#fbbf24' : '#f59e0b';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(fa) * 19, Math.sin(fa) * 16);
        ctx.lineTo(Math.cos(fa) * (fr + 6), Math.sin(fa) * (fr + 6));
        ctx.stroke();
      }
      ctx.restore();
    }

    // GUARD / SHIELD AURA (translucent blue hex/dashed barrier)
    if ((f.guard || 0) > 0) {
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(now * 8) * 0.25;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -now * 14;
      ctx.beginPath();
      ctx.ellipse(0, 0, 32, 28, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    let outline = [];
    for (let i = 0; i < 40; i++) {
      let a = (i * Math.PI) / 20;
      let r = 21.5 + Math.sin(a * 3 + f.roleId * 1.7) * 3.5 + Math.cos(a * 5 - f.roleId) * 2;
      outline.push([Math.cos(a) * r, Math.sin(a) * r * 0.88]);
    }

    pencilShape(outline, f.color, f.roleId);

    // ARCADE HIT-FLASH SILHOUETTE & COMIC IMPACT SPARK STAR
    if (hitIntensity > 0) {
      ctx.save();
      ctx.globalAlpha = hitIntensity * 0.88;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      outline.forEach(([ox, oy], idx) => idx ? ctx.lineTo(ox, oy) : ctx.moveTo(ox, oy));
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#ffe066';
      ctx.stroke();

      // Comic Impact Starburst at the hit edge
      let sparkAngle = (f.angle || 0) + Math.PI;
      let sx = Math.cos(sparkAngle) * 22, sy = Math.sin(sparkAngle) * 18;
      ctx.fillStyle = '#fff4a3';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let sp = 0; sp < 8; sp++) {
        let spa = (sp * Math.PI * 2) / 8 + now * 10;
        let spr = sp % 2 === 0 ? 13 : 4;
        sp ? ctx.lineTo(sx + Math.cos(spa) * spr, sy + Math.sin(spa) * spr) : ctx.moveTo(sx + Math.cos(spa) * spr, sy + Math.sin(spa) * spr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    drawHat(f);

    // Eyes and pencil face
    let ex = Math.cos(f.angle) * 3, ey = Math.sin(f.angle) * 2;
    if (hitIntensity > 0.15) {
      // HURT / IMPACT FACE: Cross eyes >< and open screaming mouth
      objectLine([[-11 + ex, -8 + ey], [-5 + ex, -2 + ey]], '#2b2133', 2.4);
      objectLine([[-11 + ex, -2 + ey], [-5 + ex, -8 + ey]], '#2b2133', 2.4);
      objectLine([[5 + ex, -8 + ey], [11 + ex, -2 + ey]], '#2b2133', 2.4);
      objectLine([[5 + ex, -2 + ey], [11 + ex, -8 + ey]], '#2b2133', 2.4);
      objectOval(ex, 6 + ey, 4.5, 3.5, '#c94036');
    } else {
      ctx.strokeStyle = '#392f42';
      pencilLine([[-8 + ex, -5 + ey], [-7 + ex, -1 + ey]]);
      pencilLine([[6 + ex, -6 + ey], [7 + ex, -1 + ey]]);
      pencilLine([[-3 + ex, 5 + ey], [1 + ex, 8 + ey], [6 + ex, 4 + ey]]);
    }

    // Held weapon
    ctx.save();
    ctx.rotate(f.angle);
    ctx.translate(28, 5);
    drawWeapon(f.weaponKind, f.color);
    ctx.restore();

    ctx.restore();

    // Name tag & Race icon
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px "Comic Sans MS", cursive';
    const raceIcon = f.raceIcon || (f.race === 'titan' ? '🛡️' : f.race === 'shadow' ? '⚡' : '🔮');
    let label = (f.name.length > 12 ? f.name.slice(0, 11) + '…' : f.name) + ' ' + raceIcon;
    const tagY = f.y - 45 * scale;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#fffef8';
    ctx.strokeText(label, f.x, tagY);
    ctx.fillStyle = '#3f3449';
    ctx.fillText(label, f.x, tagY);

    // Health Bar
    ctx.translate(f.x - 22, tagY + 6);
    ctx.fillStyle = '#fffef8';
    ctx.fillRect(-1, -1, 46, 7);
    ctx.fillStyle = '#d6d6cc';
    ctx.fillRect(0, 0, 44, 5);
    let hpRatio = Math.max(0, Math.min(1, f.hp / (f.maxHp || 100)));
    ctx.fillStyle = hpRatio > 0.35 ? '#398456' : '#c84750';
    ctx.fillRect(0, 0, 44 * hpRatio, 5);

    // Ult Gauge Bar (yellow thin line right under HP)
    if (f.ultCharge !== undefined) {
      ctx.fillStyle = '#e6b943';
      ctx.fillRect(0, 6, 44 * (f.ultCharge / 100), 2);
    }
    ctx.restore();
  }

  function drawAmmo(s) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(Math.atan2(s.vy, s.vx));
    if (s.small) ctx.scale(0.7, 0.7);

    switch (s.kind) {
      case 'gun':
        objectOval(0, 0, 5, 4.5, '#9fc66f');
        break;
      case 'bow':
        objectOval(-1, -5, 4, 5, '#e3eef1');
        objectOval(1, 0, 7, 4.5, '#e5bd62');
        break;
      case 'bomb':
        objectShape([[-6, -2], [-4, -7], [1, -8], [5, -5], [7, 0], [4, 6], [-2, 7], [-6, 3]], '#edc260');
        break;
      case 'magic':
        objectOval(0, 0, 9, 8, '#cae9e4');
        break;
      case 'boomerang':
        ctx.scale(0.65, 0.65);
        drawWeapon('boomerang', s.color);
        break;
      case 'dynamite':
        drawWeapon('dynamite', s.color);
        break;
    }
    ctx.restore();
  }

  function drawZones() {
    const now = performance.now() / 1000;
    for (const z of zones) {
      ctx.save();
      ctx.translate(z.x, z.y);

      // Common Animated Boundary (Pulsing dashed paper ink circle with expanding ripple)
      const pulse = Math.sin(now * 3.5 + z.x * 0.05) * 0.04;
      const rx = z.r * (1 + pulse);
      const ry = z.r * 0.72 * (1 + pulse);

      ctx.strokeStyle = z.color;
      ctx.fillStyle = z.color;
      ctx.globalAlpha = 0.07 + Math.sin(now * 4 + z.y) * 0.03;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rotating dashed boundary
      ctx.globalAlpha = 0.65;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([7, 5]);
      ctx.lineDashOffset = -now * 22;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Concentric expanding ripple
      let rippleP = (now * 1.2 + (z.x % 10) * 0.1) % 1;
      ctx.globalAlpha = (1 - rippleP) * 0.45;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * rippleP, ry * rippleP, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Individual Rich Animated Zone Presentation
      switch (z.kind) {
        case 'barricade': {
          // Инженер-Строитель: Деревянная школьная линейка-баррикада
          let shudder = Math.sin(now * 25) * 0.8;
          ctx.save();
          ctx.translate(shudder, 0);

          // Защитный купол над линейкой
          ctx.globalAlpha = 0.22 + Math.sin(now * 5) * 0.08;
          ctx.fillStyle = '#277c60';
          ctx.beginPath();
          ctx.ellipse(0, -6, 38, 20, 0, Math.PI, 0);
          ctx.fill();

          // Тень линейки на бумаге
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = '#3a2b1c';
          ctx.fillRect(-34, 4, 68, 6);

          // Тело деревянной линейки
          ctx.globalAlpha = 0.95;
          ctx.fillStyle = '#deb86f';
          ctx.fillRect(-34, -8, 68, 16);
          // Верхняя светлая фаска
          ctx.fillStyle = '#f7db99';
          ctx.fillRect(-34, -8, 68, 4);

          // Контур линейки
          ctx.strokeStyle = '#5c4323';
          ctx.lineWidth = 1.4;
          ctx.strokeRect(-34, -8, 68, 16);

          // Деления в миллиметрах и сантиметрах
          for (let mx = -30; mx <= 30; mx += 3) {
            let isCm = mx % 12 === 0;
            let isMid = mx % 6 === 0;
            let h = isCm ? 8 : isMid ? 5 : 3;
            objectLine([[mx, -8], [mx, -8 + h]], '#4a361c', isCm ? 1.2 : 0.8);
          }
          // Тетрадный автограф на линейке
          ctx.font = 'bold 8px "Comic Sans MS", cursive';
          ctx.fillStyle = '#5c4323';
          ctx.fillText('30 cm ★', -12, 5);
          ctx.restore();
          break;
        }

        case 'summon_bee': {
          // Чернильный Призыватель: Летающий живой шмель
          let hoverX = Math.sin(now * 7) * 9;
          let hoverY = Math.cos(now * 14) * 5;
          let wingFlap = Math.sin(now * 45);

          ctx.save();
          ctx.translate(hoverX, hoverY);

          // Золотистая пыльца / аура призывателя
          ctx.globalAlpha = 0.2 + Math.sin(now * 6) * 0.08;
          ctx.fillStyle = '#e5b634';
          ctx.beginPath();
          ctx.arc(0, 0, 18, 0, Math.PI * 2);
          ctx.fill();

          // Быстро машущие крылышки с жилками
          ctx.save();
          ctx.scale(1, wingFlap * 0.85);
          ctx.globalAlpha = 0.75;
          ctx.fillStyle = '#d9f2f5';
          ctx.strokeStyle = '#5a7c88';
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.ellipse(-3, -11, 8, 4, -0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(3, -11, 8, 4, 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          // Пушистое тельце шмеля (полосатый овал)
          ctx.globalAlpha = 1.0;
          objectOval(0, 0, 12, 8, '#f5be28');
          objectLine([[-3, -7], [-3, 7]], '#2c2214', 2.8);
          objectLine([[2, -7], [2, 7]], '#2c2214', 2.8);
          objectLine([[7, -5], [7, 5]], '#2c2214', 2.2);

          // Острое жало сзади
          objectShape([[-11, -2], [-16, 0], [-11, 2]], '#2c2214');

          // Милые мультяшные глазки
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(8, -2, 2.5, 0, Math.PI * 2);
          ctx.arc(8, 2, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#111';
          ctx.beginPath();
          ctx.arc(9, -2, 1.2, 0, Math.PI * 2);
          ctx.arc(9, 2, 1.2, 0, Math.PI * 2);
          ctx.fill();

          // Шевелящиеся усики
          let antWobble = Math.sin(now * 15) * 1.5;
          objectLine([[9, -3], [13, -7 + antWobble]], '#2c2214', 1.0);
          objectLine([[9, 3], [13, 7 - antWobble]], '#2c2214', 1.0);

          // Капельки мёда и золотые искры
          for (let i = 0; i < 3; i++) {
            let pa = now * 4 + i * 2.1;
            let pr = 14 + Math.sin(pa * 2) * 4;
            ctx.fillStyle = '#f3c432';
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.arc(Math.cos(pa) * pr, Math.sin(pa) * pr * 0.7, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
          break;
        }

        case 'gravity': {
          // Карманная Сингулярность: Космическая воронка чёрной дыры
          ctx.save();
          ctx.rotate(now * 3.2);

          // 3 Спиральных рукава воронки
          for (let arm = 0; arm < 3; arm++) {
            ctx.save();
            ctx.rotate((arm * Math.PI * 2) / 3);
            ctx.strokeStyle = '#8b43b1';
            ctx.lineWidth = 2.2;
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            for (let step = 0; step < 20; step++) {
              let th = step * 0.22;
              let rad = 6 + step * 4.2;
              let px = Math.cos(th) * rad, py = Math.sin(th) * rad * 0.8;
              step ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
            }
            ctx.stroke();
            ctx.restore();
          }

          // Засасываемые частицы космической материи
          for (let i = 0; i < 8; i++) {
            let prog = (now * 1.8 + i * 0.125) % 1;
            let r = z.r * (1 - prog);
            let a = prog * Math.PI * 6 + i * 1.3;
            ctx.fillStyle = i % 2 ? '#c39bd3' : '#ffd700';
            ctx.globalAlpha = (1 - prog) * 0.9;
            ctx.beginPath();
            ctx.arc(Math.cos(a) * r, Math.sin(a) * r * 0.75, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }

          // Чёрный горизонт событий в центре
          ctx.globalAlpha = 1.0;
          ctx.fillStyle = '#170c24';
          ctx.beginPath();
          ctx.arc(0, 0, 14, 0, Math.PI * 2);
          ctx.fill();
          // Неоновая корона
          ctx.strokeStyle = '#d7a2f5';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.restore();
          break;
        }

        case 'bubble': {
          // Мыльный Иллюзионист: Колеблющийся мыльный пузырь с переливом
          ctx.save();
          let wob = [];
          for (let i = 0; i < 32; i++) {
            let a = (i * Math.PI * 2) / 32;
            let wr = z.r * 0.75 + Math.sin(now * 6 + a * 3) * 3 + Math.cos(now * 8 - a * 2) * 2;
            wob.push([Math.cos(a) * wr, Math.sin(a) * wr]);
          }

          ctx.globalAlpha = 0.22 + Math.sin(now * 4) * 0.05;
          ctx.fillStyle = '#67e8f9';
          ctx.beginPath();
          wob.forEach(([wx, wy], idx) => idx ? ctx.lineTo(wx, wy) : ctx.moveTo(wx, wy));
          ctx.closePath();
          ctx.fill();

          ctx.globalAlpha = 0.85;
          ctx.strokeStyle = '#008f9b';
          ctx.lineWidth = 1.8;
          ctx.stroke();

          // Серповидный белый блик (отблеск мыльной плёнки)
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(-z.r * 0.25, -z.r * 0.25, z.r * 0.35, Math.PI * 1.05, Math.PI * 1.55);
          ctx.stroke();

          // Маленькие пузырьки-спутники
          for (let i = 0; i < 3; i++) {
            let ba = now * 1.8 + i * 2.1;
            let br = z.r * 0.85 + Math.sin(now * 3 + i) * 6;
            let bx = Math.cos(ba) * br, by = Math.sin(ba) * br;
            ctx.fillStyle = '#a5f3fc';
            ctx.globalAlpha = 0.65;
            ctx.beginPath();
            ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#0891b2';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
          ctx.restore();
          break;
        }

        case 'popcorn': {
          // Киношный Подрывник: Попкорн-мина с искрящимся фитилём
          ctx.save();
          // Опасный пульсирующий контур
          let dangerPulse = Math.sin(now * 8) * 0.5 + 0.5;
          ctx.strokeStyle = `rgba(230, 80, 50, ${0.4 + dangerPulse * 0.4})`;
          ctx.lineWidth = 1.8;
          ctx.setLineDash([6, 6]);
          ctx.lineDashOffset = -now * 18;
          ctx.beginPath();
          ctx.ellipse(0, 0, z.r, z.r * 0.72, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // Зерно попкорна / бомбочка
          ctx.globalAlpha = 1.0;
          objectOval(0, 2, 10, 8, '#f59e0b');

          // Горящий искрящийся фитиль
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(0, -6);
          ctx.quadraticCurveTo(4, -14, 8 + Math.sin(now * 15) * 2, -16);
          ctx.stroke();

          let sparkX = 8 + Math.sin(now * 15) * 2, sparkY = -16;
          ctx.fillStyle = Math.random() < 0.5 ? '#f59e0b' : '#ef4444';
          ctx.beginPath();
          ctx.arc(sparkX, sparkY, 3 + Math.random() * 2, 0, Math.PI * 2);
          ctx.fill();

          // Клубы горячего масляного пара
          for (let s = 0; s < 2; s++) {
            let st = (now * 2 + s * 0.5) % 1;
            let sy = -8 - st * 22;
            let sx = Math.sin(now * 6 + s) * 5;
            ctx.strokeStyle = 'rgba(255, 255, 255, ' + (1 - st) * 0.7 + ')';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(sx, sy, 3 + st * 4, 0, Math.PI * 1.2);
            ctx.stroke();
          }
          ctx.restore();
          break;
        }

        case 'storm': {
          // Грозовой Дуэлянт: Электрическое поле с молниями
          ctx.save();
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 1.8;
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.ellipse(0, 0, z.r, z.r * 0.72, 0, 0, Math.PI * 2);
          ctx.stroke();

          // Разряды молний от периметра к центру
          ctx.strokeStyle = Math.random() < 0.5 ? '#facc15' : '#60a5fa';
          ctx.lineWidth = 1.8;
          for (let b = 0; b < 3; b++) {
            let a = Math.random() * Math.PI * 2;
            let px = Math.cos(a) * z.r, py = Math.sin(a) * z.r * 0.72;
            let pts = [[px, py]];
            for (let k = 1; k < 4; k++) {
              let frac = k / 4;
              pts.push([
                px * (1 - frac) + (Math.random() - 0.5) * 16,
                py * (1 - frac) + (Math.random() - 0.5) * 16
              ]);
            }
            pts.push([0, 0]);
            pencilLine(pts);
          }

          // Центральная катушка Теслы
          objectOval(0, 0, 7, 7, '#fef08a');
          objectOval(0, 0, 4, 4, '#3b82f6');
          ctx.restore();
          break;
        }

        case 'landing': {
          // Пружинный Берсерк: Разломы в бумаге от сейсмического удара
          ctx.save();
          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = 2.0;
          ctx.globalAlpha = 0.85;
          for (let c = 0; c < 5; c++) {
            let a = (c * Math.PI * 2) / 5 + 0.3;
            let r = z.r * 0.85;
            let pts = [[0, 0]];
            let curX = 0, curY = 0;
            for (let step = 0; step < 4; step++) {
              curX += (Math.cos(a) * r / 4) + (Math.sin(step * 4) * 6);
              curY += (Math.sin(a) * (r * 0.72) / 4) + (Math.cos(step * 4) * 6);
              pts.push([curX, curY]);
            }
            pencilLine(pts);
          }
          // Прицел эпицентра
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.ellipse(0, 0, z.r * 0.4, z.r * 0.28, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          break;
        }

        case 'spin': {
          // Кактус / Трюкач: Вращающаяся вертушка с пильными зубьями
          ctx.save();
          ctx.rotate(now * 16);
          ctx.strokeStyle = z.color;
          ctx.lineWidth = 3.0;
          ctx.globalAlpha = 0.55;
          ctx.beginPath();
          ctx.arc(0, 0, z.r * 0.8, 0, Math.PI * 1.5);
          ctx.stroke();

          for (let t = 0; t < 8; t++) {
            let a = (t * Math.PI * 2) / 8;
            let tr = z.r * 0.85;
            let tx = Math.cos(a) * tr, ty = Math.sin(a) * tr;
            objectShape([
              [tx, ty],
              [Math.cos(a + 0.25) * (tr + 9), Math.sin(a + 0.25) * (tr + 9)],
              [Math.cos(a + 0.35) * tr, Math.sin(a + 0.35) * tr]
            ], z.color);
          }
          ctx.restore();
          break;
        }
      }
      ctx.restore();
    }
  }

  function drawEffects() {
    for (const e of effects) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (e.t / e.max) * 2);
      ctx.strokeStyle = e.color;
      ctx.fillStyle = e.color;

      if (e.lightning) {
        // Двухканальная искрящаяся молния Теслы
        let p = [[e.x, e.y]], dx = e.x2 - e.x, dy = e.y2 - e.y;
        for (let i = 1; i < 7; i++) {
          p.push([e.x + dx * i / 7 + (i % 2 ? 12 : -12), e.y + dy * i / 7 + (i % 2 ? -12 : 12)]);
        }
        p.push([e.x2, e.y2]);
        pencilLine(p);

        // Вторичный электрический отросток
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        let p2 = [[e.x, e.y]];
        for (let i = 1; i < 5; i++) {
          p2.push([e.x + dx * i / 5 + (i % 2 ? -8 : 8), e.y + dy * i / 5 + (i % 2 ? 8 : -8)]);
        }
        p2.push([e.x2, e.y2]);
        pencilLine(p2);
      } else if (e.explosion || e.burst) {
        let p = [];
        for (let i = 0; i < 18; i++) {
          let a = i * Math.PI / 9, r = 16 + (1 - e.t / e.max) * 38;
          p.push([e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.8]);
        }
        pencilLine(p);
      } else if (e.text) {
        let p = 1 - e.t / e.max;
        if (e.isUlt) {
          // ЭПИЧЕСКИЙ МУЛЬТИПЛИКАЦИОННЫЙ КАТ-СЦЕН БАННЕР УЛЬТЫ
          ctx.save();
          let bannerY = 82;
          ctx.fillStyle = 'rgba(20, 16, 28, 0.72)';
          ctx.fillRect(0, bannerY - 38, W, 76);

          // Двойные золотые полосы манги
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, bannerY - 38); ctx.lineTo(W, bannerY - 38);
          ctx.moveTo(0, bannerY + 38); ctx.lineTo(W, bannerY + 38);
          ctx.stroke();

          // Радиальные лучи боевой готовности
          ctx.save();
          ctx.translate(W / 2, bannerY);
          ctx.strokeStyle = e.color + '55';
          ctx.lineWidth = 2.0;
          for (let ray = 0; ray < 24; ray++) {
            let ra = (ray * Math.PI * 2) / 24 + performance.now() * 0.001;
            ctx.beginPath();
            ctx.moveTo(Math.cos(ra) * 110, Math.sin(ra) * 22);
            ctx.lineTo(Math.cos(ra) * 380, Math.sin(ra) * 36);
            ctx.stroke();
          }
          ctx.restore();

          // Зубчатый взрывной комикс-бейдж за названием
          ctx.save();
          ctx.translate(W / 2, bannerY);
          let starScale = 1.0 + Math.sin(p * Math.PI * 3) * 0.08;
          ctx.scale(starScale, starScale);
          ctx.fillStyle = '#ffcf33';
          ctx.strokeStyle = '#c94036';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          for (let s = 0; s < 16; s++) {
            let sa = (s * Math.PI * 2) / 16;
            let sr = (s % 2 === 0 ? 160 : 135);
            s ? ctx.lineTo(Math.cos(sa) * sr, Math.sin(sa) * 26) : ctx.moveTo(Math.cos(sa) * sr, Math.sin(sa) * 26);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.font = 'bold 11px "Comic Sans MS", cursive';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#7a2218';
          ctx.fillText('★ СВЕРХСПОСОБНОСТЬ ★', 0, -11);

          ctx.font = 'bold 22px "Comic Sans MS", cursive';
          ctx.lineWidth = 4.5;
          ctx.strokeStyle = '#2b1b36';
          ctx.strokeText(e.text, 0, 15);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(e.text, 0, 15);
          ctx.restore();

          // Расширяющееся кольцо ударной волны вокруг кастера
          let shockP = (1 - e.t / e.max);
          let shockR = shockP * 190;
          ctx.strokeStyle = e.color;
          ctx.lineWidth = (1 - shockP) * 4;
          ctx.globalAlpha = (1 - shockP) * 0.8;
          ctx.beginPath();
          ctx.arc(e.x, e.y, shockR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else {
          // Плавный вылет цифр урона и статусов
          ctx.save();
          let rise = Math.sin(p * Math.PI * 0.5) * 32;
          let popScale = p < 0.25 ? 1.0 + (p / 0.25) * 0.35 : 1.35 - (p - 0.25) * 0.45;
          ctx.translate(e.x, e.y - 20 - rise);
          ctx.scale(popScale, popScale);
          ctx.textAlign = 'center';
          ctx.font = 'bold 16px "Comic Sans MS", cursive';
          ctx.lineWidth = 3.5;
          ctx.strokeStyle = '#fffef8';
          ctx.strokeText(e.text, 0, 0);
          ctx.fillStyle = e.color || '#333';
          ctx.fillText(e.text, 0, 0);
          ctx.restore();
        }
      }
      ctx.restore();
    }
  }

  function renderLoop() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastFrameTime) / 1000);
    lastFrameTime = now;

    sketchFrame = Math.floor(now / 1000 * sketchFPS);
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    // Сочный Screen Shake при ударах и ультах
    if (screenShake > 0.2) {
      let ox = (Math.random() - 0.5) * screenShake * 2;
      let oy = (Math.random() - 0.5) * screenShake * 2;
      ctx.translate(ox, oy);
      screenShake *= 0.88;
    } else {
      screenShake = 0;
    }

    paper();

    drawZones();
    shots.forEach(drawAmmo);
    fighters.forEach(f => {
      if (f.alive) drawFighter(f);
    });
    updateAndDrawParticles(dt);
    drawEffects();

    ctx.restore();

    raf = requestAnimationFrame(renderLoop);
  }

  // Initial event bindings
  $('inputName').value = myName;
  $('inputName').addEventListener('input', () => {
    myName = $('inputName').value.trim();
    sendProfile();
  });

  $('btnStrMinus').onclick = () => changeStat('str', -1);
  $('btnStrPlus').onclick = () => changeStat('str', 1);
  $('btnAgiMinus').onclick = () => changeStat('agi', -1);
  $('btnAgiPlus').onclick = () => changeStat('agi', 1);
  $('btnIntMinus').onclick = () => changeStat('int', -1);
  $('btnIntPlus').onclick = () => changeStat('int', 1);

  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.onclick = () => {
      const [s, a, i] = btn.dataset.preset.split(',').map(Number);
      applyPreset(s, a, i);
    };
  });

  // Start initialization
  updateStatDisplays();
  connect();
  renderLoop();

})();
