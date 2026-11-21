"""Run TerraPulse's source checks without printing suspected credentials."""

import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PATTERN = re.compile(
    r"AIza[0-9A-Za-z_-]{30,}|gh[pousr]_[0-9A-Za-z]{30,}|sk-[0-9A-Za-z_-]{24,}"
    r"|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"
    r"|(?:password|api[_-]?token)\s*[:=]\s*['\"][^'\"]{12,}['\"]",
    re.IGNORECASE,
)


def git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=False)


def check_syntax(root: Path, pattern: re.Pattern) -> list[str]:
    matches = []
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix not in (".py", ".ts", ".tsx", ".js", ".mjs", ".json", ".geojson"):
            continue
        if any(part.startswith(".") or part in {"__pycache__", "node_modules"} for part in path.relative_to(root).parts):
            continue
        for line_number, line in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1):
            if pattern.search(line):
                matches.append(f"{path.relative_to(ROOT)}:{line_number}")
    return matches


backend = ROOT / "backend/app"
frontend = ROOT / "frontend/src"
config = (ROOT / "frontend/next.config.mjs").read_text(encoding="utf-8")
tracked = git("ls-files").stdout.splitlines()
private_files = [
    path for path in tracked
    if (Path(path).name.startswith(".env") and Path(path).name != ".env.example")
    or Path(path).suffix in {".pem", ".key"}
]
if any(git("check-ignore", "--quiet", name).returncode != 0 for name in [".env", "frontend/.env.local"]):
    private_files.append("Expected .env ignore rules are missing")

headers = ("Content-Security-Policy", "X-Content-Type-Options", "X-Frame-Options", "Strict-Transport-Security")
checks = [
    ("Hardcoded credentials", check_syntax(backend, PATTERN) + check_syntax(frontend, PATTERN)),
    ("Private files and environment configuration", private_files),
    ("Raw HTML injection", check_syntax(frontend, re.compile(r"dangerouslySetInnerHTML"))),
    ("Frontend response headers", [name for name in headers if name not in config]),
    ("Client-exposed secret names", check_syntax(frontend, re.compile(r"NEXT_PUBLIC_\w*(?:SECRET|PASSWORD|TOKEN)\b"))),
]

for name, findings in checks:
    print(f"{'FAIL' if findings else 'PASS'} {name}")
    for finding in findings:
        print(f"  {finding}")

raise SystemExit(int(any(findings for _, findings in checks)))
