#!/usr/bin/env bash
#
# After a commit: push the branch and make sure a PR is open for it.
#
# The hook cannot do that itself. This session reaches github.com only through
# the MCP tools — a shell has no gh CLI, and the proxy answers api.github.com
# with 403 even holding a token — and a command hook cannot call an MCP tool.
# So it works out what happened locally, where git is perfectly available, and
# hands the GitHub half back to Claude as context.
#
# Fires on any Bash call whose command mentions `git commit`, rather than on a
# `Bash(git commit*)` prefix rule: commits are usually written as
# `git add -A && git commit -m ...`, which no prefix on `git commit` matches.

set -uo pipefail

payload=$(cat)
command=$(printf '%s' "$payload" | jq -r '.tool_input.command // ""' 2>/dev/null)
case "$command" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

cd "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || exit 0

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
# A detached HEAD has no branch to push or open a PR from.
[ "$branch" = "HEAD" ] && exit 0

default=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
[ -n "$default" ] || default=$(git remote show origin 2>/dev/null | sed -n 's/.*HEAD branch: //p')
[ -n "$default" ] || default=master
# Never open a PR from the default branch onto itself.
[ "$branch" = "$default" ] && exit 0

if git rev-parse --verify --quiet "refs/remotes/origin/$branch" >/dev/null 2>&1; then
  ahead=$(git rev-list --count "origin/$branch..HEAD" 2>/dev/null || echo 0)
  # The commit is already on the remote — a no-op commit, or an amend that
  # changed nothing. Nothing to push, so nothing to say.
  [ "$ahead" = "0" ] && exit 0
  state="$ahead commit(s) ahead of origin/$branch"
else
  state="the branch does not exist on origin yet"
fi

subject=$(git log -1 --pretty=%s 2>/dev/null)

jq -nc \
  --arg branch "$branch" --arg default "$default" \
  --arg subject "$subject" --arg state "$state" \
'{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: (
      "AUTO-PR: a commit just landed on `\($branch)` — \"\($subject)\" (\($state)).\n" +
      "Complete the auto-PR step now, before you reply to the user:\n" +
      "1. Push it: git push -u origin \($branch)\n" +
      "2. Look for an already-open PR whose head is `\($branch)` " +
      "(mcp__github__list_pull_requests with state \"open\", or search_pull_requests).\n" +
      "3. If one is open, stop — this commit lands in it. Say so, with its URL.\n" +
      "4. If none is open, open one into `\($default)` with mcp__github__create_pull_request. " +
      "Draw the title and body from the commits on the branch, follow any PR template in the repo, " +
      "and end the body with the Claude Code attribution footer.\n" +
      "5. Give the user the PR URL.\n" +
      "Do NOT merge and do NOT deploy — the user reviews and merges."
    )
  }
}'
