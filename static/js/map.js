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
const navigationPanel = document.getElementById('navigationPanel');
const navigationHud = document.getElementById('navigationHud');
const navigationHint = document.getElementById('navigationHint');
const navigationRouteList = document.getElementById('navigationRouteList');
const navigationToggle = document.getElementById('toggleNavigation');
const navigationClose = document.getElementById('closeNavigation');
const navigationActivate = document.getElementById('activateNavigation');
const navigationPrevious = document.getElementById('previousNavigation');
const navigationNext = document.getElementById('nextNavigation');
const navigationClear = document.getElementById('clearNavigation');
const navigationAutoAdvance = document.getElementById('navAutoAdvance');
const navigationArrivalRadius = document.getElementById('navArrivalRadius');
const mapToast = document.getElementById('mapToast');

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
let latestMapInfo = {};
let mapScale = null;
let renderTransform = null;
let latestHeading = null;
let latestAltitude = null;
let latestIas = null;
let groundSpeedMps = null;
let lastPlayerSample = null;
let navigationMode = null;
let navigationPanelOpen = false;
let navigationSaveTimer = null;
let navigationSaveInFlight = false;
let lastRouteUiSignature = '';
let lastNavigationDistance = null;
let lastNavigationDistanceAt = 0;
let lastNavigationPointId = null;
let closingRateMps = null;
let lastAutomaticAdvanceAt = 0;
let toastTimer = null;
let pointerTapStart = null;
let touchTapStart = null;
let navigationState = {
  version: 1,
  revision: 0,
  map_generation: null,
  active: false,
  active_index: 0,
  auto_advance: true,
  arrival_radius_m: 750,
  points: [],
};

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


function mapGenerationValue(info = latestMapInfo) {
  return info?.map_generation === undefined || info?.map_generation === null
    ? null
    : String(info.map_generation);
}

function numericPair(value) {
  if (Array.isArray(value) && value.length >= 2) {
    const a = number(value[0]);
    const b = number(value[1]);
    return a === null || b === null ? null : [a, b];
  }
  if (value && typeof value === 'object') {
    const a = number(value.x ?? value[0]);
    const b = number(value.y ?? value[1]);
    return a === null || b === null ? null : [a, b];
  }
  return null;
}

function extractMapScale(info) {
  const min = numericPair(info?.map_min ?? info?.mapMin ?? info?.min);
  const max = numericPair(info?.map_max ?? info?.mapMax ?? info?.max);
  let width = min && max ? Math.abs(max[0] - min[0]) : null;
  let height = min && max ? Math.abs(max[1] - min[1]) : null;
  if (!width || !height) {
    width = number(info?.map_width ?? info?.mapWidth ?? info?.width_m);
    height = number(info?.map_height ?? info?.mapHeight ?? info?.height_m);
  }
  if (!width || !height || width < 500 || height < 500 || width > 3000000 || height > 3000000) return null;
  return { width, height, diagonal: Math.hypot(width, height) };
}

function metresVector(from, to) {
  if (!mapScale || !from || !to) return null;
  return {
    east: (to.x - from.x) * mapScale.width,
    north: (from.y - to.y) * mapScale.height,
  };
}

function mapDistanceMetres(from, to) {
  const vector = metresVector(from, to);
  return vector ? Math.hypot(vector.east, vector.north) : null;
}

function mapBearingDegrees(from, to) {
  const vector = metresVector(from, to);
  if (!vector || Math.hypot(vector.east, vector.north) < 0.1) return null;
  return (Math.atan2(vector.east, vector.north) * 180 / Math.PI + 360) % 360;
}

function headingDifference(target, current) {
  if (target === null || current === null) return null;
  return ((target - current + 540) % 360) - 180;
}

function currentPlayerHeading() {
  if (latestHeading !== null) return (latestHeading + 360) % 360;
  const player = mapObjects.find(isPlayer);
  const dx = number(player?.dx);
  const dy = number(player?.dy);
  if (dx === null || dy === null || Math.hypot(dx, dy) < 0.00001) return null;
  return (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
}

function formatDistance(metres) {
  if (metres === null || !Number.isFinite(metres)) return '—';
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(metres < 10000 ? 1 : 0)} km`;
}

function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 24 * 3600) return '—';
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${minutes}:${String(secs).padStart(2, '0')}`;
}

function formatArrivalClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 24 * 3600) return '—';
  return new Date(Date.now() + seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function roleLabel(role) {
  return ({ target: 'TARGET', home: 'HOME', divert: 'DIVERT', waypoint: 'WAYPOINT' })[role] || 'POINT';
}

function roleSymbol(role) {
  return ({ target: '◎', home: '⌂', divert: '◇', waypoint: '◆' })[role] || '◆';
}

function newPointId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `nav-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function sanitiseNavigationClient(value) {
  const points = Array.isArray(value?.points) ? value.points.filter(item =>
    item && Number.isFinite(Number(item.x)) && Number.isFinite(Number(item.y))
  ).slice(0, 32).map(item => ({
    id: String(item.id || newPointId()),
    name: String(item.name || roleLabel(item.role)).slice(0, 48),
    role: ['waypoint', 'target', 'home', 'divert'].includes(item.role) ? item.role : 'waypoint',
    kind: String(item.kind || 'custom').slice(0, 24),
    x: clamp(Number(item.x), 0, 1),
    y: clamp(Number(item.y), 0, 1),
    ...(item.runway && [item.runway.sx, item.runway.sy, item.runway.ex, item.runway.ey].every(v => Number.isFinite(Number(v))) ? {
      runway: {
        sx: clamp(Number(item.runway.sx), 0, 1), sy: clamp(Number(item.runway.sy), 0, 1),
        ex: clamp(Number(item.runway.ex), 0, 1), ey: clamp(Number(item.runway.ey), 0, 1),
      },
    } : {}),
  })) : [];
  return {
    version: 1,
    revision: Number(value?.revision) || 0,
    map_generation: value?.map_generation === null || value?.map_generation === undefined ? null : String(value.map_generation),
    active: Boolean(value?.active) && points.length > 0,
    active_index: clamp(Math.trunc(Number(value?.active_index) || 0), 0, Math.max(0, points.length - 1)),
    auto_advance: value?.auto_advance !== false,
    arrival_radius_m: clamp(Math.trunc(Number(value?.arrival_radius_m) || 750), 100, 5000),
    points,
  };
}

async function loadNavigation() {
  try {
    const response = await fetch('/api/navigation', { cache: 'no-store' });
    if (!response.ok) throw new Error('navigation unavailable');
    navigationState = sanitiseNavigationClient(await response.json());
  } catch {
    navigationState = sanitiseNavigationClient(navigationState);
  }
  syncNavigationControls();
  renderNavigationUi(true);
}

function scheduleNavigationSave(immediate = false) {
  clearTimeout(navigationSaveTimer);
  const run = async () => {
    navigationSaveInFlight = true;
    try {
      const response = await fetch('/api/navigation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(navigationState),
      });
      if (!response.ok) throw new Error('save failed');
      navigationState = sanitiseNavigationClient(await response.json());
    } catch (error) {
      console.error('Unable to save navigation plan', error);
      showMapToast('Navigation plan could not be saved');
    } finally {
      navigationSaveInFlight = false;
      renderNavigationUi(true);
    }
  };
  if (immediate) run();
  else navigationSaveTimer = setTimeout(run, 180);
}

function applyRemoteNavigation(value) {
  const incoming = sanitiseNavigationClient(value);
  if (navigationSaveInFlight || incoming.revision <= navigationState.revision) return;
  navigationState = incoming;
  syncNavigationControls();
  renderNavigationUi(true);
}

function resetNavigationForMap(nextGeneration) {
  navigationState = sanitiseNavigationClient({ map_generation: nextGeneration });
  lastNavigationPointId = null;
  lastNavigationDistance = null;
  closingRateMps = null;
  syncNavigationControls();
  renderNavigationUi(true);
  scheduleNavigationSave(true);
}

function showMapToast(message) {
  clearTimeout(toastTimer);
  mapToast.textContent = message;
  mapToast.classList.remove('hidden');
  toastTimer = setTimeout(() => mapToast.classList.add('hidden'), 2600);
}

function setNavigationMode(mode) {
  navigationMode = navigationMode === mode ? null : mode;
  document.querySelectorAll('[data-nav-mode]').forEach(button => button.classList.toggle('active', button.dataset.navMode === navigationMode));
  if (!navigationMode) navigationHint.textContent = 'Choose a point type, then tap the map or an existing objective/airfield.';
  else navigationHint.textContent = `${roleLabel(navigationMode)} placement active — tap the map${navigationMode === 'home' || navigationMode === 'divert' ? ' or a runway' : ' or an objective'}.`;
  canvas.classList.toggle('placing-point', Boolean(navigationMode));
}

function toggleNavigationPanel(force) {
  navigationPanelOpen = typeof force === 'boolean' ? force : !navigationPanelOpen;
  navigationPanel.classList.toggle('hidden', !navigationPanelOpen);
  navigationHud.classList.toggle('panel-open', navigationPanelOpen);
  navigationToggle.classList.toggle('active', navigationPanelOpen);
  if (!navigationPanelOpen) setNavigationMode(null);
}

function syncNavigationControls() {
  navigationAutoAdvance.checked = navigationState.auto_advance;
  navigationArrivalRadius.value = navigationState.arrival_radius_m;
  navigationActivate.textContent = navigationState.active ? 'PAUSE' : 'ACTIVATE';
}

function isAirfieldObject(obj) {
  const text = `${obj?.type || ''} ${obj?.icon || ''} ${obj?.icon_bg || ''}`.toLowerCase();
  return text.includes('airfield') || text.includes('runway') || (obj?.type === 'airfield' && [obj.sx, obj.sy, obj.ex, obj.ey].every(v => v !== undefined));
}

function isObjectiveObject(obj) {
  const text = `${obj?.type || ''} ${obj?.icon || ''} ${obj?.icon_bg || ''}`.toLowerCase();
  return /(bomb|objective|capture|defend|point|zone|base)/.test(text);
}

function objectNavigationCandidate(obj) {
  if (isPlayer(obj)) return null;
  if (isAirfieldObject(obj) && [obj.sx, obj.sy, obj.ex, obj.ey].every(v => number(v) !== null)) {
    return {
      kind: 'airfield',
      name: 'AIRFIELD',
      x: (Number(obj.sx) + Number(obj.ex)) / 2,
      y: (Number(obj.sy) + Number(obj.ey)) / 2,
      runway: { sx: Number(obj.sx), sy: Number(obj.sy), ex: Number(obj.ex), ey: Number(obj.ey) },
    };
  }
  if (obj?.x === undefined || obj?.y === undefined || number(obj.x) === null || number(obj.y) === null) return null;
  if (!isObjectiveObject(obj)) return null;
  const sourceName = String(obj.icon || obj.type || 'OBJECTIVE').replace(/[_-]+/g, ' ').trim().toUpperCase();
  return { kind: 'objective', name: sourceName || 'OBJECTIVE', x: Number(obj.x), y: Number(obj.y) };
}

function mapToScreen(x, y) {
  if (!renderTransform) return null;
  const { rect, playerPoint, rotation, effectiveScale, anchor } = renderTransform;
  const p = point(rect, x, y);
  const dx = (p.x - playerPoint.x) * effectiveScale;
  const dy = (p.y - playerPoint.y) * effectiveScale;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return { x: anchor.x + dx * cos - dy * sin, y: anchor.y + dx * sin + dy * cos };
}

function screenToMap(x, y) {
  if (!renderTransform) return null;
  const { rect, playerPoint, rotation, effectiveScale, anchor } = renderTransform;
  const dx = x - anchor.x;
  const dy = y - anchor.y;
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const localX = (dx * cos - dy * sin) / effectiveScale + playerPoint.x;
  const localY = (dx * sin + dy * cos) / effectiveScale + playerPoint.y;
  return { x: clamp((localX - rect.x) / rect.width, 0, 1), y: clamp((localY - rect.y) / rect.height, 0, 1) };
}

function nearestNavigationObject(screenX, screenY) {
  let best = null;
  for (const obj of mapObjects) {
    const candidate = objectNavigationCandidate(obj);
    if (!candidate) continue;
    const screen = mapToScreen(candidate.x, candidate.y);
    if (!screen) continue;
    const distance = Math.hypot(screen.x - screenX, screen.y - screenY);
    if (distance <= 34 && (!best || distance < best.distance)) best = { ...candidate, distance };
  }
  return best;
}

function defaultPointName(role, candidate) {
  if (role === 'target') return candidate?.kind === 'objective' ? `TARGET · ${candidate.name}` : 'TARGET';
  if (role === 'home') return candidate?.kind === 'airfield' ? 'HOME AIRFIELD' : 'HOME';
  if (role === 'divert') return candidate?.kind === 'airfield' ? 'DIVERT AIRFIELD' : 'DIVERT';
  return `WP ${navigationState.points.filter(item => item.role === 'waypoint').length + 1}`;
}

function addNavigationPoint(role, location, candidate = null) {
  const pointValue = {
    id: newPointId(),
    name: defaultPointName(role, candidate),
    role,
    kind: candidate?.kind || 'custom',
    x: location.x,
    y: location.y,
    ...(candidate?.runway ? { runway: candidate.runway } : {}),
  };
  if (role !== 'waypoint') {
    const existing = navigationState.points.findIndex(item => item.role === role);
    if (existing >= 0) {
      pointValue.id = navigationState.points[existing].id;
      navigationState.points.splice(existing, 1, pointValue);
    } else navigationState.points.push(pointValue);
  } else navigationState.points.push(pointValue);

  if (navigationState.points.length === 1) navigationState.active_index = 0;
  navigationState.active = true;
  navigationState.map_generation = mapGenerationValue();
  navigationState = sanitiseNavigationClient(navigationState);
  setNavigationMode(null);
  syncNavigationControls();
  renderNavigationUi(true);
  scheduleNavigationSave();
  showMapToast(`${roleLabel(role)} set: ${pointValue.name}`);
}

function handleMapTap(clientX, clientY) {
  if (!navigationMode || !renderTransform) return false;
  const rect = canvas.getBoundingClientRect();
  const screenX = clientX - rect.left;
  const screenY = clientY - rect.top;
  const mapLocation = screenToMap(screenX, screenY);
  if (!mapLocation) return false;
  const candidate = nearestNavigationObject(screenX, screenY);
  if ((navigationMode === 'home' || navigationMode === 'divert') && candidate && candidate.kind !== 'airfield') {
    showMapToast('Select a runway line or tap empty map space for a manual airfield point');
    return true;
  }
  addNavigationPoint(navigationMode, candidate || mapLocation, candidate);
  return true;
}

function activeNavigationPoint() {
  return navigationState.active && navigationState.points.length ? navigationState.points[navigationState.active_index] : null;
}

function homeNavigationPoint() {
  return navigationState.points.find(pointValue => pointValue.role === 'home') || null;
}

function approachData(home = homeNavigationPoint()) {
  if (!home?.runway || !targetPlayer || !mapScale) return null;
  const a = { x: home.runway.sx, y: home.runway.sy };
  const b = { x: home.runway.ex, y: home.runway.ey };
  const headingAB = mapBearingDegrees(a, b);
  const headingBA = mapBearingDegrees(b, a);
  const currentHeading = currentPlayerHeading();
  const chooseAB = currentHeading === null || Math.abs(headingDifference(headingAB, currentHeading)) <= Math.abs(headingDifference(headingBA, currentHeading));
  const threshold = chooseAB ? a : b;
  const farEnd = chooseAB ? b : a;
  const runwayHeading = chooseAB ? headingAB : headingBA;
  const distance = mapDistanceMetres(targetPlayer, threshold);
  const runwayVector = metresVector(threshold, farEnd);
  const playerVector = metresVector(threshold, targetPlayer);
  if (!runwayVector || !playerVector) return null;
  const runwayLength = Math.hypot(runwayVector.east, runwayVector.north);
  if (runwayLength < 1) return null;
  const ue = runwayVector.east / runwayLength;
  const un = runwayVector.north / runwayLength;
  const crossTrack = ue * playerVector.north - un * playerVector.east;
  const alongTrack = ue * playerVector.east + un * playerVector.north;
  return { threshold, farEnd, runwayHeading, distance, crossTrack, alongTrack, runwayLength };
}

function navigationMetrics() {
  const pointValue = activeNavigationPoint();
  if (!pointValue || !targetPlayer || !mapScale) return null;
  const distance = mapDistanceMetres(targetPlayer, pointValue);
  const bearing = mapBearingDegrees(targetPlayer, pointValue);
  const heading = currentPlayerHeading();
  const correction = headingDifference(bearing, heading);
  const eta = groundSpeedMps !== null && groundSpeedMps > 4 ? distance / groundSpeedMps : null;
  const now = performance.now() / 1000;
  if (lastNavigationPointId !== pointValue.id) {
    lastNavigationPointId = pointValue.id;
    lastNavigationDistance = distance;
    lastNavigationDistanceAt = now;
    closingRateMps = null;
  } else if (lastNavigationDistance !== null && now - lastNavigationDistanceAt >= 0.35) {
    const rawClosing = (lastNavigationDistance - distance) / (now - lastNavigationDistanceAt);
    if (Number.isFinite(rawClosing) && Math.abs(rawClosing) < 2500) closingRateMps = closingRateMps === null ? rawClosing : closingRateMps * 0.7 + rawClosing * 0.3;
    lastNavigationDistance = distance;
    lastNavigationDistanceAt = now;
  }
  return { point: pointValue, distance, bearing, heading, correction, eta, closingRateMps };
}

function totalRemainingDistance() {
  if (!targetPlayer || !mapScale || !navigationState.points.length) return null;
  let total = 0;
  let previous = targetPlayer;
  const start = navigationState.active ? navigationState.active_index : 0;
  for (let index = start; index < navigationState.points.length; index++) {
    total += mapDistanceMetres(previous, navigationState.points[index]) || 0;
    previous = navigationState.points[index];
  }
  return total;
}

function steerText(correction) {
  if (correction === null) return 'HEADING UNAVAILABLE';
  if (Math.abs(correction) < 2) return 'ON COURSE';
  return `${Math.round(Math.abs(correction))}° ${correction > 0 ? 'RIGHT' : 'LEFT'}`;
}

function renderRouteList(force = false) {
  const signature = JSON.stringify(navigationState.points.map(item => [item.id, item.name, item.role, item.x, item.y])) + `|${navigationState.active_index}|${navigationState.active}`;
  if (!force && signature === lastRouteUiSignature) return;
  lastRouteUiSignature = signature;
  if (!navigationState.points.length) {
    navigationRouteList.innerHTML = '<li class="nav-route-empty">No route points yet.</li>';
    return;
  }
  navigationRouteList.innerHTML = navigationState.points.map((item, index) => `
    <li class="${navigationState.active && index === navigationState.active_index ? 'active' : ''}" data-point-id="${escapeHtml(item.id)}">
      <button class="nav-route-select" data-action="select" title="Make active"><span>${roleSymbol(item.role)}</span><div><small>${roleLabel(item.role)} ${String(index + 1).padStart(2, '0')}</small><strong>${escapeHtml(item.name)}</strong></div></button>
      <div class="nav-route-item-actions">
        <button data-action="up" aria-label="Move up">↑</button><button data-action="down" aria-label="Move down">↓</button><button data-action="rename" aria-label="Rename">✎</button><button data-action="remove" aria-label="Remove">×</button>
      </div>
    </li>`).join('');
}

function renderNavigationUi(forceRoute = false) {
  renderRouteList(forceRoute);
  const metrics = navigationMetrics();
  const totalDistance = totalRemainingDistance();
  document.getElementById('navRouteTotal').textContent = navigationState.points.length
    ? `${navigationState.points.length} point${navigationState.points.length === 1 ? '' : 's'}${totalDistance !== null ? ` · ${formatDistance(totalDistance)}` : ''}`
    : '0 points';
  document.getElementById('navScaleStatus').textContent = mapScale
    ? `MAP SCALE ${(mapScale.width / 1000).toFixed(1)} × ${(mapScale.height / 1000).toFixed(1)} KM · GS ${groundSpeedMps === null ? '—' : Math.round(groundSpeedMps * 3.6)} KM/H`
    : 'Map scale unavailable — route drawing works, distance and ETA are paused.';

  const hudVisible = Boolean(metrics);
  navigationHud.classList.toggle('hidden', !hudVisible);
  if (metrics) {
    const trend = metrics.closingRateMps === null ? 'CALCULATING' : metrics.closingRateMps < -5 ? 'MOVING AWAY' : metrics.closingRateMps < 5 ? 'CROSS-TRACK' : `CLOSING ${Math.round(metrics.closingRateMps * 3.6)} KM/H`;
    document.getElementById('navHudRole').textContent = roleLabel(metrics.point.role);
    document.getElementById('navHudName').textContent = metrics.point.name;
    document.getElementById('navHudBearing').textContent = metrics.bearing === null ? '—' : String(Math.round(metrics.bearing)).padStart(3, '0');
    document.getElementById('navHudDistance').textContent = metrics.distance < 1000 ? (metrics.distance / 1000).toFixed(2) : (metrics.distance / 1000).toFixed(1);
    document.getElementById('navHudEta').textContent = formatEta(metrics.eta);
    document.getElementById('navHudEtaClock').textContent = formatArrivalClock(metrics.eta);
    document.getElementById('navHudSteer').textContent = metrics.correction === null ? '—' : Math.abs(metrics.correction) < 2 ? 'ON CRS' : `${Math.round(Math.abs(metrics.correction))}° ${metrics.correction > 0 ? 'R' : 'L'}`;
    document.getElementById('navHudTrend').textContent = trend;
    document.getElementById('navPanelName').textContent = metrics.point.name;
    document.getElementById('navPanelBearing').textContent = metrics.bearing === null ? '—' : `${String(Math.round(metrics.bearing)).padStart(3, '0')}°`;
    document.getElementById('navPanelDistance').textContent = formatDistance(metrics.distance);
    document.getElementById('navPanelEta').textContent = formatEta(metrics.eta);
    document.getElementById('navPanelSteer').textContent = `${steerText(metrics.correction)} · ${trend}`;
    const marker = document.getElementById('navSteeringMarker');
    marker.style.left = `${50 + clamp(metrics.correction || 0, -45, 45) / 45 * 48}%`;
  } else {
    document.getElementById('navPanelName').textContent = navigationState.points.length ? 'Route paused' : 'No route selected';
    document.getElementById('navPanelBearing').textContent = '—';
    document.getElementById('navPanelDistance').textContent = '—';
    document.getElementById('navPanelEta').textContent = '—';
    document.getElementById('navPanelSteer').textContent = navigationState.points.length ? 'Press ACTIVATE to resume navigation.' : 'Add a target or waypoint to begin.';
    document.getElementById('navSteeringMarker').style.left = '50%';
  }

  const home = homeNavigationPoint();
  const homeSummary = document.getElementById('navHomeSummary');
  if (home && targetPlayer && mapScale) {
    const distance = mapDistanceMetres(targetPlayer, home);
    const bearing = mapBearingDegrees(targetPlayer, home);
    const eta = groundSpeedMps !== null && groundSpeedMps > 4 ? distance / groundSpeedMps : null;
    homeSummary.classList.remove('hidden');
    document.getElementById('navHomeName').textContent = home.name;
    document.getElementById('navHomeMetrics').textContent = `${String(Math.round(bearing)).padStart(3, '0')}° · ${formatDistance(distance)} · ${formatEta(eta)}`;
  } else homeSummary.classList.add('hidden');

  const approach = approachData(home);
  const approachSummary = document.getElementById('navApproachSummary');
  if (approach && approach.distance <= 20000) {
    approachSummary.classList.remove('hidden');
    document.getElementById('navRunwayHeading').textContent = `RUNWAY ${String(Math.round(approach.runwayHeading / 10) % 36 || 36).padStart(2, '0')} · ${String(Math.round(approach.runwayHeading)).padStart(3, '0')}°`;
    const side = Math.abs(approach.crossTrack) < 20 ? 'CENTRELINE' : `${Math.round(Math.abs(approach.crossTrack))} m ${approach.crossTrack > 0 ? 'LEFT' : 'RIGHT'}`;
    document.getElementById('navRunwayMetrics').textContent = `${formatDistance(approach.distance)} to threshold · ${side}`;
  } else approachSummary.classList.add('hidden');

  if (metrics && navigationState.auto_advance && metrics.distance <= navigationState.arrival_radius_m && performance.now() - lastAutomaticAdvanceAt > 5000) {
    lastAutomaticAdvanceAt = performance.now();
    advanceNavigation(true);
  }
}

function advanceNavigation(automatic = false) {
  if (!navigationState.points.length) return;
  if (navigationState.active_index < navigationState.points.length - 1) {
    navigationState.active_index += 1;
    navigationState.active = true;
    showMapToast(`${automatic ? 'Waypoint reached · ' : ''}Navigating to ${navigationState.points[navigationState.active_index].name}`);
  } else {
    navigationState.active = false;
    showMapToast('Route complete');
  }
  lastNavigationPointId = null;
  syncNavigationControls();
  renderNavigationUi(true);
  scheduleNavigationSave();
}

function previousNavigation() {
  if (!navigationState.points.length) return;
  navigationState.active_index = Math.max(0, navigationState.active_index - 1);
  navigationState.active = true;
  lastNavigationPointId = null;
  syncNavigationControls();
  renderNavigationUi(true);
  scheduleNavigationSave();
}

function drawNavigationRoute(rect, symbolScale) {
  if (!navigationState.points.length) return;
  const activeIndex = navigationState.active ? navigationState.active_index : -1;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  let previous = targetPlayer ? point(rect, targetPlayer.x, targetPlayer.y) : null;
  navigationState.points.forEach((item, index) => {
    const current = point(rect, item.x, item.y);
    if (previous) {
      ctx.beginPath();
      ctx.moveTo(previous.x, previous.y);
      ctx.lineTo(current.x, current.y);
      const activeLeg = index === activeIndex;
      ctx.strokeStyle = activeLeg ? 'rgba(116,241,197,.98)' : index < activeIndex ? 'rgba(116,241,197,.25)' : 'rgba(231,244,239,.55)';
      ctx.lineWidth = (activeLeg ? 3.1 : 1.8) * symbolScale;
      ctx.setLineDash(activeLeg ? [] : [7 * symbolScale, 7 * symbolScale]);
      ctx.stroke();
    }
    previous = current;
  });
  ctx.setLineDash([]);

  const approach = approachData();
  if (approach) {
    const threshold = point(rect, approach.threshold.x, approach.threshold.y);
    const farEnd = point(rect, approach.farEnd.x, approach.farEnd.y);
    const vx = farEnd.x - threshold.x;
    const vy = farEnd.y - threshold.y;
    ctx.strokeStyle = 'rgba(116,241,197,.45)';
    ctx.lineWidth = 1.5 * symbolScale;
    ctx.setLineDash([10 * symbolScale, 5 * symbolScale]);
    ctx.beginPath();
    ctx.moveTo(threshold.x - vx * 4, threshold.y - vy * 4);
    ctx.lineTo(farEnd.x + vx * 0.5, farEnd.y + vy * 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  navigationState.points.forEach((item, index) => {
    const p = point(rect, item.x, item.y);
    const active = index === activeIndex;
    const size = (active ? 10 : 8) * symbolScale;
    ctx.beginPath();
    if (item.role === 'target') {
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.moveTo(p.x - size * 1.45, p.y); ctx.lineTo(p.x + size * 1.45, p.y);
      ctx.moveTo(p.x, p.y - size * 1.45); ctx.lineTo(p.x, p.y + size * 1.45);
    } else if (item.role === 'home') {
      ctx.rect(p.x - size, p.y - size, size * 2, size * 2);
    } else {
      ctx.moveTo(p.x, p.y - size); ctx.lineTo(p.x + size, p.y); ctx.lineTo(p.x, p.y + size); ctx.lineTo(p.x - size, p.y); ctx.closePath();
    }
    ctx.strokeStyle = item.role === 'target' ? '#f4d477' : item.role === 'home' ? '#74f1c5' : item.role === 'divert' ? '#c6b5ff' : '#edf7f3';
    ctx.fillStyle = 'rgba(5,9,8,.75)';
    ctx.lineWidth = (active ? 2.7 : 1.8) * symbolScale;
    ctx.fill(); ctx.stroke();
    if (active) {
      ctx.beginPath(); ctx.arc(p.x, p.y, size * 1.75, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(116,241,197,.55)'; ctx.lineWidth = 1.2 * symbolScale; ctx.stroke();
    }
    ctx.font = `${10 * symbolScale}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,.9)';
    ctx.lineWidth = 3 * symbolScale;
    const label = item.name.length > 22 ? `${item.name.slice(0, 21)}…` : item.name;
    ctx.strokeText(label, p.x, p.y + size * 1.9);
    ctx.fillText(label, p.x, p.y + size * 1.9);
  });
  ctx.restore();
}

function updatePlayerTracking() {
  const player = mapObjects.find(isPlayer);
  if (!player || player.x === undefined || player.y === undefined) return;

  const x = number(player.x);
  const y = number(player.y);
  if (x === null || y === null) return;

  targetPlayer = { x, y };
  if (!displayPlayer) displayPlayer = { ...targetPlayer };

  const sampleAt = performance.now() / 1000;
  if (mapScale && lastPlayerSample) {
    const elapsed = sampleAt - lastPlayerSample.at;
    const travelled = mapDistanceMetres(lastPlayerSample, targetPlayer);
    if (elapsed >= 0.04 && elapsed <= 2 && travelled !== null && travelled < mapScale.diagonal * 0.08) {
      const rawSpeed = travelled / elapsed;
      if (rawSpeed <= 2500) groundSpeedMps = groundSpeedMps === null ? rawSpeed : groundSpeedMps * 0.78 + rawSpeed * 0.22;
    }
  }
  lastPlayerSample = { x, y, at: sampleAt };
  if (latestIas !== null && latestIas < 2 && groundSpeedMps !== null && groundSpeedMps < 5) groundSpeedMps = 0;
  document.getElementById('mapGroundSpeed').textContent = groundSpeedMps === null ? '—' : Math.round(groundSpeedMps * 3.6);

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
  renderTransform = { rect, playerPoint, rotation, effectiveScale, anchor, width, height };

  ctx.save();
  ctx.translate(anchor.x, anchor.y);
  ctx.rotate(rotation);
  ctx.scale(effectiveScale, effectiveScale);
  ctx.translate(-playerPoint.x, -playerPoint.y);

  ctx.drawImage(mapImage, rect.x, rect.y, rect.width, rect.height);
  ctx.fillStyle = 'rgba(2, 9, 8, 0.08)';
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

  drawTrail(rect, symbolScale);
  drawNavigationRoute(rect, symbolScale);
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
  latestMapInfo = info;
  mapScale = extractMapScale(info);
  const nextGeneration = String(info.map_generation ?? 'unknown');
  if (navigationState.map_generation === null && nextGeneration !== 'unknown') {
    navigationState.map_generation = nextGeneration;
    scheduleNavigationSave();
  } else if (navigationState.map_generation && nextGeneration !== 'unknown' && navigationState.map_generation !== nextGeneration && navigationState.points.length) {
    resetNavigationForMap(nextGeneration);
    showMapToast('New map detected · previous route cleared');
  }
  if (!mapImage || nextGeneration !== mapGeneration) {
    mapGeneration = nextGeneration;
    playerTrail.length = 0;
    lastTrailPoint = null;
    lastPlayerSample = null;
    groundSpeedMps = null;
    await loadMapImage();
  }
  renderNavigationUi();
}
async function updateMapInfo() {
  try { const r=await fetch('/api/map/info',{cache:'no-store'}); if(!r.ok) throw new Error(); await applyMapInfo(await r.json()); }
  catch { if(!mapImage) await loadMapImage(); }
}
function applyMapObjects(objects, sequence=null) {
  if (sequence!==null && Number.isFinite(sequence) && sequence===lastMapSequence) return;
  if (sequence!==null && Number.isFinite(sequence)) lastMapSequence=sequence;
  mapObjects=Array.isArray(objects)?objects:[]; updatePlayerTracking(); renderNavigationUi();
  statusDot.classList.add('online'); statusText.textContent=`TACTICAL MAP LIVE · 10 HZ · ${mapObjects.length} OBJECTS`; waitPanel.classList.add('hidden');
}
async function updateObjects() {
  try { const r=await fetch('/api/map/objects',{cache:'no-store'}); if(!r.ok) throw new Error(); applyMapObjects(await r.json()); }
  catch { if(!mapImage){statusDot.classList.remove('online');statusText.textContent='WAITING FOR MAP';} }
}
function applyTelemetryPayload(payload) {
  lastTelemetrySuccess=Date.now(); const state=payload.state||{}, indicators=payload.indicators||{};
  const ias=number(pick(state,['IAS, km/h'])), altitude=number(pick(state,['H, m'])), heading=number(pick(indicators,['compass','compass1','compass2']));
  latestIas = ias; latestAltitude = altitude; latestHeading = heading;
  document.getElementById('mapIas').textContent=ias===null?'—':Math.round(ias);
  document.getElementById('mapAlt').textContent=altitude===null?'—':Math.round(altitude);
  document.getElementById('mapHeading').textContent=heading===null?'—':String(Math.round((heading+360)%360)).padStart(3,'0');
  renderMapAlerts(payload);
  renderNavigationUi();
}
async function updateFlightStrip() {
  try { const r=await fetch('/api/telemetry',{cache:'no-store'}); if(!r.ok) throw new Error(); applyTelemetryPayload(await r.json()); }
  catch { if(alertsEnabled&&alertProfile.alertTelemetryStale!==false&&lastTelemetrySuccess&&Date.now()-lastTelemetrySuccess>2500){lastAlertSignature='stale';alertStack.innerHTML='<div class="map-alert warning"><span></span><strong>TELEMETRY STALE</strong></div>';} }
}
function connectMapStream() {
  clearTimeout(mapReconnectTimer); const protocol=location.protocol==='https:'?'wss:':'ws:';
  mapSocket=new WebSocket(`${protocol}//${location.host}/ws/map`);
  mapSocket.addEventListener('open',()=>{mapStreamOpen=true;statusDot.classList.add('online');statusText.textContent='TACTICAL MAP LIVE · 10 HZ';});
  mapSocket.addEventListener('message',event=>{try{const m=JSON.parse(event.data);applyMapObjects(m.objects,Number(m.sequence));if(m.map_info)applyMapInfo(m.map_info);if(m.telemetry)applyTelemetryPayload(m.telemetry);if(m.navigation)applyRemoteNavigation(m.navigation);}catch(err){console.error(err);}});
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
  pointerTapStart = { x: event.clientX, y: event.clientY, moved: false };
  dragStart = { x: event.clientX - panX, y: event.clientY - panY };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (!dragging || event.pointerType === 'touch') return;
  if (pointerTapStart && Math.hypot(event.clientX - pointerTapStart.x, event.clientY - pointerTapStart.y) > 7) pointerTapStart.moved = true;
  panX = event.clientX - dragStart.x;
  panY = event.clientY - dragStart.y;
});
canvas.addEventListener('pointerup', event => {
  const tap = pointerTapStart && !pointerTapStart.moved;
  pointerTapStart = null;
  dragging = false;
  if (tap) handleMapTap(event.clientX, event.clientY);
});
canvas.addEventListener('pointercancel', () => { dragging = false; pointerTapStart = null; });

canvas.addEventListener('touchstart', event => {
  event.preventDefault();
  if (event.touches.length === 1) {
    const t = event.touches[0];
    touchTapStart = { x: t.clientX, y: t.clientY, moved: false };
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
    if (touchTapStart && Math.hypot(t.clientX - touchTapStart.x, t.clientY - touchTapStart.y) > 9) touchTapStart.moved = true;
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
canvas.addEventListener('touchend', event => {
  const ended = event.changedTouches?.[0];
  const tap = touchTapStart && !touchTapStart.moved && ended;
  lastTouchDistance = null;
  lastTouchMidpoint = null;
  dragStart = null;
  touchTapStart = null;
  if (tap) handleMapTap(ended.clientX, ended.clientY);
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


navigationToggle.addEventListener('click', () => toggleNavigationPanel());
navigationClose.addEventListener('click', () => toggleNavigationPanel(false));
document.querySelectorAll('[data-nav-mode]').forEach(button => button.addEventListener('click', () => setNavigationMode(button.dataset.navMode)));
navigationActivate.addEventListener('click', () => {
  if (!navigationState.points.length) return showMapToast('Add a route point first');
  navigationState.active = !navigationState.active;
  if (navigationState.active_index >= navigationState.points.length) navigationState.active_index = 0;
  lastNavigationPointId = null;
  syncNavigationControls(); renderNavigationUi(true); scheduleNavigationSave();
});
navigationPrevious.addEventListener('click', previousNavigation);
navigationNext.addEventListener('click', () => advanceNavigation(false));
navigationClear.addEventListener('click', () => {
  if (!navigationState.points.length || window.confirm('Clear the complete navigation route?')) resetNavigationForMap(mapGenerationValue());
});
navigationAutoAdvance.addEventListener('change', () => {
  navigationState.auto_advance = navigationAutoAdvance.checked;
  scheduleNavigationSave();
});
navigationArrivalRadius.addEventListener('change', () => {
  navigationState.arrival_radius_m = clamp(Math.trunc(Number(navigationArrivalRadius.value) || 750), 100, 5000);
  navigationArrivalRadius.value = navigationState.arrival_radius_m;
  scheduleNavigationSave();
});
navigationRouteList.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  const item = event.target.closest('li[data-point-id]');
  if (!button || !item) return;
  const index = navigationState.points.findIndex(pointValue => pointValue.id === item.dataset.pointId);
  if (index < 0) return;
  const action = button.dataset.action;
  if (action === 'select') { navigationState.active_index = index; navigationState.active = true; lastNavigationPointId = null; }
  if (action === 'up' && index > 0) {
    [navigationState.points[index - 1], navigationState.points[index]] = [navigationState.points[index], navigationState.points[index - 1]];
    if (navigationState.active_index === index) navigationState.active_index -= 1;
    else if (navigationState.active_index === index - 1) navigationState.active_index += 1;
  }
  if (action === 'down' && index < navigationState.points.length - 1) {
    [navigationState.points[index + 1], navigationState.points[index]] = [navigationState.points[index], navigationState.points[index + 1]];
    if (navigationState.active_index === index) navigationState.active_index += 1;
    else if (navigationState.active_index === index + 1) navigationState.active_index -= 1;
  }
  if (action === 'rename') {
    const name = window.prompt('Point name', navigationState.points[index].name);
    if (name?.trim()) navigationState.points[index].name = name.trim().slice(0, 48);
  }
  if (action === 'remove') {
    navigationState.points.splice(index, 1);
    navigationState.active_index = clamp(navigationState.active_index - (index < navigationState.active_index ? 1 : 0), 0, Math.max(0, navigationState.points.length - 1));
    navigationState.active = navigationState.active && navigationState.points.length > 0;
    lastNavigationPointId = null;
  }
  navigationState = sanitiseNavigationClient(navigationState);
  syncNavigationControls(); renderNavigationUi(true); scheduleNavigationSave();
});

document.getElementById('fullscreenMap').addEventListener('click', async () => {
  if (!document.fullscreenElement) await shell.requestFullscreen?.();
  else await document.exitFullscreen?.();
});

window.addEventListener('resize', resize);
resize();
updateOrientationUi();
requestAnimationFrame(animate);

async function initialiseMap() {
  await Promise.allSettled([loadSharedSettings(), loadNavigation()]);
  await Promise.allSettled([updateMapInfo(), updateObjects(), updateFlightStrip()]);
  connectMapStream();
}

initialiseMap();
setInterval(fallbackRefresh, 1000);
setInterval(loadSharedSettings, 30000);
