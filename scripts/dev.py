#!/usr/bin/env python3
"""Cross-platform dev runner for NatureCure AI (Windows, macOS, Linux). Standard library only.

    python scripts/dev.py start [backend|frontend]   start in the background (default: both)
    python scripts/dev.py stop  [backend|frontend]   stop what `start` launched
    python scripts/dev.py restart [backend|frontend]
    python scripts/dev.py status
    python scripts/dev.py logs [backend|frontend] [-f]
    python scripts/dev.py run backend|frontend       run in the foreground (Ctrl+C to quit)

`stop` only stops processes that `start` launched (tracked in .dev/pids.json). Anything else that
happens to use port 5000 or 5001 is never touched.
"""
import argparse
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATE_DIR = ROOT / ".dev"
PID_FILE = STATE_DIR / "pids.json"
LOG_DIR = STATE_DIR / "logs"
IS_WINDOWS = os.name == "nt"

SERVICES = {
    "backend": {"port": 5000, "cwd": ROOT / "backend", "markers": ("uvicorn",), "url": "http://localhost:5000/docs"},
    "frontend": {"port": 5001, "cwd": ROOT / "frontend", "markers": ("npm", "next"), "url": "http://localhost:5001"},
}
START_TIMEOUT = 90  # seconds to wait for a port to open (the first Next.js start can be slow)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def venv_python():
    """Python for the backend: a project virtualenv if there is one, else the interpreter running this script."""
    for venv in (ROOT / "backend" / ".venv", ROOT / "backend" / "venv", ROOT / ".venv", ROOT / "venv"):
        candidate = venv / ("Scripts/python.exe" if IS_WINDOWS else "bin/python")
        if candidate.exists():
            return str(candidate)
    return sys.executable


def service_command(name):
    if name == "backend":
        return [venv_python(), "-m", "uvicorn", "main:app", "--reload", "--port", str(SERVICES[name]["port"])]
    return [shutil.which("npm") or "npm", "run", "dev"]


def preflight(name):
    """Returns a list of problems that would stop the service from starting."""
    problems = []
    cwd = SERVICES[name]["cwd"]
    if name == "backend":
        py = venv_python()
        check = subprocess.run([py, "-c", "import uvicorn, fastapi"], capture_output=True)
        if check.returncode != 0:
            problems.append(
                f"Backend packages are missing for {py}.\n"
                "    Install them: python -m venv backend/.venv, activate it, then\n"
                "    pip install -r backend/requirements.txt")
        if not (cwd / ".env").exists():
            print("  note: backend/.env not found. Copy backend/.env.example to backend/.env and fill it in.")
    else:
        if not shutil.which("npm"):
            problems.append("npm was not found. Install Node.js 20+ from https://nodejs.org")
        elif not (cwd / "node_modules").exists():
            problems.append("Frontend packages are missing. Run: cd frontend && npm install")
    return problems


def port_in_use(port):
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.5):
            return True
    except OSError:
        return False


def load_state():
    try:
        return json.loads(PID_FILE.read_text())
    except (OSError, ValueError):
        return {}


def save_state(state):
    STATE_DIR.mkdir(exist_ok=True)
    PID_FILE.write_text(json.dumps(state, indent=2))


def pid_alive(pid):
    if IS_WINDOWS:
        out = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/NH"], capture_output=True, text=True).stdout
        return str(pid) in out.split()
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def command_line(pid):
    """Command line of a process, or None if it can't be determined."""
    try:
        if IS_WINDOWS:
            ps = f"(Get-CimInstance Win32_Process -Filter 'ProcessId={pid}').CommandLine"
            out = subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, text=True, timeout=20)
        else:
            out = subprocess.run(["ps", "-p", str(pid), "-o", "command="], capture_output=True, text=True, timeout=10)
        return out.stdout.strip() or None
    except (OSError, subprocess.SubprocessError):
        return None


def is_ours(name, pid):
    """Guards against a stale pid file: the pid must still look like this service's server/launcher."""
    cmd = command_line(pid)
    return bool(cmd) and any(marker in cmd.lower() for marker in SERVICES[name]["markers"])


def kill_tree(pid):
    if IS_WINDOWS:
        subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True)
        return
    try:
        os.killpg(os.getpgid(pid), signal.SIGTERM)  # started with start_new_session, so the group is the whole tree
    except ProcessLookupError:
        return
    deadline = time.time() + 8
    while time.time() < deadline and pid_alive(pid):
        time.sleep(0.2)
    if pid_alive(pid):
        try:
            os.killpg(os.getpgid(pid), signal.SIGKILL)
        except ProcessLookupError:
            pass


def tail(path, lines=15):
    try:
        return "\n".join(path.read_text(errors="replace").splitlines()[-lines:])
    except OSError:
        return ""


def pick(target):
    return list(SERVICES) if target in (None, "all") else [target]


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------
def cmd_start(target):
    state = load_state()
    ok = True
    started = []
    for name in pick(target):
        svc = SERVICES[name]
        tracked = state.get(name)
        if tracked and pid_alive(tracked["pid"]) and port_in_use(svc["port"]):
            print(f"{name}: already running (PID {tracked['pid']}) at {svc['url']}")
            continue
        if port_in_use(svc["port"]):
            print(f"{name}: port {svc['port']} is already used by another program, so it was not started.\n"
                  f"    Close that program or free the port, then try again.")
            ok = False
            continue
        problems = preflight(name)
        if problems:
            print(f"{name}: cannot start")
            for problem in problems:
                print(f"  - {problem}")
            ok = False
            continue

        LOG_DIR.mkdir(parents=True, exist_ok=True)
        log_path = LOG_DIR / f"{name}.log"
        kwargs = {}
        if IS_WINDOWS:
            kwargs["creationflags"] = 0x08000000 | 0x00000200  # CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP
        else:
            kwargs["start_new_session"] = True
        with open(log_path, "wb") as log:
            proc = subprocess.Popen(service_command(name), cwd=svc["cwd"], stdin=subprocess.DEVNULL,
                                    stdout=log, stderr=subprocess.STDOUT, **kwargs)
        state[name] = {"pid": proc.pid, "started": time.time()}
        save_state(state)
        started.append((name, proc))
        print(f"{name}: starting (PID {proc.pid})...")

    for name, proc in started:
        svc = SERVICES[name]
        deadline = time.time() + START_TIMEOUT
        while time.time() < deadline:
            if proc.poll() is not None:
                print(f"{name}: stopped right after starting (exit code {proc.returncode}). Last log lines:")
                print("    " + tail(LOG_DIR / f"{name}.log").replace("\n", "\n    "))
                state.pop(name, None)
                save_state(state)
                ok = False
                break
            if port_in_use(svc["port"]):
                print(f"{name}: ready at {svc['url']}")
                break
            time.sleep(0.5)
        else:
            print(f"{name}: still starting after {START_TIMEOUT}s. Check: python scripts/dev.py logs {name}")
    if started and ok:
        print(f"Logs are in {LOG_DIR}. Stop everything with: python scripts/dev.py stop")
    return 0 if ok else 1


def cmd_stop(target):
    state = load_state()
    stopped = 0
    for name in pick(target):
        tracked = state.get(name)
        if not tracked:
            if port_in_use(SERVICES[name]["port"]):
                print(f"{name}: port {SERVICES[name]['port']} is in use, but not by a server started with this tool; leaving it alone.")
            else:
                print(f"{name}: not running")
            continue
        pid = tracked["pid"]
        if not pid_alive(pid):
            print(f"{name}: not running (cleaning up stale record)")
        elif not is_ours(name, pid):
            print(f"{name}: PID {pid} no longer looks like the {name} server (stale record); not touching it.")
        else:
            kill_tree(pid)
            print(f"{name}: stopped (PID {pid})")
            stopped += 1
        state.pop(name, None)
    save_state(state)
    if not stopped:
        print("Nothing was stopped.")
    return 0


def cmd_status(_target):
    state = load_state()
    for name, svc in SERVICES.items():
        tracked = state.get(name)
        up = port_in_use(svc["port"])
        if tracked and pid_alive(tracked["pid"]) and up:
            print(f"{name}: running (PID {tracked['pid']}) at {svc['url']}")
        elif up:
            print(f"{name}: port {svc['port']} is in use by a program not started with this tool")
        elif tracked and pid_alive(tracked["pid"]):
            print(f"{name}: process {tracked['pid']} is alive but port {svc['port']} is not open (starting or stuck); see logs")
        else:
            print(f"{name}: stopped")
    return 0


def cmd_logs(target, follow):
    names = pick(target)
    for name in names:
        path = LOG_DIR / f"{name}.log"
        print(f"==== {name} ({path}) ====")
        print(tail(path, 40) or "(no log yet)")
    if follow and len(names) == 1:
        path = LOG_DIR / f"{names[0]}.log"
        try:
            with open(path, "r", errors="replace") as handle:
                handle.seek(0, os.SEEK_END)
                while True:
                    line = handle.readline()
                    if line:
                        print(line, end="")
                    else:
                        time.sleep(0.3)
        except (KeyboardInterrupt, OSError):
            pass
    elif follow:
        print("(-f needs a single service: logs backend -f)")
    return 0


def cmd_run(target):
    if target not in SERVICES:
        print("Usage: python scripts/dev.py run backend|frontend")
        return 2
    svc = SERVICES[target]
    if port_in_use(svc["port"]):
        print(f"{target}: port {svc['port']} is already in use. Stop the other program first.")
        return 1
    problems = preflight(target)
    if problems:
        print(f"{target}: cannot start")
        for problem in problems:
            print(f"  - {problem}")
        return 1
    try:
        return subprocess.call(service_command(target), cwd=svc["cwd"])
    except KeyboardInterrupt:
        return 0


def main():
    parser = argparse.ArgumentParser(description="Start and stop the NatureCure AI dev servers.")
    parser.add_argument("command", choices=["start", "stop", "restart", "status", "logs", "run"])
    parser.add_argument("service", nargs="?", choices=["backend", "frontend", "all"], default=None)
    parser.add_argument("-f", "--follow", action="store_true", help="logs: keep following the log")
    args = parser.parse_args()

    if args.command == "start":
        return cmd_start(args.service)
    if args.command == "stop":
        return cmd_stop(args.service)
    if args.command == "restart":
        cmd_stop(args.service)
        return cmd_start(args.service)
    if args.command == "status":
        return cmd_status(args.service)
    if args.command == "logs":
        return cmd_logs(args.service, args.follow)
    return cmd_run(args.service)


if __name__ == "__main__":
    sys.exit(main())
