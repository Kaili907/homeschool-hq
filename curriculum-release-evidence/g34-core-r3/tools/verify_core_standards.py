#!/usr/bin/env python3
"""Resolve Grade 3/4 core-subject standards citations against primary MDE sources.

Reads the normalized release's per-course standards artifacts (read-only) and the
locally custodied MDE PDFs' extracted text, and emits a machine-readable evidence
registry, alias maps, per-course coverage, an unresolved list and before/after counts.

Writes only under curriculum-release-evidence/g34-core-r3/.
"""
import json, os, re, hashlib, sys

HERE = os.path.dirname(os.path.abspath(__file__))
EV = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(EV))
REL = os.path.join(REPO, 'curriculum-release-normalization', 'g34-r2')
COURSES = os.path.join(REL, 'standards', 'courses')

CORE = [
    ('ma-g3-mathematics', 3, 'mathematics'),
    ('ma-g4-mathematics', 4, 'mathematics'),
    ('ma-g3-english-language-arts', 3, 'english-language-arts'),
    ('ma-g4-english-language-arts', 4, 'english-language-arts'),
    ('ma-g3-science', 3, 'science'),
    ('ma-g4-science', 4, 'science'),
    ('ma-g3-social-studies', 3, 'social-studies'),
    ('ma-g4-social-studies', 4, 'social-studies'),
]

SRC = {
    'mathematics': 'mde-mathematics',
    'english-language-arts': 'mde-english-language-arts',
    'science': 'mde-science',
    'social-studies': 'mde-social-studies',
}

def load_text(name):
    return open(os.path.join(EV, 'extract', name + '.txt'), encoding='utf-8').read()

TEXT = {k: load_text(v) for k, v in SRC.items()}

def page_index(t):
    return [(m.start(), int(m.group(1))) for m in re.finditer(r'<<<PAGE (\d+)>>>', t)]

PAGES = {k: page_index(v) for k, v in TEXT.items()}

def page_of(subject, pos):
    p = 0
    for s, n in PAGES[subject]:
        if s <= pos:
            p = n
        else:
            break
    return p

def snippet(t, pos, n=90):
    s = re.sub(r'\s+', ' ', t[pos:pos + n]).strip()
    return s

# ---------------------------------------------------------------- science
_SCI_HEADS = sorted((m.start(), int(m.group(1))) for m in re.finditer(
    r'(?m)^(\d)(?:st|nd|rd|th) Grade Performance Expectations', TEXT['science']))
SCI_GRADE_SPAN = {}
for _i, (_p, _g) in enumerate(_SCI_HEADS):
    _e = _SCI_HEADS[_i + 1][0] if _i + 1 < len(_SCI_HEADS) else len(TEXT['science'])
    SCI_GRADE_SPAN[_g] = (_p, _e)


def verify_science(code, grade):
    t = TEXT['science']
    hits = [m.start() for m in re.finditer(re.escape(code) + r'(?![0-9A-Za-z-])', t)]
    span = SCI_GRADE_SPAN.get(grade)
    if span:
        inside = [h for h in hits if span[0] <= h < span[1]]
        if not inside:
            # a 3-5 band expectation is reprinted under each grade it applies to; if it is
            # absent from this grade's own section it is not this grade's standard.
            return None
        hits = inside
    if not hits:
        return None
    pos = hits[0]
    return {
        'classification': 'VERBATIM_VERIFIED',
        'resolved_code': code,
        'method': 'exact-string match of the performance-expectation code in the primary source',
        'evidence': [{
            'source_id': 'mde-science', 'page': page_of('science', pos),
            'char_offset': pos, 'match': 'verbatim', 'snippet': snippet(t, pos),
        }],
        'occurrences': len(hits),
    }

# ---------------------------------------------------------------- social studies
DASHES = dict.fromkeys(map(ord, '‐‑‒–—―-'), '–')

def ss_norm(s):
    return re.sub(r'\s+', ' ', s.translate(DASHES)).strip()

SS_NORM = {g: None for g in (3, 4)}
_ss_norm_text = ss_norm(TEXT['social-studies'])

_SS_HEADS = sorted((m.start(), m.group(1).upper()) for m in re.finditer(
    r'(?i)SOCIAL STUDIES CONTENT EXPECTATIONS: GRADE (ONE|TWO|THREE|FOUR|FIVE|SIX)',
    TEXT['social-studies']))
_SS_WORD = {'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5, 'SIX': 6}
SS_GRADE_SPAN = {}
for _i, (_p, _w) in enumerate(_SS_HEADS):
    _e = _SS_HEADS[_i + 1][0] if _i + 1 < len(_SS_HEADS) else len(TEXT['social-studies'])
    SS_GRADE_SPAN[_SS_WORD[_w]] = (_p, _e)
# offset map from normalized -> original is not needed; locate in original with a tolerant regex
def verify_social_studies(code, grade):
    t = TEXT['social-studies']
    g, rest = [x.strip() for x in ss_norm(code).split('–', 1)]
    pat = re.compile(re.escape(g) + r'\s*[‐-―-]\s*' + re.escape(rest) + r'(?![0-9])')
    hits = [m.start() for m in pat.finditer(t)]
    span = SS_GRADE_SPAN.get(grade)
    if span:
        inside = [h for h in hits if span[0] <= h < span[1]]
        if inside:
            hits = inside
    if not hits:
        # the primary source prints a malformed sibling of this code (e.g. "4 - E1.01"
        # where every sibling reads "4 - E1.0.n"). That is a defect in the source, not a
        # verification: the correction is a judgement a human has to make.
        defect = re.fullmatch(r'([A-Z]\d)\.0\.(\d+)', rest)
        if defect:
            alt = '%s.0%s' % (defect.group(1), defect.group(2))
            lo, hi = SS_GRADE_SPAN.get(grade, (0, len(t)))
            am = re.search(re.escape(g) + r'\s*[‐-―-]\s*' + re.escape(alt) + r'(?![0-9.])', t[lo:hi])
            if am:
                class _M:
                    def __init__(self, m, off):
                        self._m, self._o = m, off
                    def start(self):
                        return self._m.start() + self._o
                    def group(self, *a):
                        return self._m.group(*a)
                am = _M(am, lo)
            if am:
                return {
                    'classification': 'HUMAN_REVIEW_REQUIRED',
                    'resolved_code': None,
                    'source_defect': True,
                    'source_printed_variant': ss_norm(am.group(0)),
                    'method': 'the cited code is not printed; the primary source prints a '
                              'malformed variant at the expected position, and every sibling '
                              'code in the same cluster uses the cited form. Correcting the '
                              'source is a human ruling, not a verification.',
                    'evidence': [{'source_id': 'mde-social-studies',
                                  'page': page_of('social-studies', am.start()),
                                  'char_offset': am.start(), 'match': 'source-printed-variant',
                                  'snippet': snippet(t, am.start())}],
                }
        return None
    pos = hits[0]
    exact = code in t
    return {
        'classification': 'VERBATIM_VERIFIED',
        'resolved_code': code,
        'method': ('exact-string match of the expectation code in the primary source' if exact
                   else 'match after dash/whitespace normalization only (alias-maps/social-studies-code-normalization.alias.json)'),
        'evidence': [{
            'source_id': 'mde-social-studies', 'page': page_of('social-studies', pos),
            'char_offset': pos, 'match': 'verbatim' if exact else 'verbatim-after-whitespace-normalization',
            'snippet': snippet(t, pos),
        }],
        'occurrences': len(hits),
    }

# ---------------------------------------------------------------- mathematics
MATH = TEXT['mathematics']
GRADE_SPAN = {}
for m in re.finditer(r'(?i)In Grade (\d), instructional time should focus on', MATH):
    GRADE_SPAN.setdefault(int(m.group(1)), []).append(m.start())
_gs = sorted((g, v[0]) for g, v in GRADE_SPAN.items())
MATH_GRADE_RANGE = {}
for i, (g, s) in enumerate(_gs):
    e = _gs[i + 1][1] if i + 1 < len(_gs) else len(MATH)
    MATH_GRADE_RANGE[g] = (s, e)

MATH_DOMAINS = {}   # (grade, domain) -> (header_pos, sec_start, sec_end)
for g in (3, 4):
    lo, hi = MATH_GRADE_RANGE[g]
    heads = [(m.start(), m.group(0)) for m in
             re.finditer(r'(?i)\b%d\.(oa|nbt|nf|md|g)\b' % g, MATH[lo:hi])]
    heads = [(p + lo, s) for p, s in heads]
    heads.sort()
    for i, (p, s) in enumerate(heads):
        end = heads[i + 1][0] if i + 1 < len(heads) else hi
        MATH_DOMAINS[(g, s.split('.')[1].upper())] = (p, p, end)

MATH_ITEM_RE = re.compile(r'(?m)^[ \t]*(\d{1,2})[ \t]*(?:\.(?![0-9])|\t)')

PRACTICE_TITLES = {
    1: 'Make sense of problems and persevere in solving them',
    2: 'Reason abstractly and quantitatively',
    3: 'Construct viable arguments and critique the reasoning of others',
    4: 'Model with mathematics',
    5: 'Use appropriate tools strategically',
    6: 'Attend to precision',
    7: 'Look for and make use of structure',
    8: 'Look for and express regularity in repeated reasoning',
}

def verify_math(code, grade):
    mp = re.fullmatch(r'MP\.(\d)', code)
    if mp:
        n = int(mp.group(1))
        title = PRACTICE_TITLES.get(n)
        if not title:
            return None
        for m in re.finditer(re.escape(title), MATH):
            pre = MATH[max(0, m.start() - 12):m.start()].replace('\n', ' ')
            if re.search(r'(?<!\d)%d\s*$' % n, pre):
                return {
                    'classification': 'COMPOSITE_VERIFIED',
                    'resolved_code': 'Standards for Mathematical Practice, practice %d' % n,
                    'method': 'house label MP.n resolved by alias-maps/math-practice.alias.json; '
                              'the source prints the practice number and title, not the "MP." label',
                    'label_printed_by_source': False,
                    'evidence': [{
                        'source_id': 'mde-mathematics', 'page': page_of('mathematics', m.start()),
                        'char_offset': m.start(), 'match': 'practice-number+title',
                        'snippet': snippet(MATH, max(0, m.start() - 2)),
                    }],
                }
        return None

    cm = re.fullmatch(r'([34])\.(OA|NBT|NF|MD|G)\.(\d+)', code)
    if not cm:
        return None
    g, dom, num = int(cm.group(1)), cm.group(2), int(cm.group(3))
    if g != grade:
        return None
    key = (g, dom)
    if key not in MATH_DOMAINS:
        return None
    hp, s, e = MATH_DOMAINS[key]
    sec = MATH[s:e]
    items = {}
    for m in re.finditer(MATH_ITEM_RE, sec):
        if m.start() == 0:
            continue          # the domain header itself opens the section
        n = int(m.group(1))
        if n:
            items.setdefault(n, m.start())
    if num not in items:
        return None
    ip = s + items[num]
    return {
        'classification': 'COMPOSITE_VERIFIED',
        'resolved_code': code,
        'method': 'the source prints the domain code as a section header and the standards as '
                  'numbered items beneath it; <grade>.<domain>.<number> is composed from both',
        'label_printed_by_source': False,
        'evidence': [
            {'source_id': 'mde-mathematics', 'page': page_of('mathematics', hp),
             'char_offset': hp, 'match': 'domain-header', 'snippet': snippet(MATH, hp, 40)},
            {'source_id': 'mde-mathematics', 'page': page_of('mathematics', ip),
             'char_offset': ip, 'match': 'numbered-standard', 'snippet': snippet(MATH, ip)},
        ],
    }

# ---------------------------------------------------------------- ELA
ELA = TEXT['english-language-arts']
_ep = re.split(r'<<<PAGE (\d+)>>>', ELA)
ELA_PAGE = {int(_ep[i]): _ep[i + 1] for i in range(1, len(_ep), 2)}
ELA_PAGE_OFF = {}
_off = len(_ep[0])
for i in range(1, len(_ep), 2):
    _off += len('<<<PAGE %s>>>' % _ep[i])
    ELA_PAGE_OFF[int(_ep[i])] = _off
    _off += len(_ep[i + 1])

STRAND_TITLE = {
    'RL': 'Reading Standards for Literature K–5',
    'RI': 'Reading Standards for Informational T ext K–5',
    'RF': 'Reading Standards: Foundational Skills (K–5)',
    'W':  'Writing Standards K–5',
    'SL': 'Speaking and Listening Standards K–5',
    'L':  'Language Standards K–5',
}
# pages of the K-5 grade 3-5 spread, per strand (established by grade-column headers)
STRAND_PAGES = {'RL': [12], 'RI': [14], 'RF': [17], 'W': [20, 21], 'SL': [24], 'L': [28, 29]}

def _strand_designator_evidence(strand):
    """The source prints the strand designator alongside the full strand title."""
    title = STRAND_TITLE[strand]
    pat = re.compile(re.escape(title) + r'\s*(?:%s)' % re.escape(strand), re.I)
    m = pat.search(ELA)
    if m:
        return {'source_id': 'mde-english-language-arts', 'page': page_of('english-language-arts', m.start()),
                'char_offset': m.start(), 'match': 'strand-designator', 'snippet': snippet(ELA, m.start(), 70)}
    return None

LEGEND = re.search(r'identified by their strand, grade, and number', ELA)


def ela_cells(page_text, num):
    """Start offsets of each grade cell for row `num` on a three-column K-5 spread.

    A cell normally starts a line, but where the preceding cell is a short parenthetical
    stub - "(Begins in grade 4)", "(Not applicable to literature)" - the next cell stays on
    the same line, so a line-start scan silently loses a column and shifts every later
    column by one grade.
    """
    pat = re.compile(r'(?m)(?:^|(?<=\) ))%d\.\s' % num)
    return [m.start() for m in pat.finditer(page_text)]

def verify_ela(code, grade):
    m = re.fullmatch(r'([34])\.(RL|RI|RF|SL|W|L)\.(\d+)([a-z])?', code)
    if not m:
        return None
    g, strand, num, letter = int(m.group(1)), m.group(2), int(m.group(3)), m.group(4)
    if g != grade:
        return None
    official = '%s.%d.%d%s' % (strand, g, num, letter or '')
    sd = _strand_designator_evidence(strand)
    if sd is None:
        return None
    col = 'Grade %d students' % g
    for p in STRAND_PAGES[strand]:
        x = ELA_PAGE[p]
        if col not in x:
            continue
        occ = ela_cells(x, num)
        if not occ:
            continue
        idx = g - 3   # grade-3 / grade-4 / grade-5 columns in reading order
        if len(occ) != 3:
            return {'classification': 'HUMAN_REVIEW_REQUIRED', 'resolved_code': official,
                    'alias_applied': 'ela-code-order',
                    'method': 'the grade 3/4/5 spread for this strand did not extract as three '
                              'cells for this row (%d found), so the grade column cannot be '
                              'attributed mechanically' % len(occ),
                    'evidence': [{'source_id': 'mde-english-language-arts', 'page': p,
                                  'char_offset': ELA_PAGE_OFF[p] + occ[0],
                                  'match': 'ambiguous-row', 'snippet': snippet(x, occ[0])}]}
        pos = occ[idx]
        body = x[pos:occ[idx + 1] if idx + 1 < len(occ) else min(len(x), pos + 1600)]
        if re.match(r'%d\.\s*\((?:Begins|Not applicable)' % num, body):
            return {'classification': 'HUMAN_REVIEW_REQUIRED', 'resolved_code': official,
                    'method': 'the source prints this numbered standard as not applicable at this grade',
                    'evidence': [{'source_id': 'mde-english-language-arts', 'page': p,
                                  'char_offset': ELA_PAGE_OFF[p] + pos, 'match': 'not-applicable',
                                  'snippet': snippet(x, pos, 60)}]}
        ev = [sd,
              {'source_id': 'mde-english-language-arts', 'page': p,
               'char_offset': ELA_PAGE_OFF[p] + x.find(col), 'match': 'grade-column-header',
               'snippet': col + ':'},
              {'source_id': 'mde-english-language-arts', 'page': p,
               'char_offset': ELA_PAGE_OFF[p] + pos, 'match': 'numbered-standard',
               'snippet': snippet(x, pos)}]
        if letter:
            lm = re.search(r'(?m)^%s\.\s' % letter, body)
            if not lm:
                return None
            lp = pos + lm.start()
            ev.append({'source_id': 'mde-english-language-arts', 'page': p,
                       'char_offset': ELA_PAGE_OFF[p] + lp, 'match': 'lettered-sub-standard',
                       'snippet': snippet(x, lp)})
        if LEGEND:
            ev.append({'source_id': 'mde-english-language-arts',
                       'page': page_of('english-language-arts', LEGEND.start()),
                       'char_offset': LEGEND.start(), 'match': 'code-order-legend',
                       'snippet': snippet(ELA, LEGEND.start(), 110)})
        return {'classification': 'COMPOSITE_VERIFIED', 'resolved_code': official,
                'alias_applied': 'ela-code-order',
                'method': 'house <grade>.<strand>.<number> transposed to the source-stated '
                          '<strand>.<grade>.<number>, then verified from the printed strand '
                          'designator, grade column header and numbered standard',
                'label_printed_by_source': False,
                'evidence': ev}
    return None


# ------------------------------------------------- official inventories (reverse coverage)
def inventory(subject, grade):
    if subject == 'science':
        pages = {3: (10, 11), 4: (12, 13)}[grade]
        t = TEXT['science']
        out = set()
        for m in re.finditer(r'\b(?:%d|3-5)-[A-Z]{2,4}\d?-\d\b' % grade, t):
            if page_of('science', m.start()) in pages:
                out.add(m.group(0))
        return sorted(out)
    if subject == 'social-studies':
        t = TEXT['social-studies']
        out = set()
        lo, hi = SS_GRADE_SPAN[grade]
        for m in re.finditer(r'(?<![0-9])%d\s*[‐-―-]\s*([A-Z]\d\.\d\.\d+)(?![0-9])' % grade, t[lo:hi]):
            out.add('%d – %s' % (grade, m.group(1)))
        return sorted(out)
    if subject == 'mathematics':
        out = []
        for (g, dom), (hp, s0, e0) in sorted(MATH_DOMAINS.items()):
            if g != grade:
                continue
            sec = MATH[s0:e0]
            nums = sorted({int(m.group(1)) for m in MATH_ITEM_RE.finditer(sec)
                           if m.start() and int(m.group(1))})
            out += ['%d.%s.%d' % (g, dom, n) for n in nums]
        return sorted(out)
    if subject == 'english-language-arts':
        out = []
        for strand, pgs in STRAND_PAGES.items():
            for p in pgs:
                x = ELA_PAGE[p]
                if 'Grade %d students' % grade not in x:
                    continue
                for n in sorted({int(m.group(1)) for m in re.finditer(r'(?m)^(\d{1,2})\.\s', x)}):
                    occ = [mm for mm in re.finditer(r'(?m)^%d\.\s' % n, x)]
                    idx = grade - 3
                    if idx >= len(occ):
                        continue
                    body = x[occ[idx].start():]
                    if re.match(r'(?m)^%d\.\s*\((?:Begins|Not applicable)' % n, body):
                        continue
                    out.append('%d.%s.%d' % (grade, strand, n))
        return sorted(out)
    return []


VERIFY = {'science': verify_science, 'social-studies': verify_social_studies,
          'mathematics': verify_math, 'english-language-arts': verify_ela}

# ---------------------------------------------------------------- run
def main():
    registry = []
    coverage = {}
    unresolved = []
    before = {'canonical': 0, 'unverified': 0, 'human-review': 0}
    for course_id, grade, subject in CORE:
        art = json.load(open(os.path.join(COURSES, course_id + '.standards.json')))
        cov = {'course_id': course_id, 'grade': grade, 'subject': subject,
               'official_source': art['official_source'],
               'source_id': SRC[subject],
               'citations': art['totals']['citations'], 'distinct': art['totals']['distinct'],
               'before': {k: art['totals'][k] for k in ('canonical', 'unverified', 'human-review')},
               'after_citations': {}, 'after_distinct': {}}
        for k in ('canonical', 'unverified', 'human-review'):
            before[k] += art['totals'][k]
        for s in art['standards']:
            code = s['code_or_strand']
            r = VERIFY[subject](code, grade) or {
                'classification': 'UNVERIFIED',
                'resolved_code': None,
                'method': 'not located in the primary source by any rule for this subject',
                'evidence': []}
            entry = {
                'course_id': course_id, 'grade': grade, 'subject': subject,
                'cited_code': code,
                'resolved_code': r['resolved_code'],
                'classification': r['classification'],
                'alias_applied': r.get('alias_applied'),
                'label_printed_by_source': r.get('label_printed_by_source', True),
                'method': r['method'],
                'citation_count': s['citation_count'],
                'prior_mapping_status': s['mapping_status'],
                'prior_derivation_rule': s.get('derivation_rule'),
                'unit_numbers': s['unit_numbers'],
                'lesson_count': len(s['lesson_ids']),
                'source_id': SRC[subject],
                'source_defect': r.get('source_defect', False),
                'source_printed_variant': r.get('source_printed_variant'),
                'evidence': r['evidence'],
            }
            registry.append(entry)
            c = r['classification']
            cov['after_citations'][c] = cov['after_citations'].get(c, 0) + s['citation_count']
            cov['after_distinct'][c] = cov['after_distinct'].get(c, 0) + 1
            if c in ('UNVERIFIED', 'HUMAN_REVIEW_REQUIRED'):
                unresolved.append({'course_id': course_id, 'cited_code': code,
                                   'classification': c, 'citation_count': s['citation_count'],
                                   'reason': r['method'],
                                   'source_id': SRC[subject],
                                   'source_printed_variant': r.get('source_printed_variant'),
                                   'evidence': r['evidence'],
                                   'unit_numbers': s['unit_numbers']})
        inv = inventory(subject, grade)
        cited_norm = set()
        for s2 in art['standards']:
            c2 = s2['code_or_strand']
            cited_norm.add(ss_norm(c2) if subject == 'social-studies' else c2)
        inv_norm = {(ss_norm(i) if subject == 'social-studies' else i): i for i in inv}
        cov['official_inventory_count'] = len(inv)
        cov['cited_not_in_inventory'] = sorted(cited_norm - set(inv_norm))
        cov['inventory_not_cited'] = sorted(inv_norm[k] for k in set(inv_norm) - cited_norm)
        coverage[course_id] = cov
    return registry, coverage, unresolved, before

if __name__ == '__main__':
    reg, cov, unres, before = main()
    json.dump(reg, open(os.path.join(EV, 'registry', 'evidence-registry.json'), 'w'), indent=2)
    json.dump(cov, open(os.path.join(EV, 'coverage', 'per-course-coverage.json'), 'w'), indent=2)
    json.dump(unres, open(os.path.join(EV, 'coverage', 'unresolved.json'), 'w'), indent=2)
    tot = {}
    for e in reg:
        tot[e['classification']] = tot.get(e['classification'], 0) + e['citation_count']
    print('BEFORE', before)
    print('AFTER ', tot, 'sum', sum(tot.values()))
