#!/bin/sh
# Re-fetch every document held in sources/documents/ and check it against the
# pinned SHA256. michigan.gov answers 403 to a default User-Agent and 200 to a
# desktop browser one; that is the whole trick.
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

fetch "mde-health-education-standards-guidelines-2025.pdf" \
      "https://www.michigan.gov/mde/-/media/Project/Websites/mde/ohns/School-Health-and-Safety/Michigan-Health-Education-Standards-Guidelines-2025---ADA-final-with-edits-12-19-25.pdf" \
      e64744d56ba3ba36b968012995f9fed259f74efbb49fbfc91075be8b16defee4
fetch "mde-k12-physical-education-standards-2017.pdf" \
      "https://www.michigan.gov/mde/-/media/Project/Websites/mde/2019/02/22/K_12_PE_Standards_Aug_17_ADA_compliance918.pdf" \
      88ab7e08a6611015674ebf97e67a7e8ba0aabb9138b9376bf70adecd9018d93c
fetch "mde-k12-computer-science-standards-2019.pdf" \
      "https://www.michigan.gov/documents/mde/CompSci_Standards_Accessible_Final_655284_7.pdf" \
      62bedb9e798a0ebb387dbbeafefc1f926c745df1dd564e4b67b41385e0392c3d
fetch "mde-arts-standards-benchmarks-glce.pdf" \
      "https://www.michigan.gov/mde/-/media/Project/Websites/mde/Academic-Standards/Arts_Standards_Benchmarks_GLCE.pdf" \
      f52e0506e30a2277991ae4cebfe75ce157ca0cc3d6ba2b833e15ee8fd9113f2b
fetch "mde-vpaa-expectations-june-2011.pdf" \
      "https://www.michigan.gov/mde/-/media/Project/Websites/mde/Year/2014/06/06/Complete_VPAA_Expectations_June_2011_356110_7.pdf" \
      330ca531c64200c0ec5e7bc18083cb76e6eb2c57a21fbe3de25c2d29bcfe845c
fetch "mde-personal-finance-content-expectations-9-12.pdf" \
      "https://www.michigan.gov/mde/-/media/Project/Websites/mde/Academic-Standards/Personal-Finance/Personal_Finance_Content_Expectations.pdf" \
      ff97640535d7864de8d3333669a5f8d8ab8134ebfa0af5f9f938cf2e91ab2735
fetch "mde-k12-social-studies-standards.pdf" \
      "https://www.michigan.gov/mde/-/media/Project/Websites/mde/Academic-Standards/Social_Studies_Standards.pdf" \
      bba06f46bb241ae3cdd698caaeb41baa3c976d96176fef0a9d594a7e98e70b96
