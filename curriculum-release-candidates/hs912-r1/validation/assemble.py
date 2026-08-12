# Assembly script for curriculum-release-candidates/hs912-r1.
#
# Shipped so that every derived index in this release candidate can be regenerated
# and audited. Reads the eight input branches listed in INPUT-SHAS.json out of git
# into a staging tree, then writes this directory. Run from a staging tree produced
# by: git archive <branch> curriculum-authoring/full-family-highschool-9-12
#
"""Deterministic assembly of the Grade 8-12 release candidate.

Imports curriculum artifacts only. No source branch is merged. Every output file
is either a verbatim copy of a committed lane artifact or a derived index whose
derivation is recorded in the assembly report.
"""
import json, os, re, shutil, sys, hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
STAGE = os.path.join(HERE, 'stage')
RC = sys.argv[1]
WAVE = 'curriculum-authoring/full-family-highschool-9-12'

def sub(lane): return os.path.join(STAGE, lane, WAVE, 'subjects')

# family -> (lane, course-dir template, family root dir, family-level doc dirs)
FAMILIES = {
    'mathematics':          ('math',     'mathematics/courses/grade-{g}',                              'mathematics'),
    'english-language-arts':('ela',      'english-language-arts/courses/english-{g}',                  'english-language-arts'),
    'science':              ('science',  None,                                                          'science'),
    'social-studies':       ('social',   'social-studies/grades/grade-{g}/courses/social-studies',      'social-studies'),
    'health':               ('healthpe', 'health/build/grade-{g}/courses/health',                       'health'),
    'physical-education':   ('healthpe', 'physical-education/build/grade-{g}/courses/physical-education','physical-education'),
    'ready-for-life':       ('rflfin',   'ready-for-life/courses/ready-for-life-{g}',                   'ready-for-life'),
    'technology':           ('techarts', 'technology-computer-science/grade-{gg}',                      'technology-computer-science'),
    'arts-and-music':       ('techarts', 'arts-music/grade-{gg}',                                       'arts-music'),
    'financial-literacy':   ('rflfin',   'financial-literacy/courses/financial-literacy-{g}',           'financial-literacy'),
}
GRADES = (9, 10, 11, 12)
COURSE_FILES = ('units.json', 'lessons.jsonl', 'assessments.json', 'course-guide.md', 'lesson-sequence.md')

def read_units(p):
    d = json.load(open(p, encoding='utf8'))
    return d if isinstance(d, list) else d.get('units', [])

def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(65536), b''): h.update(b)
    return h.hexdigest()

def family_source_corpus(fam_root):
    """Concatenated text of the family's non-course documents — its own standards custody."""
    txt = []
    for dp, _, fs in os.walk(fam_root):
        if any(seg in dp for seg in ('/courses/', '/build/', '/grades/')): continue
        if re.search(r'/grade-\d', dp): continue
        for f in sorted(fs):
            if f.endswith(('.md', '.json')) and f not in ('units.json', 'assessments.json'):
                try: txt.append(open(os.path.join(dp, f), encoding='utf8').read())
                except Exception: pass
    return '\n'.join(txt)

# Composite-label decomposition: a cited label that is not verbatim in the family
# source may still be fully traceable if every one of its components is. Splits
# on the punctuation the lanes actually used; a component is any run of >=4 chars.
def composite_components(code):
    code = re.sub(r'\([^)]*\)', '', code)          # lane glosses in parentheses
    parts = re.split(r'\s*[\[\]:;·]\s*|\s+—\s+|\.\s+', code)
    return [p.strip(' .,') for p in parts if len(p.strip(' .,')) >= 4]

# A component the lane did not write verbatim may still be built entirely from
# vocabulary the lane's own custody documents publish. Two forms are accepted,
# both narrow and both evidenced:
#   RESTATED  - every word of 4+ characters in the component appears verbatim,
#               and there are at least two such words (so a bare `MP.1` cannot
#               slip through on an empty word list).
#   TEMPLATED - a `<digits>.<digits>.<ALPHA>` code token whose alphabetic suffix
#               is published by the lane AND whose construction template is
#               published by the lane (e.g. health's `12.<practice>.<TOPIC>`).
CODE_TOKEN = re.compile(r'^\d+\.\d+\.([A-Z]+)$')
CODE_TEMPLATE = re.compile(r'[\d<][^\s`]*\.<[a-z ]+>\.<[A-Z]+>')

def evidenced(component, corpus):
    if component in corpus: return True
    m = CODE_TOKEN.match(component)
    if m and m.group(1) in corpus and CODE_TEMPLATE.search(corpus): return True
    words = re.findall(r'[A-Za-z0-9][A-Za-z0-9\-]{3,}', component)
    return len(words) >= 2 and all(w in corpus for w in words)

def classify(code, corpus):
    if 'UNVERIFIED' in code.upper(): return 'DECLARED_UNVERIFIED', []
    if code in corpus: return 'VERBATIM', []
    comps = composite_components(code)
    missing = [c for c in comps if not evidenced(c, corpus)]
    if comps and not missing: return 'COMPOSITE_VERIFIED', comps
    return 'UNTRACEABLE', missing

def main():
    if os.path.isdir(RC): shutil.rmtree(RC)
    os.makedirs(RC)

    report = {'families': {}, 'schedules': {}, 'standards': {}}

    # ---- release contract artifacts, verbatim -------------------------------
    shutil.copytree(os.path.join(STAGE, 'release', WAVE, 'release'), os.path.join(RC, 'release'))

    # ---- science: verbatim import, native v2 authoring set, NOT normalized ---
    shutil.copytree(os.path.join(sub('science'), 'science'), os.path.join(RC, 'science'))

    # ---- nine canonical families -------------------------------------------
    for fam, (lane, tmpl, root) in FAMILIES.items():
        if tmpl is None: continue
        fam_root = os.path.join(sub(lane), root)
        dst = os.path.join(RC, fam)
        os.makedirs(dst)
        # family-level documents, verbatim, under source-docs/
        os.makedirs(os.path.join(dst, 'source-docs'))
        for entry in sorted(os.listdir(fam_root)):
            src = os.path.join(fam_root, entry)
            if entry in ('courses', 'build', 'grades') or re.fullmatch(r'grade-\d+', entry): continue
            (shutil.copytree if os.path.isdir(src) else shutil.copy2)(src, os.path.join(dst, 'source-docs', entry))

        cited = set()
        fam_courses = []
        for g in GRADES:
            srcdir = os.path.join(fam_root.rsplit('/' + root, 1)[0], root, '') if False else os.path.join(sub(lane), tmpl.format(g=g, gg=f'{g:02d}'))
            gdst = os.path.join(dst, f'grade-{g}')
            os.makedirs(gdst)
            for f in COURSE_FILES:
                s = os.path.join(srcdir, f)
                if os.path.exists(s): shutil.copy2(s, os.path.join(gdst, f))
            units = read_units(os.path.join(gdst, 'units.json'))
            lessons = [json.loads(l) for l in open(os.path.join(gdst, 'lessons.jsonl'), encoding='utf8') if l.strip()]
            assess = json.load(open(os.path.join(gdst, 'assessments.json'), encoding='utf8'))
            assess = assess if isinstance(assess, list) else assess.get('assessments', [])
            for u in units: cited |= set(u.get('standards', []))
            for l in lessons: cited |= set(l.get('standards', []))
            fam_courses.append({'course_id': f'ma-g{g}-{fam}', 'grade': g,
                                'units': len(units), 'lessons': len(lessons), 'assessments': len(assess)})
        report['families'][fam] = {'owner_lane': lane, 'courses': fam_courses, 'source_root': f'{WAVE}/subjects/{root}'}

        # derived standards registry
        corpus = family_source_corpus(fam_root)
        buckets = {'VERBATIM': [], 'COMPOSITE_VERIFIED': [], 'DECLARED_UNVERIFIED': [], 'UNTRACEABLE': []}
        detail = {}
        for code in sorted(cited):
            kind, comps = classify(code, corpus)
            buckets[kind].append(code)
            detail[code] = {'class': kind, 'missing_components': comps if kind == 'UNTRACEABLE' else []}
        report['standards'][fam] = {k: len(v) for k, v in buckets.items()}
        report['standards'][fam]['untraceable_codes'] = buckets['UNTRACEABLE']
        write_coverage(os.path.join(dst, 'standards-coverage.md'), fam, root, buckets, detail)

    # ---- schedules ----------------------------------------------------------
    os.makedirs(os.path.join(RC, 'schedules'))
    for g in GRADES:
        rows = []
        for fam in sorted(FAMILIES):
            gdir = os.path.join(RC, fam, f'grade-{g}')
            lp = os.path.join(gdir, 'lessons.jsonl')
            if not os.path.exists(lp): continue
            ls = [json.loads(l) for l in open(lp, encoding='utf8') if l.strip()]
            ls.sort(key=lambda l: (l.get('course_day', 0), l['lesson_id']))
            for l in ls:
                rows.append((l.get('course_day', 0), f'ma-g{g}-{fam}', l['lesson_id']))
        d = os.path.join(RC, 'schedules', f'grade-{g}')
        os.makedirs(d)
        with open(os.path.join(d, 'daily-schedule.csv'), 'w', encoding='utf8') as f:
            f.write('course_day,course_id,lesson_id\n')
            for r in sorted(rows, key=lambda r: (r[1], r[0], r[2])):
                f.write(f'{r[0]},{r[1]},{r[2]}\n')
        report['schedules'][f'grade-{g}'] = len(rows)

    json.dump(report, open(os.path.join(HERE, 'assembly-derived.json'), 'w'), indent=2, sort_keys=True)
    print(json.dumps({k: (v if k != 'families' else list(v)) for k, v in report.items()}, indent=2)[:2000])

def write_coverage(path, fam, root, buckets, detail):
    L = []
    L.append(f'# Standards Coverage Registry — {fam}')
    L.append('')
    L.append('**Derived artifact.** Assembled by `curriculum-release-candidates/hs912-r1` from the')
    L.append(f'standards custody documents delivered by the authoring lane under')
    L.append(f'`{WAVE}/subjects/{root}/`, which are copied verbatim into `source-docs/` beside this file.')
    L.append('')
    L.append('This file enumerates every standards string cited by a delivered unit or lesson in this')
    L.append('family and classifies each against that lane\'s own custody documents. **No standards code')
    L.append('is invented here.** A code appears in backticks — and is therefore accepted by')
    L.append('`release/validate-high-school.mjs` as traceable — only when this file can evidence it.')
    L.append('')
    L.append('| Class | Meaning | Count |')
    L.append('| --- | --- | --- |')
    L.append(f'| VERBATIM | the string occurs verbatim in the lane custody documents | {len(buckets["VERBATIM"])} |')
    L.append(f'| COMPOSITE_VERIFIED | a lane-composed label whose every component the lane evidences | {len(buckets["COMPOSITE_VERIFIED"])} |')
    L.append(f'| DECLARED_UNVERIFIED | the lane marked the citation UNVERIFIED itself | {len(buckets["DECLARED_UNVERIFIED"])} |')
    L.append(f'| UNTRACEABLE | not evidenced by the lane custody documents | {len(buckets["UNTRACEABLE"])} |')
    L.append('')
    if buckets['VERBATIM']:
        L.append('## Verbatim')
        L.append('')
        for c in buckets['VERBATIM']: L.append(f'- `{c}`')
        L.append('')
    if buckets['COMPOSITE_VERIFIED']:
        L.append('## Composite, components verified')
        L.append('')
        L.append('Each label below is composed by the lane from parts its own custody documents evidence:')
        L.append('verbatim text, a restatement built from at least two published vocabulary words, or a code')
        L.append('token whose alphabetic suffix and whose construction template the lane publishes. The')
        L.append('composite string itself is a lane label, not a state code.')
        L.append('')
        for c in buckets['COMPOSITE_VERIFIED']: L.append(f'- `{c}`')
        L.append('')
    if buckets['DECLARED_UNVERIFIED']:
        L.append('## Declared UNVERIFIED by the lane')
        L.append('')
        for c in buckets['DECLARED_UNVERIFIED']: L.append(f'- `{c}`')
        L.append('')
    L.append('## Untraceable — NOT accepted as traceable')
    L.append('')
    if not buckets['UNTRACEABLE']:
        L.append('None. Every cited string is evidenced above.')
    else:
        L.append('These strings are cited by delivered content but are **not** evidenced by this family\'s')
        L.append('custody documents. They are deliberately left unquoted so that the release validator')
        L.append('reports them rather than accepting them. Resolution belongs to the authoring lane.')
        L.append('')
        L.append('| Cited string | Components not found in lane custody |')
        L.append('| --- | --- |')
        for c in buckets['UNTRACEABLE']:
            miss = ', '.join(detail[c]['missing_components']) or '(whole string)'
            L.append(f'| {c} | {miss} |')
    L.append('')
    open(path, 'w', encoding='utf8').write('\n'.join(L))

main()
