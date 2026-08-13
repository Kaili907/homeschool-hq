#!/usr/bin/env bash
# Re-verify source custody for g34-specialty-arts-pe-r4.
#
#   1. the bytes held by g34-specialty-r3 still match the SHA256 pinned here
#   2. michigan.gov still serves those same bytes
#
# Check 1 is what tools/build_r4.py enforces on every run. Check 2 needs the network
# and is what stops this package from verifying faithfully against a document the
# state has since replaced. Exit 0 only if both pass for all three documents.
#
#   bash curriculum-release-evidence/g34-specialty-arts-pe-r4/sources/refetch-verify.sh
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELD="$HERE/../../g34-specialty-r3/sources/documents"
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
rc=0

# doc_id | filename | sha256 | url
DOCS=(
"mde-pe-2017|mde-k12-physical-education-standards-2017.pdf|88ab7e08a6611015674ebf97e67a7e8ba0aabb9138b9376bf70adecd9018d93c|https://www.michigan.gov/mde/-/media/Project/Websites/mde/2019/02/22/K_12_PE_Standards_Aug_17_ADA_compliance918.pdf"
"mde-arts-glce|mde-arts-standards-benchmarks-glce.pdf|f52e0506e30a2277991ae4cebfe75ce157ca0cc3d6ba2b833e15ee8fd9113f2b|https://www.michigan.gov/mde/-/media/Project/Websites/mde/Academic-Standards/Arts_Standards_Benchmarks_GLCE.pdf"
"mde-vpaa-2011|mde-vpaa-expectations-june-2011.pdf|330ca531c64200c0ec5e7bc18083cb76e6eb2c57a21fbe3de25c2d29bcfe845c|https://www.michigan.gov/mde/-/media/Project/Websites/mde/Year/2014/06/06/Complete_VPAA_Expectations_June_2011_356110_7.pdf"
)

sha() { shasum -a 256 "$1" 2>/dev/null | awk '{print $1}'; }

for row in "${DOCS[@]}"; do
  IFS='|' read -r id file want url <<<"$row"
  printf '%s\n' "$id"

  got="$(sha "$HELD/$file")"
  if [ -z "$got" ]; then
    printf '  held      MISSING  %s\n' "$HELD/$file"; rc=1
  elif [ "$got" = "$want" ]; then
    printf '  held      ok       %s\n' "$got"
  else
    printf '  held      MISMATCH got %s want %s\n' "$got" "$want"; rc=1
  fi

  # michigan.gov answers 403 to a default User-Agent and 200 to a desktop browser one.
  code="$(curl -sS -L -A "$UA" --max-time 120 -o "$TMP/$file" -w '%{http_code}' "$url" 2>/dev/null)"
  if [ "$code" != "200" ]; then
    printf '  upstream  HTTP %s (network unavailable or the document moved)\n' "$code"; rc=1
  else
    got="$(sha "$TMP/$file")"
    if [ "$got" = "$want" ]; then
      printf '  upstream  ok       %s\n' "$got"
    else
      printf '  upstream  CHANGED  got %s want %s\n' "$got" "$want"
      printf '            The state is serving a different document. Do not rebuild against\n'
      printf '            the held copy until the change has been reviewed.\n'; rc=1
    fi
  fi
done

[ "$rc" -eq 0 ] && printf '\nOK  3/3 documents verified against held bytes and upstream.\n' \
                || printf '\nFAILED  see above.\n'
exit "$rc"
