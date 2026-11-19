import './style.css';
import { DURATION, type Round } from './round';
import { SliceSound } from './sound';
import { Blade, PlayerSlots, percentile, toStage } from './motion';
import { createGame, WatermelonScene, type Skeleton } from './game';
import { Vision, type Observation } from './vision';

const icon = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 17a11 11 0 0 0 22 0H5Z" fill="currentColor"/><path d="M8 17a8 8 0 0 0 16 0" stroke="#10221c" stroke-width="2"/><path d="m12 20 1 2m6-2-1 2" stroke="#10221c" stroke-width="2" stroke-linecap="round"/></svg>`;
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="topbar"><a class="brand" href="#">${icon}<span>动作派 <small>CAMERA GAMES</small></span></a><span class="local"><i></i> 本机识别 · 画面不上传</span><span class="badge">PLAY LAB / 01</span></header>
  <main>
    <section class="intro"><div><p class="eyebrow">把身体，变成手柄。</p><h1>挥挥手，<span>开个瓜。</span></h1><p class="subtitle">不必握住什么。站到镜头前，让每一次挥手都有回应。</p></div><div class="intro-note"><span>01 / WATERMELON</span><p>一个镜头，两位玩家。<br>先体验手感，再探索更多玩法。</p></div></section>
    <nav class="game-tabs" aria-label="选择游戏"><button class="game-tab selected" aria-current="page">${icon} 切西瓜 <span>正在体验</span></button><button class="game-tab" disabled>＋ 更多游戏 <span>即将加入</span></button></nav>
    <div class="workspace"><section class="play-column" aria-label="游戏区域">
      <div class="stage-toolbar"><span><i class="status-dot"></i><b id="mode-label">准备开玩</b></span><span id="engine-label">PHASER · MOVENET MULTIPOSE</span></div>
      <div id="stage"><div id="viewport">
        <video id="camera" autoplay muted playsinline aria-label="镜像摄像头画面"></video><div class="camera-shade"></div>
        <div class="zones" aria-hidden="true"><div><span>P1 <b>左侧玩家</b></span></div><div><span>P2 <b>右侧玩家</b></span></div></div>
        <div id="phaser"></div>
        <div id="round-hud" hidden><span class="player-score score-left">P1 <b id="score-0">0</b> 分</span><span id="round-clock">60</span><span class="player-score score-right">P2 <b id="score-1">0</b> 分</span></div>
        <div id="countdown" hidden role="status"></div>
        <div id="preparation" hidden aria-label="玩家准备"><div class="prepare-card" id="prepare-0"><b>P1 准备确认</b><p></p><span></span><progress max="1" value="0" aria-label="P1 准备进度"></progress></div><div class="prepare-card" id="prepare-1"><b>P2 准备确认</b><p></p><span></span><progress max="1" value="0" aria-label="P2 准备进度"></progress></div></div>
        <div id="results" hidden><p class="eyebrow">ROUND COMPLETE</p><h2 id="result-title">本局结束</h2><p id="result-scores"></p><p id="result-counts"></p><button id="replay" class="primary">再来一局</button><button id="exit-results" class="text-button">结束体验</button></div>
        <div id="welcome"><div class="melon-art"><span></span><span></span><span></span><i></i></div><p class="eyebrow">READY WHEN YOU ARE</p><h2>你的双手，就是刀光</h2><p>向两侧留出挥手空间，让肩膀、髋部和双手入镜。</p><button id="start" class="primary">开启摄像头 <span>↗</span></button><button id="demo" class="text-button">先用鼠标试切 →</button><small>仅在点击后请求摄像头权限</small></div>
        <div id="live-hint" class="live-hint" hidden>站进活动区，挥手切开飞起的西瓜</div>
        <span id="slice-flash" class="slice-flash" aria-hidden="true">漂亮的一刀！</span>
      </div></div>
      <div class="stage-bottom"><p id="status" role="status" aria-live="polite">每局 60 秒 · 西瓜 1 分 · 菠萝 2 分 · 越到最后越密集。</p><div><button id="reset" disabled title="清空西瓜和轨迹">重新开始</button><button id="stop" disabled>结束体验</button><button id="fullscreen" aria-label="切换游戏全屏">⛶</button></div></div>
      <div class="instructions"><div><span>01</span><p><b>站好位置</b>肩膀到髋部入镜，留出挥手空间。</p></div><div><span>02</span><p><b>挥动双手</b>西瓜 1 分，菠萝 2 分。</p></div><div><span>03</span><p><b>一起开玩</b>两侧同步出水果，各切各的。</p></div></div>
    </section>
    <aside><section class="panel"><div class="panel-heading"><h2>体验设置</h2><span>CONTROL</span></div>
      <label class="field">上场人数<select id="players"><option value="1">单人 · 自由站位</option><option value="2">双人 · 左右站位</option></select></label>
      <label class="field">摄像头<select id="device"><option value="">系统默认摄像头</option></select></label>
      <div class="two-fields"><label class="field">采集画质<select id="resolution"><option value="720">720p / 30fps</option><option value="1080">1080p / 30fps</option><option value="1080-60">1080p / 60fps</option></select></label><label class="field">识别输入<select id="dimension"><option>256</option><option>320</option><option>384</option><option>512</option></select></label></div>
      <label class="field">识别频率上限<select id="frequency"><option value="30">30 次 / 秒</option><option value="20">20 次 / 秒</option><option value="15">15 次 / 秒</option></select></label>
      <label class="slider-label" for="speed">挥手速度门槛 <output id="speed-value">220 px/s</output></label><input id="speed" type="range" min="80" max="600" value="220" step="20" />
      <label class="toggle"><input id="skeleton" type="checkbox" checked /><span>显示身体骨架</span></label><label class="toggle"><input id="background" type="checkbox" checked /><span>显示摄像头画面</span></label>
      <label class="toggle"><input id="sound" type="checkbox" checked /><span>播放切水果音效</span></label><p class="fineprint">画质、输入尺寸和人数在开始前设置。速度门槛越低，轻挥越容易触发。</p></section>
      <section class="panel metrics-panel"><div class="panel-heading"><h2>实时性能</h2><span><i></i> LIVE</span></div><div class="metrics"><div><span>识别频率</span><strong id="inference-fps">—</strong><small>次 / 秒</small></div><div><span>游戏帧率</span><strong id="render-fps">—</strong><small>FPS</small></div><div><span>推理耗时 P50</span><strong id="latency">—</strong><small>ms</small></div><div><span>推理耗时 P95</span><strong id="p95">—</strong><small>ms</small></div></div>
      <div class="diagnostics"><p>实际采集 <b id="capture">未连接</b></p><p>采集帧率 <b id="capture-fps">—</b></p><p>推理后端 <b id="backend">未加载</b></p><p>有效玩家 <b id="people">0 / 1</b></p></div><p class="fineprint">耗时为取帧与模型计算，不含显示延迟。鼠标模式仅验证轨迹和 Phaser。</p></section>
      <div class="privacy-note"><span>◉</span><p><b>让画面留在这里</b>不录像，不上传。所有识别和游戏计算都在当前浏览器完成。</p></div>
    </aside></div>
  </main><footer><span>动作派 / CAMERA GAMES</span><span>用动作，发现快乐。 <b>LOCAL-FIRST PLAYGROUND</b></span></footer>`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const video = $<HTMLVideoElement>('camera');
const scene = new WatermelonScene();
const sound = new SliceSound();
const game = createGame($('phaser'), scene);
let mode: 'idle' | 'camera' | 'mouse' = 'idle';
let session = 0, busy = false;
let stream: MediaStream | null = null, vision: Vision | null = null;
let frameCallback = 0;
let frameTimes: number[] = [], captureTimes: number[] = [], latencies: number[] = [];
let captureSupported = 'requestVideoFrameCallback' in video;
let people = 0, lastObservation = 0, flashTimer = 0;
let motionResetAt = 0;
const slots = new PlayerSlots();
const blades = [new Blade(), new Blade(), new Blade(), new Blade()];
const configIds = ['players', 'device', 'resolution', 'dimension', 'frequency'];
const selected = (id: string) => $<HTMLSelectElement>(id).value;
const setStatus = (text: string, error = false) => { $('status').textContent = text; $('status').classList.toggle('error', error); };

function updateControls() {
  $('welcome').hidden = mode !== 'idle';
  $('live-hint').hidden = mode === 'idle';
  $<HTMLButtonElement>('start').disabled = busy;
  $<HTMLButtonElement>('demo').disabled = busy;
  $<HTMLButtonElement>('stop').disabled = mode === 'idle' && !busy;
  $<HTMLButtonElement>('reset').disabled = mode === 'idle' || busy;
  for (const id of configIds) $<HTMLSelectElement>(id).disabled = busy || mode !== 'idle';
  $('mode-label').textContent = busy ? '正在准备…' : mode === 'camera' ? '摄像头体验中' : mode === 'mouse' ? '鼠标试切中' : '准备开玩';
  $('stage').classList.toggle('single', selected('players') === '1');
  $('round-hud').hidden = mode === 'idle';
  if (mode === 'idle') { $('countdown').hidden = true; $('results').hidden = true; $('preparation').hidden = true; }
  $('stage').classList.toggle('camera-active', mode === 'camera');
  $('stage').classList.toggle('demo-active', mode === 'mouse');
}

function clearMotion() { motionResetAt = performance.now(); slots.reset(); blades.forEach(b => b.reset()); scene.setSkeletons([], 0); people = 0; }
async function stop() {
  session++; busy = false; mode = 'idle';
  stream?.getTracks().forEach(t => t.stop()); stream = null;
  if (captureSupported) video.cancelVideoFrameCallback(frameCallback);
  video.pause(); video.srcObject = null;
  const previous = vision; vision = null;
  clearMotion(); scene.setMode('idle'); updateControls();
  frameTimes = []; captureTimes = []; latencies = [];
  $('capture').textContent = '未连接'; $('backend').textContent = '未加载';
  setStatus('摄像头已关闭。可以更改设置，或再次开始。');
  await previous?.stop();
}

function observe(frame: Observation) {
  if (mode !== 'camera' || scene.round.state === 'finished' || document.hidden || frame.time < motionResetAt) return;
  const now = performance.now(); lastObservation = now;
  frameTimes.push(now); latencies.push(frame.ms); if (latencies.length > 120) latencies.shift();
  const assigned = slots.update(frame.poses, frame.time, frame.width, Number(selected('players')));
  people = assigned.length;
  const skeletons: Skeleton[] = [];
  const active = new Set<number>();
  for (const { pose, player, changed } of assigned) {
    active.add(player);
    if (changed) { blades[player * 2].reset(); blades[player * 2 + 1].reset(); }
    const points = pose.keypoints.map(p => (p.score ?? 0) >= 0.35 && p.x >= 0 && p.x <= frame.width && p.y >= 0 && p.y <= frame.height ? toStage(p, frame.width, frame.height) : null);
    skeletons.push({ player, id: pose.id!, points });
    for (let hand = 0; hand < 2; hand++) {
      const stroke = blades[player * 2 + hand].push(points[9 + hand], frame.time, player, scene.minSpeed);
      if (stroke) scene.slice(stroke);
    }
  }
  for (let player = 0; player < 2; player++) if (!active.has(player)) {
    blades[player * 2].reset(); blades[player * 2 + 1].reset();
  }
  scene.setSkeletons(skeletons, frame.time);
  $('live-hint').textContent = scene.round.state === 'waiting' ? '双手抬到腹部线以上，保持 1 秒确认' : people ? `${people} 位玩家已就位 · 挥动手腕切西瓜` : '没有识别到玩家 · 请让肩膀到髋部入镜';
}

async function listCameras() {
  const current = selected('device');
  const devices = await navigator.mediaDevices.enumerateDevices();
  const select = $<HTMLSelectElement>('device');
  select.replaceChildren(new Option('系统默认摄像头', ''));
  devices.filter(d => d.kind === 'videoinput').forEach((d, i) => select.add(new Option(d.label || `摄像头 ${i + 1}`, d.deviceId)));
  if ([...select.options].some(o => o.value === current)) select.value = current;
}

function errorMessage(error: unknown) {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError') return '未获得摄像头权限。请在地址栏和系统隐私设置中允许 Chrome 使用摄像头，再重试。';
  if (name === 'NotFoundError') return '未找到摄像头，请连接 USB 摄像头或使用笔记本内置摄像头。';
  if (name === 'NotReadableError') return '摄像头无法启动，可能被其他应用占用。关闭视频会议软件后重试。';
  if (name === 'OverconstrainedError') return '摄像头不支持所选设置，请选择默认摄像头或 720p 后重试。';
  return `启动或识别失败：${error instanceof Error ? error.message : String(error)}。请检查模型文件和 Chrome 图形加速，然后重试。`;
}

async function startCamera() {
  if (busy || mode !== 'idle') return;
  sound.unlock();
  scene.players = Number(selected('players'));
  if (!navigator.mediaDevices?.getUserMedia) { setStatus('摄像头需要 HTTPS 或 localhost，请通过本机开发地址打开。', true); return; }
  const token = ++session;
  busy = true; updateControls(); setStatus('请在浏览器提示中允许使用摄像头…');
  const localVision = new Vision();
  try {
    const resolution = selected('resolution'), height = resolution.startsWith('1080') ? 1080 : 720;
    const deviceId = selected('device');
    const localStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
      width: { ideal: height * 16 / 9 }, height: { ideal: height }, frameRate: { ideal: resolution.endsWith('-60') ? 60 : 30 },
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    } });
    if (token !== session) { localStream.getTracks().forEach(t => t.stop()); return; }
    stream = localStream; video.srcObject = stream; await video.play();
    if (token !== session) return;
    await listCameras();
    if (token !== session) return;
    localVision.settings = { dimension: Number(selected('dimension')), hz: Number(selected('frequency')) };
    await localVision.load(text => { if (token === session) setStatus(text); });
    if (token !== session) { await localVision.stop(); return; }
    vision = localVision; mode = 'camera'; busy = false; clearMotion(); scene.setMode('camera'); updateControls();
    const settings = stream.getVideoTracks()[0].getSettings();
    $('capture').textContent = `${settings.width} × ${settings.height} / ${settings.frameRate?.toFixed(0) ?? '?'}fps`;
    $('backend').textContent = 'WebGL · GPU';
    setStatus('识别已启动。手腕划过西瓜即可切开；每位玩家的轨迹独立处理。');
    if (captureSupported) {
      const capture = () => { if (token !== session) return; captureTimes.push(performance.now()); frameCallback = video.requestVideoFrameCallback(capture); };
      frameCallback = video.requestVideoFrameCallback(capture);
    }
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      if (token === session) void stop().then(() => setStatus('摄像头已断开，请重新连接后开始。', true));
    });
    localVision.start(video, observe, error => { if (token === session) void stop().then(() => setStatus(errorMessage(error), true)); });
  } catch (error) {
    await localVision.stop();
    if (token === session) { await stop(); setStatus(errorMessage(error), true); }
  }
}

$('start').addEventListener('click', () => void startCamera());
$('stop').addEventListener('click', () => void stop());
$('demo').addEventListener('click', () => {
  sound.unlock(); scene.players = Number(selected('players'));
  mode = 'mouse'; scene.setMode('mouse'); updateControls();
  $('live-hint').textContent = '鼠标试切 · 移动到左／右半屏模拟对应玩家';
  setStatus('鼠标模式：没有打开摄像头或加载模型，移动鼠标验证轨迹和碰撞。');
});
function replay() { sound.unlock(); clearMotion(); scene.reset(); vision?.resume(); if (mode === 'camera') $('backend').textContent = 'WebGL · GPU'; setStatus(mode === 'camera' ? '请重新将双手抬到腹部线以上，保持 1 秒确认。' : '新一局倒计时开始。'); }
$('reset').addEventListener('click', replay);
$('replay').addEventListener('click', replay);
$('exit-results').addEventListener('click', () => void stop());
$('sound').addEventListener('change', () => { sound.muted = !$<HTMLInputElement>('sound').checked; if (!sound.muted) sound.unlock(); });
$('fullscreen').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('stage').requestFullscreen(); }
  catch { setStatus('当前浏览器不支持全屏，可以使用浏览器的全屏功能。'); }
});
$('players').addEventListener('change', updateControls);
$('speed').addEventListener('input', () => { scene.minSpeed = Number($<HTMLInputElement>('speed').value); $('speed-value').textContent = `${scene.minSpeed} px/s`; });
$('skeleton').addEventListener('change', () => scene.showSkeleton = $<HTMLInputElement>('skeleton').checked);
$('background').addEventListener('change', () => $('stage').classList.toggle('hide-video', !$<HTMLInputElement>('background').checked));
scene.onSlice = (kind, player, points) => {
  sound.play(kind);
  $('slice-flash').textContent = `P${player + 1} ${kind === 'melon' ? '西瓜' : '菠萝'} +${points}`;
  $('slice-flash').classList.add('visible'); window.clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => $('slice-flash').classList.remove('visible'), 650);
};
let preparationDisplay = '';
scene.onPreparation = views => {
  const key = JSON.stringify(views.map(v => [v.ready, Math.round(v.progress * 100), v.message, v.hands]));
  if (key === preparationDisplay) return;
  preparationDisplay = key;
  views.forEach((view, player) => {
    const card = $(`prepare-${player}`);
    card.classList.toggle('confirmed', view.ready);
    card.querySelector('p')!.textContent = view.message;
    card.querySelector('span')!.textContent = view.ready ? '等待所有玩家准备完成' : `左手 ${view.hands[0] ? '✓' : '待抬起'} · 右手 ${view.hands[1] ? '✓' : '待抬起'}`;
    card.querySelector('progress')!.value = view.progress;
  });
};
let lastRoundDisplay = '';
scene.onRound = (round: Round) => {
  const remaining = Math.ceil((DURATION - round.elapsed) / 1000);
  const key = `${mode}:${round.state}:${remaining}:${round.countdown}:${round.scores}:${round.players}`;
  if (key === lastRoundDisplay) return;
  lastRoundDisplay = key;
  $('score-0').textContent = String(round.scores[0]); $('score-1').textContent = String(round.scores[1]);
  $('round-clock').textContent = `${remaining}s`;
  $('round-clock').classList.toggle('urgent', remaining <= 10);
  $('countdown').hidden = mode === 'idle' || round.state !== 'countdown';
  $('preparation').hidden = mode !== 'camera' || round.state !== 'waiting';
  $('countdown').textContent = round.state === 'waiting' ? `等待 ${round.players} 位玩家就位` : String(round.countdown);
  $('results').hidden = mode === 'idle' || round.state !== 'finished';
  if (round.state === 'finished') {
    if (mode === 'camera') {
      vision?.pause(); clearMotion(); frameTimes = []; latencies = [];
      $('backend').textContent = 'WebGL · 已暂停';
    }
    $('result-title').textContent = round.players === 1 ? '挑战完成！' : round.scores[0] === round.scores[1] ? '平局，一样出色！' : `P${round.scores[0] > round.scores[1] ? 1 : 2} 获胜！`;
    $('result-scores').textContent = round.players === 1 ? `${round.scores[0]} 分` : `P1  ${round.scores[0]} 分   ·   P2  ${round.scores[1]} 分`;
    $('result-counts').textContent = round.counts.slice(0, round.players).map((c, i) => `P${i + 1}：西瓜 ${c.melon} / 菠萝 ${c.pineapple}`).join('　｜　');
    $('live-hint').hidden = true;
    setStatus('60 秒结束，得分已锁定。可以再来一局，或结束体验关闭摄像头。');
  } else if (mode !== 'idle') $('live-hint').hidden = false;
};
document.addEventListener('visibilitychange', () => {
  scene.setPaused(document.hidden);
  clearMotion(); frameTimes = []; captureTimes = [];
  if (mode !== 'idle') setStatus(document.hidden ? '页面不在前台，已暂停识别与游戏。' : '已恢复，重新挥手即可。');
});
window.addEventListener('pagehide', () => { void stop(); });

const metricsTimer = window.setInterval(() => {
  const now = performance.now();
  frameTimes = frameTimes.filter(t => now - t < 1000); captureTimes = captureTimes.filter(t => now - t < 1000);
  $('inference-fps').textContent = mode === 'camera' ? String(frameTimes.length) : '—';
  $('render-fps').textContent = mode !== 'idle' ? game.loop.actualFps.toFixed(0) : '—';
  $('latency').textContent = latencies.length ? percentile(latencies, 0.5).toFixed(1) : '—';
  $('p95').textContent = latencies.length ? percentile(latencies, 0.95).toFixed(1) : '—';
  $('capture-fps').textContent = mode === 'camera' ? captureSupported ? `${captureTimes.length} fps` : '浏览器未提供统计' : '—';
  $('people').textContent = `${mode === 'camera' && now - lastObservation < 500 ? people : 0} / ${selected('players')}`;
}, 500);
if (navigator.mediaDevices) void listCameras().catch(() => {});
updateControls();

if (import.meta.hot) import.meta.hot.dispose(() => { void stop(); game.destroy(true); sound.dispose(); window.clearInterval(metricsTimer); });
