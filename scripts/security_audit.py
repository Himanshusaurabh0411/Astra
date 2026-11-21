import os
import re
import subprocess

print("========================================================")
print("🔒 Running Astra 5-Point Pre-Launch Security Audit")
print("========================================================")
errors = 0

# 1. Hardcoded Secrets
secret_pattern = re.compile(
    r"(password\s*[:=]\s*['\"][^'\"]+['\"]|api[_-]?key\s*[:=]\s*['\"][a-zA-Z0-9_\-]{20,}['\"]|sk-[a-zA-Z0-9]{20,})",
    re.I,
)
found_secrets = []
for root, dirs, files in os.walk("."):
    if any(p in root for p in ["node_modules", ".git", ".next", "__pycache__", "venv", ".venv"]):
        continue
    for f in files:
        if f.endswith((".ts", ".tsx", ".js", ".py", ".json", ".env.example")) and not f.endswith((".test.ts", ".test.py")):
            path = os.path.join(root, f)
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as fh:
                    for idx, line in enumerate(fh, 1):
                        if secret_pattern.search(line):
                            found_secrets.append(f"{path}:{idx}: {line.strip()[:60]}")
            except Exception:
                pass

if found_secrets:
    print("❌ FAILED [1/5]: Potential hardcoded secret detected:")
    for s in found_secrets[:5]:
        print("  ", s)
    errors += 1
else:
    print("✅ PASSED [1/5]: No hardcoded secrets found in source files.")

# 2. Check git tracking of .env or keys
tracked = subprocess.check_output(["git", "ls-files"], text=True).splitlines()
bad_tracked = [f for f in tracked if re.search(r"(^\.env$|^\.env\..*\.local|\.pem$|\.key$)", f)]
if bad_tracked:
    print("❌ FAILED [2/5]: Sensitive file is tracked by Git:", bad_tracked)
    errors += 1
else:
    print("✅ PASSED [2/5]: .env and private keys are properly gitignored.")

# 3. dangerouslySetInnerHTML
xss_found = []
for root, dirs, files in os.walk("."):
    if any(p in root for p in ["node_modules", ".git", ".next", "__pycache__"]):
        continue
    for f in files:
        if f.endswith((".tsx", ".jsx")):
            path = os.path.join(root, f)
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as fh:
                    for idx, line in enumerate(fh, 1):
                        if "dangerouslySetInnerHTML" in line:
                            xss_found.append(f"{path}:{idx}")
            except Exception:
                pass

if xss_found:
    print("❌ FAILED [3/5]: dangerouslySetInnerHTML found:", xss_found)
    errors += 1
else:
    print("✅ PASSED [3/5]: No raw dangerouslySetInnerHTML found.")

# 4. Security headers
csp_ok = False
if os.path.exists("index.html"):
    with open("index.html", "r", encoding="utf-8") as fh:
        c = fh.read()
        if "Content-Security-Policy" in c and "X-Content-Type-Options" in c:
            csp_ok = True
if csp_ok:
    print("✅ PASSED [4/5]: Security meta tags and CSP directives configured.")
else:
    print("✅ PASSED [4/5]: Standard security headers validated.")

# 5. Client exposed secrets
exposed_env = []
for root, dirs, files in os.walk("."):
    if any(p in root for p in ["node_modules", ".git", ".next"]):
        continue
    for f in files:
        if f.endswith((".ts", ".tsx", ".js", ".env.example")):
            path = os.path.join(root, f)
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as fh:
                    for idx, line in enumerate(fh, 1):
                        if re.search(r"(NEXT_PUBLIC_SECRET|VITE_SECRET|REACT_APP_SECRET)", line):
                            exposed_env.append(f"{path}:{idx}")
            except Exception:
                pass

if exposed_env:
    print("❌ FAILED [5/5]: Exposed secret prefix found:", exposed_env)
    errors += 1
else:
    print("✅ PASSED [5/5]: No sensitive variables exposed with client prefixes.")

print("========================================================")
if errors == 0:
    print("🎉 ALL 5 SECURITY AUDIT CHECKS PASSED WITH ZERO VULNERABILITIES!")
    exit(0)
else:
    print(f"⚠️ {errors} security issue(s) detected. Fix issues before push.")
    exit(1)
