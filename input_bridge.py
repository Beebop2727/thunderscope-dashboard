from __future__ import annotations

import ctypes
import platform
import time
from ctypes import wintypes
from typing import Any

INPUT_KEYBOARD = 1
KEYEVENTF_KEYUP = 0x0002
KEYEVENTF_SCANCODE = 0x0008
KEYEVENTF_EXTENDEDKEY = 0x0001
MAPVK_VK_TO_VSC = 0

_SPECIAL_KEYS: dict[str, int] = {
    "BACKSPACE": 0x08, "TAB": 0x09, "ENTER": 0x0D, "SHIFT": 0x10,
    "CTRL": 0x11, "CONTROL": 0x11, "ALT": 0x12, "PAUSE": 0x13,
    "CAPSLOCK": 0x14, "ESC": 0x1B, "ESCAPE": 0x1B, "SPACE": 0x20,
    "PAGEUP": 0x21, "PAGEDOWN": 0x22, "END": 0x23, "HOME": 0x24,
    "LEFT": 0x25, "UP": 0x26, "RIGHT": 0x27, "DOWN": 0x28,
    "INSERT": 0x2D, "DELETE": 0x2E,
    "NUM0": 0x60, "NUM1": 0x61, "NUM2": 0x62, "NUM3": 0x63,
    "NUM4": 0x64, "NUM5": 0x65, "NUM6": 0x66, "NUM7": 0x67,
    "NUM8": 0x68, "NUM9": 0x69, "NUM*": 0x6A, "NUM+": 0x6B,
    "NUM-": 0x6D, "NUM.": 0x6E, "NUM/": 0x6F,
}
for _index in range(1, 25):
    _SPECIAL_KEYS[f"F{_index}"] = 0x6F + _index

_EXTENDED_KEYS = {0x21,0x22,0x23,0x24,0x25,0x26,0x27,0x28,0x2D,0x2E,0x6F}

def normalise_key_name(value: Any) -> str:
    raw = str(value or "").strip().upper().replace(" ", "")
    aliases = {"CONTROL": "CTRL", "ESCAPE": "ESC"}
    if "+" not in raw:
        return aliases.get(raw, raw)
    return "+".join(aliases.get(part, part) for part in raw.split("+") if part)

def virtual_key_code(value: Any) -> int | None:
    key = normalise_key_name(value)
    if "+" in key:
        return None
    if len(key) == 1 and ("A" <= key <= "Z" or "0" <= key <= "9"):
        return ord(key)
    return _SPECIAL_KEYS.get(key)

def key_spec_codes(value: Any) -> list[int] | None:
    name = normalise_key_name(value)
    if not name:
        return None
    parts = name.split("+")
    if len(parts) > 4:
        return None
    codes=[]
    for part in parts:
        vk=virtual_key_code(part)
        if vk is None:
            return None
        if vk not in codes:
            codes.append(vk)
    return codes or None

def key_spec_valid(value: Any) -> bool:
    return key_spec_codes(value) is not None

if platform.system().lower() == "windows":
    ULONG_PTR = ctypes.c_size_t
    class MOUSEINPUT(ctypes.Structure):
        _fields_=[("dx",wintypes.LONG),("dy",wintypes.LONG),("mouseData",wintypes.DWORD),("dwFlags",wintypes.DWORD),("time",wintypes.DWORD),("dwExtraInfo",ULONG_PTR)]
    class KEYBDINPUT(ctypes.Structure):
        _fields_=[("wVk",wintypes.WORD),("wScan",wintypes.WORD),("dwFlags",wintypes.DWORD),("time",wintypes.DWORD),("dwExtraInfo",ULONG_PTR)]
    class HARDWAREINPUT(ctypes.Structure):
        _fields_=[("uMsg",wintypes.DWORD),("wParamL",wintypes.WORD),("wParamH",wintypes.WORD)]
    class INPUTUNION(ctypes.Union):
        _fields_=[("mi",MOUSEINPUT),("ki",KEYBDINPUT),("hi",HARDWAREINPUT)]
    class INPUT(ctypes.Structure):
        _anonymous_=("u",)
        _fields_=[("type",wintypes.DWORD),("u",INPUTUNION)]
else:
    INPUT=None

class InputBridge:
    """One-action input bridge using Windows SendInput scan-code events."""
    def __init__(self)->None:
        self.windows=platform.system().lower()=="windows"
        self._held_specs:dict[str,list[int]]={}
        self._user32=ctypes.windll.user32 if self.windows else None
        if self._user32 is not None and INPUT is not None:
            self._user32.SendInput.argtypes=(wintypes.UINT,ctypes.POINTER(INPUT),ctypes.c_int)
            self._user32.SendInput.restype=wintypes.UINT
            self._user32.MapVirtualKeyW.argtypes=(wintypes.UINT,wintypes.UINT)
            self._user32.MapVirtualKeyW.restype=wintypes.UINT
    @property
    def supported(self)->bool:
        return self.windows and self._user32 is not None and INPUT is not None
    def status(self)->dict[str,Any]:
        return {"supported":self.supported,"platform":platform.system(),"held_keys":sum(len(v) for v in self._held_specs.values()),"backend":"Windows SendInput (scan-code)" if self.supported else None,"supports_chords":True}
    def _make_input(self,vk:int,key_up:bool)->Any:
        if not self.supported or INPUT is None:
            raise RuntimeError("Virtual cockpit controls currently require Windows.")
        scan=int(self._user32.MapVirtualKeyW(vk,MAPVK_VK_TO_VSC)) & 0xFF
        if not scan:
            raise RuntimeError(f"Windows could not resolve scan code for VK 0x{vk:02X}.")
        flags=KEYEVENTF_SCANCODE | (KEYEVENTF_KEYUP if key_up else 0)
        if vk in _EXTENDED_KEYS: flags |= KEYEVENTF_EXTENDEDKEY
        item=INPUT(type=INPUT_KEYBOARD)
        item.ki=KEYBDINPUT(0,scan,flags,0,0)
        return item
    def _send_sequence(self,events:list[tuple[int,bool]])->None:
        if not events: return
        items=[self._make_input(vk,up) for vk,up in events]
        array_type=INPUT*len(items)
        array=array_type(*items)
        sent=int(self._user32.SendInput(len(items),array,ctypes.sizeof(INPUT)))
        if sent != len(items):
            error=ctypes.get_last_error()
            raise OSError(error,f"Windows SendInput sent {sent}/{len(items)} keyboard events")
    def key_down(self,key:Any)->str:
        name=normalise_key_name(key); codes=key_spec_codes(name)
        if codes is None: raise ValueError(f"Unsupported key or chord: {name or '<blank>'}")
        if name not in self._held_specs:
            self._send_sequence([(vk,False) for vk in codes]); self._held_specs[name]=codes
        return name
    def key_up(self,key:Any)->str:
        name=normalise_key_name(key); codes=self._held_specs.pop(name,None) or key_spec_codes(name)
        if codes is None: raise ValueError(f"Unsupported key or chord: {name or '<blank>'}")
        self._send_sequence([(vk,True) for vk in reversed(codes)])
        return name
    def tap(self,key:Any,hold_seconds:float=0.075)->str:
        name=self.key_down(key); time.sleep(max(0.04,min(0.25,float(hold_seconds)))); self.key_up(key); return name
    def release_all(self)->None:
        for name,codes in tuple(self._held_specs.items()):
            try: self._send_sequence([(vk,True) for vk in reversed(codes)])
            finally: self._held_specs.pop(name,None)
