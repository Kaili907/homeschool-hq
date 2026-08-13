#!/bin/zsh
# Regenerate every derived artefact in this lane in one step, so the sources,
# the projection, its rendered view, and the readiness re-run are never on disk
# in a mutually stale state. check-arks.py must run before build-projection.py:
# an anchor with no recorded link check fails closed.
#
#   PROJECTION_AS_OF   date the attachment revalidation window is measured from.
#                      Defaults to today. Set it to make a build reproducible.
set -e
cd "$(dirname "$0")/.."
[[ "$1" == "--recapture" ]] && python3 tools/capture-era1.py
python3 tools/build-era1-sources.py
python3 tools/check-arks.py
python3 tools/build-projection.py
python3 tools/render-projection.py
node --experimental-strip-types --import ./tools/register-hook.mjs tools/reevaluate-readiness.mjs
rm -rf tools/__pycache__
