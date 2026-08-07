const $ = id => document.getElementById(id);
const num = value => Number.isFinite(Number(value)) ? Number(value) : null;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const pick = (obj, keys) => { for (const key of keys) if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key]; return null; };
const fmt = (value, digits = 0, signed = false) => { const parsed = num(value); if (parsed === null) return '—'; return `${signed && parsed > 0 ? '+' : ''}${parsed.toFixed(digits)}`; };
const angleDelta = (current, previous) => ((current - previous + 540) % 360) - 180;

function prettyVehicle(value) {
  if (!value) return 'AIRCRAFT DATA';
  const acronyms = new Set(['iriaf','raf','usaf','iaf','rn','usn']);
  return value.replace(/^.*?:/, '').replaceAll('_', ' ').split(/\s+/).map(token => {
    const lower = token.toLowerCase();
    if (acronyms.has(lower) || /\d/.test(token)) return token.toUpperCase();
    return token.charAt(0).toUpperCase() + token.slice(1);
  }).join(' ');
}

class SparkChart {
  constructor(canvas, stroke) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.stroke = stroke; this.values = []; new ResizeObserver(() => this.draw()).observe(canvas); }
  push(value) { this.values.push(num(value)); if (this.values.length > 240) this.values.shift(); this.draw(); }
  reset() { this.values = []; this.draw(); }
  draw() {
    const rect = this.canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    const dpr = window.devicePixelRatio || 1; this.canvas.width = Math.round(rect.width*dpr); this.canvas.height = Math.round(rect.height*dpr);
    const ctx = this.ctx; ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,rect.width,rect.height);
    ctx.strokeStyle='rgba(124,157,151,.12)'; ctx.lineWidth=1;
    for(let i=1;i<4;i++){const y=rect.height*i/4;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(rect.width,y);ctx.stroke();}
    const valid=this.values.filter(v=>v!==null); if(valid.length<2) return;
    let min=Math.min(...valid),max=Math.max(...valid); if(Math.abs(max-min)<.001){min-=1;max+=1;} const pad=(max-min)*.12; min-=pad;max+=pad;
    ctx.strokeStyle=this.stroke;ctx.lineWidth=2;ctx.lineJoin='round';ctx.beginPath();let started=false;
    this.values.forEach((value,index)=>{if(value===null)return;const x=index/Math.max(1,this.values.length-1)*rect.width;const y=rect.height-((value-min)/(max-min))*rect.height;if(!started){ctx.moveTo(x,y);started=true;}else ctx.lineTo(x,y);});ctx.stroke();
  }
}

const charts={ias:new SparkChart($('iasChart'),'#74f1c5'),alt:new SparkChart($('altChart'),'#76b9ff'),energy:new SparkChart($('energyChart'),'#f4d477')};
let settings={defaults:{},profiles:{},display:{}};
let profile={};
let currentRawVehicle=null,currentVehicle=null,reconnectTimer=null,selectedMode='auto',lastPayloadAt=0;
let session=createSession();
const motionSamples=[],fuelSamples=[],energySamples=[];
let previous={ias:null,alt:null,vs:null,timestamp:null,gearDown:false};
let turnRun=null,turnQuietSince=null;
let test={state:'idle',type:'accel500900',startedAt:null,startValue:null,accumulatedTurn:0,lastHeading:null,result:null};

function createSession(timestamp=Date.now()/1000){return{startedAt:timestamp,peakIas:null,peakAltitude:null,maxG:null,minG:null,maxAoa:null,fuelStart:null,fuelUsed:0,abSeconds:0,lastTimestamp:null};}
function resetSession(timestamp=Date.now()/1000){session=createSession(timestamp);motionSamples.length=0;fuelSamples.length=0;energySamples.length=0;turnRun=null;Object.values(charts).forEach(c=>c.reset());renderSessionStats();}
function formatClock(seconds){const s=Math.max(0,Math.floor(seconds));const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),r=s%60;return h?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;}
function formatDuration(seconds){if(!Number.isFinite(seconds)||seconds<=0||seconds>86400)return'CALCULATING';const m=Math.floor(seconds/60),s=Math.floor(seconds%60);return m>=60?`${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m`:`${m}:${String(s).padStart(2,'0')}`;}
function rolling(samples,timestamp,seconds){return samples.filter(s=>s.timestamp>=timestamp-seconds);}
function resolveProfile(raw){profile={...(settings.defaults||{}),...((settings.profiles||{})[raw]||{})};$('reservePct').textContent=`${profile.fuelReservePct??25}%`;}
async function loadSettings(){try{settings=await fetch('/api/settings',{cache:'no-store'}).then(r=>r.json());resolveProfile(currentRawVehicle);}catch{settings={defaults:{fuelReservePct:25,fuelCriticalPct:15,highAoADeg:18,stallAoADeg:22,gCaution:4,highG:8,lowG:-3,sinkRateWarning:-4.5,sinkRateMaxIas:500,landingIasMin:230,landingIasMax:360,engineMismatchPct:18},profiles:{},display:{autoFlightPhase:true,compactEngineNormal:true}};resolveProfile(currentRawVehicle);}}

function calculateMotion(timestamp,ias,heading){
  motionSamples.push({timestamp,ias,heading});while(motionSamples.length&&motionSamples[0].timestamp<timestamp-10)motionSamples.shift();const recent=rolling(motionSamples,timestamp,2);
  let acceleration=null,turnRate=null;const speeds=recent.filter(s=>s.ias!==null);if(speeds.length>=2){const a=speeds[0],b=speeds.at(-1),dt=b.timestamp-a.timestamp;if(dt>=.6)acceleration=(b.ias-a.ias)/dt;}
  const headings=recent.filter(s=>s.heading!==null);if(headings.length>=2){let turn=0;for(let i=1;i<headings.length;i++)turn+=angleDelta(headings[i].heading,headings[i-1].heading);const dt=headings.at(-1).timestamp-headings[0].timestamp;if(dt>=.6)turnRate=turn/dt;}
  return{acceleration,turnRate};
}
function calculateEnergy(timestamp,ias,altitude){if(ias===null||altitude===null)return{value:null,trend:null};const v=ias/3.6;const value=altitude+(v*v)/(2*9.80665);energySamples.push({timestamp,value});while(energySamples.length&&energySamples[0].timestamp<timestamp-8)energySamples.shift();const recent=rolling(energySamples,timestamp,3);let trend=null;if(recent.length>=2){const dt=recent.at(-1).timestamp-recent[0].timestamp;if(dt>=1)trend=(recent.at(-1).value-recent[0].value)/dt;}return{value,trend};}
function calculateFuel(timestamp,fuel){if(fuel===null)return{flow:null,endurance:null};fuelSamples.push({timestamp,fuel});while(fuelSamples.length&&fuelSamples[0].timestamp<timestamp-50)fuelSamples.shift();const recent=rolling(fuelSamples,timestamp,30);if(recent.length<10)return{flow:null,endurance:null};const first=recent[0],last=recent.at(-1),dt=last.timestamp-first.timestamp,used=first.fuel-last.fuel;if(dt<8||used<=.2)return{flow:null,endurance:null};const perSecond=used/dt;return{flow:perSecond*60,endurance:last.fuel/perSecond};}
function percentState(value,multiplier=1){const parsed=num(value);if(parsed===null)return'—';const pct=parsed*multiplier;if(pct<=1)return'RETRACTED';if(pct>=99)return'DEPLOYED';return`${pct.toFixed(0)}%`;}
function stateActive(value){return value==='DEPLOYED'||/%/.test(value);}
function setStateClass(el,value){el.classList.remove('state-safe','state-active');if(value==='RETRACTED')el.classList.add('state-safe');else if(stateActive(value)||/°/.test(value))el.classList.add('state-active');}

function engineTelemetry(state){const engines=[];for(let i=1;i<=8;i++){const e={index:i,throttle:num(state[`throttle ${i}, %`]),rpm:num(state[`RPM ${i}`]),thrust:num(state[`thrust ${i}, kgs`]),power:num(state[`power ${i}, hp`]),oil:num(state[`oil temp ${i}, C`]),water:num(state[`water temp ${i}, C`]),head:num(state[`head temp ${i}, C`])};if(Object.entries(e).some(([k,v])=>k!=='index'&&v!==null))engines.push(e);}return engines;}
function engineMismatch(engines){const rpms=engines.map(e=>e.rpm).filter(v=>v!==null);if(rpms.length<2)return 0;return(Math.max(...rpms)-Math.min(...rpms))/Math.max(...rpms)*100;}
function renderEngines(engines){
  const mismatch=engineMismatch(engines),warning=mismatch>(profile.engineMismatchPct??18)||engines.some(e=>e.rpm!==null&&e.rpm<20);
  $('engineHealth').textContent=!engines.length?'NO DATA':warning?'CHECK ENGINES':'NORMAL';$('engineHealth').className=warning?'warning-text':'safe-text';
  if(!engines.length){$('engineSummary').textContent='Engine data will appear when available.';$('engineGrid').hidden=true;return{warning,mismatch};}
  $('engineSummary').innerHTML=engines.map(e=>`<span>ENG ${e.index}<b>${e.rpm===null?'—':fmt(e.rpm)}%</b></span>`).join('')+(mismatch>1?`<em>${fmt(mismatch,0)}% mismatch</em>`:'');
  $('engineGrid').innerHTML=engines.map(e=>{const temp=e.water??e.oil??e.head;const output=e.thrust!==null?`${fmt(e.thrust)} kgf`:e.power!==null?`${fmt(e.power)} hp`:'—';return`<article class="engine-card"><div class="engine-title"><span>ENGINE ${e.index}</span><strong>${e.throttle>100?'WEP / AB':`${fmt(e.throttle)}%`}</strong></div><div class="engine-bar"><span style="width:${clamp(e.throttle??0,0,110)/1.1}%"></span></div><dl><div><dt>RPM</dt><dd>${fmt(e.rpm)}%</dd></div><div><dt>OUTPUT</dt><dd>${output}</dd></div><div><dt>TEMP</dt><dd>${temp===null?'—':`${fmt(temp)}°C`}</dd></div></dl></article>`;}).join('');
  $('engineGrid').hidden=Boolean(settings.display?.compactEngineNormal)&&!warning;return{warning,mismatch};
}

function detectPhase({connected,ias,alt,vs,g,aoa,gearDown,turnRate}){
  if(!connected)return'STANDBY';if((gearDown&&ias!==null&&ias>60)||(alt!==null&&alt<500&&vs!==null&&vs<0&&ias!==null&&ias<500))return'LANDING';if(ias!==null&&ias<80)return'GROUND';if(vs!==null&&vs>8&&alt!==null&&alt<2500)return'CLIMB';if((Math.abs(turnRate??0)>5)||(g!==null&&Math.abs(g)>2.5)||(aoa!==null&&aoa>10))return'COMBAT';if(vs!==null&&vs>5)return'CLIMB';return'CRUISE';
}
function setModePanels(phase){const mode=selectedMode==='auto'?phase.toLowerCase():selectedMode;$('combatPanel').hidden=!(mode==='combat'||mode==='climb'||mode==='cruise'||mode==='ground');$('landingPanel').hidden=mode!=='landing';$('testPanel').hidden=mode!=='test';document.querySelectorAll('.mode-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.mode===selectedMode));}

function advisory(label,tone='neutral'){return`<span class="advisory-pill ${tone}">${label}</span>`;}
function renderAdvisories(ctx){if(!ctx.connected){$('advisoryStrip').innerHTML=advisory('WAITING FOR WAR THUNDER');return;}const n=[];if(ctx.fuelPct!==null&&ctx.fuelPct<=(profile.fuelCriticalPct??15))n.push(advisory('LOW FUEL','danger'));else if(ctx.fuelPct!==null&&ctx.fuelPct<=(profile.fuelReservePct??25))n.push(advisory('FUEL RESERVE','warning'));if(ctx.gWarning||ctx.g!==null&&(ctx.g>=(profile.highG??8)||ctx.g<=(profile.lowG??-3)))n.push(advisory(`OVER G · ${fmt(ctx.gWarningValue??ctx.g,1,true)} G`,'danger'));if(!ctx.gWarning&&ctx.g!==null&&ctx.g>(profile.gCaution??4))n.push(advisory(`HIGH G · ${fmt(ctx.g,1,true)} G`,'warning'));if(ctx.aoa!==null&&ctx.aoa>=(profile.stallAoADeg??22))n.push(advisory('STALL','danger'));else if(ctx.aoa!==null&&ctx.aoa>(profile.highAoADeg??18))n.push(advisory('HIGH AoA','warning'));if(ctx.gearDown&&ctx.ias>(profile.gearOverspeedKmh??450))n.push(advisory('GEAR OVERSPEED','danger'));if(ctx.flapsDown&&ctx.ias>(profile.flapOverspeedKmh??500))n.push(advisory('FLAP OVERSPEED','danger'));if(ctx.engineWarning)n.push(advisory('ENGINE ASYMMETRY','danger'));if(ctx.airbrakeDown)n.push(advisory('AIRBRAKE','accent'));if(ctx.afterburner)n.push(advisory('WEP / AFTERBURNER','accent'));if(!n.length)n.push(advisory(`${ctx.phase} · NORMAL`,'safe'));$('advisoryStrip').innerHTML=n.join('');}

function updateTurnRun(timestamp,turnRate,ias,alt,g,aoa,heading){
  const active=Math.abs(turnRate??0)>5&&Math.abs(g??0)>1.4;
  if(active){turnQuietSince=null;if(!turnRun)turnRun={startedAt:timestamp,startIas:ias,startAlt:alt,lastHeading:heading,totalTurn:0,gSum:0,aoaSum:0,count:0};if(turnRun.lastHeading!==null&&heading!==null)turnRun.totalTurn+=Math.abs(angleDelta(heading,turnRun.lastHeading));turnRun.lastHeading=heading;turnRun.count++;turnRun.gSum+=g??0;turnRun.aoaSum+=aoa??0;const duration=timestamp-turnRun.startedAt;if(duration>=2){$('turnRun').hidden=false;$('turnRunValue').textContent=`${fmt(Math.abs(turnRun.totalTurn),0)}° · ${formatClock(duration)}`;$('turnRunDetail').textContent=`Speed ${fmt(turnRun.startIas)} → ${fmt(ias)} km/h · altitude ${fmt((alt??0)-(turnRun.startAlt??0),0,true)} m · avg G ${fmt(turnRun.gSum/turnRun.count,1)}`;}}
  else if(turnRun){if(turnQuietSince===null)turnQuietSince=timestamp;if(timestamp-turnQuietSince>2){turnRun=null;$('turnRun').hidden=true;}}
}

function updateLanding({timestamp,ias,vs,gearDown,flapsDown,alt}){
  const min=profile.landingIasMin??230,max=profile.landingIasMax??360;
  $('landingSpeed').textContent=fmt(ias);$('landingSink').textContent=fmt(vs,1,true);$('landingConfig').textContent=`${gearDown?'GEAR':'NO GEAR'} · ${flapsDown?'FLAPS':'CLEAN'}`;
  $('landingSpeedCue').textContent=ias===null?'no speed data':ias<min?'below profile range':ias>max?'above profile range':'within profile range';
  $('landingSinkCue').textContent=vs!==null&&vs<(profile.sinkRateWarning??-4.5)?'sink rate high':'descent monitored';
  $('landingConfigCue').textContent=gearDown?'landing gear deployed':'landing gear not deployed';
  const stable=gearDown&&ias!==null&&ias>=min&&ias<=max&&vs!==null&&vs>=(profile.sinkRateWarning??-4.5);$('landingStatus').textContent=stable?'STABLE APPROACH':'CHECK APPROACH';$('landingStatus').className=stable?'safe-text':'warning-text';
  if(previous.vs!==null&&previous.vs<-1.5&&vs!==null&&Math.abs(vs)<.8&&gearDown&&ias!==null&&ias>50){$('touchdownValue').textContent=`${fmt(previous.vs,1)} m/s`;$('touchdownCue').textContent=`touchdown detected at ${fmt(ias)} km/h`;}
}

function updateTest(ctx){
  if(test.state==='idle'||test.state==='done')return;
  const {timestamp,ias,alt,heading}=ctx;
  if(test.type==='manual'){if(test.state==='armed'){test.state='running';test.startedAt=timestamp;$('testState').textContent='RUNNING';$('armTest').textContent='Finish test';}else if(test.state==='running'){$('testResult').textContent=formatClock(timestamp-test.startedAt);$('testDetail').textContent='Manual timer running';}return;}
  if(test.type==='accel500900'){
    if(test.state==='armed'&&previous.ias!==null&&previous.ias<500&&ias>=500){test.state='running';test.startedAt=timestamp;test.startValue={alt,fuel:ctx.fuel};$('testState').textContent='RUNNING';}
    if(test.state==='running'){const elapsed=timestamp-test.startedAt;$('testResult').textContent=formatClock(elapsed);$('testDetail').textContent=`IAS ${fmt(ias)} km/h · waiting for 900`;if(ias>=900)finishTest(timestamp,`500 → 900 km/h in ${elapsed.toFixed(2)} s`,`Altitude change ${fmt((alt??0)-(test.startValue.alt??0),0,true)} m`);}
  } else if(test.type==='climb10005000'){
    if(test.state==='armed'&&previous.alt!==null&&previous.alt<1000&&alt>=1000){test.state='running';test.startedAt=timestamp;test.startValue={ias,fuel:ctx.fuel};$('testState').textContent='RUNNING';}
    if(test.state==='running'){const elapsed=timestamp-test.startedAt;$('testResult').textContent=formatClock(elapsed);$('testDetail').textContent=`Altitude ${fmt(alt)} m · waiting for 5,000`;if(alt>=5000)finishTest(timestamp,`1,000 → 5,000 m in ${formatClock(elapsed)}`,`Final IAS ${fmt(ias)} km/h`);}
  } else if(test.type==='turn'){
    if(test.state==='armed'&&Math.abs(ctx.turnRate??0)>5){test.state='running';test.startedAt=timestamp;test.lastHeading=heading;test.accumulatedTurn=0;$('testState').textContent='RUNNING';}
    if(test.state==='running'&&heading!==null&&test.lastHeading!==null){test.accumulatedTurn+=Math.abs(angleDelta(heading,test.lastHeading));test.lastHeading=heading;const elapsed=timestamp-test.startedAt;$('testResult').textContent=`${fmt(test.accumulatedTurn,0)}° / 360°`;$('testDetail').textContent=`Elapsed ${formatClock(elapsed)} · IAS ${fmt(ias)} km/h`;if(test.accumulatedTurn>=360)finishTest(timestamp,`360° turn in ${elapsed.toFixed(2)} s`,`Average rate ${(360/elapsed).toFixed(1)}°/s`);}
  }
}
function finishTest(timestamp,result,detail){test.state='done';test.result={timestamp,result,detail};$('testState').textContent='COMPLETE';$('testResult').textContent=result;$('testDetail').textContent=detail;$('armTest').textContent='Arm test';}

function renderSessionStats(){$('peakIasValue').textContent=fmt(session.peakIas);$('peakAltValue').textContent=fmt(session.peakAltitude);$('gEnvelopeValue').textContent=session.maxG===null?'—':`${fmt(session.maxG,1,true)} / ${fmt(session.minG,1,true)}`;$('peakAoaValue').textContent=fmt(session.maxAoa,1);}
function updateSession(timestamp,ias,alt,g,aoa,fuel,afterburner){session.peakIas=ias===null?session.peakIas:Math.max(session.peakIas??ias,ias);session.peakAltitude=alt===null?session.peakAltitude:Math.max(session.peakAltitude??alt,alt);session.maxG=g===null?session.maxG:Math.max(session.maxG??g,g);session.minG=g===null?session.minG:Math.min(session.minG??g,g);session.maxAoa=aoa===null?session.maxAoa:Math.max(session.maxAoa??aoa,aoa);if(session.fuelStart===null&&fuel!==null)session.fuelStart=fuel;if(session.fuelStart!==null&&fuel!==null)session.fuelUsed=Math.max(0,session.fuelStart-fuel);if(session.lastTimestamp!==null&&afterburner)session.abSeconds+=Math.max(0,Math.min(1,timestamp-session.lastTimestamp));session.lastTimestamp=timestamp;$('sessionTime').textContent=formatClock(timestamp-session.startedAt);$('abTime').textContent=formatClock(session.abSeconds);$('fuelUsed').textContent=session.fuelStart===null?'—':`${fmt(session.fuelUsed)} kg`;renderSessionStats();}

function render(payload){
  const state=payload.state||{},ind=payload.indicators||{},connected=Boolean(payload.connected),timestamp=num(payload.timestamp)??Date.now()/1000;lastPayloadAt=Date.now();
  const raw=payload.vehicle||null,vehicle=connected?prettyVehicle(raw):null;if(connected&&raw!==currentRawVehicle){currentRawVehicle=raw;currentVehicle=vehicle;resolveProfile(raw);resetSession(timestamp);} $('vehicleName').textContent=connected?vehicle:'NO AIRCRAFT DATA';$('dataStatusDot').classList.toggle('online',connected);$('dataStatusText').textContent=connected?'LIVE · 10 HZ':'WAITING FOR WAR THUNDER';
  const derived=payload.derived||{};const ias=num(pick(state,['IAS, km/h'])),alt=num(pick(state,['H, m'])),mach=num(pick(state,['M']))??num(ind.mach),vs=num(pick(state,['Vy, m/s']))??num(ind.vario),g=num(derived.g_load)??num(pick(state,['Ny','Ny, g','Ny, G','g_load','g-force']))??num(ind.g_meter),aoa=num(pick(state,['AoA, deg'])),heading=num(pick(ind,['compass','compass1','compass2'])),fuel=num(pick(state,['Mfuel, kg']))??num(ind.fuel),capacity=num(pick(state,['Mfuel0, kg']));
  $('iasValue').textContent=fmt(ias);$('altValue').textContent=fmt(alt);$('machValue').textContent=fmt(mach,2);$('vsValue').textContent=fmt(vs,1,true);$('gValue').textContent=fmt(g,2,true);$('gValue').closest('.metric-card').classList.toggle('metric-warning',Boolean(derived.g_warning));$('aoaValue').textContent=fmt(aoa,1,true);
  const motion=calculateMotion(timestamp,ias,heading),energy=calculateEnergy(timestamp,ias,alt),fuelData=calculateFuel(timestamp,fuel);$('accelValue').textContent=fmt(motion.acceleration,1,true);$('turnRateValue').textContent=fmt(motion.turnRate,1,true);$('turnTimeValue').textContent=motion.turnRate&&Math.abs(motion.turnRate)>.5?`${fmt(360/Math.abs(motion.turnRate),1)} s`:'—';
  const energyTone=energy.trend===null?'CALCULATING':energy.trend>12?'RISING':energy.trend<-12?'FALLING':'STABLE';$('energyTrend').textContent=energyTone;$('energyTrend').className=energyTone==='RISING'?'safe-text':energyTone==='FALLING'?'warning-text':'';$('energyDelta').textContent=energy.trend===null?'specific energy':`${fmt(energy.trend,1,true)} m/s`;$('energyTrendLabel').textContent=energy.value===null?'—':`${fmt(energy.value)} m E`;
  const fuelPct=fuel!==null&&capacity?clamp(fuel/capacity*100,0,100):null;$('fuelValue').textContent=fmt(fuel);$('fuelPercent').textContent=fuelPct===null?'—':`${fmt(fuelPct)}%`;$('fuelBar').style.width=`${fuelPct??0}%`;$('fuelBar').className=fuelPct!==null&&fuelPct<=(profile.fuelCriticalPct??15)?'low':fuelPct!==null&&fuelPct<=(profile.fuelReservePct??25)?'reserve':'';$('fuelTime').textContent=formatDuration(fuelData.endurance);$('fuelFlowSummary').textContent=fuelData.flow===null?'CALCULATING':`${fmt(fuelData.flow,1)} kg/min`;const reserveMass=capacity!==null?capacity*(profile.fuelReservePct??25)/100:null;$('reserveTime').textContent=fuelData.flow&&fuel!==null&&reserveMass!==null?formatDuration(Math.max(0,fuel-reserveMass)/(fuelData.flow/60)):'—';
  const flapsRaw=num(pick(state,['flaps, %'])),gearRaw=num(ind.gears??ind.gears1),airRaw=num(ind.airbrake_indicator??ind.airbrake_lever),sweep=pick(ind,['wing_sweep_lever','wing_sweep_indicator']);const flapsState=flapsRaw===null?percentState(ind.flaps,100):percentState(flapsRaw),gearState=percentState(gearRaw,100),airState=percentState(airRaw,100),sweepNum=num(sweep),sweepState=sweepNum===null?(sweep===null?'—':String(sweep)):Math.abs(sweepNum)<=1.01?`${fmt(sweepNum*100)}%`:`${fmt(sweepNum)}°`;const gearDown=stateActive(gearState),flapsDown=stateActive(flapsState),airbrakeDown=stateActive(airState);[['gearValue',gearState],['flapsValue',flapsState],['airbrakeValue',airState],['sweepValue',sweepState]].forEach(([id,value])=>{$(id).textContent=value;setStateClass($(id),value);});
  const engines=engineTelemetry(state),engineState=renderEngines(engines),afterburner=engines.some(e=>e.throttle!==null&&e.throttle>100);const phase=detectPhase({connected,ias,alt,vs,g,aoa,gearDown,turnRate:motion.turnRate});$('phaseBadge').textContent=phase;$('phaseBadge').dataset.phase=phase.toLowerCase();setModePanels(phase);
  const ctx={connected,timestamp,ias,alt,vs,g,gWarning:Boolean(derived.g_warning),gWarningValue:num(derived.g_warning_value),aoa,heading,fuel,fuelPct,gearDown,flapsDown,airbrakeDown,afterburner,engineWarning:engineState.warning,turnRate:motion.turnRate,phase};renderAdvisories(ctx);updateTurnRun(timestamp,motion.turnRate,ias,alt,g,aoa,heading);updateLanding(ctx);updateTest(ctx);if(connected)updateSession(timestamp,ias,alt,g,aoa,fuel,afterburner);else $('sessionTime').textContent='00:00';charts.ias.push(ias);charts.alt.push(alt);charts.energy.push(energy.value);previous={ias,alt,vs,timestamp,gearDown};
}

function connect(){clearTimeout(reconnectTimer);const protocol=location.protocol==='https:'?'wss:':'ws:';const socket=new WebSocket(`${protocol}//${location.host}/ws/telemetry`);socket.addEventListener('message',e=>{try{render(JSON.parse(e.data));}catch(err){console.error(err);}});socket.addEventListener('close',()=>{$('dataStatusDot').classList.remove('online');$('dataStatusText').textContent='RECONNECTING';reconnectTimer=setTimeout(connect,1500);});socket.addEventListener('error',()=>socket.close());}

document.querySelectorAll('.mode-tabs button').forEach(button=>button.addEventListener('click',()=>{selectedMode=button.dataset.mode;setModePanels($('phaseBadge').textContent||'STANDBY');}));
$('resetSession').addEventListener('click',()=>resetSession());
$('testType').addEventListener('change',e=>{test={state:'idle',type:e.target.value,startedAt:null,startValue:null,accumulatedTurn:0,lastHeading:null,result:null};$('testState').textContent='IDLE';$('testResult').textContent='Select and arm a test';$('testDetail').textContent='ThunderScope will detect the start and finish thresholds automatically.';$('armTest').textContent='Arm test';});
$('armTest').addEventListener('click',()=>{if(test.type==='manual'&&test.state==='running'){finishTest(Date.now()/1000,`Manual run ${formatClock(Date.now()/1000-test.startedAt)}`,'Completed manually');return;}test.state='armed';test.startedAt=null;test.startValue=null;test.accumulatedTurn=0;test.lastHeading=null;$('testState').textContent='ARMED';$('testResult').textContent='Waiting for start threshold';$('testDetail').textContent=test.type==='accel500900'?'Cross 500 km/h while accelerating':test.type==='climb10005000'?'Climb upward through 1,000 m':test.type==='turn'?'Begin a sustained turn':'Timer will start immediately';if(test.type==='manual')$('armTest').textContent='Start timer';});
$('resetTest').addEventListener('click',()=>{$('testType').dispatchEvent(new Event('change'));});
setInterval(()=>{if(lastPayloadAt&&Date.now()-lastPayloadAt>2500){$('dataStatusText').textContent='TELEMETRY STALE';$('dataStatusDot').classList.remove('online');}},1000);
loadSettings().then(connect);window.addEventListener('resize',()=>Object.values(charts).forEach(c=>c.draw()));
