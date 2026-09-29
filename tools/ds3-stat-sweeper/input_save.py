"""Автосейв DS3 через ESC x2 + ожидание записи файла сейва.

- находит окно игры (заголовок содержит "DARK SOULS III");
- поднимает его на передний план (ShowWindow + AttachThreadInput + SetForegroundWindow);
- шлёт ESC scancode-ом через SendInput (DirectInput-совместимо): открыть меню, ~1 c, закрыть;
- ждёт смену mtime у DS30000.sl2 — признак того, что игра записала сейв.
"""

from __future__ import annotations

import ctypes
import os
import time
from ctypes import wintypes

user32 = ctypes.WinDLL("user32", use_last_error=True)
kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)

ULONG_PTR = ctypes.c_size_t

# --- структуры SendInput ---------------------------------------------------
class KEYBDINPUT(ctypes.Structure):
    _fields_ = [
        ("wVk", wintypes.WORD),
        ("wScan", wintypes.WORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ULONG_PTR),
    ]


class MOUSEINPUT(ctypes.Structure):
    _fields_ = [
        ("dx", wintypes.LONG),
        ("dy", wintypes.LONG),
        ("mouseData", wintypes.DWORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ULONG_PTR),
    ]


class HARDWAREINPUT(ctypes.Structure):
    _fields_ = [
        ("uMsg", wintypes.DWORD),
        ("wParamL", wintypes.WORD),
        ("wParamH", wintypes.WORD),
    ]


class _INPUTunion(ctypes.Union):
    _fields_ = [("ki", KEYBDINPUT), ("mi", MOUSEINPUT), ("hi", HARDWAREINPUT)]


class INPUT(ctypes.Structure):
    _fields_ = [("type", wintypes.DWORD), ("u", _INPUTunion)]


INPUT_KEYBOARD = 1
KEYEVENTF_KEYUP = 0x0002
KEYEVENTF_SCANCODE = 0x0008
SC_ESC = 0x01

SW_RESTORE = 9

user32.SendInput.argtypes = (wintypes.UINT, ctypes.POINTER(INPUT), ctypes.c_int)
user32.SendInput.restype = wintypes.UINT


# --- поиск окна ------------------------------------------------------------
WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)


def find_ds3_window(title_substr: str = "DARK SOULS III") -> int | None:
    result: list[int] = []
    want = title_substr.upper()

    def _cb(hwnd, _lparam):
        if not user32.IsWindowVisible(hwnd):
            return True
        length = user32.GetWindowTextLengthW(hwnd)
        if length:
            buf = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buf, length + 1)
            if want in buf.value.upper():
                result.append(hwnd)
                return False
        return True

    user32.EnumWindows(WNDENUMPROC(_cb), 0)
    return result[0] if result else None


def focus_window(hwnd: int) -> None:
    """Поднять окно на передний план (с трюком AttachThreadInput)."""
    user32.ShowWindow(hwnd, SW_RESTORE)
    fg = user32.GetForegroundWindow()
    target_tid = user32.GetWindowThreadProcessId(hwnd, None)
    fg_tid = user32.GetWindowThreadProcessId(fg, None) if fg else 0
    if fg_tid and fg_tid != target_tid:
        user32.AttachThreadInput(fg_tid, target_tid, True)
        user32.SetForegroundWindow(hwnd)
        user32.BringWindowToTop(hwnd)
        user32.AttachThreadInput(fg_tid, target_tid, False)
    else:
        user32.SetForegroundWindow(hwnd)
    user32.SetFocus(hwnd)


# --- отправка клавиш -------------------------------------------------------
def _send_scancode(scan: int, keyup: bool) -> None:
    flags = KEYEVENTF_SCANCODE | (KEYEVENTF_KEYUP if keyup else 0)
    inp = INPUT(
        type=INPUT_KEYBOARD,
        u=_INPUTunion(ki=KEYBDINPUT(0, scan, flags, 0, 0)),
    )
    sent = user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))
    if sent != 1:
        raise ctypes.WinError(ctypes.get_last_error())


def press_key(scan: int = SC_ESC, hold: float = 0.05) -> None:
    _send_scancode(scan, keyup=False)
    time.sleep(hold)
    _send_scancode(scan, keyup=True)


# --- ожидание записи сейва -------------------------------------------------
def wait_for_save(path: str, prev_mtime: float, timeout: float = 15.0,
                  poll: float = 0.25) -> float | None:
    """Ждёт, пока mtime файла изменится. Возвращает новый mtime или None по таймауту."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            m = os.stat(path).st_mtime
            if m != prev_mtime:
                # дать записи докатиться (файл ~9 МБ)
                time.sleep(0.4)
                return os.stat(path).st_mtime
        except FileNotFoundError:
            pass
        time.sleep(poll)
    return None


def _countdown(seconds: float) -> None:
    n = int(seconds)
    for i in range(n, 0, -1):
        print(f"\r  Разверни игру в фокус... {i} ", end="", flush=True)
        time.sleep(1.0)
    frac = seconds - n
    if frac > 0:
        time.sleep(frac)
    print("\r  Отправляю ESC...            ")


def _do_presses(presses: int, gap: float) -> None:
    for _ in range(presses):
        press_key(SC_ESC)
        time.sleep(gap)


def save_via_esc(save_path: str, pre_delay: float = 5.0, gap: float = 0.5,
                 presses: int = 2, retries: int = 3, retry_gap: float = 1.0,
                 timeout: float = 10.0) -> bool:
    """Полуавтомат: отсчёт pre_delay сек (успеть развернуть игру) -> ESC x2 -> ждать сейв.

    Фокус НЕ крадём программно (DS3 его не принимает) — ESC уходит в активное окно,
    которое ты вручную сделал игрой. Основная попытка: ESC x2 с паузой gap.
    Если mtime сейва не изменился — ещё `retries` попыток с интервалом retry_gap.
    Возвращает True, если сейв записался.
    """
    prev = os.stat(save_path).st_mtime
    _countdown(pre_delay)
    _do_presses(presses, gap)
    if wait_for_save(save_path, prev, timeout=timeout) is not None:
        return True

    for attempt in range(1, retries + 1):
        print(f"  Сейв не изменился — повтор {attempt}/{retries} "
              f"(ESC x{presses}, интервал {retry_gap}s)")
        _do_presses(presses, retry_gap)
        if wait_for_save(save_path, prev, timeout=timeout) is not None:
            return True
    return False


def _main() -> None:
    """python input_save.py [--focus | --esc]
    --focus : только найти и сфокусировать окно (без нажатий).
    --esc   : найти, сфокусировать и нажать ESC x2 (без ожидания файла).
    """
    import sys

    hwnd = find_ds3_window()
    if not hwnd:
        print("Окно DARK SOULS III не найдено. Игра запущена и в окне/borderless?")
        return
    print(f"Окно найдено: hwnd={hwnd}")

    mode = sys.argv[1] if len(sys.argv) > 1 else "--focus"
    focus_window(hwnd)
    print("Окно сфокусировано.")
    if mode == "--esc":
        time.sleep(0.35)
        for i in range(3):
            press_key(SC_ESC)
            print(f"ESC #{i + 1}")
            time.sleep(1.0)


if __name__ == "__main__":
    _main()
