#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_TOKEN:?Please set GITHUB_TOKEN env var (PAT with repo scope)}"

OWNER="${OWNER:-kamel-l}"
REPO="${REPO:-erp_mobile}"
BRANCH="${BRANCH:-agent/suivre-factures/init}"
TITLE="${TITLE:-agent: add suivre-les-factures agent}"

read -r -d '' DEFAULT_BODY <<'EOF' || true
Ajoute un agent francophone pour aider au suivi et à la maintenance des factures.

Changements:
- Ajout de `suivre-les-factures.agent.md`
- Ajout de `suivre-les-factures-README.md`
- Ajout de `.github/PULL_REQUEST_TEMPLATE.md`

Checklist:
- [ ] Les fichiers respectent les conventions
- [ ] Pas de données sensibles
- [ ] Commits clairs
- [ ] PR limitée à doc/config

Reviewers suggérés: @kamel-l, @teammate1
EOF

BODY="${BODY:-$DEFAULT_BODY}"
REVIEWERS="${REVIEWERS:-kamel-l,teammate1}"
LABELS="${LABELS:-agent}"

for cmd in curl python; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "$cmd is required" >&2
    exit 1
  fi
done

echo "Searching PR for head=$OWNER:$BRANCH..."
pr_number=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/$OWNER/$REPO/pulls?head=$OWNER:$BRANCH" | grep -Po '"number"\s*:\s*\K[0-9]+' | head -n1 || true)

if [[ -z "$pr_number" ]]; then
  echo "PR not found for branch $BRANCH" >&2
  exit 1
fi

echo "Found PR #$pr_number — updating title/body..."

# JSON-encode title and body using python to avoid jq dependency
TITLE_JSON=$(printf '%s' "$TITLE" | python -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
BODY_JSON=$(printf '%s' "$BODY" | python -c 'import json,sys; print(json.dumps(sys.stdin.read()))')

PAYLOAD="{\"title\":$TITLE_JSON,\"body\":$BODY_JSON}"
curl -s -X PATCH -H "Authorization: token $GITHUB_TOKEN" -H "Content-Type: application/json" -d "$PAYLOAD" \
  "https://api.github.com/repos/$OWNER/$REPO/pulls/$pr_number" >/dev/null

echo "Requesting reviewers: $REVIEWERS"
REVIEWERS_JSON=$(python - <<PY
import json,sys
csv = sys.argv[1]
print(json.dumps([s for s in csv.split(',') if s]))
PY
"$REVIEWERS")

curl -s -X POST -H "Authorization: token $GITHUB_TOKEN" -H "Content-Type: application/json" \
  -d "{\"reviewers\":$REVIEWERS_JSON}" \
  "https://api.github.com/repos/$OWNER/$REPO/pulls/$pr_number/requested_reviewers" >/dev/null || true

echo "Adding labels: $LABELS"
LABELS_JSON=$(python - <<PY
import json,sys
csv = sys.argv[1]
print(json.dumps([s for s in csv.split(',') if s]))
PY
"$LABELS")

curl -s -X POST -H "Authorization: token $GITHUB_TOKEN" -H "Content-Type: application/json" \
  -d "$LABELS_JSON" \
  "https://api.github.com/repos/$OWNER/$REPO/issues/$pr_number/labels" >/dev/null || true

echo "Done. PR URL: https://github.com/$OWNER/$REPO/pull/$pr_number"
