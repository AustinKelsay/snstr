#!/usr/bin/env bash
set -euo pipefail

# Resilient checkout to work around intermittent GitHub git-over-HTTPS 5xx errors.
# - Forces HTTP/1.1 (some environments see flaky HTTP/2 behavior)
# - Retries fetch with backoff
# - On PRs, falls back from refs/pull/<n>/merge to refs/pull/<n>/head
#
# Required env:
# - GITHUB_TOKEN (set in workflow from github.token)
#
# GitHub Actions provides:
# - GITHUB_REPOSITORY, GITHUB_REF, GITHUB_EVENT_NAME
# - GITHUB_EVENT_PATH (not used here)

repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
ref="${GITHUB_REF:?GITHUB_REF is required}"
event_name="${GITHUB_EVENT_NAME:-}"

git config --global http.version HTTP/1.1

git init .
git remote add origin "https://github.com/${repo}.git"

# Avoid GNU base64 line wrapping and strip any trailing newline.
auth_b64="$(printf 'x-access-token:%s' "${GITHUB_TOKEN:?GITHUB_TOKEN is required}" | base64 | tr -d '\n')"

primary_ref="${ref}"
fallback_ref=""

# GitHub Actions uses refs/pull/<n>/merge for pull_request events.
if [[ "${event_name}" == "pull_request" && "${ref}" =~ ^refs/pull/([0-9]+)/merge$ ]]; then
  pr_number="${BASH_REMATCH[1]}"
  fallback_ref="refs/pull/${pr_number}/head"
fi

fetch_ref_with_retry() {
  local ref_to_fetch="$1"
  local attempts=12
  local i=1

  while [ "${i}" -le "${attempts}" ]; do
    echo "Fetch attempt ${i}/${attempts}: ${ref_to_fetch}"

    if git -c "http.extraheader=AUTHORIZATION: basic ${auth_b64}" \
      fetch --no-tags --prune --no-recurse-submodules --depth=1 origin "+${ref_to_fetch}:refs/remotes/origin/ci"; then
      return 0
    fi

    sleep $((i * 5))
    i=$((i + 1))
  done

  return 1
}

if fetch_ref_with_retry "${primary_ref}"; then
  git checkout --detach refs/remotes/origin/ci
  exit 0
fi

if [ -n "${fallback_ref}" ]; then
  echo "Primary ref failed; trying PR head ref: ${fallback_ref}"
  if fetch_ref_with_retry "${fallback_ref}"; then
    git checkout --detach refs/remotes/origin/ci
    exit 0
  fi
fi

echo "Checkout failed after retries."
exit 1

