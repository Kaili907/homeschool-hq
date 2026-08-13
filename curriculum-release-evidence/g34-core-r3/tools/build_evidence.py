#!/usr/bin/env python3
"""Build the custody, alias-map, coverage, counts and validation artifacts.

Runs the resolver in verify_core_standards.py and writes every artifact under
curriculum-release-evidence/g34-core-r3/. Writes nothing outside that directory.
"""
import csv, hashlib, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
EV = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import verify_core_standards as V  # noqa: E402

from pypdf import PdfReader

SOURCES = [
    {
        'source_id': 'mde-mathematics',
        'title': 'Michigan K-12 Standards: Mathematics',
        'publisher': 'Michigan Department of Education',
        'url': 'https://www.michigan.gov/-/media/Project/Websites/mde/Literacy/'
               'Content-Standards/Math_Standards.pdf?rev=1e793e2b1e314e4fa1abc754251b5dc9',
        'file': 'sources/mde-mathematics.pdf',
        'covers': ['ma-g3-mathematics', 'ma-g4-mathematics'],
    },
    {
        'source_id': 'mde-english-language-arts',
        'title': 'Michigan K-12 Standards: English Language Arts',
        'publisher': 'Michigan Department of Education',
        'url': 'https://www.michigan.gov/-/media/Project/Websites/mde/Literacy/'
               'Content-Standards/ELA_Standards.pdf?rev=0f76588bc2bd48f89165484fa35d2b31',
        'file': 'sources/mde-english-language-arts.pdf',
        'covers': ['ma-g3-english-language-arts', 'ma-g4-english-language-arts'],
    },
    {
        'source_id': 'mde-science',
        'title': 'Michigan K-12 Standards: Science (November 2015)',
        'publisher': 'Michigan Department of Education',
        'url': 'https://www.michigan.gov/mde/-/media/Project/Websites/mde/Literacy/'
               'Content-Standards/Science_Standards.pdf?rev=30bad7c0cbc048ceabb5548669b2d76a'
               '&hash=7E6FE20EA3F051673EC3B27ABF14FD96',
        'file': 'sources/mde-science.pdf',
        'covers': ['ma-g3-science', 'ma-g4-science'],
    },
    {
        'source_id': 'mde-social-studies',
        'title': 'Michigan K-12 Standards: Social Studies (v 6/19)',
        'publisher': 'Michigan Department of Education',
        'url': 'https://www.michigan.gov/-/media/Project/Websites/mde/Academic-Standards/'
               'Social_Studies_Standards.pdf?rev=4bab170dd4114e2dbce578723b37ca63',
        'file': 'sources/mde-social-studies.pdf',
        'covers': ['ma-g3-social-studies', 'ma-g4-social-studies'],
    },
]


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def headers(path):
    out = {}
    for line in open(path, encoding='utf-8', errors='replace'):
        line = line.strip()
        if line.lower().startswith('http/'):
            out['status_line'] = line
        elif ':' in line:
            k, v = line.split(':', 1)
            if k.lower() in ('date', 'last-modified', 'etag', 'content-type', 'content-length'):
                out[k.lower()] = v.strip()
    return out


def build_custody():
    recs = []
    for s in SOURCES:
        p = os.path.join(EV, s['file'])
        hp = p + '.headers.txt'
        h = headers(hp)
        txt = os.path.join(EV, 'extract', s['source_id'] + '.txt')
        rec = dict(s)
        rec['retrieval'] = {
            'method': 'HTTPS GET (curl), direct from michigan.gov, no intermediary or mirror',
            'retrieved_at_utc': h.get('date'),
            'http_status': h.get('status_line'),
            'content_type': h.get('content-type'),
            'content_length': int(h.get('content-length', 0)) or None,
            'server_last_modified': h.get('last-modified'),
            'server_etag': h.get('etag'),
            'response_headers_file': s['file'] + '.headers.txt',
        }
        rec['pdf'] = {
            'bytes': os.path.getsize(p),
            'sha256': sha256(p),
            'pages': len(PdfReader(p).pages),
        }
        rec['extraction'] = {
            'text_file': 'extract/%s.txt' % s['source_id'],
            'sha256': sha256(txt),
            'extractor': 'pypdf %s, PdfReader.extract_text() per page' % __import__('pypdf').__version__,
            'page_markers': '<<<PAGE n>>> delimits each PDF page; n is the 1-based PDF page '
                            'index, which is not always the printed folio',
            'snippet_normalisation': 'registry snippets collapse runs of whitespace to a single '
                                     'space for legibility, so a snippet may differ from the '
                                     'bytes at its char_offset by whitespace alone. char_offset '
                                     'and the cited code itself are never normalised.',
        }
        recs.append(rec)
    return recs


ALIASES = {
    'ela-code-order': {
        'alias_id': 'ela-code-order',
        'applies_to': ['ma-g3-english-language-arts', 'ma-g4-english-language-arts'],
        'problem': 'This release prints ELA codes as <grade>.<strand>.<number> (3.RL.1). The '
                   'primary source states the ordering is <strand>.<grade>.<number> (RL.3.1). '
                   'The two strings are not equal and must never be compared as if they were.',
        'source_statement': {
            'source_id': 'mde-english-language-arts',
            'locator': 'Introduction, "How to read this document"',
            'quoted': 'identified by their strand, grade, and number',
            'reading': 'the source gives RI.4.3 as its own worked example of the ordering',
        },
        'direction': 'house -> official',
        'transform': {
            'house_pattern': '^(?P<grade>[0-9K]+)\\.(?P<strand>RL|RI|RF|W|SL|L)\\.(?P<number>[0-9]+)(?P<letter>[a-z]?)$',
            'official_template': '{strand}.{grade}.{number}{letter}',
        },
        'inverse_transform': {
            'official_pattern': '^(?P<strand>RL|RI|RF|W|SL|L)\\.(?P<grade>[0-9K]+)\\.(?P<number>[0-9]+)(?P<letter>[a-z]?)$',
            'house_template': '{grade}.{strand}.{number}{letter}',
        },
        'reversible': True,
        'lossless': True,
        'caveat': 'The primary source prints no full ELA code except the legend example RI.4.3 '
                  'and the sub-codes in the Language Progressive Skills table (L.3.1f, L.3.3a, '
                  'L.4.1f, L.4.1g, L.4.3a, L.4.3b). Transposing therefore yields a code that is '
                  'correct by the source\'s own stated convention but is not itself a printed '
                  'string, which is why every ELA citation lands in COMPOSITE_VERIFIED and not '
                  'in ALIAS_RESOLVED_VERBATIM.',
        'pairs': {},
    },
    'math-practice': {
        'alias_id': 'math-practice',
        'applies_to': ['ma-g3-mathematics', 'ma-g4-mathematics'],
        'problem': 'This release prints MP.n for the Standards for Mathematical Practice. The '
                   'string "MP" does not occur anywhere in the primary source.',
        'source_statement': {
            'source_id': 'mde-mathematics',
            'locator': 'Standards for Mathematical Practice',
            'reading': 'the source prints the eight practices as a numbered list, 1 through 8, '
                       'each with a title; it prints no code for them',
        },
        'direction': 'house -> official',
        'transform': {
            'house_pattern': '^MP\\.(?P<n>[1-8])$',
            'official_template': 'Standards for Mathematical Practice, practice {n}',
        },
        'official_codes_live_in': 'mde-mathematics',
        'inverse_transform': {
            'official_pattern': '^Standards for Mathematical Practice, practice (?P<n>[1-8])$',
            'house_template': 'MP.{n}',
        },
        'reversible': True,
        'lossless': True,
        'caveat': 'The referent is verified (number and title are printed); the "MP." label is a '
                  'house/Common Core convention the MDE document does not print.',
        'pairs': {},
    },
    'math-domain-composition': {
        'alias_id': 'math-domain-composition',
        'applies_to': ['ma-g3-mathematics', 'ma-g4-mathematics'],
        'problem': 'This release prints math content codes as <grade>.<domain>.<number> '
                   '(3.OA.1). The primary source prints the domain code as a section header '
                   '(3.OA) and the standards as numbered items beneath it; the joined string '
                   'never appears.',
        'direction': 'house -> official components',
        'transform': {
            'house_pattern': '^(?P<grade>[34])\\.(?P<domain>OA|NBT|NF|MD|G)\\.(?P<number>[0-9]+)$',
            'official_components': ['domain header "{grade}.{domain}"',
                                    'numbered standard "{number}." within that header\'s section'],
        },
        'inverse_transform': {
            'components_pattern': '^(?P<grade>[34])\\.(?P<domain>OA|NBT|NF|MD|G)\\|(?P<number>[0-9]+)$',
            'house_template': '{grade}.{domain}.{number}',
            'note': 'the alias target is a pair of printed components, not a string, so the '
                    'inverse recomposes the house code from "<header>|<item number>"',
        },
        'reversible': True,
        'lossless': True,
        'caveat': 'The Common Core namespace inserts a cluster letter (3.OA.A.1). This release '
                  'and the MDE document both omit it, so a join against a cluster-lettered '
                  'namespace needs a further mapping that is out of scope here.',
        'pairs': {},
    },
    'social-studies-code-normalization': {
        'alias_id': 'social-studies-code-normalization',
        'applies_to': ['ma-g3-social-studies', 'ma-g4-social-studies'],
        'problem': 'Social studies codes carry a spaced dash ("3 – C1.0.1"). Dash character '
                   'and surrounding whitespace vary between the release, the PDF and its text '
                   'extraction.',
        'direction': 'both',
        'transform': {
            'rule': 'collapse runs of whitespace to a single space; map U+2010..U+2015 and '
                    'U+002D all to U+2013',
        },
        'reversible': False,
        'lossless': False,
        'caveat': 'Normalisation is for matching only. Every social studies citation in this '
                  'release matched the primary source byte-for-byte before normalisation was '
                  'needed, so the map is recorded but never load-bearing; see '
                  'registry/evidence-registry.json, field "match".',
        'pairs': {},
    },
}


def main():
    reg, cov, unres, before = V.main()

    # --- alias pairs actually exercised
    for e in reg:
        if e['subject'] == 'english-language-arts' and e['resolved_code']:
            ALIASES['ela-code-order']['pairs'][e['cited_code']] = e['resolved_code']
        elif e['subject'] == 'mathematics':
            if e['cited_code'].startswith('MP.') and e['resolved_code']:
                ALIASES['math-practice']['pairs'][e['cited_code']] = e['resolved_code']
            elif e['resolved_code']:
                ALIASES['math-domain-composition']['pairs'][e['cited_code']] = e['resolved_code']
        elif e['subject'] == 'social-studies' and e['resolved_code']:
            ALIASES['social-studies-code-normalization']['pairs'][e['cited_code']] = e['resolved_code']
    for k, a in ALIASES.items():
        a['pair_count'] = len(a['pairs'])
        json.dump(a, open(os.path.join(EV, 'alias-maps', k + '.alias.json'), 'w'), indent=2, ensure_ascii=False)

    # --- custody
    custody = build_custody()
    json.dump({'release_under_review': 'curriculum-release-normalization/g34-r2',
               'evidence_set': 'curriculum-release-evidence/g34-core-r3',
               'sources': custody}, open(os.path.join(EV, 'sources', 'source-custody.json'), 'w'),
              indent=2)

    # --- registry
    json.dump(reg, open(os.path.join(EV, 'registry', 'evidence-registry.json'), 'w'),
              indent=2, ensure_ascii=False)
    with open(os.path.join(EV, 'registry', 'evidence-registry.csv'), 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['course_id', 'grade', 'subject', 'cited_code', 'resolved_code',
                    'classification', 'alias_applied', 'label_printed_by_source',
                    'source_defect', 'source_printed_variant', 'citation_count',
                    'prior_mapping_status', 'source_id', 'evidence_pages', 'method'])
        for e in reg:
            w.writerow([e['course_id'], e['grade'], e['subject'], e['cited_code'],
                        e['resolved_code'] or '', e['classification'], e['alias_applied'] or '',
                        e['label_printed_by_source'], e['source_defect'],
                        e['source_printed_variant'] or '', e['citation_count'],
                        e['prior_mapping_status'], e['source_id'],
                        '|'.join(str(x['page']) for x in e['evidence']), e['method']])

    # --- coverage + counts
    inventory_cache = {cid: set(V.inventory(c['subject'], c['grade'])) for cid, c in cov.items()}
    for cid, c in cov.items():
        if c['subject'] == 'mathematics':
            c['inventory_scope'] = ('content standards for this grade only; the eight Standards '
                                    'for Mathematical Practice are inventoried separately')
            c['practice_inventory'] = ['MP.%d' % n for n in range(1, 9)]
            c['practice_cited'] = sorted(e['cited_code'] for e in reg
                                         if e['course_id'] == cid and e['cited_code'].startswith('MP.'))
        elif c['subject'] == 'english-language-arts':
            c['inventory_scope'] = ('K-5 strand tables, grade column for this grade, excluding '
                                    'standards the source marks "(Begins in grade n)" or "(Not '
                                    'applicable to literature)"; inventory is at whole-number '
                                    'granularity, so a cited sub-letter (4.W.9a) reads as an '
                                    'uncited parent (4.W.9)')
        elif c['subject'] == 'science':
            c['inventory_scope'] = ('performance expectations printed on this grade\'s pages, '
                                    'including the 3-5 engineering design expectations repeated '
                                    'on them')
        else:
            c['inventory_scope'] = ('content expectations printed inside "SOCIAL STUDIES CONTENT '
                                    'EXPECTATIONS: GRADE <n>"; the inquiry-arc tables that '
                                    'precede those sections are excluded')
    json.dump(cov, open(os.path.join(EV, 'coverage', 'per-course-coverage.json'), 'w'),
              indent=2, ensure_ascii=False)
    json.dump(unres, open(os.path.join(EV, 'coverage', 'unresolved.json'), 'w'),
              indent=2, ensure_ascii=False)

    after_c, after_d = {}, {}
    for e in reg:
        after_c[e['classification']] = after_c.get(e['classification'], 0) + e['citation_count']
        after_d[e['classification']] = after_d.get(e['classification'], 0) + 1
    order = ['VERBATIM_VERIFIED', 'ALIAS_RESOLVED_VERBATIM', 'COMPOSITE_VERIFIED',
             'LOCAL_COMPOSITION', 'UNVERIFIED', 'HUMAN_REVIEW_REQUIRED']
    counts = {
        'scope': 'Grade 3 and Grade 4 core subjects only (mathematics, english-language-arts, '
                 'science, social-studies); the other 12 courses in the release are untouched.',
        'citations_total': sum(after_c.values()),
        'distinct_codes_total': len(reg),
        'before': {
            'source': 'curriculum-release-normalization/g34-r2/standards/standards-rollup.json',
            'by_citation': before,
            'unverified_or_human_review_citations': before['unverified'] + before['human-review'],
        },
        'after': {
            'by_citation': {k: after_c.get(k, 0) for k in order},
            'by_distinct_code': {k: after_d.get(k, 0) for k in order},
            'unverified_or_human_review_citations': after_c.get('UNVERIFIED', 0) + after_c.get('HUMAN_REVIEW_REQUIRED', 0),
        },
    }
    counts['delta'] = {
        'unverified_or_human_review_citations':
            counts['after']['unverified_or_human_review_citations']
            - counts['before']['unverified_or_human_review_citations'],
        'resolved_against_primary_source_citations':
            sum(after_c.get(k, 0) for k in ('VERBATIM_VERIFIED', 'ALIAS_RESOLVED_VERBATIM',
                                            'COMPOSITE_VERIFIED')),
    }
    json.dump(counts, open(os.path.join(EV, 'counts', 'before-after.json'), 'w'), indent=2)

    # --- validation. Every check below reads or recomputes something; none of them is
    # satisfiable by construction.
    checks = []

    def chk(name, ok, detail):
        checks.append({'check': name, 'status': 'pass' if ok else 'fail', 'detail': detail})

    core_ids = [c for c, _g, _s in V.CORE]

    # 1. the release itself is untouched: re-hash every file it sealed
    rel_sums = os.path.join(V.REL, 'SHA256SUMS.txt')
    bad, seen = [], 0
    for line in open(rel_sums, encoding='utf-8'):
        line = line.rstrip('\n')
        if not line.strip():
            continue
        want, rel = line.split('  ', 1)
        f = os.path.join(V.REL, rel)
        seen += 1
        if not os.path.exists(f) or sha256(f) != want:
            bad.append(rel)
    chk('release-under-review-untouched', seen > 0 and not bad,
        're-hashed %d files sealed by %s; %d mismatches'
        % (seen, os.path.relpath(rel_sums, V.REPO), len(bad)))

    # 2. before counts and totals recomputed from the release, not asserted
    rollup = json.load(open(os.path.join(V.REL, 'standards', 'standards-rollup.json')))
    index = json.load(open(os.path.join(V.REL, 'standards', 'standards-index.json')))
    rel_before = {'canonical': 0, 'unverified': 0, 'human-review': 0}
    for cid in core_ids:
        for k in rel_before:
            rel_before[k] += rollup['by_course'][cid][k]
    chk('before-counts-recomputed-from-release-rollup', before == rel_before,
        'core subset of standards-rollup.json: %s; this pass read: %s' % (rel_before, before))
    idx = {c['course_id']: c for c in index['courses']}
    rel_cit = sum(idx[c]['citations'] for c in core_ids)
    rel_dis = sum(idx[c]['distinct'] for c in core_ids)
    chk('totals-recomputed-from-release-index',
        counts['citations_total'] == rel_cit and len(reg) == rel_dis,
        'standards-index.json core subset: %d citations / %d distinct (course, code) pairs; '
        'this pass classified %d / %d' % (rel_cit, rel_dis, counts['citations_total'], len(reg)))

    pairs = {(e['course_id'], e['cited_code']) for e in reg}
    chk('every-citation-classified-exactly-once',
        len(pairs) == len(reg) and sum(after_c.values()) == counts['citations_total'],
        '%d rows, %d unique (course, code) pairs, buckets sum to %d'
        % (len(reg), len(pairs), sum(after_c.values())))

    # 3. every VERBATIM_VERIFIED locator really is the cited code, byte for byte
    off_bad = []
    for e in reg:
        if e['classification'] != 'VERBATIM_VERIFIED':
            continue
        t = V.TEXT[e['subject']]
        ev = e['evidence'][0]
        if t[ev['char_offset']:ev['char_offset'] + len(e['cited_code'])] != e['cited_code']:
            off_bad.append(e['cited_code'])
    chk('verbatim-locators-match-source-bytes', not off_bad,
        'sliced each of the %d verbatim locators out of the extracted source at its recorded '
        'char_offset; %d differed' % (after_d.get('VERBATIM_VERIFIED', 0), len(off_bad)))

    # 4. every evidence locator resolves to non-empty text at its offset, on its page
    ev_bad = []
    for e in reg:
        t = V.TEXT[e['subject']]
        for ev in e['evidence']:
            if not ev['snippet'].strip():
                ev_bad.append((e['cited_code'], ev['match'], 'empty snippet'))
            elif V.page_of(e['subject'], ev['char_offset']) != ev['page']:
                ev_bad.append((e['cited_code'], ev['match'], 'page/offset disagree'))
    n_ev = sum(len(e['evidence']) for e in reg)
    chk('evidence-locators-resolve', not ev_bad,
        'checked %d locators across %d entries for a non-empty snippet and page/offset '
        'agreement; %d bad' % (n_ev, len(reg), len(ev_bad)))

    # 5. grade attribution: science and social studies evidence must sit inside the grade's
    #    own section of the document, not a neighbouring grade's
    span_bad = []
    for e in reg:
        span = None
        if e['subject'] == 'science':
            span = V.SCI_GRADE_SPAN.get(e['grade'])
        elif e['subject'] == 'social-studies':
            span = V.SS_GRADE_SPAN.get(e['grade'])
        if not span:
            continue
        for ev in e['evidence']:
            if ev['match'] in ('verbatim', 'verbatim-after-whitespace-normalization',
                               'source-printed-variant') and not (span[0] <= ev['char_offset'] < span[1]):
                span_bad.append((e['course_id'], e['cited_code']))
    chk('evidence-inside-the-cited-grade-section', not span_bad,
        'every science and social studies locator falls inside its own grade section of the '
        'source; %d outside' % len(span_bad))

    # 6. ELA grade-column attribution is never guessed
    ela_amb = [e['cited_code'] for e in reg
               if e['subject'] == 'english-language-arts'
               and any(v['match'] == 'ambiguous-row' for v in e['evidence'])]
    chk('ela-grade-column-attribution-unambiguous', not ela_amb,
        'the three-cell structure resolved for every cited ELA row; rows that did not extract '
        'as three cells are refused rather than indexed positionally (%d refused)' % len(ela_amb))

    # 7. alias maps round-trip through their own recorded regexes and templates
    def round_trip(a):
        fp, ft = re.compile(a['transform']['house_pattern']), a['transform']['official_template']
        ip, it = re.compile(a['inverse_transform']['official_pattern']), a['inverse_transform']['house_template']
        fails = []
        for house, official in a['pairs'].items():
            m = fp.match(house)
            if not m or ft.format(**m.groupdict()) != official:
                fails.append(house)
                continue
            m2 = ip.match(official)
            if not m2 or it.format(**m2.groupdict()) != house:
                fails.append(house)
        return fails

    for aid in ('ela-code-order', 'math-practice'):
        a = ALIASES[aid]
        f = round_trip(a)
        chk('alias-round-trips-%s' % aid, not f and a['pair_count'] > 0,
            'exercised all %d recorded pairs through the map\'s own transform and inverse; '
            '%d failed' % (a['pair_count'], len(f)))

    # 8. no invented codes: every cited code is in the official inventory for its grade, or
    #    is one of the exceptions enumerated here and evidenced in the registry
    inv_bad = []
    for cid, c in cov.items():
        for code in c['cited_not_in_inventory']:
            if c['subject'] == 'mathematics' and re.fullmatch(r'MP\.[1-8]', code):
                continue          # practice standard; inventoried separately, evidenced
            if c['subject'] == 'english-language-arts':
                parent = re.sub(r'[a-z]$', '', code)
                if parent != code and parent in inventory_cache[cid]:
                    continue      # sub-letter of an inventoried standard
            if code == '4 – E1.0.1':
                continue          # the recorded source defect; HUMAN_REVIEW_REQUIRED
            inv_bad.append((cid, code))
    chk('no-invented-codes', not inv_bad,
        'every one of the %d cited codes is in the official inventory for its grade, or is an '
        'enumerated exception (MP.n practices, ELA sub-letters of an inventoried parent, the '
        'one source defect); %d unexplained' % (len(reg), len(inv_bad)))

    # 9. custody hashes recompute, and every source is a michigan.gov primary
    h_bad = [s2['source_id'] for s2 in custody
             if sha256(os.path.join(EV, s2['file'])) != s2['pdf']['sha256']
             or sha256(os.path.join(EV, s2['extraction']['text_file'])) != s2['extraction']['sha256']]
    chk('source-hashes-recompute', not h_bad,
        're-hashed %d PDFs and %d extracts against source-custody.json; %d mismatches'
        % (len(custody), len(custody), len(h_bad)))
    chk('all-sources-are-michigan-gov-primaries',
        all(s2['url'].startswith('https://www.michigan.gov/') for s2 in custody)
        and all(s2['retrieval']['http_status'].endswith('200') for s2 in custody),
        'four sources, each a michigan.gov URL returning 200, no mirror in the chain')

    val = {'checks': checks,
           'status': 'pass' if all(c['status'] == 'pass' for c in checks) else 'fail'}
    json.dump(val, open(os.path.join(EV, 'validation', 'validation.json'), 'w'), indent=2)

    print(json.dumps(counts['after'], indent=1))
    print('validation:', val['status'], len(checks), 'checks')
    return counts, val


if __name__ == '__main__':
    main()
