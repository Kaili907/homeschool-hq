#!/bin/zsh
# Probe candidate static URLs: print HTTP status, final URL, and <title>.
while IFS= read -r u; do
  [[ -z "$u" ]] && continue
  code=$(curl -sSL --max-time 30 -A "ManuelAcademy-SourceResolution/1.0" -o /tmp/probe.html -w "%{http_code}" "$u")
  t=$(python3 -c "
import re,sys
h=open('/tmp/probe.html',encoding='utf-8',errors='replace').read()
m=re.search(r'<title[^>]*>(.*?)</title>',h,re.S|re.I)
print(re.sub(r'\s+',' ',m.group(1)).strip()[:95] if m else 'NO-TITLE')
")
  printf "%s  %-95s  %s\n" "$code" "$t" "$u"
done
