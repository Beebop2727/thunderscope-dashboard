from __future__ import annotations

import asyncio
import json
import logging
import math
import os
import socket
import sqlite3
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import httpx
import uvicorn
from fastapi import Body, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from host_audio import ALERT_DEFINITIONS, HostAudioService
from telemetry_values import GPeakMonitor, extract_g_load

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
DB_PATH = DATA_DIR / "thunderscope.db"
SETTINGS_PATH = DATA_DIR / "settings.json"
NAVIGATION_PATH = DATA_DIR / "navigation.json"
WT_BASE_URL = os.getenv("WT_BASE_URL", "http://127.0.0.1:8111").rstrip("/")
POLL_INTERVAL = max(0.025, float(os.getenv("POLL_INTERVAL", "0.05")))
TELEMETRY_STREAM_INTERVAL = max(0.05, float(os.getenv("TELEMETRY_STREAM_INTERVAL", "0.10")))
MAP_OBJECT_POLL_INTERVAL = max(0.05, float(os.getenv("MAP_OBJECT_POLL_INTERVAL", "0.10")))
MAP_INFO_POLL_INTERVAL = max(0.5, float(os.getenv("MAP_INFO_POLL_INTERVAL", "1.0")))
MAP_STREAM_INTERVAL = max(0.05, float(os.getenv("MAP_STREAM_INTERVAL", "0.10")))
SESSION_SAMPLE_INTERVAL = max(0.5, float(os.getenv("SESSION_SAMPLE_INTERVAL", "1.0")))
DISCONNECT_GRACE_SECONDS = 8.0

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger("thunderscope")
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

DEFAULT_NAVIGATION: dict[str, Any] = {
    "version": 1,
    "revision": 0,
    "map_generation": None,
    "active": False,
    "active_index": 0,
    "auto_advance": True,
    "arrival_radius_m": 750,
    "points": [],
}


DEFAULT_SETTINGS: dict[str, Any] = {
    "version": 11,
    "defaults": {
        "fuelReservePct": 25,
        "fuelCriticalPct": 15,
        "jokerFuelPct": 35,
        "highAoADeg": 18,
        "stallAoADeg": 22,
        "highG": 8.0,
        "gCaution": 4.0,
        "lowG": -3.0,
        "sinkRateWarning": -4.5,
        "sinkRateMaxIas": 500,
        "gearOverspeedKmh": 450,
        "flapOverspeedKmh": 500,
        "landingIasMin": 230,
        "landingIasMax": 360,
        "engineMismatchPct": 18,
        "overspeedKmh": 1300,
        "approachCheckMaxIas": 420,
        "positiveRateMps": 2.0,
        "dontSinkMps": -2.0,
        "takeoffWarningWindowSeconds": 20.0,
        "hardLandingMps": -6.0,
        "energyLowIasKmh": 350,
        "energyLowDecelKmhS": -8.0,
        "speedbrakeThrottlePct": 80,
        "engineOilTempWarningC": 120,
        "engineWaterTempWarningC": 120,
        "engineHeadTempWarningC": 260,
        "oilPressureDropPct": 35,
        "engineFailureDropPct": 20,
        "engineFailureThrottlePct": 55,
        "alertsEnabled": True,
        "alertLowFuel": True,
        "alertJokerFuel": True,
        "alertHighG": True,
        "alertGCaution": True,
        "alertHighAoA": True,
        "alertStall": True,
        "alertMachOne": True,
        "alertSinkRate": True,
        "alertGearOverspeed": True,
        "alertFlapOverspeed": True,
        "alertEngineMismatch": True,
        "alertEngineTemperature": True,
        "alertOilPressure": True,
        "alertEngineFailure": True,
        "alertCheckGear": True,
        "alertCheckFlaps": True,
        "alertCheckAfterburner": True,
        "alertPositiveRate": True,
        "alertDontSink": True,
        "alertHardLanding": True,
        "alertSpeedbrake": True,
        "alertOverspeed": False,
        "alertEnergyLow": False,
        "alertTelemetryStale": True,
        "alertTelemetryRestored": True,
    },
    "profiles": {},
    "display": {
        "autoFlightPhase": True,
        "compactEngineNormal": True,
        "mapAlerts": True,
        "mapAlertDurationSeconds": 4,
        "theme": "dark",
    },
    "audio": {
        "enabled": True,
        "preferCustomWav": True,
        "voice": "",
        "rate": -1,
        "volume": 90,
        "repeatCooldownSeconds": 12.0,
        "minimumGapSeconds": 1.0,
        "suppressWhenStationary": True,
        "stationarySpeedKmh": 0.5,
        "announceControlChanges": True,
        "radioChatterEnabled": False,
        "radioChatterSource": "vaicom",
        "radioChatterVaicomTheme": "Navy",
        "radioChatterContextAware": True,
        "radioChatterOnlyAirborne": True,
        "radioChatterMinSeconds": 45.0,
        "radioChatterMaxSeconds": 120.0,
        "radioChatterQuietAfterWarningSeconds": 10.0,
        "radioChatterMinimumIasKmh": 80.0,
        "radioChatterMixWithWarnings": True,
        "radioChatterVolume": 50,
    },
}


def deep_copy(value: Any) -> Any:
    return json.loads(json.dumps(value))


def load_settings() -> dict[str, Any]:
    if not SETTINGS_PATH.exists():
        SETTINGS_PATH.write_text(json.dumps(DEFAULT_SETTINGS, indent=2), encoding="utf-8")
        return deep_copy(DEFAULT_SETTINGS)
    try:
        loaded=json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
        if not isinstance(loaded,dict): raise ValueError("settings root must be an object")
        version=loaded.get("version") if isinstance(loaded.get("version"),int) else 1
        merged=deep_copy(DEFAULT_SETTINGS)
        for section in ("defaults","display","audio"):
            if isinstance(loaded.get(section),dict): merged[section].update(loaded[section])
        if isinstance(loaded.get("profiles"),dict): merged["profiles"]=loaded["profiles"]
        if version < 4:
            if merged["defaults"].get("highG") in (8.5, 7.5):
                merged["defaults"]["highG"] = 6.5
            for profile in merged["profiles"].values():
                if isinstance(profile, dict) and profile.get("highG") in (8.5, 7.5):
                    profile["highG"] = 6.5
        if version < 5:
            if merged["defaults"].get("highG") in (6.5, 7.5, 8.5):
                merged["defaults"]["highG"] = 8.0
            if merged["defaults"].get("sinkRateWarning") == -8:
                merged["defaults"]["sinkRateWarning"] = -4.5
            for profile in merged["profiles"].values():
                if not isinstance(profile, dict):
                    continue
                if profile.get("highG") in (6.5, 7.5, 8.5):
                    profile["highG"] = 8.0
                if profile.get("sinkRateWarning") == -8:
                    profile["sinkRateWarning"] = -4.5
            if merged["audio"].get("minimumGapSeconds") == 0.6:
                merged["audio"]["minimumGapSeconds"] = 1.0
        if version < 6 and merged["audio"].get("stationarySpeedKmh") == 1.0:
            merged["audio"]["stationarySpeedKmh"] = 0.5
        merged["version"] = 11
        return merged
    except (OSError,ValueError,json.JSONDecodeError):
        logger.exception("Settings file could not be read; using defaults")
        return deep_copy(DEFAULT_SETTINGS)

def save_settings(settings: dict[str, Any]) -> None:
    temp = SETTINGS_PATH.with_suffix(".tmp")
    temp.write_text(json.dumps(settings, indent=2), encoding="utf-8")
    temp.replace(SETTINGS_PATH)



def _finite_coordinate(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number) or number < 0.0 or number > 1.0:
        return None
    return round(number, 7)


def sanitise_navigation(payload: Any, revision: int | None = None) -> dict[str, Any]:
    if not isinstance(payload, dict):
        payload = {}
    result = deep_copy(DEFAULT_NAVIGATION)
    result["map_generation"] = (
        str(payload.get("map_generation"))[:80]
        if payload.get("map_generation") is not None
        else None
    )
    result["active"] = bool(payload.get("active", False))
    result["auto_advance"] = bool(payload.get("auto_advance", True))
    try:
        result["arrival_radius_m"] = int(
            max(100, min(5000, float(payload.get("arrival_radius_m", 750))))
        )
    except (TypeError, ValueError):
        result["arrival_radius_m"] = 750

    points: list[dict[str, Any]] = []
    raw_points = payload.get("points", [])
    if isinstance(raw_points, list):
        for raw in raw_points[:32]:
            if not isinstance(raw, dict):
                continue
            x = _finite_coordinate(raw.get("x"))
            y = _finite_coordinate(raw.get("y"))
            if x is None or y is None:
                continue
            role = str(raw.get("role") or "waypoint").lower()
            if role not in {"waypoint", "target", "home", "divert"}:
                role = "waypoint"
            kind = str(raw.get("kind") or "custom").lower()[:24]
            point: dict[str, Any] = {
                "id": str(raw.get("id") or uuid.uuid4().hex)[:64],
                "name": str(raw.get("name") or role.title())[:48],
                "role": role,
                "kind": kind,
                "x": x,
                "y": y,
            }
            runway = raw.get("runway")
            if isinstance(runway, dict):
                sx = _finite_coordinate(runway.get("sx"))
                sy = _finite_coordinate(runway.get("sy"))
                ex = _finite_coordinate(runway.get("ex"))
                ey = _finite_coordinate(runway.get("ey"))
                if None not in (sx, sy, ex, ey):
                    point["runway"] = {"sx": sx, "sy": sy, "ex": ex, "ey": ey}
            points.append(point)
    result["points"] = points
    try:
        active_index = int(payload.get("active_index", 0))
    except (TypeError, ValueError):
        active_index = 0
    result["active_index"] = max(0, min(active_index, max(0, len(points) - 1)))
    result["active"] = result["active"] and bool(points)
    result["revision"] = int(revision if revision is not None else payload.get("revision", 0) or 0)
    return result


def load_navigation() -> dict[str, Any]:
    if not NAVIGATION_PATH.exists():
        return deep_copy(DEFAULT_NAVIGATION)
    try:
        return sanitise_navigation(json.loads(NAVIGATION_PATH.read_text(encoding="utf-8")))
    except (OSError, ValueError, json.JSONDecodeError):
        logger.exception("Navigation plan could not be read; using an empty plan")
        return deep_copy(DEFAULT_NAVIGATION)


def save_navigation(navigation: dict[str, Any]) -> None:
    temp = NAVIGATION_PATH.with_suffix(".tmp")
    temp.write_text(json.dumps(navigation, indent=2), encoding="utf-8")
    temp.replace(NAVIGATION_PATH)


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                started_at REAL NOT NULL,
                ended_at REAL NOT NULL,
                vehicle TEXT,
                duration REAL NOT NULL,
                summary_json TEXT NOT NULL,
                samples_json TEXT NOT NULL,
                path_json TEXT NOT NULL
            )
            """
        )
        db.execute("CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at DESC)")
        db.commit()


def lan_ipv4_addresses() -> list[str]:
    addresses: set[str] = set()
    try:
        hostname = socket.gethostname()
        for result in socket.getaddrinfo(hostname, None, socket.AF_INET):
            address = result[4][0]
            if not address.startswith(("127.", "169.254.")):
                addresses.add(address)
    except OSError:
        pass
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("1.1.1.1", 80))
            address = sock.getsockname()[0]
            if not address.startswith("127."):
                addresses.add(address)
    except OSError:
        pass
    return sorted(addresses)


def numeric(value: Any) -> float | None:
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def pick(obj: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in obj and obj[key] is not None:
            return obj[key]
    return None


class SessionRecorder:
    def __init__(self) -> None:
        self.active: dict[str, Any] | None = None
        self.disconnected_at: float | None = None
        self.last_sample_at = 0.0
        self.last_map_at = 0.0
        self.last_speed: tuple[float, float] | None = None

    def start(self, snapshot: dict[str, Any]) -> None:
        now = snapshot["timestamp"]
        state = snapshot.get("state", {})
        fuel = numeric(pick(state, "Mfuel, kg"))
        self.active = {
            "id": uuid.uuid4().hex,
            "vehicle": snapshot.get("vehicle"),
            "started_at": now,
            "last_at": now,
            "samples": [],
            "path": [],
            "summary": {
                "peak_ias": None,
                "peak_altitude": None,
                "max_g": None,
                "min_g": None,
                "max_aoa": None,
                "peak_climb": None,
                "fuel_start": fuel,
                "fuel_end": fuel,
                "afterburner_seconds": 0.0,
                "distance_km": 0.0,
            },
        }
        self.last_sample_at = 0.0
        self.last_map_at = 0.0
        self.last_speed = None
        logger.info("Session started: %s (%s)", self.active["id"], self.active["vehicle"])

    def update(self, snapshot: dict[str, Any]) -> None:
        if not snapshot.get("connected"):
            if self.active and self.disconnected_at is None:
                self.disconnected_at = snapshot["timestamp"]
            return

        self.disconnected_at = None
        vehicle = snapshot.get("vehicle")
        if self.active and vehicle and vehicle != self.active.get("vehicle"):
            self.finish(snapshot["timestamp"])
        if not self.active:
            self.start(snapshot)

        assert self.active is not None
        now = snapshot["timestamp"]
        self.active["last_at"] = now
        state = snapshot.get("state", {})
        indicators = snapshot.get("indicators", {})
        ias = numeric(pick(state, "IAS, km/h"))
        altitude = numeric(pick(state, "H, m"))
        g_load = numeric(snapshot.get("derived", {}).get("g_load"))
        if g_load is None:
            g_load, _ = extract_g_load(state, indicators)
        aoa = numeric(pick(state, "AoA, deg"))
        climb = numeric(pick(state, "Vy, m/s")) or numeric(pick(indicators, "vario"))
        fuel = numeric(pick(state, "Mfuel, kg")) or numeric(pick(indicators, "fuel"))
        heading = numeric(pick(indicators, "compass", "compass1", "compass2"))
        throttles = [numeric(state.get(f"throttle {idx}, %")) for idx in range(1, 9)]
        afterburner = any(value is not None and value > 100 for value in throttles)

        summary = self.active["summary"]
        for key, value, mode in (
            ("peak_ias", ias, "max"),
            ("peak_altitude", altitude, "max"),
            ("max_g", g_load, "max"),
            ("min_g", g_load, "min"),
            ("max_aoa", aoa, "max"),
            ("peak_climb", climb, "max"),
        ):
            if value is None:
                continue
            current = summary[key]
            summary[key] = value if current is None else (max(current, value) if mode == "max" else min(current, value))
        if fuel is not None:
            summary["fuel_end"] = fuel

        if self.last_speed and ias is not None:
            previous_time, previous_ias = self.last_speed
            elapsed = max(0.0, min(2.0, now - previous_time))
            average_ms = ((previous_ias + ias) / 2) / 3.6
            summary["distance_km"] += average_ms * elapsed / 1000
            if afterburner:
                summary["afterburner_seconds"] += elapsed
        if ias is not None:
            self.last_speed = (now, ias)

        if now - self.last_sample_at >= SESSION_SAMPLE_INTERVAL:
            self.last_sample_at = now
            self.active["samples"].append(
                {
                    "t": round(now - self.active["started_at"], 2),
                    "ias": ias,
                    "alt": altitude,
                    "g": g_load,
                    "aoa": aoa,
                    "vs": climb,
                    "fuel": fuel,
                    "hdg": heading,
                    "ab": afterburner,
                }
            )

    def add_map_objects(self, objects: list[dict[str, Any]], timestamp: float) -> None:
        if not self.active or timestamp - self.last_map_at < 1.0:
            return
        self.last_map_at = timestamp
        player = next(
            (
                obj for obj in objects
                if str(obj.get("icon", "")).lower() == "player"
                or obj.get("is_player") is True
                or obj.get("player") is True
            ),
            None,
        )
        if not player:
            return
        x, y = numeric(player.get("x")), numeric(player.get("y"))
        if x is None or y is None:
            return
        self.active["path"].append({"t": round(timestamp - self.active["started_at"], 2), "x": x, "y": y})

    def maybe_finish(self, now: float) -> None:
        if self.active and self.disconnected_at is not None and now - self.disconnected_at >= DISCONNECT_GRACE_SECONDS:
            self.finish(self.active.get("last_at", now))
            self.disconnected_at = None

    def finish(self, ended_at: float | None = None) -> None:
        if not self.active:
            return
        active = self.active
        ended = ended_at or time.time()
        duration = max(0.0, ended - active["started_at"])
        summary = active["summary"]
        start_fuel, end_fuel = summary.get("fuel_start"), summary.get("fuel_end")
        summary["fuel_used"] = max(0.0, start_fuel - end_fuel) if start_fuel is not None and end_fuel is not None else None
        summary["duration"] = duration
        with sqlite3.connect(DB_PATH) as db:
            db.execute(
                "INSERT OR REPLACE INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    active["id"],
                    active["started_at"],
                    ended,
                    active.get("vehicle"),
                    duration,
                    json.dumps(summary, separators=(",", ":")),
                    json.dumps(active["samples"], separators=(",", ":")),
                    json.dumps(active["path"], separators=(",", ":")),
                ),
            )
            db.commit()
        logger.info("Session saved: %s (%.1fs, %d samples)", active["id"], duration, len(active["samples"]))
        self.active = None
        self.last_speed = None


class TelemetryHub:
    def __init__(self) -> None:
        self.client=None
        self.latest={"connected":False,"timestamp":time.time(),"vehicle":None,"state":{},"indicators":{},"errors":["starting"]}
        self.latest_objects=[]; self.latest_map_info={}; self.map_sequence=0
        self.recorder=SessionRecorder(); self.g_monitor=GPeakMonitor()
        self.task=None; self.map_task=None; self._stop=asyncio.Event()
    async def start(self,client):
        self.client=client; self._stop.clear()
        self.task=asyncio.create_task(self.run(),name="thunderscope-telemetry-hub")
        self.map_task=asyncio.create_task(self.run_map(),name="thunderscope-map-hub")
    async def stop(self):
        self._stop.set(); tasks=[t for t in (self.task,self.map_task) if t]
        for t in tasks: t.cancel()
        for t in tasks:
            try: await t
            except asyncio.CancelledError: pass
        self.recorder.finish()
    async def get_json(self,endpoint):
        response=await self.client.get(f"{WT_BASE_URL}{endpoint}"); response.raise_for_status(); return response.json()
    async def snapshot(self):
        async def get(endpoint):
            try: return await self.get_json(endpoint)
            except Exception as exc: return exc
        sr,ir=await asyncio.gather(get("/state"),get("/indicators"))
        state=sr if isinstance(sr,dict) else {}; indicators=ir if isinstance(ir,dict) else {}
        errors=[]
        if isinstance(sr,Exception): errors.append(f"state: {type(sr).__name__}")
        if isinstance(ir,Exception): errors.append(f"indicators: {type(ir).__name__}")
        return {"connected":bool(state.get("valid") or indicators.get("valid")),"timestamp":time.time(),"vehicle":indicators.get("type") or state.get("type"),"state":state,"indicators":indicators,"errors":errors}
    async def run_map(self):
        next_info=0.0
        while not self._stop.is_set():
            started=time.monotonic(); now=time.time()
            try:
                if now>=next_info:
                    objects,info=await asyncio.gather(self.get_json("/map_obj.json"),self.get_json("/map_info.json"),return_exceptions=True); next_info=now+MAP_INFO_POLL_INTERVAL
                else: objects=await self.get_json("/map_obj.json"); info=None
                if isinstance(objects,list): self.latest_objects=objects; self.map_sequence+=1; self.recorder.add_map_objects(objects,now)
                if isinstance(info,dict): self.latest_map_info=info
            except Exception as exc: logger.debug("Map poll failed: %s",exc)
            await asyncio.sleep(max(0.01,MAP_OBJECT_POLL_INTERVAL-(time.monotonic()-started)))
    async def run(self):
        while not self._stop.is_set():
            started=time.monotonic()
            try:
                self.latest=await self.snapshot(); settings=self.audio_settings() if getattr(self,"audio_settings",None) else DEFAULT_SETTINGS
                profile=dict(settings.get("defaults",{})); vehicle=self.latest.get("vehicle")
                if vehicle: profile.update(settings.get("profiles",{}).get(vehicle,{}))
                self.latest["derived"]=self.g_monitor.update(self.latest["timestamp"],bool(self.latest.get("connected")),self.latest.get("state",{}),self.latest.get("indicators",{}),float(profile.get("highG",8.0)),float(profile.get("lowG",-3.0)))
                self.recorder.update(self.latest); self.recorder.maybe_finish(self.latest["timestamp"]); host_audio.process(self.latest,settings)
            except Exception as exc: logger.warning("Telemetry poll failed: %s",exc)
            await asyncio.sleep(max(0.02,POLL_INTERVAL-(time.monotonic()-started)))

hub = TelemetryHub()
host_audio = HostAudioService(BASE_DIR, logger)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    app.state.settings = load_settings()
    app.state.navigation = load_navigation()
    hub.audio_settings = lambda: app.state.settings
    await host_audio.start(app.state.settings)
    app.state.client = httpx.AsyncClient(
        timeout=httpx.Timeout(1.5, connect=0.5),
        limits=httpx.Limits(max_connections=24, max_keepalive_connections=12),
        headers={"User-Agent": "ThunderScope/0.11.0"},
    )
    await hub.start(app.state.client)
    logger.info("War Thunder source: %s", WT_BASE_URL)
    yield
    await hub.stop()
    await host_audio.stop()
    await app.state.client.aclose()


app = FastAPI(
    title="ThunderScope",
    description="Local War Thunder telemetry, tactical-map and flight-analysis dashboard",
    version="0.11.0",
    lifespan=lifespan,
)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, max-age=0"
        response.headers["Pragma"] = "no-cache"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response


def page(name: str) -> FileResponse:
    return FileResponse(STATIC_DIR / name, media_type="text/html")


@app.get("/", response_class=HTMLResponse)
async def home() -> FileResponse:
    return page("index.html")


@app.get("/map", response_class=HTMLResponse)
async def map_page() -> FileResponse:
    return page("map.html")


@app.get("/data", response_class=HTMLResponse)
async def data_page() -> FileResponse:
    return page("data.html")


@app.get("/reports", response_class=HTMLResponse)
async def reports_page() -> FileResponse:
    return page("reports.html")


@app.get("/settings", response_class=HTMLResponse)
async def settings_page() -> FileResponse:
    return page("settings.html")


@app.get("/manifest.webmanifest")
async def manifest() -> FileResponse:
    return FileResponse(STATIC_DIR / "manifest.webmanifest", media_type="application/manifest+json")


@app.get("/service-worker.js")
async def service_worker() -> FileResponse:
    return FileResponse(STATIC_DIR / "service-worker.js", media_type="application/javascript", headers={"Cache-Control": "no-cache"})


@app.get("/api/server-info")
async def server_info(request: Request) -> dict[str, Any]:
    port = request.url.port or 80
    return {
        "name": "ThunderScope",
        "version": app.version,
        "war_thunder_source": WT_BASE_URL,
        "lan_addresses": [f"http://{ip}:{port}" for ip in lan_ipv4_addresses()],
    }


@app.get("/api/health")
async def health() -> dict[str, Any]:
    return {
        "service": True,
        "war_thunder": hub.latest.get("connected", False),
        "vehicle": hub.latest.get("vehicle"),
        "errors": hub.latest.get("errors", []),
        "recording": hub.recorder.active is not None,
    }


@app.get("/api/telemetry")
async def telemetry() -> dict[str, Any]:
    return hub.latest


@app.get("/api/state")
async def state() -> JSONResponse:
    return JSONResponse(hub.latest.get("state", {}))


@app.get("/api/indicators")
async def indicators() -> JSONResponse:
    return JSONResponse(hub.latest.get("indicators", {}))


@app.get("/api/map/info")
async def map_info(request: Request) -> JSONResponse:
    if hub.latest_map_info:
        return JSONResponse(hub.latest_map_info)
    try:
        return JSONResponse(await hub.get_json("/map_info.json"))
    except (httpx.HTTPError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=503, detail="War Thunder map information is unavailable") from exc


@app.get("/api/map/objects")
async def map_objects(request: Request) -> JSONResponse:
    if hub.latest_objects:
        return JSONResponse(hub.latest_objects)
    try:
        data = await hub.get_json("/map_obj.json")
        return JSONResponse(data if isinstance(data, list) else [])
    except (httpx.HTTPError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=503, detail="War Thunder map objects are unavailable") from exc


@app.get("/api/mission")
async def mission() -> JSONResponse:
    try:
        return JSONResponse(await hub.get_json("/mission.json"))
    except (httpx.HTTPError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=503, detail="War Thunder mission data is unavailable") from exc


@app.get("/api/map/image")
async def map_image() -> Response:
    assert hub.client is not None
    try:
        upstream = await hub.client.get(f"{WT_BASE_URL}/map.img", timeout=2.5)
        upstream.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="War Thunder map image is unavailable") from exc
    return Response(
        content=upstream.content,
        media_type=upstream.headers.get("content-type", "image/png"),
        headers={"Cache-Control": "no-store, max-age=0"},
    )


@app.get("/api/navigation")
async def get_navigation(request: Request) -> dict[str, Any]:
    return request.app.state.navigation


@app.put("/api/navigation")
async def put_navigation(request: Request, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    current = request.app.state.navigation
    navigation = sanitise_navigation(payload, revision=int(current.get("revision", 0)) + 1)
    save_navigation(navigation)
    request.app.state.navigation = navigation
    return navigation


@app.delete("/api/navigation")
async def delete_navigation(request: Request) -> dict[str, Any]:
    current = request.app.state.navigation
    navigation = sanitise_navigation({}, revision=int(current.get("revision", 0)) + 1)
    save_navigation(navigation)
    request.app.state.navigation = navigation
    return navigation


@app.get("/api/settings")
async def get_settings(request: Request) -> dict[str, Any]:
    return request.app.state.settings


@app.put("/api/settings")
async def put_settings(request: Request, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    if (
        not isinstance(payload.get("defaults", {}), dict)
        or not isinstance(payload.get("profiles", {}), dict)
        or not isinstance(payload.get("display", {}), dict)
        or not isinstance(payload.get("audio", {}), dict)
    ):
        raise HTTPException(status_code=400, detail="Invalid settings structure")
    merged = deep_copy(DEFAULT_SETTINGS)
    merged["defaults"].update(payload.get("defaults", {}))
    merged["display"].update(payload.get("display", {}))
    merged["audio"].update(payload.get("audio", {}))
    merged["profiles"] = payload.get("profiles", {})
    save_settings(merged)
    request.app.state.settings = merged
    host_audio.update_settings(merged)
    return merged


@app.get("/api/audio/status")
async def audio_status() -> dict[str, Any]:
    status = host_audio.status()
    status["voices"] = await asyncio.to_thread(host_audio.list_voices)
    return status


@app.post("/api/audio/test")
async def audio_test(payload: dict[str, Any] = Body(default={})) -> dict[str, Any]:
    key = str(payload.get("key") or "").strip()
    if key:
        if key not in ALERT_DEFINITIONS or key == "test":
            raise HTTPException(status_code=400, detail="Unknown Betty alert key.")
        definition = ALERT_DEFINITIONS[key]
        host_audio.enqueue(key, str(definition["phrase"]), int(definition["priority"]), force=True)
        return {
            "queued": True,
            "key": key,
            "phrase": definition["phrase"],
            "custom_wav": (BASE_DIR / "audio" / f"{key}.wav").exists(),
            "host_only": True,
        }
    phrase = str(payload.get("phrase") or "ThunderScope voice alert test.")[:180]
    await host_audio.test(phrase)
    return {"queued": True, "phrase": phrase, "host_only": True}


@app.post("/api/audio/chatter/test")
async def audio_chatter_test() -> dict[str, Any]:
    selected = await host_audio.test_chatter()
    if selected is None:
        raise HTTPException(
            status_code=404,
            detail="No radio chatter WAV files were found in audio/radio category folders.",
        )
    return {"queued": True, "host_only": True, **selected}


@app.get("/api/diagnostics")
async def diagnostics() -> dict[str, Any]:
    return {
        "connected": hub.latest.get("connected", False),
        "vehicle": hub.latest.get("vehicle"),
        "timestamp": hub.latest.get("timestamp"),
        "state_fields": sorted(hub.latest.get("state", {}).keys()),
        "indicator_fields": sorted(hub.latest.get("indicators", {}).keys()),
        "derived": hub.latest.get("derived", {}),
        "poll_hz": round(1 / POLL_INTERVAL, 1),
        "telemetry_stream_hz": round(1 / TELEMETRY_STREAM_INTERVAL, 1),
        "map_poll_hz": round(1 / MAP_OBJECT_POLL_INTERVAL, 1),
        "map_stream_hz": round(1 / MAP_STREAM_INTERVAL, 1),
        "map_objects": len(hub.latest_objects),
        "recording_session": hub.recorder.active.get("id") if hub.recorder.active else None,
        "host_audio": host_audio.status(),
    }


@app.get("/api/sessions")
async def sessions(limit: int = 50) -> list[dict[str, Any]]:
    safe_limit = max(1, min(200, limit))
    with sqlite3.connect(DB_PATH) as db:
        db.row_factory = sqlite3.Row
        rows = db.execute(
            "SELECT id, started_at, ended_at, vehicle, duration, summary_json FROM sessions ORDER BY started_at DESC LIMIT ?",
            (safe_limit,),
        ).fetchall()
    return [
        {
            "id": row["id"],
            "started_at": row["started_at"],
            "ended_at": row["ended_at"],
            "vehicle": row["vehicle"],
            "duration": row["duration"],
            "summary": json.loads(row["summary_json"]),
        }
        for row in rows
    ]


@app.get("/api/sessions/{session_id}")
async def session_detail(session_id: str) -> dict[str, Any]:
    with sqlite3.connect(DB_PATH) as db:
        db.row_factory = sqlite3.Row
        row = db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "id": row["id"],
        "started_at": row["started_at"],
        "ended_at": row["ended_at"],
        "vehicle": row["vehicle"],
        "duration": row["duration"],
        "summary": json.loads(row["summary_json"]),
        "samples": json.loads(row["samples_json"]),
        "path": json.loads(row["path_json"]),
    }


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str) -> dict[str, bool]:
    with sqlite3.connect(DB_PATH) as db:
        result = db.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        db.commit()
    return {"deleted": result.rowcount > 0}


@app.websocket("/ws/map")
async def map_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await websocket.send_json({"sequence":hub.map_sequence,"objects":hub.latest_objects,"map_info":hub.latest_map_info,"telemetry":hub.latest,"navigation":websocket.app.state.navigation,"timestamp":time.time()})
            await asyncio.sleep(MAP_STREAM_INTERVAL)
    except WebSocketDisconnect: return
    except Exception as exc:
        logger.warning("Map websocket closed: %s",exc)
        try: await websocket.close(code=1011)
        except RuntimeError: pass


@app.websocket("/ws/telemetry")
async def telemetry_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await websocket.send_json(hub.latest)
            await asyncio.sleep(TELEMETRY_STREAM_INTERVAL)
    except WebSocketDisconnect:
        return
    except Exception as exc:  # noqa: BLE001
        logger.warning("Telemetry websocket closed: %s", exc)
        try:
            await websocket.close(code=1011)
        except RuntimeError:
            pass


if __name__ == "__main__":
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8765"))
    print("\nThunderScope dashboard")
    print(f"  Local dashboard: http://127.0.0.1:{port}")
    print(f"  Flight data:     http://127.0.0.1:{port}/data")
    print(f"  Reports:         http://127.0.0.1:{port}/reports")
    print(f"  Voice settings:  http://127.0.0.1:{port}/settings")
    if host in {"0.0.0.0", "::"}:
        for ip in lan_ipv4_addresses():
            print(f"  Tablet map:      http://{ip}:{port}/map")
    print("  Press Ctrl+C to stop.\n")
    uvicorn.run("app:app", host=host, port=port, reload=False, access_log=False)
