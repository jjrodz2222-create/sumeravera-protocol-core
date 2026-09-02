#!/usr/bin/env bash
set -euo pipefail

echo "== GitHub CLI auth check =="
if gh auth status >/dev/null 2>&1; then
  echo "gh auth: OK (logged in)."
  gh auth status
  exit 0
fi

echo "gh auth: not logged in."
if [[ -n "${GH_TOKEN:-}" ]]; then
  echo "GH_TOKEN is set, testing token-based access..."
  if gh api user >/dev/null 2>&1; then
    echo "GH_TOKEN authentication works."
    gh api user --jq '.login'
    exit 0
  fi
  echo "GH_TOKEN is set but invalid or lacks required scopes."
  exit 1
fi

cat <<'EOF'
No authorization found.

Local interactive login:
  gh auth login

Token-based login:
  export GH_TOKEN=<your_token>
  gh auth status
EOF
exit 1
