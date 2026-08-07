const $=id=>document.getElementById(id);let settings=null,currentVehicle=null,audioInfo=null;
const fieldNames=['fuelReservePct','fuelCriticalPct','jokerFuelPct','landingIasMin','landingIasMax','sinkRateWarning','sinkRateMaxIas','highAoADeg','stallAoADeg','gCaution','highG','lowG','gearOverspeedKmh','flapOverspeedKmh','engineMismatchPct','overspeedKmh','approachCheckMaxIas','positiveRateMps','dontSinkMps','hardLandingMps','energyLowIasKmh','energyLowDecelKmhS','speedbrakeThrottlePct','engineOilTempWarningC','engineWaterTempWarningC','engineHeadTempWarningC','oilPressureDropPct','engineFailureDropPct','engineFailureThrottlePct'];
const toggles=['alertsEnabled','alertLowFuel','alertJokerFuel','alertGCaution','alertHighG','alertHighAoA','alertStall','alertMachOne','alertSinkRate','alertGearOverspeed','alertFlapOverspeed','alertEngineMismatch','alertEngineTemperature','alertOilPressure','alertEngineFailure','alertCheckGear','alertCheckFlaps','alertCheckAfterburner','alertPositiveRate','alertDontSink','alertHardLanding','alertSpeedbrake','alertOverspeed','alertEnergyLow','alertTelemetryStale','alertTelemetryRestored'];
const audioDefaults={enabled:true,preferCustomWav:true,voice:'',rate:-1,volume:90,repeatCooldownSeconds:12,minimumGapSeconds:1,suppressWhenStationary:true,stationarySpeedKmh:.5,announceControlChanges:true,radioChatterEnabled:false,radioChatterSource:'vaicom',radioChatterVaicomTheme:'Navy',radioChatterContextAware:true,radioChatterOnlyAirborne:true,radioChatterMinSeconds:45,radioChatterMaxSeconds:120,radioChatterQuietAfterWarningSeconds:10,radioChatterMinimumIasKmh:80,radioChatterMixWithWarnings:true,radioChatterVolume:50};
function selectedObject(){const key=$('profileSelect').value;return key==='__default__'?settings.defaults:(settings.profiles[key]??={});}
function populate(){
  const source={...settings.defaults,...selectedObject()};
  fieldNames.forEach(name=>{const el=document.querySelector(`[name="${name}"]`);el.value=source[name]??'';});
  toggles.forEach(name=>{document.querySelector(`[name="${name}"]`).checked=source[name]!==false;});
  document.querySelectorAll('[data-display]').forEach(el=>{const key=el.dataset.display;if(el.type==='checkbox')el.checked=settings.display[key]!==false;else el.value=settings.display[key]??'';});
  settings.audio={...audioDefaults,...(settings.audio||{})};
  document.querySelectorAll('[data-audio]').forEach(el=>{const key=el.dataset.audio;if(el.type==='checkbox')el.checked=settings.audio[key]!==false;else el.value=settings.audio[key]??'';});
  $('deleteProfile').disabled=$('profileSelect').value==='__default__';
}
function rebuildProfiles(){const select=$('profileSelect'),chosen=select.value;select.innerHTML='<option value="__default__">Default profile</option>'+Object.keys(settings.profiles).map(key=>`<option value="${key}">${key.replaceAll('_',' ')}</option>`).join('');if([...select.options].some(o=>o.value===chosen))select.value=chosen;populate();}
function collect(){
  const target=selectedObject();
  fieldNames.forEach(name=>target[name]=Number(document.querySelector(`[name="${name}"]`).value));
  toggles.forEach(name=>target[name]=document.querySelector(`[name="${name}"]`).checked);
  document.querySelectorAll('[data-display]').forEach(el=>settings.display[el.dataset.display]=el.type==='checkbox'?el.checked:Number(el.value));
  settings.audio={...audioDefaults,...(settings.audio||{})};
  document.querySelectorAll('[data-audio]').forEach(el=>{const key=el.dataset.audio;settings.audio[key]=el.type==='checkbox'?el.checked:(el.tagName==='SELECT'?el.value:Number(el.value));});
}
async function save(){collect();const response=await fetch('/api/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(settings)});if(!response.ok)throw new Error('save failed');settings=await response.json();$('saveState').textContent='Saved for monitor, tablet and host audio.';setTimeout(()=>$('saveState').textContent='',2500);}
async function loadAudioInfo(){
  try{
    audioInfo=await fetch('/api/audio/status',{cache:'no-store'}).then(r=>r.json());
    const select=$('audioVoice'),chosen=settings?.audio?.voice||'';
    select.innerHTML='<option value="">System default</option>'+(audioInfo.voices||[]).map(name=>`<option value="${name.replaceAll('"','&quot;')}">${name}</option>`).join('');
    select.value=[...select.options].some(o=>o.value===chosen)?chosen:'';
    const audioBackendReady=Boolean(audioInfo.wav_backend||audioInfo.tts_backend);$('audioStatus').textContent=audioInfo.supported?(audioInfo.last_error?'CHECK AUDIO':(audioBackendReady?'HOST READY':'INSTALL AUDIO')):'UNSUPPORTED';
    $('audioStatus').classList.toggle('warning',Boolean(audioInfo.last_error)||!audioInfo.supported||!audioBackendReady);
    if(audioInfo.last_error)$('audioTestState').textContent=audioInfo.last_error;
    const chatter=audioInfo.radio_chatter||{},counts=chatter.categories||{},themes=chatter.vaicom_themes||{};
    $('chatterStatus').textContent=`${chatter.total_clips||0} CLIPS`;
    $('chatterStatus').classList.toggle('warning',!(chatter.total_clips>0));
    const themeSelect=$('vaicomTheme'),selected=settings?.audio?.radioChatterVaicomTheme||'Navy';
    const themeNames=Object.keys(themes);
    themeSelect.innerHTML=(themeNames.length?themeNames:['Navy']).map(name=>`<option value="${name.replaceAll('"','&quot;')}">${name}${themes[name]?` (${themes[name]})`:''}</option>`).join('');
    themeSelect.value=[...themeSelect.options].some(option=>option.value===selected)?selected:themeSelect.options[0]?.value||'Navy';
    settings.audio.radioChatterVaicomTheme=themeSelect.value;
    const crewText=Object.entries(counts).filter(([,count])=>count).map(([name,count])=>`${name} ${count}`).join(' · ');
    const vaicomText=Object.entries(themes).filter(([,count])=>count).map(([name,count])=>`${name} ${count}`).join(' · ');
    $('chatterTestState').textContent=chatter.total_clips>0
      ? `Crew ${chatter.crew_total_clips||0}${crewText?` (${crewText})`:''} · VAICOM ${chatter.vaicom_total_clips||0}${vaicomText?` (${vaicomText})`:''}`
      : 'No chatter clips installed. Run the VAICOM importer for your OS or add crew WAV files.';
  }catch{$('audioStatus').textContent='UNAVAILABLE';$('audioStatus').classList.add('warning');}
}
async function load(){settings=await fetch('/api/settings',{cache:'no-store'}).then(r=>r.json());settings.audio={...audioDefaults,...(settings.audio||{})};try{const health=await fetch('/api/health',{cache:'no-store'}).then(r=>r.json());currentVehicle=health.vehicle;}catch{}rebuildProfiles();await loadAudioInfo();populate();}
$('profileSelect').addEventListener('change',populate);
$('settingsForm').addEventListener('submit',e=>{e.preventDefault();save().catch(()=>$('saveState').textContent='Unable to save settings.');});
$('newProfile').addEventListener('click',()=>{const key=currentVehicle||prompt('Enter the exact aircraft profile name:');if(!key)return;settings.profiles[key]={...settings.defaults};rebuildProfiles();$('profileSelect').value=key;populate();});
$('deleteProfile').addEventListener('click',()=>{const key=$('profileSelect').value;if(key==='__default__')return;delete settings.profiles[key];$('profileSelect').value='__default__';rebuildProfiles();});
$('exportSettings').addEventListener('click',()=>{collect();const blob=new Blob([JSON.stringify(settings,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='thunderscope-settings.json';a.click();URL.revokeObjectURL(a.href);});
$('importSettings').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const imported=JSON.parse(await file.text());if(!imported.defaults||!imported.profiles)throw new Error();settings={...imported,audio:{...audioDefaults,...(imported.audio||{})},display:imported.display||{}};rebuildProfiles();await loadAudioInfo();populate();$('saveState').textContent='Imported. Press Save settings to apply.';}catch{$('saveState').textContent='That file is not a valid ThunderScope settings export.';}});
$('testAudio').addEventListener('click',async()=>{
  collect();
  $('audioTestState').textContent='Saving audio settings…';
  try{
    await save();
    const response=await fetch('/api/audio/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phrase:'ThunderScope voice alert test.'})});
    if(!response.ok)throw new Error();
    $('audioTestState').textContent='Test queued on the host PC.';
    setTimeout(loadAudioInfo,1800);
  }catch{$('audioTestState').textContent='Unable to queue the host voice test.';}
});

$('testChatter').addEventListener('click',async()=>{
  collect();
  $('chatterTestState').textContent='Saving settings and selecting a clip…';
  try{
    await save();
    const response=await fetch('/api/audio/chatter/test',{method:'POST'});
    const result=await response.json();
    if(!response.ok)throw new Error(result.detail||'No clips found');
    $('chatterTestState').textContent=`Queued ${result.file} (${result.category}) on the host PC.`;
    setTimeout(loadAudioInfo,1800);
  }catch(error){$('chatterTestState').textContent=error.message||'Unable to queue radio chatter.';}
});

load().catch(()=>$('saveState').textContent='Unable to load settings.');

$('testBettyCue').addEventListener('click',async()=>{
  collect();
  const key=$('bettyCueSelect').value;
  $('audioTestState').textContent='Saving settings and queueing selected cue…';
  try{
    await save();
    const response=await fetch('/api/audio/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key})});
    const result=await response.json();
    if(!response.ok)throw new Error(result.detail||'Unable to queue cue');
    $('audioTestState').textContent=`Queued ${result.phrase}${result.custom_wav?' using bundled WAV.':' using host TTS.'}`;
    setTimeout(loadAudioInfo,1800);
  }catch(error){$('audioTestState').textContent=error.message||'Unable to queue selected cue.';}
});
