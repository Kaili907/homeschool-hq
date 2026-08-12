#!/bin/zsh
# Regenerate every derived artefact in one step, so the registry, its rendered
# view, and the readiness re-run are never on disk in a mutually stale state.
set -e
cd "$(dirname "$0")/.."
python3 tools/build-unit-inventory.py
[[ "$1" == "--reverify" ]] && python3 tools/verify.py
python3 tools/build-registry.py
python3 tools/render-registry-md.py
node --experimental-strip-types --import ./tools/register-hook.mjs tools/reevaluate-readiness.mjs
rm -rf tools/__pycache__
