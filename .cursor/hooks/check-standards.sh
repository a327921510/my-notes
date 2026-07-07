#!/usr/bin/env bash
# check-standards.sh — Cursor sessionStart hook.
#
# Reminds the developer (non-blocking) when the project's cursor-standards are
# outdated. Reliability is layered because sessionStart `additional_context`
# injection is not always delivered and does NOT run for cloud agents:
#   1. Emit {"additional_context": "..."} for the agent (best case).
#   2. Print the notice to stderr (visible in the hook/terminal output).
#   3. Write a marker file (.cursor/.standards-check) as a durable fallback.
#
# Fast + quiet by design: results are cached with a TTL so we do not hit the
# network on every session start, and we stay silent when up to date.
set -euo pipefail

# stdin carries the hook payload JSON; we don't need it. Drain to avoid blocking.
cat >/dev/null 2>&1 || true

# Resolve workspace root: prefer Cursor's env, else current dir.
ROOT="${CURSOR_WORKSPACE_ROOT:-${CLAUDE_PROJECT_DIR:-$PWD}}"
CACHE_TTL_SECONDS="${STANDARDS_CHECK_TTL:-21600}"   # 6h default
CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/cursor-std"
MARKER="$ROOT/.cursor/.standards-check"

emit_none() { printf '{}\n'; exit 0; }

# cursor-std must be on PATH; if not, stay silent (do not disrupt the session).
command -v cursor-std >/dev/null 2>&1 || emit_none

mkdir -p "$CACHE_DIR" 2>/dev/null || true
cache_key="$(printf '%s' "$ROOT" | cksum | awk '{print $1}')"
CACHE_FILE="$CACHE_DIR/$cache_key.txt"

now="$(date +%s)"
result=""
if [ -f "$CACHE_FILE" ]; then
  mtime="$(date -r "$CACHE_FILE" +%s 2>/dev/null || echo 0)"
  if [ $((now - mtime)) -lt "$CACHE_TTL_SECONDS" ]; then
    result="$(cat "$CACHE_FILE" 2>/dev/null || true)"
  fi
fi

if [ -z "$result" ]; then
  # `check` exits 1 when an upgrade is available. Capture its human output.
  if out="$(cursor-std check "$ROOT" 2>&1)"; then
    result="ok"
  else
    result="stale:$out"
  fi
  printf '%s' "$result" > "$CACHE_FILE" 2>/dev/null || true
fi

case "$result" in
  ok|"") emit_none ;;
  stale:*)
    msg="[cursor-standards] 项目规范有新版本可用，运行 'cursor-std update .' 升级。"
    # (2) stderr fallback
    printf '%s\n' "$msg" >&2
    # (3) durable marker
    printf '%s | %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$msg" > "$MARKER" 2>/dev/null || true
    # (1) agent context injection (best effort)
    esc="$(printf '%s' "$msg" | sed 's/\\/\\\\/g; s/"/\\"/g')"
    printf '{"additional_context": "%s"}\n' "$esc"
    ;;
esac
