import { PeerLink } from './network.mjs';
import { SOUNDS, SAMPLE_RATE, getTarget, playSamples, recordSamples, scoreSamples, encodeSamples, decodeSamples } from './audio.mjs';
import { createStage } from './stage.mjs';
import { createCatalog } from './catalog.mjs';

const byId = id => document.getElementById(id);
const roundOptions = [5, 10, 15];
const defaultRecordTime = 3200;
const roundsStore = 'echo-settings';
const pieceSize = 12_000;
const piecePattern = new RegExp('.{1,' + pieceSize + '}', 'g');
const maxPieces = Math.ceil((Math.ceil(SAMPLE_RATE * defaultRecordTime / 1000) * 8 / 3 + 16) / pieceSize) + 1;
const soundById = new Map(SOUNDS.map(sound => [sound.id, sound]));
const categories = [...new Set(SOUNDS.map(sound => sound.category))];
const rules = new Map([
  ['classic', { label: '' }],
  ['sprint', { label: 'Блиц · 2,3 секунды на ответ', duration: 2300 }],
  ['ear', { label: 'На слух · без подсказки и волны образца' }],
  ['rhythm', { label: 'Ритм ×2 · повтори паузы и длительность', emphasis: 'rhythm' }],
  ['pitch', { label: 'Высота ×2 · повтори, как меняется голос', emphasis: 'pitch' }],
  ['tone', { label: 'Тембр ×2 · повтори окраску звука', emphasis: 'tone' }],
]);
const room = byId('room');
const settingsDialog = byId('settings');
const settingsForm = byId('settings-form');
const scope = byId('scope');
const canvas = byId('spectrum');
const paint = canvas.getContext('2d');
const studio = createStage(byId('studio-canvas'));
let roundDots = [];

let peerLink;
let roomRole = 'host';
let roomAction = false;
let backToRoom = false;
let match;
let cue;
let target;
let heard;
let ownTake;
let friendTake;
let incoming;
let busy;
let showFriend;
let status;
let shownWave;
let micLevels = [];
let micStarted;
let soundStarted = 0;
let frame;
let libraryPlaying = false;
let preferences = loadPreferences();

function loadPreferences() {
  const defaults = { count: 5, packs: categories, hints: true, party: false };
  try {
    const saved = JSON.parse(localStorage.getItem(roundsStore));
    const packs = categories.filter(category => saved?.packs?.includes?.(category));
    if (!roundOptions.includes(saved?.count) || !packs.length) return defaults;
    return { count: saved.count, packs, hints: saved.hints !== false, party: saved.party === true };
  } catch {
    return defaults;
  }
}

function bestKey() {
  const format = match.rules.some(rule => rule !== 'classic') ? 'mix' : 'classic';
  return 'echo-best-' + match.rounds.length + '-' + format;
}

function loadBest() {
  try {
    const legacy = bestKey() === 'echo-best-5-classic' ? localStorage.getItem('echo-best') : null;
    const value = Number(localStorage.getItem(bestKey()) ?? legacy);
    return Number.isInteger(value) && value >= 0 && value <= 100 * match.rounds.length ? value : 0;
  } catch {
    return 0;
  }
}

function saveBest() {
  if (match.own <= match.best) return;
  match.best = match.own;
  try { localStorage.setItem(bestKey(), String(match.best)); } catch { /* Storage may be disabled. */ }
}

function shuffle(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function chooseRounds(firstSound) {
  const selected = SOUNDS.filter(sound => preferences.packs.includes(sound.category)).map(sound => sound.id);
  const pool = selected.length ? selected : [...soundById.keys()];
  const rounds = firstSound && pool.includes(firstSound) ? [firstSound] : [];
  while (rounds.length < preferences.count) {
    const last = rounds.at(-1);
    const prior = rounds.length < pool.length ? rounds : [];
    const deck = shuffle(pool.filter(id => !prior.includes(id)));
    if (deck[0] === last && deck.length > 1) [deck[0], deck[1]] = [deck[1], deck[0]];
    rounds.push(...deck);
  }
  return rounds.slice(0, preferences.count);
}

function chooseRules(count) {
  if (!preferences.party) return Array(count).fill('classic');
  const variations = [...rules.keys()].filter(rule => rule !== 'classic');
  const sequence = [];
  while (sequence.length < count) sequence.push(...shuffle(variations));
  return sequence.slice(0, count);
}

function startMatch(mode, rounds = chooseRounds(), options = {}) {
  const { id = crypto.randomUUID(), sequence = chooseRules(rounds.length), hints = preferences.hints, practice = false } = options;
  match = { mode, id, rounds, rules: sequence, hints, practice, index: 0, own: 0, friend: 0, complete: false };
  match.best = loadBest();
  roundDots = rounds.map((_, index) => {
    const dot = document.createElement('span');
    dot.className = 'round-dot';
    dot.textContent = String(index + 1).padStart(2, '0');
    return dot;
  });
  byId('round-dots').replaceChildren(...roundDots);
  setRound(0);
}

function setRound(index) {
  match.index = index;
  cue = soundById.get(match.rounds[index]);
  target = getTarget(cue.id);
  heard = false;
  ownTake = null;
  friendTake = null;
  incoming = null;
  busy = '';
  showFriend = false;
  status = '';
  shownWave = target;
  micStarted = 0;
  soundStarted = 0;
  render();
}

function activeRule() {
  return rules.get(match.rules[match.index]);
}

function roundTime() {
  return activeRule().duration ?? defaultRecordTime;
}

function grade(samples) {
  const score = scoreSamples(samples, target);
  const emphasis = activeRule().emphasis;
  return emphasis ? { ...score, total: Math.round((score.rhythm + score.pitch + score.tone + score[emphasis]) / 4) } : score;
}

function isOnline() {
  return match.mode === 'duo';
}

function bothReady() {
  return ownTake && (!isOnline() || friendTake);
}

function finishRound() {
  if (!bothReady() || match.index !== match.rounds.length - 1 || match.complete) return;
  match.complete = true;
  if (!isOnline() && !match.practice) saveBest();
}

function hint() {
  if (status) return status;
  if (busy === 'demo') return 'Слушай, где звук меняет высоту и ритм.';
  if (busy === 'recording') return micStarted ? 'Запись идёт. Повторяй звук!' : 'Разреши доступ к микрофону в браузере.';
  if (busy === 'replay') return showFriend ? 'Воспроизводится запись друга.' : 'Воспроизводится твоя запись.';
  if (match.complete) return match.practice ? 'Звук сыгран. Можно попробовать ещё раз.' : 'Все раунды сыграны.';
  if (ownTake && isOnline() && !friendTake) return 'Ответ отправлен. Ждём запись друга.';
  if (ownTake && isOnline() && roomRole === 'guest') return 'Хозяин комнаты переключит раунд.';
  if (ownTake) return 'Послушай записи или переходи дальше.';
  return heard ? 'Готов? На ответ есть ' + (roundTime() / 1000).toLocaleString('ru-RU') + ' с.' : 'Сначала послушай образец.';
}

function render() {
  const online = isOnline();
  const connected = peerLink?.state === 'open';
  const onlineLost = online && !connected;
  const canAdvance = bothReady() && (!online || roomRole === 'host');
  byId('category').textContent = cue.category;
  byId('sound-title').textContent = cue.label;
  const showHint = match.rules[match.index] !== 'ear' && match.hints;
  byId('sound-description').textContent = showHint ? cue.description : 'Повтори, что услышишь в образце.';
  byId('challenge').textContent = activeRule().label;
  byId('challenge').hidden = !activeRule().label;
  byId('studio-partner').firstChild.textContent = online ? 'ДРУГ ' : 'ЭХО ';
  byId('round-label').textContent = String(match.index + 1).padStart(2, '0') + ' / ' + String(match.rounds.length).padStart(2, '0');
  byId('stage-status').textContent = onlineLost ? 'Связь прервалась. Открой комнату, чтобы подключиться снова.' : hint();
  byId('mode-label').lastChild.textContent = online ? (connected ? ' Матч с другом' : ' Связь прервана') : match.practice ? ' Один звук' : ' Тренировка';
  byId('solo-tab').classList.toggle('active', !online);
  byId('duo-tab').classList.toggle('active', online);
  byId(online ? 'solo-tab' : 'duo-tab').removeAttribute('aria-current');
  byId(online ? 'duo-tab' : 'solo-tab').setAttribute('aria-current', 'page');

  byId('listen').disabled = Boolean(busy || libraryPlaying);
  byId('record').hidden = Boolean(ownTake);
  byId('record').disabled = Boolean(busy || libraryPlaying || !heard || onlineLost);
  byId('next').hidden = !canAdvance;
  byId('next').disabled = Boolean(busy || onlineLost);
  byId('next').textContent = match.complete ? (match.practice ? 'Повторить звук' : 'Сыграть ещё') : 'Следующий звук';
  byId('replay').hidden = !ownTake;
  byId('peer-replay').hidden = !friendTake || !ownTake;
  byId('replay').disabled = Boolean(busy || libraryPlaying);
  byId('peer-replay').disabled = Boolean(busy || libraryPlaying);
  byId('restart').disabled = Boolean(busy);
  byId('restart').hidden = online;
  byId('open-settings').disabled = Boolean(busy || online && roomRole === 'guest');
  byId('score-title').textContent = showFriend ? 'Точность друга' : 'Точность';
  const score = (showFriend ? friendTake : ownTake)?.score;
  byId('score').textContent = score?.total ?? '—';
  for (const key of ['rhythm', 'pitch', 'tone']) {
    byId(key).value = score?.[key] ?? 0;
    byId(key + '-value').textContent = score?.[key] ?? '—';
  }

  roundDots.forEach((dot, index) => {
    dot.classList.toggle('done', index < match.index || (index === match.index && Boolean(bothReady())));
    dot.classList.toggle('current', index === match.index);
    if (index === match.index) dot.setAttribute('aria-current', 'step');
    else dot.removeAttribute('aria-current');
  });
  byId('my-total').textContent = match.own;
  byId('peer-total').textContent = match.friend;
  byId('best-total').textContent = match.best;
  byId('match-length').textContent = match.practice ? '1 звук' : match.rounds.length + ' раундов';
  byId('peer-total-row').hidden = !online;
  byId('best-row').hidden = online || match.practice;
  byId('match-status').textContent = match.complete
    ? (online ? match.own === match.friend ? 'Ничья!' : match.own > match.friend ? 'Ты выиграл!' : 'Друг выиграл!' : 'Итог — ' + match.own + ' из ' + match.rounds.length * 100 + '.')
    : '';

  scope.dataset.state = busy === 'recording' ? 'recording' : 'idle';
  byId('scope-source').textContent = busy === 'recording' ? 'МИКРОФОН' : shownWave === ownTake?.samples ? 'МОЯ ЗАПИСЬ' : shownWave === friendTake?.samples ? 'ЗАПИСЬ ДРУГА' : 'ОБРАЗЕЦ';
  byId('scope-readout').textContent = busy === 'recording' ? (micStarted ? 'ИДЁТ ЗАПИСЬ' : 'ПОДКЛЮЧЕНИЕ') : busy ? 'ВОСПРОИЗВЕДЕНИЕ' : 'АУДИОСИГНАЛ';
  byId('scope-end').textContent = (roundTime() / 1000).toFixed(1).padStart(4, '0');
  if (!frame) frame = requestAnimationFrame(drawScope);
  renderRoom();
}

function drawScope(now) {
  frame = 0;
  const { clientWidth: width, clientHeight: height } = canvas;
  if (!width || !height) return;
  const density = Math.min(2, devicePixelRatio || 1);
  if (canvas.width !== Math.round(width * density) || canvas.height !== Math.round(height * density)) {
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
  }
  paint.setTransform(density, 0, 0, density, 0, 0);
  paint.clearRect(0, 0, width, height);
  const bars = Math.max(24, Math.floor((width - 28) / 5));
  const middle = height / 2;
  const step = (width - 28) / bars;
  const live = busy === 'recording';
  const playing = busy === 'demo' || busy === 'replay';
  const obscured = match.rules[match.index] === 'ear' && shownWave === target && !match.complete;
  const samples = shownWave;
  const samplesPerBar = samples.length / bars;
  const durationRatio = Math.min(1, samples.length / (SAMPLE_RATE * roundTime() / 1000));
  const position = playing ? Math.floor((now - soundStarted) * SAMPLE_RATE / 1000) : 0;
  let volume = live ? (micLevels.at(-1) ?? 0) : 0;
  if (live && micStarted) {
    const remaining = Math.max(0, roundTime() - (now - micStarted)) / 1000;
    byId('scope-readout').textContent = remaining.toFixed(1).replace('.', ',') + ' С';
  }
  if (playing) {
    for (let i = Math.max(0, position); i < Math.min(samples.length, position + 260); i++) {
      volume = Math.max(volume, Math.abs(samples[i]));
    }
  }
  studio.setState({
    phase: live ? 'recording' : playing ? busy : bothReady() ? 'result' : 'idle',
    online: isOnline(),
    speaker: live || shownWave === ownTake?.samples ? 'self' : shownWave === friendTake?.samples ? 'friend' : 'sample',
    volume
  });

  paint.beginPath();
  paint.moveTo(14, middle);
  paint.lineTo(width - 14, middle);
  paint.strokeStyle = '#b0d09542';
  paint.lineWidth = 1;
  paint.stroke();

  paint.strokeStyle = live ? '#ffb18a' : '#c9f783';
  paint.lineWidth = Math.max(1.5, step * .52);
  paint.lineCap = 'round';
  paint.shadowColor = live ? '#ff9563' : '#a5d46a';
  paint.shadowBlur = 5;
  paint.beginPath();
  for (let i = 0; i < bars; i++) {
    let amplitude = 0;
    if (live) {
      const level = micLevels[i - bars + micLevels.length] ?? 0;
      amplitude = Math.min(1, Math.sqrt(Math.max(0, level)) * 1.45);
    } else if (!obscured && i < bars * durationRatio) {
      const left = Math.floor(i * samplesPerBar / durationRatio);
      const right = Math.min(samples.length, Math.floor((i + 1) * samplesPerBar / durationRatio));
      for (let j = left; j < right; j++) amplitude = Math.max(amplitude, Math.abs(samples[j]));
    }
    const length = Math.max(.7, Math.pow(amplitude, .66) * height * .35);
    const x = 14 + step * (i + .5);
    paint.moveTo(x, middle - length);
    paint.lineTo(x, middle + length);
  }
  paint.stroke();
  paint.shadowBlur = 0;
  if (playing && !obscured && position >= 0 && position < samples.length) {
    const marker = 14 + (width - 28) * Math.min(1, position / (SAMPLE_RATE * roundTime() / 1000));
    paint.fillStyle = '#e7ffb498';
    paint.fillRect(marker, 28, 1, height - 56);
  }
  if (playing) frame = requestAnimationFrame(drawScope);
}

new ResizeObserver(() => {
  if (!frame) frame = requestAnimationFrame(drawScope);
}).observe(scope);

async function listen(take = null) {
  if (busy || libraryPlaying || (take && !take.samples)) return;
  const playingMatch = match;
  const playingRound = match.index;
  status = '';
  busy = take ? 'replay' : 'demo';
  showFriend = take === friendTake && take !== null;
  shownWave = take ? take.samples : target;
  soundStarted = performance.now();
  render();
  try {
    await playSamples(shownWave);
    if (match === playingMatch && match.index === playingRound && !take) heard = true;
  } catch {
    if (match === playingMatch && match.index === playingRound) status = 'Звук не воспроизвёлся. Нажми кнопку ещё раз.';
  } finally {
    if (match === playingMatch && match.index === playingRound) {
      busy = '';
      render();
    }
  }
}

function microphoneError(error) {
  if (!navigator.mediaDevices?.getUserMedia) return 'Микрофон доступен по HTTPS или на localhost.';
  if (error?.name === 'NotAllowedError') return 'Разреши микрофон в настройках сайта и попробуй снова.';
  if (error?.name === 'NotFoundError') return 'Браузер не видит микрофон. Подключи его и попробуй ещё раз.';
  if (error?.name === 'NotReadableError') return 'Микрофон занят или недоступен. Проверь настройки звука.';
  return 'Не удалось записать звук. Проверь микрофон и попробуй снова.';
}

async function record() {
  if (busy || libraryPlaying || !heard || ownTake || (isOnline() && peerLink?.state !== 'open')) return;
  const recordingMatch = match;
  const recordingRound = match.index;
  busy = 'recording';
  status = '';
  showFriend = false;
  micLevels = [];
  micStarted = 0;
  render();
  try {
    const samples = await recordSamples(roundTime(), level => {
      if (match !== recordingMatch || match.index !== recordingRound) return;
      if (!micStarted) {
        micStarted = performance.now();
        render();
      }
      micLevels.push(level);
      if (micLevels.length > 230) micLevels.shift();
      if (!frame) frame = requestAnimationFrame(drawScope);
    });
    if (match !== recordingMatch || match.index !== recordingRound) return;
    const encoded = isOnline() ? encodeSamples(samples) : '';
    const comparison = isOnline() ? decodeSamples(encoded) : samples;
    ownTake = { samples, score: grade(comparison) };
    match.own += ownTake.score.total;
    shownWave = samples;
    if (isOnline()) {
      const pieces = encoded.match(piecePattern) ?? [''];
      for (const [index, piece] of pieces.entries()) {
        if (!peerLink?.send({ kind: 'take', id: match.id, round: match.index, index, length: pieces.length, piece })) {
          peerLink?.close();
          break;
        }
      }
    }
    finishRound();
  } catch (error) {
    if (match === recordingMatch && match.index === recordingRound) status = microphoneError(error);
  } finally {
    if (match === recordingMatch && match.index === recordingRound) {
      busy = '';
      render();
    }
  }
}

function acceptTake(message) {
  if (friendTake || !Number.isInteger(message.length) || message.length < 1 || message.length > maxPieces ||
      !Number.isInteger(message.index) || message.index < 0 || message.index >= message.length ||
      typeof message.piece !== 'string' || message.piece.length > pieceSize) return;
  if (message.index === 0) incoming = { length: message.length, parts: [] };
  if (!incoming || message.index !== incoming.parts.length || message.length !== incoming.length) return;
  incoming.parts.push(message.piece);
  if (incoming.parts.length !== incoming.length) return;

  try {
    const samples = decodeSamples(incoming.parts.join(''));
    if (samples.length > SAMPLE_RATE * (roundTime() + 100) / 1000) throw new Error();
    friendTake = { samples, score: grade(samples) };
    match.friend += friendTake.score.total;
    finishRound();
    render();
  } catch {
    peerLink?.close();
  } finally {
    incoming = null;
  }
}

function onMessage(message) {
  if (!message || typeof message !== 'object') return;
  if (message.kind === 'match' && roomRole === 'guest' && typeof message.id === 'string' && message.id.length <= 64 &&
      Array.isArray(message.rounds) && roundOptions.includes(message.rounds.length) && message.rounds.every(id => soundById.has(id)) &&
      Array.isArray(message.sequence) && message.sequence.length === message.rounds.length &&
      message.sequence.every(rule => rules.has(rule)) && typeof message.hints === 'boolean') {
    startMatch('duo', message.rounds, { id: message.id, sequence: message.sequence, hints: message.hints });
    if (room.open) room.close();
    return;
  }
  if (!isOnline() || message.id !== match.id) return;
  if (message.kind === 'take' && message.round === match.index) acceptTake(message);
  if (message.kind === 'advance' && roomRole === 'guest' && bothReady() &&
      message.round === match.index + 1 && message.round < match.rounds.length) setRound(message.round);
}

function sendMatch() {
  const rounds = chooseRounds();
  const sequence = chooseRules(rounds.length);
  const { hints } = preferences;
  const id = crypto.randomUUID();
  if (!peerLink?.send({ kind: 'match', id, rounds, sequence, hints })) return;
  startMatch('duo', rounds, { id, sequence, hints });
  if (room.open) room.close();
}

function nextRound() {
  if (busy || !bothReady()) return;
  if (isOnline() && (roomRole !== 'host' || peerLink?.state !== 'open')) return;
  if (match.complete) {
    if (isOnline()) sendMatch();
    else if (match.practice) startPractice(cue.id);
    else startMatch('solo');
    return;
  }
  const round = match.index + 1;
  if (!isOnline() || peerLink.send({ kind: 'advance', id: match.id, round })) setRound(round);
}

function resetRoom() {
  const previous = peerLink;
  peerLink = null;
  previous?.close();
  for (const id of ['offer-output', 'answer-input', 'offer-input', 'answer-output']) byId(id).value = '';
  byId('offer-box').hidden = true;
  byId('answer-box').hidden = true;
  byId('room-status').textContent = 'Откройте игру у себя и обменяйтесь кодами в чате.';
  renderRoom();
}

function newPeerLink() {
  peerLink?.close();
  const link = new PeerLink({
    onState(state, detail) {
      if (peerLink !== link) return;
      byId('room-status').textContent = state === 'open' && roomRole === 'guest' ? 'Вы подключены. Хозяин комнаты может начать матч.' : detail;
      render();
    },
    onMessage
  });
  peerLink = link;
  return link;
}

function selectRoomRole(role) {
  if (role === roomRole) return;
  if (isOnline()) startMatch('solo');
  resetRoom();
  roomRole = role;
  renderRoom();
}

function renderRoom() {
  const connected = peerLink?.state === 'open';
  const online = isOnline();
  const hosting = roomRole === 'host';
  const hostPending = peerLink?.state === 'connecting' || peerLink?.state === 'waiting';
  for (const [id, active] of [['host-tab', hosting], ['join-tab', !hosting]]) {
    byId(id).classList.toggle('active', active);
    byId(id).setAttribute('aria-pressed', String(active));
    byId(id).disabled = Boolean(roomAction || connected);
  }
  byId('host-panel').hidden = connected || !hosting;
  byId('join-panel').hidden = connected || hosting;
  byId('start-duo').hidden = !connected || !hosting || (online && !match.complete);
  byId('start-duo').disabled = Boolean(busy);
  byId('room-settings').hidden = !hosting;
  byId('room-settings').disabled = Boolean(busy || roomAction);
  byId('leave-room').hidden = !peerLink;
  byId('make-offer').disabled = roomAction;
  byId('make-offer').textContent = peerLink && hosting ? 'Новое приглашение' : 'Создать приглашение';
  byId('accept-offer').disabled = roomAction;
  byId('accept-answer').disabled = !hostPending || roomAction || peerLink?.state === 'connecting';
}

async function roomOperation(operation) {
  if (roomAction) return;
  roomAction = true;
  renderRoom();
  try {
    await operation();
  } catch (error) {
    if (error?.name !== 'AbortError') byId('room-status').textContent = error.message;
  } finally {
    roomAction = false;
    renderRoom();
  }
}

function inviteCode(value) {
  const text = value.trim();
  if (text.startsWith('MF1.offer.')) return text;
  try { return new URLSearchParams(new URL(text).hash.slice(1)).get('join') ?? text; } catch { return text; }
}

async function copyField(id) {
  const field = byId(id);
  try {
    await navigator.clipboard.writeText(field.value);
    byId('room-status').textContent = 'Скопировано. Отправь другу в чат.';
  } catch {
    field.focus();
    field.select();
    byId('room-status').textContent = 'Код выделен. Скопируй его и отправь другу.';
  }
}

function openSolo() {
  if (busy || (!isOnline() && !match.practice)) return;
  if (isOnline()) resetRoom();
  startMatch('solo');
}

function startPractice(id) {
  if (busy || libraryPlaying || isOnline() || !soundById.has(id)) return false;
  startMatch('solo', [id], { sequence: ['classic'], hints: true, practice: true });
  return true;
}

for (const category of categories) {
  const label = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.name = 'packs';
  checkbox.value = category;
  label.append(checkbox, ' ' + category);
  byId('settings-packs').append(label);
}

function openSettings(fromRoom = false) {
  if (busy || settingsDialog.open) return;
  backToRoom = fromRoom;
  if (fromRoom) room.close();
  for (const input of settingsForm.elements) {
    if (input.name === 'rounds') input.checked = Number(input.value) === preferences.count;
    if (input.name === 'packs') input.checked = preferences.packs.includes(input.value);
    if (input.name === 'party') input.checked = preferences.party;
    if (input.name === 'hints') input.checked = preferences.hints;
  }
  byId('settings-status').textContent = isOnline() ? 'Настройки применятся к следующему матчу.' : '';
  settingsDialog.showModal();
}

byId('open-settings').addEventListener('click', () => openSettings());
byId('room-settings').addEventListener('click', () => openSettings(true));
byId('close-settings').addEventListener('click', () => settingsDialog.close());
settingsDialog.addEventListener('close', () => {
  if (backToRoom && !room.open) room.showModal();
  backToRoom = false;
});
settingsForm.addEventListener('submit', event => {
  event.preventDefault();
  const values = new FormData(settingsForm);
  const packs = values.getAll('packs');
  if (!packs.length) {
    byId('settings-status').textContent = 'Выбери хотя бы один пакет звуков.';
    return;
  }
  preferences = { count: Number(values.get('rounds')), packs, party: values.has('party'), hints: values.has('hints') };
  try { localStorage.setItem(roundsStore, JSON.stringify(preferences)); } catch { /* Storage may be disabled. */ }
  if (!isOnline()) startMatch('solo');
  settingsDialog.close();
});

createCatalog({
  trigger: byId('open-catalog'),
  sounds: SOUNDS,
  getTarget,
  onPractice: startPractice,
  async playSamples(samples) {
    if (busy || libraryPlaying) throw new Error('Дождись окончания записи или воспроизведения.');
    libraryPlaying = true;
    render();
    try { await playSamples(samples); }
    finally {
      libraryPlaying = false;
      render();
    }
  }
});

byId('solo-tab').addEventListener('click', openSolo);
byId('home').addEventListener('click', openSolo);
byId('duo-tab').addEventListener('click', () => room.showModal());
byId('close-room').addEventListener('click', () => room.close());
byId('host-tab').addEventListener('click', () => selectRoomRole('host'));
byId('join-tab').addEventListener('click', () => selectRoomRole('guest'));
byId('start-duo').addEventListener('click', sendMatch);
byId('leave-room').addEventListener('click', () => {
  resetRoom();
  if (isOnline()) startMatch('solo');
});
byId('make-offer').addEventListener('click', () => roomOperation(async () => {
  byId('offer-box').hidden = true;
  byId('answer-input').value = '';
  const code = await newPeerLink().createOffer();
  const site = new URL(location.href);
  site.hash = new URLSearchParams({ join: code }).toString();
  const remotelyReachable = site.protocol === 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(site.hostname);
  byId('offer-output').value = remotelyReachable ? site.href : code;
  byId('offer-box').hidden = false;
}));
byId('accept-offer').addEventListener('click', () => roomOperation(async () => {
  const code = inviteCode(byId('offer-input').value);
  if (!code.startsWith('MF1.offer.')) throw new Error('Вставь код или ссылку-приглашение.');
  byId('answer-box').hidden = true;
  byId('answer-output').value = await newPeerLink().acceptOffer(code);
  byId('answer-box').hidden = false;
}));
byId('accept-answer').addEventListener('click', () => roomOperation(async () => {
  await peerLink.acceptAnswer(byId('answer-input').value.trim());
}));
byId('copy-offer').addEventListener('click', () => copyField('offer-output'));
byId('copy-answer').addEventListener('click', () => copyField('answer-output'));
byId('listen').addEventListener('click', () => listen());
byId('record').addEventListener('click', record);
byId('replay').addEventListener('click', () => listen(ownTake));
byId('peer-replay').addEventListener('click', () => listen(friendTake));
byId('next').addEventListener('click', nextRound);
byId('restart').addEventListener('click', () => {
  if (match.practice) startPractice(cue.id);
  else startMatch('solo');
});
window.addEventListener('pagehide', () => peerLink?.close());

startMatch('solo', chooseRounds(SOUNDS[0].id));
const invitation = new URLSearchParams(location.hash.slice(1)).get('join');
if (invitation) {
  selectRoomRole('guest');
  byId('offer-input').value = invitation.slice(0, 40_000);
  room.showModal();
}
