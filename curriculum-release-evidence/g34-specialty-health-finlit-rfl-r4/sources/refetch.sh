#!/bin/sh
# Re-fetch the two documents this package holds and check them against the pinned
# SHA256. The three inherited documents are re-fetched by
# ../g34-specialty-r3/sources/refetch.sh - this package verifies their hashes at
# build time but does not hold a second copy.
set -e
cd "$(dirname "$0")/documents"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

fetch() {
  curl -sS -L -A "$UA" -o "$1.refetch" "$2"
  got=$(shasum -a 256 "$1.refetch" | cut -d' ' -f1)
  if [ "$got" = "$3" ]; then
    echo "OK       $1"
    rm -f "$1.refetch"
  else
    echo "CHANGED  $1"
    echo "  pinned $3"
    echo "  live   $got"
    echo "  kept as $1.refetch - diff it before trusting any classification against $1"
  fi
}

fetch "mde-sel-competencies-indicators-2017.pdf" \
      "https://www.michigan.gov/mde/-/media/Project/Websites/mde/Year/2018/04/12/SEL_Competencies-_ADA_Compliant_FINAL.pdf" \
      17d23981b703594f56b518de425c7e2235bb1b356dca4cb68d81b3f0862a3d0d

fetch "mde-health-education-standards-guidelines-2025-press-release-variant.pdf" \
      "https://www.michigan.gov/mde/-/media/Project/Websites/mde/ohns/School-Health-and-Safety/Michigan-Health-Education-Standards-Guidelines-2025---ADA-Final.pdf" \
      17dc768b41b517a82f861849ae314781c723e08e87691504c38ab71aae670e15

fetch "mde-personal-finance-course-credit-requirements.pdf" \
      "https://www.michigan.gov/mde/-/media/Project/Websites/mde/Academic-Standards/Personal-Finance/Personal_Finance_Course_Credit.pdf" \
      34dd182eac9e374105d3fc85b14a221ec5563212cd29e5a0a453654e88f698a8
