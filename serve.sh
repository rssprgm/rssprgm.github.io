#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")"

host="${HOST:-0.0.0.0}"
port="${PORT:-4173}"
destination="${JEKYLL_DESTINATION:-${TMPDIR:-/tmp}/rssprgm-jekyll}"

if [[ -n "${JEKYLL_BIN:-}" ]]; then
  jekyll_bin="$JEKYLL_BIN"
elif command -v jekyll >/dev/null 2>&1; then
  jekyll_bin="$(command -v jekyll)"
elif [[ -x "$HOME/.gem/ruby/2.6.0/bin/jekyll" ]]; then
  jekyll_bin="$HOME/.gem/ruby/2.6.0/bin/jekyll"
else
  printf 'Jekyll was not found on PATH. Set JEKYLL_BIN or install Jekyll.\n' >&2
  exit 1
fi

exec "$jekyll_bin" serve --host "$host" --port "$port" --destination "$destination"
