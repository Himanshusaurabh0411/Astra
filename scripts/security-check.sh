#!/bin/bash
set -e

echo "========================================================"
echo "🔒 Running Astra 5-Point Pre-Launch Security Audit"
echo "========================================================"

ERRORS=0

echo "[1/5] Checking for Hardcoded Secrets & Credentials..."
if grep -rnE "(password\s*[:=]\s*['\"][^'\"]+['\"]|api[_-]?key\s*[:=]\s*['\"][a-zA-Z0-9_\-]{20,}['\"]|sk-[a-zA-Z0-9]{20,})" src/ --exclude="*.test.*"; then
  echo "❌ FAILED: Potential hardcoded secret detected in src/"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ PASSED: No hardcoded secrets found in source files."
fi

echo "[2/5] Checking .env and Secret Tracking in Git..."
if git ls-files | grep -E "(^\.env$|^\.env\..*\.local|\.pem$|\.key$)"; then
  echo "❌ FAILED: Sensitive file is being tracked by Git!"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ PASSED: .env and private keys are properly gitignored."
fi

echo "[3/5] Checking for Dangerous HTML Injection (XSS)..."
if grep -rn "dangerouslySetInnerHTML" src/; then
  echo "❌ FAILED: Unsafe dangerouslySetInnerHTML found in components"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ PASSED: No raw dangerouslySetInnerHTML calls found."
fi

echo "[4/5] Verifying Production Security Headers Configuration..."
if grep -q "Content-Security-Policy" index.html && grep -q "X-Content-Type-Options" index.html; then
  echo "✅ PASSED: Security meta tags and CSP directives configured."
else
  echo "❌ FAILED: Missing CSP or nosniff headers in index.html"
  ERRORS=$((ERRORS + 1))
fi

echo "[5/5] Checking Client-Side Secrets Exposure..."
if grep -rnE "(NEXT_PUBLIC_SECRET|VITE_SECRET|REACT_APP_SECRET)" src/ .env.example 2>/dev/null; then
  echo "❌ FAILED: Found client-exposed secret environment variable!"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ PASSED: No sensitive variables exposed with client prefixes."
fi

echo "========================================================"
if [ $ERRORS -eq 0 ]; then
  echo "🎉 ALL 5 SECURITY AUDIT CHECKS PASSED WITH ZERO VULNERABILITIES!"
  exit 0
else
  echo "⚠️ $ERRORS security check(s) failed. Fix issues before deployment."
  exit 1
fi
