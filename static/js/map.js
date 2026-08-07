const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
const shell = document.getElementById('mapShell');
const waitPanel = document.getElementById('mapWait');
const statusDot = document.getElementById('mapStatusDot');
const statusText = document.getElementById('mapStatusText');
const orientationButton = document.getElementById('orientationMap');
const orientationBadge = document.getElementById('orientationBadge');
const alertStack = document.getElementById('mapAlertStack');
const alertToggle = document.getElementById('toggleAlerts');

let mapImage = null;
let mapObjects = [];
let mapGeneration = null;
let zoom = 1;
let panX = 0;
let panY = 0;
let headingUp = true;
let dragging = false;
let dragStart = null;
let lastTouchDistance = null;
let lastTouchMidpoint = null;
let targetRotation = 0;
let displayRotation = 0;
let targetPlayer = null;
let displayPlayer = null;
let lastTrailPoint = null;
const playerTrail = [];
let lastFrame = performance.now();
let sharedSettings = { defaults: {}, profiles: {}, display: {} };
let alertProfile = {};
let alertsEnabled = true;
let lastAlertSignature = '';
let lastTelemetrySuccess = 0;
let mapSocket = null;
let mapReconnectTimer = null;
let mapStreamOpen = false;
let lastMapSequence = -1;

setTimeout(() => document.getElementById('mapHelp')?.classList.add('hidden'), 5000);

async function loadSharedSettings() {
  try {
    sharedSettings = await fetch('/api/settings', { cache: 'no-store' }).then(response => response.json());
    alertsEnabled = sharedSettings.display?.mapAlerts !== false;
    alertToggle.classList.toggle('muted', !alertsEnabled);
  } catch {
    sharedSettings = { defaults: {}, profiles: {}, display: {} };
  }
}

function resolveAlertProfile(rawVehicle) {
  alertProfile = {
    ...(sharedSettings.defaults || {}),
    ...((sharedSettings.profiles || {})[rawVehicle] || {}),
  };
}

function telemetryEngines(state) {
  const engines = [];
  for (let index = 1; index <= 8; index++) {
    const rpm = number(state[`RPM ${index}`]);
    if (rpm !== null) engines.push(rpm);
  }
  return engines;
}

function mapAlerts(payload) {
  if (!alertsEnabled || sharedSettings.display?.mapAlerts === false) return [];
  const state = payload.state || {};
  const indicators = payload.indicators || {};
  const derived = payload.derived || {};
  resolveAlertProfile(payload.vehicle);
  if (alertProfile.alertsEnabled === false) return [];
  const ias = number(pick(state, ['IAS, km/h']));
  const verticalSpeed = number(pick(state, ['Vy, m/s'])) ?? number(indicators.vario);
  const gLoad = number(derived.g_load) ?? number(pick(state, ['Ny','Ny, g','Ny, G','g_load','g-force'])) ?? number(indicators.g_meter);
  const gWarning = Boolean(derived.g_warning);
  const gWarningValue = number(derived.g_warning_value) ?? gLoad;
  const gPeakPositive = number(derived.g_peak_positive) ?? gLoad;
  const aoa = number(pick(state, ['AoA, deg']));
  const fuel = number(pick(state, ['Mfuel, kg'])) ?? number(indicators.fuel);
  const fuelCapacity = number(pick(state, ['Mfuel0, kg']));
  const fuelPct = fuel !== null && fuelCapacity ? fuel / fuelCapacity * 100 : null;
  const gear = number(indicators.gears ?? indicators.gears1);
  const flapsState = number(pick(state, ['flaps, %']));
  const flapsIndicator = number(indicators.flaps);
  const gearDown = gear !== null && gear > .01;
  const flapsDown = (flapsState !== null && flapsState > 1) || (flapsIndicator !== null && flapsIndicator > .01);
  const alerts = [];
  const add = (key, label, tone = 'warning') => alerts.push({ key, label, tone });

  if (alertProfile.alertLowFuel !== false && fuelPct !== null) {
    if (fuelPct <= (alertProfile.fuelCriticalPct ?? 15)) add('fuel-critical', `LOW FUEL · ${Math.round(fuelPct)}%`, 'danger');
    else if (fuelPct <= (alertProfile.fuelReservePct ?? 25)) add('fuel-reserve', `FUEL RESERVE · ${Math.round(fuelPct)}%`);
  }
  if (alertProfile.alertHighG !== false && (gWarning || gLoad !== null && (gLoad > (alertProfile.highG ?? 8) || gLoad < (alertProfile.lowG ?? -3)))) add('g-limit', `OVER G · ${gWarningValue > 0 ? '+' : ''}${gWarningValue.toFixed(1)} G`, 'danger');
  else if (alertProfile.alertGCaution !== false && gPeakPositive !== null && gPeakPositive > (alertProfile.gCaution ?? 4)) add('g-caution', `HIGH G · +${gPeakPositive.toFixed(1)} G`);
  const stallActive = aoa !== null && aoa >= (alertProfile.stallAoADeg ?? 22);
  if (alertProfile.alertStall !== false && stallActive) add('stall', `STALL · AoA ${aoa.toFixed(1)}°`, 'danger');
  else if (alertProfile.alertHighAoA !== false && aoa !== null && aoa > (alertProfile.highAoADeg ?? 18)) add('high-aoa', `HIGH AoA · ${aoa.toFixed(1)}°`);
  if (alertProfile.alertSinkRate !== false && ias !== null && ias > 0 && ias < (alertProfile.sinkRateMaxIas ?? 500) && verticalSpeed !== null && verticalSpeed <= (alertProfile.sinkRateWarning ?? -4.5)) add('sink-rate', `SINK RATE · ${verticalSpeed.toFixed(1)} m/s`, 'danger');
  if (alertProfile.alertGearOverspeed !== false && gearDown && ias !== null && ias > (alertProfile.gearOverspeedKmh ?? 450)) add('gear-speed', `GEAR OVERSPEED · ${Math.round(ias)} km/h`, 'danger');
  if (alertProfile.alertFlapOverspeed !== false && flapsDown && ias !== null && ias > (alertProfile.flapOverspeedKmh ?? 500)) add('flap-speed', `FLAP OVERSPEED · ${Math.round(ias)} km/h`, 'danger');
  if (alertProfile.alertEngineMismatch !== false) {
    const rpms = telemetryEngines(state);
    if (rpms.length >= 2) {
      const mismatch = (Math.max(...rpms) - Math.min(...rpms)) / Math.max(...rpms) * 100;
      if (mismatch > (alertProfile.engineMismatchPct ?? 18)) add('engine-mismatch', `ENGINE MISMATCH · ${Math.round(mismatch)}%`, 'danger');
    }
  }
  return alerts.slice(0, 2);
}

function renderMapAlerts(payload) {
  const alerts = mapAlerts(payload);
  const signature = alerts.map(alert => alert.key).join('|');
  if (signature === lastAlertSignature) return;
  lastAlertSignature = signature;
  alertStack.innerHTML = alerts.map(alert => `<div class="map-alert ${alert.tone}"><span></span><strong>${alert.label}</strong></div>`).join('');
}


const number = value => Number.isFinite(Number(value)) ? Number(value) : null;
const pick = (obj, keys) => {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return null;
};
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function normaliseAngle(angle) {
  let result = angle;
  while (result > Math.PI) result -= Math.PI * 2;
  while (result < -Math.PI) result += Math.PI * 2;
  return result;
}

function lerpAngle(current, target, amount) {
  return current + normaliseAngle(target - current) * amount;
}

function isPlayer(obj) {
  return String(obj?.icon || '').toLowerCase() === 'player' ||
    /\bplayer\b/i.test(String(obj?.icon_bg || '')) ||
    obj?.is_player === true || obj?.player === true;
}

function aircraftAngle(obj) {
  const dx = number(obj?.dx);
  const dy = number(obj?.dy);
  if (dx === null || dy === null || (Math.abs(dx) < 0.00001 && Math.abs(dy) < 0.00001)) return null;
  return Math.atan2(dy, dx) + Math.PI / 2;
}

function resize() {
  const rect = shell.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
}

function mapRect(width, height) {
  if (!mapImage) return { x: 0, y: 0, width, height };
  const imageRatio = mapImage.width / mapImage.height;
  const viewRatio = width / height;
  if (imageRatio > viewRatio) {
    const h = width / imageRatio;
    return { x: 0, y: (height - h) / 2, width, height: h };
  }
  const w = height * imageRatio;
  return { x: (width - w) / 2, y: 0, width: w, height };
}

function objectColour(obj) {
  const candidate = typeof obj.color === 'string' ? obj.color : null;
  if (candidate && /^#[0-9a-f]{6}$/i.test(candidate)) return candidate;
  return '#9ce7cf';
}

function point(rect, x, y) {
  return {
    x: rect.x + Number(x) * rect.width,
    y: rect.y + Number(y) * rect.height,
  };
}

function updatePlayerTracking() {
  const player = mapObjects.find(isPlayer);
  if (!player || player.x === undefined || player.y === undefined) return;

  const x = number(player.x);
  const y = number(player.y);
  if (x === null || y === null) return;

  targetPlayer = { x, y };
  if (!displayPlayer) displayPlayer = { ...targetPlayer };

  const angle = aircraftAngle(player);
  if (angle !== null) targetRotation = -angle;

  if (!lastTrailPoint || Math.hypot(x - lastTrailPoint.x, y - lastTrailPoint.y) > 0.0013) {
    playerTrail.push({ x, y });
    lastTrailPoint = { x, y };
    if (playerTrail.length > 220) playerTrail.shift();
  }
}

function coverScale(rect, width, height) {
  if (!rect.width || !rect.height) return 1;
  return Math.max(width / rect.width, height / rect.height);
}

function transformedBounds(rect, origin, rotation, scale, anchor) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const corners = [
    [rect.x, rect.y],
    [rect.x + rect.width, rect.y],
    [rect.x + rect.width, rect.y + rect.height],
    [rect.x, rect.y + rect.height],
  ].map(([x, y]) => {
    const dx = (x - origin.x) * scale;
    const dy = (y - origin.y) * scale;
    return {
      x: anchor.x + dx * cos - dy * sin,
      y: anchor.y + dx * sin + dy * cos,
    };
  });

  return {
    minX: Math.min(...corners.map(corner => corner.x)),
    maxX: Math.max(...corners.map(corner => corner.x)),
    minY: Math.min(...corners.map(corner => corner.y)),
    maxY: Math.max(...corners.map(corner => corner.y)),
  };
}

function clampAnchorToMap(rect, origin, rotation, scale, anchor, width, height) {
  let adjusted = { ...anchor };
  let bounds = transformedBounds(rect, origin, rotation, scale, adjusted);

  if (bounds.maxX - bounds.minX >= width) {
    if (bounds.minX > 0) adjusted.x -= bounds.minX;
    else if (bounds.maxX < width) adjusted.x += width - bounds.maxX;
  } else {
    adjusted.x += width / 2 - (bounds.minX + bounds.maxX) / 2;
  }

  bounds = transformedBounds(rect, origin, rotation, scale, adjusted);
  if (bounds.maxY - bounds.minY >= height) {
    if (bounds.minY > 0) adjusted.y -= bounds.minY;
    else if (bounds.maxY < height) adjusted.y += height - bounds.maxY;
  } else {
    adjusted.y += height / 2 - (bounds.minY + bounds.maxY) / 2;
  }

  return adjusted;
}

function drawTrail(rect, symbolScale) {
  if (playerTrail.length < 2) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(116, 241, 197, .72)';
  ctx.lineWidth = 1.8 * symbolScale;
  ctx.setLineDash([6 * symbolScale, 7 * symbolScale]);
  ctx.beginPath();
  playerTrail.forEach((trailPoint, index) => {
    const p = point(rect, trailPoint.x, trailPoint.y);
    if (index === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawAircraft(obj, rect, symbolScale) {
  if (obj.x === undefined || obj.y === undefined) return;
  const p = point(rect, obj.x, obj.y);
  const angle = aircraftAngle(obj) ?? 0;
  const player = isPlayer(obj);
  const size = (player ? 14 : 9) * symbolScale;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.72, size * 0.82);
  ctx.lineTo(0, size * 0.42);
  ctx.lineTo(-size * 0.72, size * 0.82);
  ctx.closePath();
  ctx.fillStyle = player ? '#ffffff' : objectColour(obj);
  ctx.shadowColor = player ? '#74f1c5' : objectColour(obj);
  ctx.shadowBlur = (player ? 14 : 5) * symbolScale;
  ctx.fill();
  ctx.restore();

  if (player) {
    ctx.strokeStyle = '#74f1c5';
    ctx.lineWidth = 1.5 * symbolScale;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 19 * symbolScale, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPointObject(obj, rect, symbolScale) {
  if (obj.x === undefined || obj.y === undefined) return;
  if (obj.type === 'aircraft' || isPlayer(obj)) return drawAircraft(obj, rect, symbolScale);
  const p = point(rect, obj.x, obj.y);
  const colour = objectColour(obj);
  const size = (obj.type === 'ship' ? 6.5 : 5.5) * symbolScale;

  ctx.fillStyle = colour;
  ctx.strokeStyle = 'rgba(0,0,0,.82)';
  ctx.lineWidth = 1.5 * symbolScale;
  ctx.beginPath();
  if (obj.type === 'ship') {
    ctx.moveTo(p.x, p.y - size);
    ctx.lineTo(p.x + size, p.y);
    ctx.lineTo(p.x, p.y + size);
    ctx.lineTo(p.x - size, p.y);
    ctx.closePath();
  } else {
    ctx.rect(p.x - size, p.y - size, size * 2, size * 2);
  }
  ctx.fill();
  ctx.stroke();
}

function drawLineObject(obj, rect, symbolScale) {
  if ([obj.sx, obj.sy, obj.ex, obj.ey].some(value => value === undefined)) return;
  const start = point(rect, obj.sx, obj.sy);
  const end = point(rect, obj.ex, obj.ey);
  ctx.strokeStyle = objectColour(obj);
  ctx.lineWidth = (obj.type === 'airfield' ? 5 : 2) * symbolScale;
  ctx.globalAlpha = obj.type === 'airfield' ? 0.9 : 0.75;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawFixedAircraftCue(anchor) {
  if (!targetPlayer) return;
  ctx.save();
  ctx.translate(anchor.x, anchor.y);
  ctx.strokeStyle = 'rgba(255,255,255,.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-28, 0); ctx.lineTo(-18, 0);
  ctx.moveTo(18, 0); ctx.lineTo(28, 0);
  ctx.moveTo(0, -28); ctx.lineTo(0, -18);
  ctx.moveTo(0, 18); ctx.lineTo(0, 28);
  ctx.stroke();
  ctx.restore();
}

function render() {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#050908';
  ctx.fillRect(0, 0, width, height);
  if (!mapImage) return;

  const rect = mapRect(width, height);
  const playerPoint = displayPlayer
    ? point(rect, displayPlayer.x, displayPlayer.y)
    : { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  const rotation = headingUp && displayPlayer ? displayRotation : 0;
  const effectiveScale = coverScale(rect, width, height) * zoom;
  const desiredAnchor = {
    x: width / 2 + panX,
    y: height / 2 + panY,
  };
  const anchor = clampAnchorToMap(
    rect,
    playerPoint,
    rotation,
    effectiveScale,
    desiredAnchor,
    width,
    height,
  );
  const symbolScale = 1 / effectiveScale;

  ctx.save();
  ctx.translate(anchor.x, anchor.y);
  ctx.rotate(rotation);
  ctx.scale(effectiveScale, effectiveScale);
  ctx.translate(-playerPoint.x, -playerPoint.y);

  ctx.drawImage(mapImage, rect.x, rect.y, rect.width, rect.height);
  ctx.fillStyle = 'rgba(2, 9, 8, 0.08)';
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

  drawTrail(rect, symbolScale);
  for (const obj of mapObjects) drawLineObject(obj, rect, symbolScale);
  for (const obj of mapObjects) drawPointObject(obj, rect, symbolScale);
  ctx.restore();

  drawFixedAircraftCue(anchor);
}

function animate(now) {
  const elapsed = Math.min(50, now - lastFrame);
  lastFrame = now;
  const smoothing = 1 - Math.pow(0.001, elapsed / 1000);

  if (targetPlayer) {
    if (!displayPlayer) displayPlayer = { ...targetPlayer };
    displayPlayer.x += (targetPlayer.x - displayPlayer.x) * smoothing;
    displayPlayer.y += (targetPlayer.y - displayPlayer.y) * smoothing;
  }
  displayRotation = lerpAngle(displayRotation, targetRotation, smoothing);
  render();
  requestAnimationFrame(animate);
}

async function loadMapImage() {
  try {
    const response = await fetch(`/api/map/image?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('map unavailable');
    const blob = await response.blob();
    let decoded;
    if ('createImageBitmap' in window) {
      decoded = await createImageBitmap(blob);
    } else {
      decoded = await new Promise((resolve, reject) => {
        const image = new Image();
        const objectUrl = URL.createObjectURL(blob);
        image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image); };
        image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Unable to decode map image')); };
        image.src = objectUrl;
      });
    }
    if (mapImage?.close) mapImage.close();
    mapImage = decoded;
    waitPanel.classList.add('hidden');
    statusDot.classList.add('online');
    statusText.textContent = 'TACTICAL MAP LIVE';
  } catch {
    statusDot.classList.remove('online');
    statusText.textContent = 'WAITING FOR MAP';
    waitPanel.classList.remove('hidden');
  }
}

async function applyMapInfo(info) {
  if (!info || typeof info !== 'object') return;
  const nextGeneration = String(info.map_generation ?? 'unknown');
  if (!mapImage || nextGeneration !== mapGeneration) {
    mapGeneration = nextGeneration;
    playerTrail.length = 0;
    lastTrailPoint = null;
    await loadMapImage();
  }
}
async function updateMapInfo() {
  try { const r=await fetch('/api/map/info',{cache:'no-store'}); if(!r.ok) throw new Error(); await applyMapInfo(await r.json()); }
  catch { if(!mapImage) await loadMapImage(); }
}
function applyMapObjects(objects, sequence=null) {
  if (sequence!==null && Number.isFinite(sequence) && sequence===lastMapSequence) return;
  if (sequence!==null && Number.isFinite(sequence)) lastMapSequence=sequence;
  mapObjects=Array.isArray(objects)?objects:[]; updatePlayerTracking();
  statusDot.classList.add('online'); statusText.textContent=`TACTICAL MAP LIVE · 10 HZ · ${mapObjects.length} OBJECTS`; waitPanel.classList.add('hidden');
}
async function updateObjects() {
  try { const r=await fetch('/api/map/objects',{cache:'no-store'}); if(!r.ok) throw new Error(); applyMapObjects(await r.json()); }
  catch { if(!mapImage){statusDot.classList.remove('online');statusText.textContent='WAITING FOR MAP';} }
}
function applyTelemetryPayload(payload) {
  lastTelemetrySuccess=Date.now(); const state=payload.state||{}, indicators=payload.indicators||{};
  const ias=number(pick(state,['IAS, km/h'])), altitude=number(pick(state,['H, m'])), heading=number(pick(indicators,['compass','compass1','compass2']));
  document.getElementById('mapIas').textContent=ias===null?'—':Math.round(ias);
  document.getElementById('mapAlt').textContent=altitude===null?'—':Math.round(altitude);
  document.getElementById('mapHeading').textContent=heading===null?'—':String(Math.round((heading+360)%360)).padStart(3,'0');
  renderMapAlerts(payload);
}
async function updateFlightStrip() {
  try { const r=await fetch('/api/telemetry',{cache:'no-store'}); if(!r.ok) throw new Error(); applyTelemetryPayload(await r.json()); }
  catch { if(alertsEnabled&&alertProfile.alertTelemetryStale!==false&&lastTelemetrySuccess&&Date.now()-lastTelemetrySuccess>2500){lastAlertSignature='stale';alertStack.innerHTML='<div class="map-alert warning"><span></span><strong>TELEMETRY STALE</strong></div>';} }
}
function connectMapStream() {
  clearTimeout(mapReconnectTimer); const protocol=location.protocol==='https:'?'wss:':'ws:';
  mapSocket=new WebSocket(`${protocol}//${location.host}/ws/map`);
  mapSocket.addEventListener('open',()=>{mapStreamOpen=true;statusDot.classList.add('online');statusText.textContent='TACTICAL MAP LIVE · 10 HZ';});
  mapSocket.addEventListener('message',event=>{try{const m=JSON.parse(event.data);applyMapObjects(m.objects,Number(m.sequence));if(m.map_info)applyMapInfo(m.map_info);if(m.telemetry)applyTelemetryPayload(m.telemetry);}catch(err){console.error(err);}});
  mapSocket.addEventListener('close',()=>{mapStreamOpen=false;statusDot.classList.remove('online');statusText.textContent='RECONNECTING MAP STREAM';mapReconnectTimer=setTimeout(connectMapStream,1000);});
  mapSocket.addEventListener('error',()=>mapSocket.close());
}
async function fallbackRefresh(){if(mapStreamOpen)return;await Promise.allSettled([updateObjects(),updateFlightStrip(),updateMapInfo()]);}

function setZoom(next, anchorX = canvas.clientWidth / 2, anchorY = canvas.clientHeight / 2) {
  const old = zoom;
  zoom = clamp(next, 0.65, 5);
  const ratio = zoom / old;
  const cx = canvas.clientWidth / 2;
  const cy = canvas.clientHeight / 2;
  panX = anchorX - cx - (anchorX - cx - panX) * ratio;
  panY = anchorY - cy - (anchorY - cy - panY) * ratio;
}

function resetMapView() {
  zoom = 1;
  panX = 0;
  panY = 0;
  if (targetPlayer) displayPlayer = { ...targetPlayer };
}

function updateOrientationUi() {
  orientationButton.textContent = headingUp ? 'HDG' : 'N';
  orientationButton.setAttribute('aria-label', headingUp ? 'Switch to north-up map' : 'Switch to heading-up map');
  orientationButton.title = headingUp ? 'Heading-up enabled' : 'North-up enabled';
  orientationBadge.textContent = headingUp ? 'HEADING UP' : 'NORTH UP';
  orientationBadge.classList.toggle('north-up', !headingUp);
}

canvas.addEventListener('wheel', event => {
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  setZoom(
    zoom * (event.deltaY < 0 ? 1.16 : 0.86),
    event.clientX - rect.left,
    event.clientY - rect.top,
  );
}, { passive: false });

canvas.addEventListener('pointerdown', event => {
  if (event.pointerType === 'touch') return;
  dragging = true;
  dragStart = { x: event.clientX - panX, y: event.clientY - panY };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (!dragging || event.pointerType === 'touch') return;
  panX = event.clientX - dragStart.x;
  panY = event.clientY - dragStart.y;
});
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointercancel', () => { dragging = false; });

canvas.addEventListener('touchstart', event => {
  event.preventDefault();
  if (event.touches.length === 1) {
    const t = event.touches[0];
    dragStart = { x: t.clientX - panX, y: t.clientY - panY };
  } else if (event.touches.length === 2) {
    const [a, b] = event.touches;
    lastTouchDistance = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    lastTouchMidpoint = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
  }
}, { passive: false });
canvas.addEventListener('touchmove', event => {
  event.preventDefault();
  if (event.touches.length === 1 && dragStart) {
    const t = event.touches[0];
    panX = t.clientX - dragStart.x;
    panY = t.clientY - dragStart.y;
  } else if (event.touches.length === 2) {
    const [a, b] = event.touches;
    const distance = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    const midpoint = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
    if (lastTouchDistance && lastTouchMidpoint) {
      const rect = canvas.getBoundingClientRect();
      setZoom(zoom * distance / lastTouchDistance, midpoint.x - rect.left, midpoint.y - rect.top);
      panX += midpoint.x - lastTouchMidpoint.x;
      panY += midpoint.y - lastTouchMidpoint.y;
    }
    lastTouchDistance = distance;
    lastTouchMidpoint = midpoint;
  }
}, { passive: false });
canvas.addEventListener('touchend', () => {
  lastTouchDistance = null;
  lastTouchMidpoint = null;
  dragStart = null;
});

orientationButton.addEventListener('click', () => {
  headingUp = !headingUp;
  panX = 0;
  panY = 0;
  updateOrientationUi();
});
document.getElementById('zoomIn').addEventListener('click', () => setZoom(zoom * 1.25));
document.getElementById('zoomOut').addEventListener('click', () => setZoom(zoom * 0.8));
document.getElementById('resetMap').addEventListener('click', resetMapView);
alertToggle.addEventListener('click', () => { alertsEnabled = !alertsEnabled; alertToggle.classList.toggle('muted', !alertsEnabled); if (!alertsEnabled) { alertStack.innerHTML = ''; lastAlertSignature = ''; } else { updateFlightStrip(); } });

document.getElementById('fullscreenMap').addEventListener('click', async () => {
  if (!document.fullscreenElement) await shell.requestFullscreen?.();
  else await document.exitFullscreen?.();
});

window.addEventListener('resize', resize);
resize();
loadSharedSettings();
updateOrientationUi();
updateMapInfo();
updateObjects();
updateFlightStrip();
connectMapStream();
setInterval(fallbackRefresh, 1000);
setInterval(loadSharedSettings, 30000);
requestAnimationFrame(animate);
