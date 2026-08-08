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
const navigationHide = document.getElementById('hideNavigation');
const headingVectorToggle = document.getElementById('toggleHeadingVector');
const rangeRingToggle = document.getElementById('toggleRangeRing');
const carrierHudToggle = document.getElementById('toggleCarrierHud');
const tgpPanel = document.getElementById('tgpControlPanel');
const tgpToggle = document.getElementById('toggleTgpPanel');
const tgpClose = document.getElementById('closeTgpPanel');
const tgpInputStatus = document.getElementById('tgpInputStatus');
const navigationActivate = document.getElementById('activateNavigation');
const navigationPrevious = document.getElementById('previousNavigation');
const navigationNext = document.getElementById('nextNavigation');
const navigationClear = document.getElementById('clearNavigation');
const navigationAutoAdvance = document.getElementById('navAutoAdvance');
const navigationArrivalRadius = document.getElementById('navArrivalRadius');
const mapToast = document.getElementById('mapToast');
const carrierHud = document.getElementById('carrierHud');
const carrierBallDot = document.getElementById('carrierBallDot');
const carrierSetupButton = document.getElementById('setupCarrier');
const carrierClearButton = document.getElementById('clearCarrier');
const carrierTestLsoButton = document.getElementById('testLso');
const carrierLoadProfileButton = document.getElementById('loadCarrierProfile');
const carrierSetupHint = document.getElementById('carrierSetupHint');
const carrierDeckAltitude = document.getElementById('carrierDeckAltitude');
const carrierGlidepath = document.getElementById('carrierGlidepath');
const carrierTouchdownOffset = document.getElementById('carrierTouchdownOffset');
const carrierApproachDistance = document.getElementById('carrierApproachDistance');
const carrierIasMin = document.getElementById('carrierIasMin');
const carrierIasMax = document.getElementById('carrierIasMax');
const carrierTargetAoa = document.getElementById('carrierTargetAoa');
const carrierAoaTolerance = document.getElementById('carrierAoaTolerance');
const carrierMaxBank = document.getElementById('carrierMaxBank');
const carrierMaxSink = document.getElementById('carrierMaxSink');
const carrierCallouts = document.getElementById('carrierCallouts');
const carrierWaveoffEnabled = document.getElementById('carrierWaveoffEnabled');
const carrierGradeEnabled = document.getElementById('carrierGradeEnabled');

let mapImage = null;
let mapObjects = [];
let mapGeneration = null;
let zoom = 1;
let panX = 0;
let panY = 0;
let headingUp = true;
let headingVectorEnabled = false;
let rangeRingEnabled = false;
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
let sharedSettings = { defaults: {}, profiles: {}, display: {}, controls: {} };
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
let latestFuelKg = null;
let latestFuelCapacityKg = null;
let groundSpeedMps = null;
let estimatedRangeM = null;
let fuelBurnKgps = null;
const fuelSamples = [];
let lastPlayerSample = null;
let navigationMode = null;
let navigationPanelOpen = false;
let carrierHudEnabled = true;
let tgpPanelOpen = false;
let tgpAutoHideTimer = null;
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
let latestVerticalSpeed = null;
let latestAoa = null;
let latestBank = null;
let latestGear = null;
let latestFlaps = null;
let lastFlapNoticeState = null;
let latestG = null;
let latestVehicle = null;
let latestConnected = false;
let carrierSetupStep = null;
let carrierPass = createCarrierPassState();
let lastLsoAnyAt = 0;
const lastLsoCallouts = new Map();
let navigationState = {
  version: 1,
  revision: 0,
  map_generation: null,
  active: false,
  active_index: 0,
  auto_advance: true,
  arrival_radius_m: 750,
  points: [],
  carrier: defaultCarrierState(),
};

setTimeout(() => document.getElementById('mapHelp')?.classList.add('hidden'), 5000);

async function loadSharedSettings() {
  try {
    sharedSettings = await fetch('/api/settings', { cache: 'no-store' }).then(response => response.json());
    alertsEnabled = sharedSettings.display?.mapAlerts !== false;
    alertToggle.classList.toggle('muted', !alertsEnabled);
    applyTgpSettings();
  } catch {
    sharedSettings = { defaults: {}, profiles: {}, display: {}, controls: {} };
  }
}

function controlSettings(){return sharedSettings.controls||{};}
function tgpActions(){return controlSettings().actions||{};}
function applyTgpSettings(){
  if(!tgpPanel)return;
  const controls=controlSettings();
  const position=['left','right','bottom'].includes(controls.panelPosition)?controls.panelPosition:'right';
  tgpPanel.classList.remove('position-left','position-right','position-bottom');
  tgpPanel.classList.add(`position-${position}`);
  tgpToggle?.classList.toggle('muted',controls.enabled===false);
  document.querySelectorAll('[data-tgp-action]').forEach(button=>{
    const action=tgpActions()[button.dataset.tgpAction]||{};
    const label=action.label||button.querySelector('b')?.textContent||button.dataset.tgpAction;
    const key=String(action.key||'UNBOUND').toUpperCase();
    if(button.querySelector('b'))button.querySelector('b').textContent=label;
    if(button.querySelector('small'))button.querySelector('small').textContent=button.dataset.tgpHold==='true'?`HOLD · ${key}`:key;
    button.disabled=controls.enabled===false||!action.key;
  });
}
function scheduleTgpAutoHide(){
  clearTimeout(tgpAutoHideTimer);
  const seconds=Number(controlSettings().autoHideSeconds||0);
  if(tgpPanelOpen&&seconds>0)tgpAutoHideTimer=setTimeout(()=>setTgpPanelOpen(false),Math.max(3,seconds)*1000);
}
function setTgpPanelOpen(force){
  const enabled=controlSettings().enabled!==false;
  tgpPanelOpen=Boolean(force===undefined?!tgpPanelOpen:force)&&enabled;
  tgpPanel?.classList.toggle('hidden',!tgpPanelOpen);
  tgpToggle?.classList.toggle('active',tgpPanelOpen);
  if(tgpPanelOpen){
    toggleNavigationPanel(false);
    navigationHud?.classList.add('hidden');
  }
  renderCarrierHud();
  scheduleTgpAutoHide();
}
async function sendCockpitAction(action,event='tap'){
  scheduleTgpAutoHide();
  try{
    const response=await fetch('/api/controls/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,event})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result.detail||`Input failed (${response.status})`);
    tgpInputStatus.textContent=`${result.key} ${event.toUpperCase()}`;
    tgpInputStatus.parentElement?.classList.remove('error');
    return true;
  }catch(error){
    tgpInputStatus.textContent=String(error.message||'INPUT ERROR').toUpperCase();
    tgpInputStatus.parentElement?.classList.add('error');
    showMapToast(error.message||'Virtual control input failed');
    return false;
  }
}
async function releaseCockpitControls(){try{await fetch('/api/controls/release-all',{method:'POST',keepalive:true});}catch{}}

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

function mapPointOffset(pointValue, headingDeg, distanceMetres) {
  if (!mapScale || !pointValue || !Number.isFinite(headingDeg) || !Number.isFinite(distanceMetres)) return null;
  const radians = headingDeg * Math.PI / 180;
  const east = Math.sin(radians) * distanceMetres;
  const north = Math.cos(radians) * distanceMetres;
  return {
    x: pointValue.x + east / mapScale.width,
    y: pointValue.y - north / mapScale.height,
  };
}

function worldToScreen(normalisedPoint) {
  if (!renderTransform || !normalisedPoint) return null;
  const world = point(renderTransform.rect, normalisedPoint.x, normalisedPoint.y);
  const relativeX = (world.x - renderTransform.playerPoint.x) * renderTransform.effectiveScale;
  const relativeY = (world.y - renderTransform.playerPoint.y) * renderTransform.effectiveScale;
  const cos = Math.cos(renderTransform.rotation);
  const sin = Math.sin(renderTransform.rotation);
  return {
    x: renderTransform.anchor.x + relativeX * cos - relativeY * sin,
    y: renderTransform.anchor.y + relativeX * sin + relativeY * cos,
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

function defaultCarrierState() {
  return {
    enabled: false, name: 'CARRIER', stern: null, bow: null,
    deck_altitude_m: 20, glidepath_deg: 3.5, touchdown_offset_m: 65,
    approach_distance_m: 12000, callouts_enabled: true,
    waveoff_enabled: true, landing_grade_enabled: true,
    profile: { approach_ias_min: 190, approach_ias_max: 310,
      target_aoa_deg: 8, aoa_tolerance_deg: 2.5, max_bank_deg: 12,
      max_sink_mps: -7, lineup_tolerance_m: 35 }, last_grade: null,
  };
}
function carrierCoordinate(value) {
  if (!value || !Number.isFinite(Number(value.x)) || !Number.isFinite(Number(value.y))) return null;
  return { x: clamp(Number(value.x), 0, 1), y: clamp(Number(value.y), 0, 1) };
}
function sanitiseCarrierClient(value) {
  const source = value && typeof value === 'object' ? value : {}, defaults = defaultCarrierState();
  const p = source.profile && typeof source.profile === 'object' ? source.profile : {};
  const profile = {
    approach_ias_min: clamp(Number(p.approach_ias_min) || 190, 40, 1000),
    approach_ias_max: clamp(Number(p.approach_ias_max) || 310, 50, 1200),
    target_aoa_deg: clamp(Number(p.target_aoa_deg) || 8, -10, 40),
    aoa_tolerance_deg: clamp(Number(p.aoa_tolerance_deg) || 2.5, .5, 15),
    max_bank_deg: clamp(Number(p.max_bank_deg) || 12, 1, 60),
    max_sink_mps: clamp(Number(p.max_sink_mps) || -7, -30, -.5),
    lineup_tolerance_m: clamp(Number(p.lineup_tolerance_m) || 35, 5, 500),
  };
  if (profile.approach_ias_max < profile.approach_ias_min) [profile.approach_ias_min, profile.approach_ias_max] = [profile.approach_ias_max, profile.approach_ias_min];
  const stern = carrierCoordinate(source.stern), bow = carrierCoordinate(source.bow);
  const grade = source.last_grade && typeof source.last_grade === 'object' ? {
    score: clamp(Math.round(Number(source.last_grade.score) || 0), 0, 100),
    result: String(source.last_grade.result || 'APPROACH').slice(0, 32),
    timestamp: Number(source.last_grade.timestamp) || Date.now() / 1000,
    sink_mps: Number(source.last_grade.sink_mps) || 0,
    ias_kmh: Number(source.last_grade.ias_kmh) || 0,
    cross_track_m: Number(source.last_grade.cross_track_m) || 0,
    glide_error_m: Number(source.last_grade.glide_error_m) || 0,
    bank_deg: Number(source.last_grade.bank_deg) || 0,
  } : null;
  return {
    enabled: Boolean(source.enabled) && Boolean(stern && bow), name: String(source.name || defaults.name).slice(0, 48), stern, bow,
    deck_altitude_m: clamp(Number(source.deck_altitude_m) || 20, -100, 5000),
    glidepath_deg: clamp(Number(source.glidepath_deg) || 3.5, 1.5, 8),
    touchdown_offset_m: clamp(Number(source.touchdown_offset_m) || 65, 0, 500),
    approach_distance_m: clamp(Number(source.approach_distance_m) || 12000, 1000, 50000),
    callouts_enabled: source.callouts_enabled !== false, waveoff_enabled: source.waveoff_enabled !== false,
    landing_grade_enabled: source.landing_grade_enabled !== false, profile, last_grade: grade,
  };
}
function createCarrierPassState() {
  return { active:false, startedAt:0, previousFinalDistance:null, touchdown:null, samples:[], milestones:new Set(), lastGuidanceAt:0, lastSampleAt:0, waveoffCalled:false, finished:false };
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
    version: 2,
    revision: Number(value?.revision) || 0,
    map_generation: value?.map_generation === null || value?.map_generation === undefined ? null : String(value.map_generation),
    active: Boolean(value?.active) && points.length > 0,
    active_index: clamp(Math.trunc(Number(value?.active_index) || 0), 0, Math.max(0, points.length - 1)),
    auto_advance: value?.auto_advance !== false,
    arrival_radius_m: clamp(Math.trunc(Number(value?.arrival_radius_m) || 750), 100, 5000),
    points,
    carrier: sanitiseCarrierClient(value?.carrier),
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
  carrierPass = createCarrierPassState();
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

function flapNoticeState(raw) {
  const value = number(raw);
  if (value === null) return null;
  const fraction = Math.abs(value) <= 1.01 ? value : value / 100;
  if (fraction <= 0.01) return 'UP';
  if (fraction < 0.22) return 'COMBAT';
  if (fraction < 0.58) return 'TAKEOFF';
  if (fraction < 0.95) return 'LANDING';
  return 'DOWN';
}

function updateFlapNotice(raw) {
  const state = flapNoticeState(raw);
  if (state === null) return;
  if (lastFlapNoticeState === null) {
    lastFlapNoticeState = state;
    return;
  }
  if (state === lastFlapNoticeState) return;
  lastFlapNoticeState = state;
  // Always use the timed toast path. This guarantees configuration callouts do
  // not become persistent entries in the tablet's condition-alert stack.
  showMapToast(`FLAPS ${state}`);
}

function setNavigationMode(mode) {
  navigationMode = navigationMode === mode ? null : mode;
  document.querySelectorAll('[data-nav-mode]').forEach(button => button.classList.toggle('active', button.dataset.navMode === navigationMode));
  if (!navigationMode) navigationHint.textContent = 'Choose a point type, then tap the map or an existing objective/airfield.';
  else navigationHint.textContent = `${roleLabel(navigationMode)} placement active — tap the map${navigationMode === 'home' || navigationMode === 'divert' ? ' or a runway' : ' or an objective'}.`;
  canvas.classList.toggle('placing-point', Boolean(navigationMode || carrierSetupStep));
}

function toggleNavigationPanel(force) {
  navigationPanelOpen = typeof force === 'boolean' ? force : !navigationPanelOpen;
  if (navigationPanelOpen && tgpPanelOpen) setTgpPanelOpen(false);
  navigationPanel.classList.toggle('hidden', !navigationPanelOpen);
  navigationHud.classList.toggle('panel-open', navigationPanelOpen);
  carrierHud.classList.toggle('panel-open', navigationPanelOpen);
  navigationToggle.classList.toggle('active', navigationPanelOpen);
  if (navigationHide) {
    navigationHide.disabled = false;
    navigationHide.setAttribute('aria-disabled', 'false');
  }
  navigationPanel.setAttribute('aria-hidden', navigationPanelOpen ? 'false' : 'true');
  if (!navigationPanelOpen) setNavigationMode(null);
}

function syncNavigationControls() {
  navigationAutoAdvance.checked = navigationState.auto_advance;
  navigationArrivalRadius.value = navigationState.arrival_radius_m;
  navigationActivate.textContent = navigationState.active ? 'PAUSE' : 'ACTIVATE';
  syncCarrierControls();
}

function syncCarrierControls() {
  const carrier = navigationState.carrier || defaultCarrierState();
  carrierDeckAltitude.value=carrier.deck_altitude_m; carrierGlidepath.value=carrier.glidepath_deg;
  carrierTouchdownOffset.value=carrier.touchdown_offset_m; carrierApproachDistance.value=carrier.approach_distance_m/1000;
  carrierIasMin.value=carrier.profile.approach_ias_min; carrierIasMax.value=carrier.profile.approach_ias_max;
  carrierTargetAoa.value=carrier.profile.target_aoa_deg; carrierAoaTolerance.value=carrier.profile.aoa_tolerance_deg;
  carrierMaxBank.value=carrier.profile.max_bank_deg; carrierMaxSink.value=carrier.profile.max_sink_mps;
  carrierCallouts.checked=carrier.callouts_enabled; carrierWaveoffEnabled.checked=carrier.waveoff_enabled; carrierGradeEnabled.checked=carrier.landing_grade_enabled;
  document.getElementById('carrierConfigBadge').textContent=carrier.enabled?'READY':carrier.stern?'MARK BOW':'NOT SET';
  carrierSetupButton.textContent=carrierSetupStep==='stern'?'TAP STERN…':carrierSetupStep==='bow'?'TAP BOW…':'MARK STERN + BOW';
  renderCarrierGrade();
}
function collectCarrierControls() {
  const carrier=navigationState.carrier||defaultCarrierState();
  carrier.deck_altitude_m=clamp(Number(carrierDeckAltitude.value)||20,-100,5000); carrier.glidepath_deg=clamp(Number(carrierGlidepath.value)||3.5,1.5,8);
  carrier.touchdown_offset_m=clamp(Number(carrierTouchdownOffset.value)||65,0,500); carrier.approach_distance_m=clamp((Number(carrierApproachDistance.value)||12)*1000,1000,50000);
  carrier.profile.approach_ias_min=clamp(Number(carrierIasMin.value)||190,40,1000); carrier.profile.approach_ias_max=clamp(Number(carrierIasMax.value)||310,50,1200);
  if(carrier.profile.approach_ias_max<carrier.profile.approach_ias_min)[carrier.profile.approach_ias_min,carrier.profile.approach_ias_max]=[carrier.profile.approach_ias_max,carrier.profile.approach_ias_min];
  carrier.profile.target_aoa_deg=clamp(Number(carrierTargetAoa.value)||8,-10,40); carrier.profile.aoa_tolerance_deg=clamp(Number(carrierAoaTolerance.value)||2.5,.5,15);
  carrier.profile.max_bank_deg=clamp(Number(carrierMaxBank.value)||12,1,60); carrier.profile.max_sink_mps=clamp(Number(carrierMaxSink.value)||-7,-30,-.5);
  carrier.callouts_enabled=carrierCallouts.checked; carrier.waveoff_enabled=carrierWaveoffEnabled.checked; carrier.landing_grade_enabled=carrierGradeEnabled.checked;
  navigationState.carrier=sanitiseCarrierClient(carrier);
}
function carrierGeometry() {
  const carrier=navigationState.carrier; if(!carrier?.enabled||!carrier.stern||!carrier.bow||!mapScale)return null;
  const vector=metresVector(carrier.stern,carrier.bow); if(!vector)return null; const deckLength=Math.hypot(vector.east,vector.north); if(deckLength<25)return null;
  const unit={east:vector.east/deckLength,north:vector.north/deckLength}, touchdownOffset=Math.min(carrier.touchdown_offset_m,deckLength*.48);
  const touchdown={x:carrier.stern.x+unit.east*touchdownOffset/mapScale.width,y:carrier.stern.y-unit.north*touchdownOffset/mapScale.height};
  return {carrier,deckLength,unit,touchdown,deckHeading:mapBearingDegrees(carrier.stern,carrier.bow)};
}
function controlFraction(value){if(!Number.isFinite(value))return null;if(Math.abs(value)<=1.01)return clamp(value,0,1);if(Math.abs(value)<=100.5)return clamp(value/100,0,1);return null;}
function carrierApproachData() {
  const geometry=carrierGeometry(); if(!geometry||!targetPlayer)return null; const vector=metresVector(geometry.touchdown,targetPlayer); if(!vector)return null;
  const along=geometry.unit.east*vector.east+geometry.unit.north*vector.north, crossTrack=geometry.unit.east*vector.north-geometry.unit.north*vector.east;
  const finalDistance=-along,directDistance=Math.hypot(vector.east,vector.north),heading=currentPlayerHeading(),headingError=headingDifference(geometry.deckHeading,heading);
  const idealAltitude=geometry.carrier.deck_altitude_m+Math.max(0,finalDistance)*Math.tan(geometry.carrier.glidepath_deg*Math.PI/180),glideError=latestAltitude===null?null:latestAltitude-idealAltitude;
  const glideTolerance=clamp(5+Math.max(0,finalDistance)*.008,6,45),lineupTolerance=clamp(geometry.carrier.profile.lineup_tolerance_m+Math.max(0,finalDistance)*.018,geometry.carrier.profile.lineup_tolerance_m,250);
  const altitudeAboveDeck=latestAltitude===null?null:latestAltitude-geometry.carrier.deck_altitude_m;
  const approachMoving=latestIas===null||latestIas>70;
  const active=latestConnected&&approachMoving&&finalDistance<=geometry.carrier.approach_distance_m&&finalDistance>-600&&Math.abs(crossTrack)<Math.max(1800,Math.max(0,finalDistance)*.65)&&(headingError===null||Math.abs(headingError)<80)&&(altitudeAboveDeck===null||altitudeAboveDeck<2400);
  let glideStatus='UNAVAILABLE'; if(glideError!==null){if(glideError>glideTolerance*1.8)glideStatus='HIGH';else if(glideError>glideTolerance*.65)glideStatus='SLIGHTLY HIGH';else if(glideError<-glideTolerance*1.8)glideStatus='LOW';else if(glideError<-glideTolerance*.65)glideStatus='SLIGHTLY LOW';else glideStatus='ON GLIDEPATH';}
  const lineupStatus=Math.abs(crossTrack)<=lineupTolerance?'ON CENTRELINE':crossTrack>0?'RIGHT':'LEFT',gearFraction=controlFraction(latestGear),flapFraction=controlFraction(latestFlaps);
  return {...geometry,active,finalDistance,directDistance,crossTrack,heading,headingError,idealAltitude,glideError,glideTolerance,lineupTolerance,glideStatus,lineupStatus,altitudeAboveDeck,ias:latestIas,aoa:latestAoa,bank:latestBank,verticalSpeed:latestVerticalSpeed,g:latestG,gearFraction,flapFraction,gearDown:gearFraction===null?null:gearFraction>=.75,flapsDown:flapFraction===null?null:flapFraction>=.12};
}
function carrierUnsafe(data){if(!data)return{unsafe:false,reasons:[]};const p=data.carrier.profile,close=data.finalDistance<850,reasons=[];if(close&&data.gearDown===false)reasons.push('GEAR');if(close&&data.flapsDown===false)reasons.push('FLAPS');if(close&&data.verticalSpeed!==null&&data.verticalSpeed<p.max_sink_mps)reasons.push('SINK');if(close&&data.glideError!==null&&data.glideError<-Math.max(14,data.glideTolerance*1.45))reasons.push('LOW');if(close&&Math.abs(data.crossTrack)>Math.max(110,data.lineupTolerance*1.8))reasons.push('LINE-UP');if(close&&data.bank!==null&&Math.abs(data.bank)>p.max_bank_deg*1.35)reasons.push('BANK');if(close&&data.headingError!==null&&Math.abs(data.headingError)>28)reasons.push('HEADING');if(close&&data.ias!==null&&(data.ias<p.approach_ias_min*.78||data.ias>p.approach_ias_max*1.22))reasons.push('SPEED');return{unsafe:reasons.length>0,reasons};}
function renderCarrierGrade(){const grade=navigationState.carrier?.last_grade,summary=document.getElementById('carrierGradeSummary');if(!grade)return summary.classList.add('hidden');summary.classList.remove('hidden');document.getElementById('carrierGradeResult').textContent=grade.result;document.getElementById('carrierGradeScore').textContent=String(grade.score).padStart(2,'0');document.getElementById('carrierGradeMetrics').textContent=`Sink ${grade.sink_mps.toFixed(1)} m/s · IAS ${Math.round(grade.ias_kmh)} km/h · line-up ${Math.round(Math.abs(grade.cross_track_m))} m · glide ${grade.glide_error_m>0?'+':''}${Math.round(grade.glide_error_m)} m · bank ${Math.abs(grade.bank_deg).toFixed(1)}°`;}
function renderCarrierHud(){const data=carrierApproachData(),waveoff=document.getElementById('carrierWaveoff');const visible=Boolean(carrierHudEnabled&&!tgpPanelOpen&&data?.active&&data.finalDistance>0);carrierHud.classList.toggle('hidden',!visible);carrierHudToggle?.classList.toggle('active',carrierHudEnabled);if(!data?.active){waveoff.classList.add('hidden');updateCarrierPass(null);return;}if(!visible){waveoff.classList.add('hidden');updateCarrierPass(data,carrierUnsafe(data));return;}document.getElementById('carrierHudName').textContent=data.carrier.name;document.getElementById('carrierHudStatus').textContent=data.finalDistance<250?'RAMP':data.finalDistance<1500?'FINAL':'APPROACH';document.getElementById('carrierHudGlide').textContent=data.glideStatus;document.getElementById('carrierHudGlideError').textContent=data.glideError===null?'Altitude unavailable':`${data.glideError>=0?'+':''}${Math.round(data.glideError)} m`;document.getElementById('carrierHudLineup').textContent=data.lineupStatus;document.getElementById('carrierHudCrossTrack').textContent=`${Math.round(Math.abs(data.crossTrack))} m ${Math.abs(data.crossTrack)<data.lineupTolerance?'':data.crossTrack>0?'RIGHT':'LEFT'}`.trim();document.getElementById('carrierHudDistance').textContent=formatDistance(Math.max(0,data.finalDistance));document.getElementById('carrierHudDeckHeading').textContent=`DECK ${String(Math.round(data.deckHeading)).padStart(3,'0')}°`;document.getElementById('carrierHudIas').textContent=data.ias===null?'—':`${Math.round(data.ias)} km/h`;document.getElementById('carrierHudAoa').textContent=data.aoa===null?'AoA —':`AoA ${data.aoa.toFixed(1)}°`;document.getElementById('carrierHudSink').textContent=data.verticalSpeed===null?'—':`${data.verticalSpeed.toFixed(1)} m/s`;document.getElementById('carrierHudBank').textContent=data.bank===null?'Bank —':`Bank ${Math.abs(data.bank).toFixed(1)}°`;document.getElementById('carrierHudGear').textContent=data.gearDown===null?'GEAR —':data.gearDown?'GEAR DOWN':'GEAR UP';document.getElementById('carrierHudFlaps').textContent=data.flapsDown===null?'FLAPS —':data.flapsDown?'FLAPS SET':'FLAPS UP';const xRatio=clamp(data.crossTrack/Math.max(60,data.lineupTolerance*2.5),-1,1),yRatio=data.glideError===null?0:clamp(data.glideError/Math.max(10,data.glideTolerance*2),-1,1);carrierBallDot.style.left=`${50+xRatio*43}%`;carrierBallDot.style.top=`${50-yRatio*43}%`;carrierBallDot.classList.toggle('danger',Math.abs(xRatio)>.8||Math.abs(yRatio)>.8);carrierBallDot.classList.toggle('caution',!carrierBallDot.classList.contains('danger')&&(Math.abs(xRatio)>.42||Math.abs(yRatio)>.42));const unsafe=carrierUnsafe(data),showWaveoff=unsafe.unsafe&&data.carrier.waveoff_enabled;waveoff.classList.toggle('hidden',!showWaveoff);waveoff.textContent=showWaveoff?`WAVE OFF · ${unsafe.reasons.join(' / ')}`:'WAVE OFF';updateCarrierPass(data,unsafe);}
async function queueLso(key,cooldownSeconds=3){const now=performance.now();if(now-lastLsoAnyAt<2200)return false;if(now-(lastLsoCallouts.get(key)||-999999)<cooldownSeconds*1000)return false;lastLsoAnyAt=now;lastLsoCallouts.set(key,now);try{const response=await fetch('/api/audio/lso',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,cooldown_seconds:cooldownSeconds})});return response.ok;}catch{return false;}}
function sampleCarrierPass(data){const now=performance.now();if(now-carrierPass.lastSampleAt<200)return;carrierPass.lastSampleAt=now;carrierPass.samples.push({time:now,finalDistance:data.finalDistance,crossTrack:data.crossTrack,glideError:data.glideError,ias:data.ias,aoa:data.aoa,bank:data.bank,sink:data.verticalSpeed,gearDown:data.gearDown,flapsDown:data.flapsDown,altitudeAboveDeck:data.altitudeAboveDeck});if(carrierPass.samples.length>500)carrierPass.samples.shift();}
function scoreCarrierPass(result,sample){const p=navigationState.carrier.profile;let score=100;score-=Math.min(24,Math.max(0,Math.abs(sample.crossTrack)-8)/4);score-=Math.min(20,Math.max(0,Math.abs(sample.glideError||0)-3)/2.2);if(sample.sink!==null){if(sample.sink<-5)score-=Math.min(22,(-sample.sink-5)*4.5);else if(sample.sink>-1)score-=Math.min(8,(sample.sink+1)*3);}if(sample.ias!==null){if(sample.ias<p.approach_ias_min)score-=Math.min(16,(p.approach_ias_min-sample.ias)/4);if(sample.ias>p.approach_ias_max)score-=Math.min(16,(sample.ias-p.approach_ias_max)/4);}if(sample.aoa!==null)score-=Math.min(10,Math.max(0,Math.abs(sample.aoa-p.target_aoa_deg)-p.aoa_tolerance_deg)*2);if(sample.bank!==null)score-=Math.min(12,Math.max(0,Math.abs(sample.bank)-4)*1.2);if(sample.gearDown===false)score-=30;if(sample.flapsDown===false)score-=15;if(result==='BOLTER')score-=12;if(result==='WAVE-OFF')score=Math.min(score,55);return clamp(Math.round(score),0,100);}
function finishCarrierPass(result,sample){if(carrierPass.finished||!sample)return;carrierPass.finished=true;const score=scoreCarrierPass(result,sample),grading=navigationState.carrier?.landing_grade_enabled!==false;if(grading){navigationState.carrier.last_grade={score,result,timestamp:Date.now()/1000,sink_mps:sample.sink||0,ias_kmh:sample.ias||0,cross_track_m:sample.crossTrack||0,glide_error_m:sample.glideError||0,bank_deg:sample.bank||0};renderCarrierGrade();scheduleNavigationSave();showMapToast(`${result} · carrier pass ${score}/100`);}else showMapToast(result);if(result==='LIKELY ARRESTED'){queueLso('arrested',20);if(grading&&score>=75)setTimeout(()=>queueLso('good-pass',30),2600);}else if(result==='BOLTER')queueLso('bolter',20);}
function maybeCarrierCallouts(data,unsafe){if(!data.carrier.callouts_enabled)return;const distance=data.finalDistance;const milestone=(key,threshold,cooldown=30)=>{if(distance<=threshold&&!carrierPass.milestones.has(key)){carrierPass.milestones.add(key);queueLso(key,cooldown);return true;}return false;};if(!carrierPass.milestones.has('approaching-final')){carrierPass.milestones.add('approaching-final');queueLso('approaching-final',30);return;}if(data.carrier.waveoff_enabled&&unsafe.unsafe&&distance<800&&!carrierPass.waveoffCalled){carrierPass.waveoffCalled=true;queueLso('wave-off',30);return;}if(distance<3200&&data.gearDown===false&&!carrierPass.milestones.has('check-gear')){carrierPass.milestones.add('check-gear');queueLso('check-gear',15);return;}if(distance<2600&&data.flapsDown===false&&!carrierPass.milestones.has('check-flaps')){carrierPass.milestones.add('check-flaps');queueLso('check-flaps',15);return;}if(milestone('three-quarter-mile',1200))return;if(milestone('half-mile',805))return;if(milestone('quarter-mile',402))return;if(milestone('approaching-ramp',180))return;const now=performance.now();if(now-carrierPass.lastGuidanceAt<(distance<1000?3600:5200))return;carrierPass.lastGuidanceAt=now;if(data.verticalSpeed!==null&&data.verticalSpeed<data.carrier.profile.max_sink_mps)return void queueLso(distance<900?'power':'sink-rate',5);if(data.glideStatus==='LOW')return void queueLso(distance<900?'power':'low',5);if(data.glideStatus==='SLIGHTLY LOW')return void queueLso('slightly-low',6);if(data.glideStatus==='HIGH')return void queueLso('high',6);if(data.glideStatus==='SLIGHTLY HIGH')return void queueLso('slightly-high',6);if(Math.abs(data.crossTrack)>data.lineupTolerance)return void queueLso(data.crossTrack>0?'come-left':'come-right',5);if(data.ias!==null&&data.ias>data.carrier.profile.approach_ias_max)return void queueLso('fast',6);if(data.ias!==null&&data.ias<data.carrier.profile.approach_ias_min)return void queueLso('slow',6);if(data.aoa!==null&&data.aoa>data.carrier.profile.target_aoa_deg+data.carrier.profile.aoa_tolerance_deg)return void queueLso('aoa-high',7);if(data.aoa!==null&&data.aoa<data.carrier.profile.target_aoa_deg-data.carrier.profile.aoa_tolerance_deg)return void queueLso('aoa-low',7);if(data.bank!==null&&Math.abs(data.bank)>data.carrier.profile.max_bank_deg)return void queueLso('ease-bank',6);if(distance<1500&&!carrierPass.milestones.has('on-glidepath')){carrierPass.milestones.add('on-glidepath');queueLso('on-glidepath',20);}}
function updateCarrierPass(data,unsafe={unsafe:false}){if(!data?.active){if(carrierPass.active&&!carrierPass.finished&&carrierPass.touchdown)finishCarrierPass('BOLTER',carrierPass.touchdown);else if(carrierPass.active&&!carrierPass.finished&&carrierPass.waveoffCalled&&carrierPass.samples.length)finishCarrierPass('WAVE-OFF',carrierPass.samples.at(-1));if(carrierPass.active&&performance.now()-carrierPass.startedAt>5000)carrierPass=createCarrierPassState();return;}if(!carrierPass.active){carrierPass=createCarrierPassState();carrierPass.active=true;carrierPass.startedAt=performance.now();}sampleCarrierPass(data);maybeCarrierCallouts(data,unsafe);if(carrierPass.previousFinalDistance!==null&&carrierPass.previousFinalDistance>0&&data.finalDistance<=0&&Math.abs(data.crossTrack)<Math.max(180,data.lineupTolerance*2)&&(data.altitudeAboveDeck===null||data.altitudeAboveDeck<30)){carrierPass.touchdown={crossTrack:data.crossTrack,glideError:data.glideError,ias:data.ias,aoa:data.aoa,bank:data.bank,sink:data.verticalSpeed,gearDown:data.gearDown,flapsDown:data.flapsDown,at:performance.now()};}carrierPass.previousFinalDistance=data.finalDistance;if(carrierPass.touchdown&&!carrierPass.finished){const elapsed=(performance.now()-carrierPass.touchdown.at)/1000,nearDeck=data.altitudeAboveDeck===null||Math.abs(data.altitudeAboveDeck)<14;if(elapsed>1.3&&nearDeck&&groundSpeedMps!==null&&groundSpeedMps<25)finishCarrierPass('LIKELY ARRESTED',carrierPass.touchdown);else if(elapsed>1.2&&data.finalDistance<-220&&groundSpeedMps!==null&&groundSpeedMps>45&&((data.altitudeAboveDeck!==null&&data.altitudeAboveDeck>22)||(data.verticalSpeed!==null&&data.verticalSpeed>1.5)))finishCarrierPass('BOLTER',carrierPass.touchdown);else if(elapsed>12)finishCarrierPass('DECK CROSSING',carrierPass.touchdown);}}
function drawCarrierGuide(rect,symbolScale){const g=carrierGeometry();if(!g)return;const stern=point(rect,g.carrier.stern.x,g.carrier.stern.y),bow=point(rect,g.carrier.bow.x,g.carrier.bow.y),touchdown=point(rect,g.touchdown.x,g.touchdown.y),finalStartMap={x:g.touchdown.x-g.unit.east*g.carrier.approach_distance_m/mapScale.width,y:g.touchdown.y+g.unit.north*g.carrier.approach_distance_m/mapScale.height},finalStart=point(rect,finalStartMap.x,finalStartMap.y);ctx.save();ctx.lineCap='round';ctx.strokeStyle='rgba(116,241,197,.88)';ctx.lineWidth=7*symbolScale;ctx.beginPath();ctx.moveTo(stern.x,stern.y);ctx.lineTo(bow.x,bow.y);ctx.stroke();ctx.strokeStyle='rgba(244,212,119,.7)';ctx.lineWidth=1.8*symbolScale;ctx.setLineDash([10*symbolScale,7*symbolScale]);ctx.beginPath();ctx.moveTo(finalStart.x,finalStart.y);ctx.lineTo(touchdown.x,touchdown.y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#f4d477';ctx.beginPath();ctx.arc(touchdown.x,touchdown.y,5*symbolScale,0,Math.PI*2);ctx.fill();ctx.restore();}

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

function nearestNavigationPoint(screenX, screenY) {
  let best = null;
  navigationState.points.forEach((pointValue, index) => {
    const screen = mapToScreen(pointValue.x, pointValue.y);
    if (!screen) return;
    const distance = Math.hypot(screen.x - screenX, screen.y - screenY);
    if (distance <= 38 && (!best || distance < best.distance)) best = { index, point: pointValue, distance };
  });
  return best;
}

function removeNavigationPoint(index, announce = true) {
  if (index < 0 || index >= navigationState.points.length) return false;
  const [removed] = navigationState.points.splice(index, 1);
  navigationState.active_index = clamp(
    navigationState.active_index - (index < navigationState.active_index ? 1 : 0),
    0,
    Math.max(0, navigationState.points.length - 1),
  );
  navigationState.active = navigationState.active && navigationState.points.length > 0;
  lastNavigationPointId = null;
  navigationState = sanitiseNavigationClient(navigationState);
  syncNavigationControls();
  renderNavigationUi(true);
  scheduleNavigationSave();
  if (announce) showMapToast(`${removed?.name || 'Route point'} removed`);
  return true;
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
  if (!renderTransform) return false;
  const rect = canvas.getBoundingClientRect();
  const screenX = clientX - rect.left;
  const screenY = clientY - rect.top;

  // When not placing anything, tapping one of our route markers offers a large,
  // native confirmation dialog. This is deliberately usable with the planner hidden.
  if (!navigationMode && !carrierSetupStep) {
    const existingPoint = nearestNavigationPoint(screenX, screenY);
    if (!existingPoint) return false;
    if (window.confirm(`Remove ${existingPoint.point.name} from the route?`)) {
      removeNavigationPoint(existingPoint.index);
    }
    return true;
  }

  const mapLocation = screenToMap(screenX, screenY);
  if (!mapLocation) return false;
  if (carrierSetupStep) {
    const carrier=navigationState.carrier||defaultCarrierState();
    if(carrierSetupStep==='stern'){carrier.stern=mapLocation;carrier.bow=null;carrier.enabled=false;carrierSetupStep='bow';carrierSetupHint.textContent='Stern marked. Tap the bow end of the landing deck.';showMapToast('Carrier stern marked · now tap the bow');}
    else{carrier.bow=mapLocation;carrier.enabled=Boolean(carrier.stern&&carrier.bow);carrierSetupStep=null;carrierSetupHint.textContent='Carrier ready. Landing direction is stern to bow; adjust deck altitude and profile below.';carrierPass=createCarrierPassState();showMapToast('Carrier deck configured');scheduleNavigationSave();}
    navigationState.carrier=sanitiseCarrierClient(carrier);canvas.classList.toggle('placing-point',Boolean(navigationMode||carrierSetupStep));syncCarrierControls();return true;
  }
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
  renderCarrierHud();
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

function mapObjectClass(obj) {
  const type = String(obj?.type || '').toLowerCase();
  const icon = String(obj?.icon || '').toLowerCase();
  if (isPlayer(obj)) return 'player';
  if (type === 'aircraft' || ['fighter', 'bomber', 'assault', 'helicopter'].includes(icon)) {
    return icon || 'aircraft';
  }
  if (type === 'ground_model') {
    if (/air.?defen|anti.?air|spaa|sam|aaa/.test(icon)) return 'airdefence';
    if (/tracked|tank/.test(icon)) return 'tracked';
    if (/wheeled|car|truck/.test(icon)) return 'wheeled';
    return 'ground';
  }
  if (type === 'bombing_point' || icon === 'bombing_point') return 'bombing_point';
  if (type === 'defending_point' || icon === 'defending_point') return 'defending_point';
  if (type === 'respawn_base_fighter' || icon === 'respawn_base_fighter') return 'respawn_fighter';
  if (type === 'respawn_base_bomber' || icon === 'respawn_base_bomber') return 'respawn_bomber';
  if (/ship|naval|boat/.test(type) || /ship|naval|boat/.test(icon)) return 'ship';
  return type || icon || 'unknown';
}

function isAircraftMapObject(obj) {
  return ['player', 'fighter', 'bomber', 'assault', 'helicopter', 'aircraft'].includes(mapObjectClass(obj));
}

function drawAircraft(obj, rect, symbolScale) {
  if (obj.x === undefined || obj.y === undefined) return;
  const p = point(rect, obj.x, obj.y);
  const angle = aircraftAngle(obj) ?? 0;
  const player = isPlayer(obj);
  const kind = mapObjectClass(obj);
  const size = (player ? 14 : 9.5) * symbolScale;
  const colour = player ? '#ffffff' : objectColour(obj);

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  ctx.fillStyle = colour;
  ctx.strokeStyle = 'rgba(0,0,0,.84)';
  ctx.lineWidth = 1.15 * symbolScale;
  ctx.shadowColor = player ? '#74f1c5' : colour;
  ctx.shadowBlur = (player ? 14 : 5) * symbolScale;
  ctx.beginPath();

  if (kind === 'bomber') {
    // Wide wing planform: immediately distinguishable from fighters at tablet scale.
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.30, -size * 0.10);
    ctx.lineTo(size * 1.22, size * 0.35);
    ctx.lineTo(size * 0.24, size * 0.25);
    ctx.lineTo(0, size * 0.86);
    ctx.lineTo(-size * 0.24, size * 0.25);
    ctx.lineTo(-size * 1.22, size * 0.35);
    ctx.lineTo(-size * 0.30, -size * 0.10);
  } else if (kind === 'assault') {
    // Broad delta/attack-aircraft symbol.
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.92, size * 0.52);
    ctx.lineTo(size * 0.28, size * 0.30);
    ctx.lineTo(0, size * 0.88);
    ctx.lineTo(-size * 0.28, size * 0.30);
    ctx.lineTo(-size * 0.92, size * 0.52);
  } else if (kind === 'helicopter') {
    ctx.arc(0, 0, size * 0.54, 0, Math.PI * 2);
    ctx.moveTo(-size, 0); ctx.lineTo(size, 0);
    ctx.moveTo(0, -size * 0.78); ctx.lineTo(0, size * 0.95);
  } else {
    // Fighter/player: narrow arrowhead.
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.68, size * 0.82);
    ctx.lineTo(0, size * 0.40);
    ctx.lineTo(-size * 0.68, size * 0.82);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
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
  if (isAircraftMapObject(obj)) return drawAircraft(obj, rect, symbolScale);

  const p = point(rect, obj.x, obj.y);
  const colour = objectColour(obj);
  const kind = mapObjectClass(obj);
  const size = 6.2 * symbolScale;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = colour;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1.8 * symbolScale;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (kind === 'airdefence') {
    // AA/SAM: target ring + crosshair.
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.82, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-size, 0); ctx.lineTo(size, 0);
    ctx.moveTo(0, -size); ctx.lineTo(0, size);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, size * 0.20, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'tracked') {
    // Tracked armour: hull rectangle with visible track bars.
    ctx.beginPath();
    ctx.rect(-size, -size * 0.58, size * 2, size * 1.16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.78)';
    ctx.lineWidth = 1.2 * symbolScale;
    ctx.beginPath();
    ctx.moveTo(-size * 0.78, -size * 0.28); ctx.lineTo(size * 0.78, -size * 0.28);
    ctx.moveTo(-size * 0.78, size * 0.28); ctx.lineTo(size * 0.78, size * 0.28);
    ctx.stroke();
  } else if (kind === 'wheeled') {
    // Wheeled ground vehicle: circle with axle line.
    ctx.beginPath(); ctx.arc(0, 0, size * 0.82, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.80)';
    ctx.lineWidth = 1.25 * symbolScale;
    ctx.beginPath(); ctx.moveTo(-size * 0.62, 0); ctx.lineTo(size * 0.62, 0); ctx.stroke();
  } else if (kind === 'bombing_point') {
    // Bomb objective: bullseye.
    ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, size * 0.42, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, size * 0.13, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'defending_point') {
    // Defended objective: hexagonal shield-like marker.
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 3;
      const x = Math.cos(a) * size, y = Math.sin(a) * size;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.fill();
  } else if (kind === 'respawn_fighter') {
    ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size * 0.72, size); ctx.lineTo(0, size * 0.48); ctx.lineTo(-size * 0.72, size); ctx.closePath(); ctx.stroke();
  } else if (kind === 'respawn_bomber') {
    ctx.beginPath(); ctx.moveTo(-size * 1.15, size * 0.18); ctx.lineTo(-size * 0.25, -size * 0.12); ctx.lineTo(0, -size); ctx.lineTo(size * 0.25, -size * 0.12); ctx.lineTo(size * 1.15, size * 0.18); ctx.lineTo(0, size * 0.62); ctx.closePath(); ctx.stroke();
  } else if (kind === 'ship') {
    ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size * 0.78, 0); ctx.lineTo(0, size); ctx.lineTo(-size * 0.78, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.78)'; ctx.stroke();
  } else {
    // Unknown future map-object types still get a visible generic marker.
    ctx.beginPath(); ctx.rect(-size * 0.72, -size * 0.72, size * 1.44, size * 1.44); ctx.fill();
  }
  ctx.restore();
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


function updateRangeEstimate() {
  if (groundSpeedMps === null || groundSpeedMps < 8 || latestFuelKg === null || latestFuelKg <= 0 || fuelBurnKgps === null || fuelBurnKgps <= 0.001) {
    estimatedRangeM = null;
    return;
  }
  const enduranceSeconds = latestFuelKg / fuelBurnKgps;
  const estimate = enduranceSeconds * groundSpeedMps;
  // Ignore impossible/noisy values while the rolling estimator is settling.
  estimatedRangeM = Number.isFinite(estimate) && estimate > 100 ? Math.min(estimate, 5000000) : null;
}

function updateFuelBurnEstimate(fuelKg, sampleAt) {
  if (fuelKg === null || !Number.isFinite(fuelKg)) {
    fuelSamples.length = 0;
    fuelBurnKgps = null;
    return;
  }
  const previous = fuelSamples.at(-1);
  // A significant increase is a refuel/rearm event: start a fresh window.
  if (previous && fuelKg > previous.fuel + 0.5) {
    fuelSamples.length = 0;
    fuelBurnKgps = null;
  }
  // One sample per ~0.75 s is plenty and avoids over-weighting the 10 Hz feed.
  const last = fuelSamples.at(-1);
  if (!last || sampleAt - last.at >= 0.75) fuelSamples.push({ fuel: fuelKg, at: sampleAt });
  while (fuelSamples.length && sampleAt - fuelSamples[0].at > 30) fuelSamples.shift();
  if (fuelSamples.length < 2) return;
  // Prefer a window of at least eight seconds so integer/quantised fuel readings
  // cannot turn a single decrement into a huge instantaneous burn rate.
  let baseline = fuelSamples[0];
  for (const sample of fuelSamples) {
    if (sampleAt - sample.at >= 8) baseline = sample;
    else break;
  }
  const elapsed = sampleAt - baseline.at;
  const used = baseline.fuel - fuelKg;
  if (elapsed < 8 || used <= 0.01) return;
  const rawBurn = used / elapsed;
  if (!Number.isFinite(rawBurn) || rawBurn <= 0 || rawBurn > 100) return;
  fuelBurnKgps = fuelBurnKgps === null ? rawBurn : fuelBurnKgps * 0.88 + rawBurn * 0.12;
}

function drawEstimatedRangeRing() {
  if (!rangeRingEnabled || !targetPlayer || !mapScale || !estimatedRangeM || !renderTransform) return;
  const centre = point(renderTransform.rect, targetPlayer.x, targetPlayer.y);
  // Canvas is currently inside the map's pre-scale coordinate space here, so the
  // normalised map fraction must be converted to map-image pixels first.
  const rx = estimatedRangeM / mapScale.width * renderTransform.rect.width;
  const ry = estimatedRangeM / mapScale.height * renderTransform.rect.height;
  if (!Number.isFinite(rx) || !Number.isFinite(ry) || rx <= 0 || ry <= 0) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(210, 214, 220, 0.42)';
  ctx.fillStyle = 'rgba(210, 214, 220, 0.025)';
  ctx.lineWidth = 1.6 / renderTransform.effectiveScale;
  ctx.setLineDash([7 / renderTransform.effectiveScale, 7 / renderTransform.effectiveScale]);
  ctx.beginPath();
  ctx.ellipse(centre.x, centre.y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawRangeReadout(width, height) {
  if (!rangeRingEnabled) return;
  let label = 'RNG · CAL';
  if (estimatedRangeM !== null && fuelBurnKgps !== null) {
    const km = estimatedRangeM / 1000;
    const enduranceMinutes = latestFuelKg !== null && fuelBurnKgps > 0 ? latestFuelKg / fuelBurnKgps / 60 : null;
    let overflow = '';
    if (renderTransform && mapScale) {
      const rxScreen = estimatedRangeM / mapScale.width * renderTransform.rect.width * renderTransform.effectiveScale;
      const ryScreen = estimatedRangeM / mapScale.height * renderTransform.rect.height * renderTransform.effectiveScale;
      const farthestVisible = Math.hypot(width / 2, height / 2);
      if (Math.min(rxScreen, ryScreen) > farthestVisible) overflow = ' · > VIEW';
    }
    label = `RNG · ${km < 100 ? km.toFixed(1) : Math.round(km)} KM${enduranceMinutes !== null ? ` · ${Math.round(enduranceMinutes)} MIN` : ''}${overflow}`;
  }
  ctx.save();
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  const paddingX = 8, paddingY = 6;
  const metrics = ctx.measureText(label);
  const boxW = metrics.width + paddingX * 2;
  const boxH = 26;
  const x = 14;
  const y = height - 62;
  ctx.fillStyle = 'rgba(10, 14, 16, 0.68)';
  ctx.fillRect(x, y - boxH, boxW, boxH);
  ctx.strokeStyle = 'rgba(210, 214, 220, 0.28)';
  ctx.strokeRect(x, y - boxH, boxW, boxH);
  ctx.fillStyle = 'rgba(225, 228, 232, 0.92)';
  ctx.fillText(label, x + paddingX, y - paddingY);
  ctx.restore();
}

function drawHeadingVectorMarkers(anchor, width, height, rotation) {
  if (!headingVectorEnabled || !targetPlayer || !anchor || !mapScale) return;
  const heading = currentPlayerHeading();
  if (heading === null) return;
  const maxLength = Math.hypot(width, height) * 1.6;
  let previous = null;
  for (let km = 5; km <= 200; km += 5) {
    const worldPoint = mapPointOffset(targetPlayer, heading, km * 1000);
    const screenPoint = worldToScreen(worldPoint);
    if (!screenPoint) continue;
    const dx = screenPoint.x - anchor.x;
    const dy = screenPoint.y - anchor.y;
    const distancePx = Math.hypot(dx, dy);
    if (distancePx > maxLength) break;
    const angle = Math.atan2(dy, dx);
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 160, 230, 0.78)';
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.moveTo(screenPoint.x - nx * 5, screenPoint.y - ny * 5);
    ctx.lineTo(screenPoint.x + nx * 5, screenPoint.y + ny * 5);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 225, 245, 0.94)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${km}`, screenPoint.x + nx * 14, screenPoint.y + ny * 14);
    ctx.restore();
    previous = screenPoint;
  }
}

function drawHeadingVector(anchor, width, height, rotation) {
  if (!headingVectorEnabled || !targetPlayer || !anchor) return;

  const player = mapObjects.find(isPlayer);
  const aircraft = player ? aircraftAngle(player) : null;
  if (aircraft === null) return;

  // aircraftAngle() is the rotation applied to the arrow; the arrow's nose points
  // along local -Y. Add the map rotation so the vector follows the on-screen nose
  // in both north-up and heading-up modes.
  const screenAngle = aircraft + rotation;
  const dirX = Math.sin(screenAngle);
  const dirY = -Math.cos(screenAngle);
  const noseOffset = 16;
  const startX = anchor.x + dirX * noseOffset;
  const startY = anchor.y + dirY * noseOffset;

  // Extend far enough to guarantee the solid vector reaches the viewport edge.
  const length = Math.hypot(width, height) * 1.6;
  const endX = startX + dirX * length;
  const endY = startY + dirY * length;

  ctx.save();
  ctx.strokeStyle = '#ff66d8';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(255,102,216,.45)';
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
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
  // Keep the aircraft at the requested anchor even at the edge of the tactical map.
  // The old edge clamp moved the aircraft away from centre to avoid showing space
  // outside the map image. Allowing that empty margin is preferable for a true
  // aircraft-centred navigation display. Manual pan still offsets the anchor.
  const anchor = {
    x: width / 2 + panX,
    y: height / 2 + panY,
  };
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
  drawEstimatedRangeRing();

  drawTrail(rect, symbolScale);
  drawNavigationRoute(rect, symbolScale);
  drawCarrierGuide(rect, symbolScale);
  for (const obj of mapObjects) drawLineObject(obj, rect, symbolScale);
  for (const obj of mapObjects) drawPointObject(obj, rect, symbolScale);
  ctx.restore();

  drawHeadingVector(anchor, width, height, rotation);
  drawHeadingVectorMarkers(anchor, width, height, rotation);
  drawRangeReadout(width, height);
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
    estimatedRangeM = null;
    fuelBurnKgps = null;
    fuelSamples.length = 0;
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
  lastTelemetrySuccess=Date.now(); const state=payload.state||{}, indicators=payload.indicators||{}, derived=payload.derived||{};
  const ias=number(pick(state,['IAS, km/h'])), altitude=number(pick(state,['H, m'])), heading=number(pick(indicators,['compass','compass1','compass2']));
  const fuel=number(pick(state,['Mfuel, kg'])) ?? number(indicators.fuel);
  const fuelCapacity=number(pick(state,['Mfuel0, kg']));
  latestIas = ias; latestAltitude = altitude; latestHeading = heading; latestFuelKg = fuel; latestFuelCapacityKg = fuelCapacity;
  latestVerticalSpeed=number(pick(state,['Vy, m/s']))??number(pick(indicators,['vario','vertical_speed'])); latestAoa=number(pick(state,['AoA, deg']))??number(pick(indicators,['aoa','angle_of_attack']));
  latestBank=number(pick(indicators,['bank','roll','aviahorizon_roll']))??number(pick(state,['bank, deg','roll, deg'])); latestGear=number(pick(indicators,['gears','gears1']))??number(pick(state,['gear, %']));
  latestFlaps=number(pick(state,['flaps, %']))??number(pick(indicators,['flaps'])); updateFlapNotice(latestFlaps); latestG=number(derived.g_load)??number(pick(state,['Ny','Ny, g','Ny, G']))??number(pick(indicators,['g_meter'])); latestVehicle=payload.vehicle||null; latestConnected=payload.connected!==false;
  const fuelNow = performance.now() / 1000;
  updateFuelBurnEstimate(fuel, fuelNow);
  updateRangeEstimate();
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
headingVectorToggle?.addEventListener('click', () => {
  headingVectorEnabled = !headingVectorEnabled;
  headingVectorToggle.classList.toggle('active', headingVectorEnabled);
  headingVectorToggle.setAttribute('aria-pressed', headingVectorEnabled ? 'true' : 'false');
  headingVectorToggle.title = headingVectorEnabled ? 'Heading vector enabled' : 'Heading vector disabled';
  showMapToast(headingVectorEnabled ? 'Heading vector enabled' : 'Heading vector hidden');
});
rangeRingToggle?.addEventListener('click', () => {
  rangeRingEnabled = !rangeRingEnabled;
  rangeRingToggle.classList.toggle('active', rangeRingEnabled);
  rangeRingToggle.setAttribute('aria-pressed', rangeRingEnabled ? 'true' : 'false');
  rangeRingToggle.title = rangeRingEnabled ? 'Fuel range ring enabled' : 'Fuel range ring disabled';
  if (rangeRingEnabled && !estimatedRangeM) showMapToast('Range ring enabled · waiting for fuel burn estimate');
  else showMapToast(rangeRingEnabled ? `Range ring ${(estimatedRangeM/1000).toFixed(estimatedRangeM<10000?1:0)} km estimate` : 'Range ring hidden');
});
alertToggle.addEventListener('click', () => { alertsEnabled = !alertsEnabled; alertToggle.classList.toggle('muted', !alertsEnabled); if (!alertsEnabled) { alertStack.innerHTML = ''; lastAlertSignature = ''; } else { updateFlightStrip(); } });


carrierSetupButton.addEventListener('click',()=>{carrierSetupStep=carrierSetupStep?null:'stern';setNavigationMode(null);carrierSetupHint.textContent=carrierSetupStep?'Tap the stern end of the landing deck.':'Carrier setup cancelled.';canvas.classList.toggle('placing-point',Boolean(navigationMode||carrierSetupStep));syncCarrierControls();});
carrierClearButton.addEventListener('click',()=>{navigationState.carrier=defaultCarrierState();carrierSetupStep=null;carrierPass=createCarrierPassState();carrierSetupHint.textContent='Mark the stern first, then the bow. The landing direction runs stern to bow.';canvas.classList.toggle('placing-point',Boolean(navigationMode));syncCarrierControls();renderCarrierHud();scheduleNavigationSave();});
carrierTestLsoButton.addEventListener('click',async()=>{carrierTestLsoButton.disabled=true;await queueLso('steady',1);setTimeout(()=>{carrierTestLsoButton.disabled=false;},1500);});
carrierLoadProfileButton.addEventListener('click',()=>{resolveAlertProfile(latestVehicle);const carrier=navigationState.carrier||defaultCarrierState();carrier.profile.approach_ias_min=Number(alertProfile.carrierApproachIasMin)||190;carrier.profile.approach_ias_max=Number(alertProfile.carrierApproachIasMax)||310;carrier.profile.target_aoa_deg=Number(alertProfile.carrierTargetAoADeg)||8;carrier.profile.aoa_tolerance_deg=Number(alertProfile.carrierAoAToleranceDeg)||2.5;carrier.profile.max_bank_deg=Number(alertProfile.carrierMaxBankDeg)||12;carrier.profile.max_sink_mps=Number(alertProfile.carrierMaxSinkMps)||-7;carrier.glidepath_deg=Number(alertProfile.carrierGlidepathDeg)||3.5;navigationState.carrier=sanitiseCarrierClient(carrier);syncCarrierControls();scheduleNavigationSave();showMapToast(`Loaded carrier profile${latestVehicle?` for ${String(latestVehicle).replaceAll('_',' ')}`:''}`);});
[carrierDeckAltitude,carrierGlidepath,carrierTouchdownOffset,carrierApproachDistance,carrierIasMin,carrierIasMax,carrierTargetAoa,carrierAoaTolerance,carrierMaxBank,carrierMaxSink,carrierCallouts,carrierWaveoffEnabled,carrierGradeEnabled].forEach(control=>control.addEventListener('change',()=>{collectCarrierControls();syncCarrierControls();scheduleNavigationSave();}));

tgpToggle?.addEventListener('click',()=>setTgpPanelOpen());
tgpClose?.addEventListener('click',()=>setTgpPanelOpen(false));
document.querySelectorAll('[data-tgp-action]').forEach(button=>{
  const action=button.dataset.tgpAction;
  if(button.dataset.tgpHold==='true'){
    const press=event=>{event.preventDefault();button.classList.add('pressed');try{button.setPointerCapture?.(event.pointerId);}catch{}sendCockpitAction(action,'down');};
    const release=event=>{event.preventDefault();button.classList.remove('pressed');sendCockpitAction(action,'up');};
    button.addEventListener('pointerdown',press);
    button.addEventListener('pointerup',release);
    button.addEventListener('pointercancel',release);
    button.addEventListener('lostpointercapture',()=>{if(button.classList.contains('pressed')){button.classList.remove('pressed');sendCockpitAction(action,'up');}});
  }else button.addEventListener('click',event=>{event.preventDefault();sendCockpitAction(action,'tap');});
});
window.addEventListener('blur',releaseCockpitControls);
document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseCockpitControls();});

navigationToggle.addEventListener('click', () => toggleNavigationPanel());
carrierHudToggle?.addEventListener('click', () => {
  carrierHudEnabled = !carrierHudEnabled;
  carrierHudToggle.classList.toggle('active', carrierHudEnabled);
  renderCarrierHud();
  showMapToast(carrierHudEnabled ? 'Carrier landing assistant armed' : 'Carrier landing assistant hidden');
});
// Both large overlays begin closed. Hidden panels are removed from hit-testing.
toggleNavigationPanel(false);
carrierHud.classList.add('hidden');
navigationClose.addEventListener('click', () => toggleNavigationPanel(false));
navigationHide?.addEventListener('click', () => {
  toggleNavigationPanel(false);
  setTgpPanelOpen(false);
  carrierHudEnabled = false;
  carrierHudToggle?.classList.remove('active');
  carrierHud.classList.add('hidden');
  showMapToast('Route planner and carrier assistant hidden');
});
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
    removeNavigationPoint(index);
    return;
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
