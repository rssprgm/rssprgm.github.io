#!/bin/sh
set -eu
site=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
source=${1:-"$site/../glass"}
cd "$source"
bun run scripts/build.ts src/runtime.ts "$site/vendor/glass/glass.js"
bun run scripts/build.ts src/components/flat-controls/flat-controls.ts "$site/vendor/glass/flat-controls.js"
