#!/bin/sh
# Regenerate SHA256SUMS.txt for the evidence set (excluding itself).
cd "$(dirname "$0")/.." || exit 1
find . -type f ! -name SHA256SUMS.txt | LC_ALL=C sort | sed 's|^\./||' | xargs shasum -a 256 > SHA256SUMS.txt
