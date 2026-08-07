from __future__ import annotations
import math, re
from collections import deque
from typing import Any

def number(value: Any) -> float | None:
    try:
        value=float(value)
        return value if math.isfinite(value) else None
    except (TypeError, ValueError): return None

def norm(key: Any) -> str: return re.sub(r'[^a-z0-9]+','',str(key).lower())

def extract_g_load(state: dict[str,Any] | None, indicators: dict[str,Any] | None):
    state=state or {}; indicators=indicators or {}
    aliases={'ny','nyg','gload','gforce','normalg','normalacceleration','normalaccelerationg','normalaccel','loadfactor','verticalg','accelerationnormal'}
    for source,obj in [('state',state),('indicators',indicators)]:
        for key,value in obj.items():
            if norm(key) in aliases|({'gmeter','currentg'} if source=='indicators' else set()):
                parsed=number(value)
                if parsed is not None: return parsed,f'{source}.{key}'
    return None,None

class GPeakMonitor:
    def __init__(self, window_seconds:float=1.25, hold_seconds:float=2.5):
        self.window_seconds=window_seconds; self.hold_seconds=hold_seconds
        self.samples=deque(); self.alert_until=0.0; self.warning_value=None
    def reset(self): self.samples.clear(); self.alert_until=0.0; self.warning_value=None
    def update(self,timestamp,connected,state,indicators,high_threshold,low_threshold):
        if not connected:
            self.reset(); return {'g_load':None,'g_source':None,'g_peak_positive':None,'g_peak_negative':None,'g_warning':False,'g_warning_value':None}
        g,source=extract_g_load(state,indicators)
        if g is not None: self.samples.append((timestamp,g))
        cutoff=timestamp-self.window_seconds
        while self.samples and self.samples[0][0]<cutoff: self.samples.popleft()
        values=[v for _,v in self.samples]
        pos=max(values) if values else g; neg=min(values) if values else g
        crossed=[]
        if pos is not None and pos>=high_threshold: crossed.append(pos)
        if neg is not None and neg<=low_threshold: crossed.append(neg)
        if crossed:
            self.warning_value=max(crossed,key=abs); self.alert_until=max(self.alert_until,timestamp+self.hold_seconds)
        active=timestamp<=self.alert_until
        if not active: self.warning_value=None
        return {'g_load':g,'g_source':source,'g_peak_positive':pos,'g_peak_negative':neg,'g_warning':active,'g_warning_value':self.warning_value,'g_sample_window_seconds':self.window_seconds,'g_alert_hold_seconds':self.hold_seconds}
