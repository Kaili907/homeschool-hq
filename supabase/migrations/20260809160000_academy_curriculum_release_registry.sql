begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Academy curriculum release registry migration must run as postgres';
  end if;
end;
$$;

create table public.academy_curriculum_releases (
  release_id uuid primary key,
  package_id text not null
    check (package_id ~ '^[a-z0-9][a-z0-9-]{0,119}$'),
  version text not null unique
    check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  status text not null check (status = 'published'),
  registered_at timestamptz not null,
  authored_on date,
  provenance_class text not null check (provenance_class = 'legacy_import'),
  source_commit text not null check (source_commit ~ '^[0-9a-f]{40}$'),
  source_root text not null check (
    source_root ~ '^curriculum-content/manuel-academy/[0-9]+\.[0-9]+\.[0-9]+$'
    and position(chr(92) in source_root) = 0
  ),
  package_manifest_sha256 text not null check (package_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  checksum_manifest_sha256 text not null check (checksum_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  curriculum_manifest_sha256 text not null check (curriculum_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  file_inventory_sha256 text not null check (file_inventory_sha256 ~ '^[0-9a-f]{64}$'),
  file_count integer not null check (file_count > 0),
  byte_count bigint not null check (byte_count > 0),
  course_count integer not null check (course_count >= 0),
  unit_count integer not null check (unit_count >= 0),
  lesson_count integer not null check (lesson_count >= 0),
  assessment_count integer not null check (assessment_count >= 0),
  text_count integer not null check (text_count >= 0),
  schedule_count integer not null check (schedule_count >= 0),
  grade_5_course_count integer not null check (grade_5_course_count >= 0),
  grade_5_unit_count integer not null check (grade_5_unit_count >= 0),
  grade_5_lesson_count integer not null check (grade_5_lesson_count >= 0),
  grade_5_assessment_count integer not null check (grade_5_assessment_count >= 0),
  grade_5_text_count integer not null check (grade_5_text_count >= 0),
  grade_5_schedule_count integer not null check (grade_5_schedule_count >= 0),
  grade_7_course_count integer not null check (grade_7_course_count >= 0),
  grade_7_unit_count integer not null check (grade_7_unit_count >= 0),
  grade_7_lesson_count integer not null check (grade_7_lesson_count >= 0),
  grade_7_assessment_count integer not null check (grade_7_assessment_count >= 0),
  grade_7_text_count integer not null check (grade_7_text_count >= 0),
  grade_7_schedule_count integer not null check (grade_7_schedule_count >= 0),
  grade_8_course_count integer not null check (grade_8_course_count >= 0),
  grade_8_unit_count integer not null check (grade_8_unit_count >= 0),
  grade_8_lesson_count integer not null check (grade_8_lesson_count >= 0),
  grade_8_assessment_count integer not null check (grade_8_assessment_count >= 0),
  grade_8_text_count integer not null check (grade_8_text_count >= 0),
  grade_8_schedule_count integer not null check (grade_8_schedule_count >= 0),
  unique (package_id, version)
);

create table public.academy_curriculum_release_files (
  release_id uuid not null references public.academy_curriculum_releases (release_id) on delete restrict,
  relative_path text not null check (
    relative_path <> ''
    and relative_path !~ '(^/|//|(^|/)\.\.?(/|$))'
    and position(chr(92) in relative_path) = 0
  ),
  byte_count bigint not null check (byte_count >= 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  content_type text not null check (content_type in (
    'application/json',
    'application/x-ndjson',
    'text/csv;charset=utf-8',
    'text/markdown;charset=utf-8',
    'text/plain;charset=utf-8'
  )),
  safe_classification text not null check (safe_classification = 'metadata_only_internal_source'),
  immutable_locator text not null unique check (
    immutable_locator ~ '^git_commit_path:[0-9a-f]{40}:curriculum-content/manuel-academy/[0-9]+\.[0-9]+\.[0-9]+/.+$'
    and position(chr(92) in immutable_locator) = 0
  ),
  primary key (release_id, relative_path)
);

create table public.academy_curriculum_active_pointers (
  environment text primary key check (environment ~ '^[a-z][a-z0-9_-]{0,39}$'),
  release_id uuid not null references public.academy_curriculum_releases (release_id) on delete restrict,
  revision bigint not null check (revision >= 1),
  change_kind text not null check (change_kind = 'migration_seed'),
  binding_mode text not null check (binding_mode = 'registry_only'),
  registered_at timestamptz not null
);

alter table public.academy_curriculum_releases owner to postgres;
alter table public.academy_curriculum_release_files owner to postgres;
alter table public.academy_curriculum_active_pointers owner to postgres;

alter table public.academy_curriculum_releases enable row level security;
alter table public.academy_curriculum_releases force row level security;
alter table public.academy_curriculum_release_files enable row level security;
alter table public.academy_curriculum_release_files force row level security;
alter table public.academy_curriculum_active_pointers enable row level security;
alter table public.academy_curriculum_active_pointers force row level security;

create function public.academy_curriculum_registry_guard_immutable()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception 'Published Academy curriculum registry rows are immutable';
end;
$$;

alter function public.academy_curriculum_registry_guard_immutable() owner to postgres;
revoke all on function public.academy_curriculum_registry_guard_immutable()
  from public, anon, authenticated, service_role;

create trigger academy_curriculum_releases_immutable
  before update or delete on public.academy_curriculum_releases
  for each row execute function public.academy_curriculum_registry_guard_immutable();
create trigger academy_curriculum_release_files_immutable
  before update or delete on public.academy_curriculum_release_files
  for each row execute function public.academy_curriculum_registry_guard_immutable();
create trigger academy_curriculum_active_pointers_immutable
  before update or delete on public.academy_curriculum_active_pointers
  for each row execute function public.academy_curriculum_registry_guard_immutable();

insert into public.academy_curriculum_releases (
  release_id, package_id, version, status, registered_at, authored_on,
  provenance_class, source_commit, source_root,
  package_manifest_sha256, checksum_manifest_sha256, curriculum_manifest_sha256,
  file_inventory_sha256, file_count, byte_count,
  course_count, unit_count, lesson_count, assessment_count, text_count, schedule_count,
  grade_5_course_count, grade_5_unit_count, grade_5_lesson_count,
  grade_5_assessment_count, grade_5_text_count, grade_5_schedule_count,
  grade_7_course_count, grade_7_unit_count, grade_7_lesson_count,
  grade_7_assessment_count, grade_7_text_count, grade_7_schedule_count,
  grade_8_course_count, grade_8_unit_count, grade_8_lesson_count,
  grade_8_assessment_count, grade_8_text_count, grade_8_schedule_count
) values (
  '16000000-0000-4000-8000-000000000001',
  'manuel-academy-grades-5-7-8-curriculum-v1',
  '1.0.0',
  'published',
  '2026-08-09 16:00:00+00',
  '2026-08-03',
  'legacy_import',
  '4056e31d8beb36622be5ac27ea7f20145266343b',
  'curriculum-content/manuel-academy/1.0.0',
  '38e6f27c24ec5371e4647364c088984fa0e1dbe25e1312847108a6d56d7404be',
  'c2ea2bfcfb7bb1983aacd36a52ff9b88ac22cc6791e1f4e1c89585d158b0f56a',
  '54c622ac0f745f88ef4eecb359e5f4f411cf1d8c7f48899fd5fcabb32b019c7b',
  '346ffa3886764314f1371fe68236741523bad8b638bdf2300e6b6c2eab93ba35',
  182, 23196845,
  30, 232, 2736, 232, 18, 3,
  10, 77, 900, 77, 6, 1,
  10, 77, 900, 77, 6, 1,
  10, 78, 936, 78, 6, 1
);

-- BEGIN GENERATED 1.0.0 RELEASE FILE ROWS
insert into public.academy_curriculum_release_files (
  release_id, relative_path, byte_count, sha256, content_type, safe_classification, immutable_locator
) values
  ('16000000-0000-4000-8000-000000000001', 'course-index.json', 16107, 'dbc677f10707f1c108e7d9d09c862faf8498eaf2f7e7017d7c7332df4085e72e', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/course-index.json'),
  ('16000000-0000-4000-8000-000000000001', 'curriculum-manifest.json', 2275, '54c622ac0f745f88ef4eecb359e5f4f411cf1d8c7f48899fd5fcabb32b019c7b', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/curriculum-manifest.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/arts-and-music/assessments.json', 15406, '91fb94faf53e3b06a85c0d8eb1a35d742f0ac4004ba8a706986b18d3ac5d459e', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/arts-and-music/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/arts-and-music/course-guide.md', 3949, '63fff8447e1db76bbc9a998224b402afede5c9837d3d9249566ad2832ad849c3', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/arts-and-music/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/arts-and-music/lesson-sequence.md', 71110, '98b39364552a991d777f3250e24864de197e3b6a985bf8ffcd38782e24dba592', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/arts-and-music/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/arts-and-music/lessons.jsonl', 476063, 'd47e4468beb38bbdad750fbc79427c9b3a060d9a6f39e8f74592008c5c09c909', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/arts-and-music/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/arts-and-music/units.json', 7961, 'b264984a6a16ea820472802d996f5c8851e67baa86319a2c46ed21c295089744', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/arts-and-music/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/english-language-arts/assessments.json', 26334, 'cc5040993430bb4cb5bbc3d8cdceb9049c5c074cea51b1f8cdc5c4a48b83f9f7', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/english-language-arts/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/english-language-arts/course-guide.md', 5178, 'e17d17c3ece9cace8b157e62dc3bdcedb15ea3dbb44991fe156a9e2270de040c', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/english-language-arts/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/english-language-arts/lesson-sequence.md', 178693, 'e93b797469955fabc9b5d46c999f8ba5f2d03d08eb7b8895f6c0869ede03c152', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/english-language-arts/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/english-language-arts/lessons.jsonl', 1200232, '649069f1a8b375e0584c3acd634e31704992ece55a55eb3b00ee640a1e233c97', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/english-language-arts/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/english-language-arts/units.json', 17710, '9c8a24fdcfc2d2f637a5b8522ef48d4cf1c54971af8dec997962931056a1e680', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/english-language-arts/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/financial-literacy/assessments.json', 15331, '6a0847690ef345cd92bcab534357cdcef91e0fd1b4c24fff7ab895a83ddc3a39', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/financial-literacy/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/financial-literacy/course-guide.md', 3938, '2e30184b1c2cf9baefb5b19977725da02d60202bbeb9c39318ae286bc8eb8782', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/financial-literacy/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/financial-literacy/lesson-sequence.md', 34981, '86c5d31b0a76aad11bbfbe5877fb89b469aea8b2b54d95fe52dcbdde502c088f', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/financial-literacy/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/financial-literacy/lessons.jsonl', 238803, 'a24bebdb413f56c292978ff4c6d683bd9e29a0dfcfd7c6b0b9d3fdce05fd2c98', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/financial-literacy/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/financial-literacy/units.json', 6675, '060f012420f7b30744e4d3d7af67a4eabedbcab82b7bdab953fdd4218fa017dc', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/financial-literacy/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/health/assessments.json', 15504, '2f2cdc520b2f40a56c995d5bc63a3bcc3a9b3834c65a8b2c5c7dfdac645432fe', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/health/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/health/course-guide.md', 4084, '060474d33f4d683afd1a3436c69e5bafe6932e9df335253548c65cc38a98ccd2', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/health/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/health/lesson-sequence.md', 36328, '18b20b109e967c26654179c791e746909f561b90f7c7494fd11f9b35caf6c764', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/health/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/health/lessons.jsonl', 243177, 'e992ee959f7acfc39a1427b443dd6998258f0a7d399586415f357fe09027cd5d', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/health/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/health/units.json', 6296, '52d085d0c31cbafbef684cf3e409f83e16a566fba6cf4f7ac5a16ccbab801aed', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/health/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/mathematics/assessments.json', 26031, 'dcff58b14e1d4a2631c74f576ca7e4dcc26850828f5da48bc146e77b4e3d9bfa', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/mathematics/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/mathematics/course-guide.md', 4978, 'b6e208ea9afe0e0636606809ccc2dcc76d1ded165d260cfec0b39afa3563baf7', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/mathematics/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/mathematics/lesson-sequence.md', 175285, 'e6b9e8055ad2a1fdff4017c12ba6957452b22462edf02f4680e3a5e5d7d9fde2', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/mathematics/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/mathematics/lessons.jsonl', 1160500, '4b66b007b4e2f1cfb658ae55510523f4c55f4ce64cc46929e97fd78b482a46a3', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/mathematics/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/mathematics/units.json', 15241, 'ae7db2f51ce4b6d9e132b6f416f70de3eb17e000952a13afc33d70e56f196a0b', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/mathematics/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/physical-education/assessments.json', 23083, '75d2ee6acc9276580bb045363e923f063f40b188f8807a811eed2a5b8c0d71c2', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/physical-education/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/physical-education/course-guide.md', 4448, '80a9f3da1faa1b1358ca2ed7dc58124f8cd756908329a5bd85e52cf43b6f468e', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/physical-education/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/physical-education/lesson-sequence.md', 105025, '94ad01e851df79b397fc3d81a370ad8955bd1763516b4d2a54d5b8f6835052ff', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/physical-education/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/physical-education/lessons.jsonl', 723716, '688400e13569d847bc8ced09a4bf2bd04a2f886b92a04a49bb12cae818d00753', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/physical-education/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/physical-education/units.json', 12493, '3991ce60114d6bdeea89ab6efdb7672a95b37d91eb9eabbf5ae669972c3b1ee5', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/physical-education/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/ready-for-life/assessments.json', 15437, 'c63e208bc08193fe63f9d33e78d107516613d103ed635f24b95259c1607d3bc3', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/ready-for-life/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/ready-for-life/course-guide.md', 4216, '5257ae30218a4de837fad11369dbd5b6f67277bdbb26e0e2ca8a33e744831cf0', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/ready-for-life/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/ready-for-life/lesson-sequence.md', 35621, 'a12e0248fa80ec6ce857b4c21a7148ad33703d3382cb3699403a713f54df9fb1', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/ready-for-life/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/ready-for-life/lessons.jsonl', 246257, '35364b7fe1e67d1b6942b5c5895a3a8975f5beb0823614c5196763a2e9933849', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/ready-for-life/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/ready-for-life/units.json', 6590, '5cd196ad1c15e011f72f8f56901b2ac33f01fa57d23a7d078ee840a3957f52dd', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/ready-for-life/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/science/assessments.json', 22967, '5244cf5bf05577613aabbc5b3496059331a6accbf3aa53f01647e80fba31c1ae', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/science/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/science/course-guide.md', 4419, 'ac4bc76ac2e940114b5d24d9d7bc541fbc4e233a762ade2acc8f3ae16ee78008', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/science/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/science/lesson-sequence.md', 103832, 'f53713c81346edeccc3c4effa1d0388fe2abd8a7da521fd66d55bc7a1e6adaf4', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/science/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/science/lessons.jsonl', 712388, '567944af5f917019150539902a35761f824d9814994063774df44435ebcaa584', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/science/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/science/units.json', 10817, '2fa1068fb2c6af7ea9e15de86df064bb9a7002430c58db64b81e6cd523d14c22', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/science/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/social-studies/assessments.json', 23355, '58b97bc2152a04e13486d07bab19d1f4e7cb6948c8f52a3c71d4410accf2f2dd', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/social-studies/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/social-studies/course-guide.md', 4709, 'e749f45bd64a43be26ec62ffd8757eeb54316a5b4b75a929af4d60ab3d8b63c0', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/social-studies/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/social-studies/lesson-sequence.md', 103121, 'a95ffcc09bf8b79ca11e66d9406dc916593a07d443fc2627c54ca937ff31fe67', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/social-studies/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/social-studies/lessons.jsonl', 718144, '99f23ad6ba6ef5fa4996f47dd54200313670f80ac0350eb6b3d12744c6d004ba', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/social-studies/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/social-studies/units.json', 12252, '4c976522b4a296ce0c05dc30b2afe4b74303fac1ba05e7fee938eccd6dee434f', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/social-studies/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/technology/assessments.json', 15327, 'e739695729258438580384c23140e26718fd5e96fb705fc013f05ac69119bf8c', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/technology/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/technology/course-guide.md', 4038, 'fc4bb00848da999ed6ee6408d13cf6f21e6cce44561c32de9135065900245e8e', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/technology/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/technology/lesson-sequence.md', 35516, 'a78b9994ff7886dd05c9858c2f928745e20b24193ef1cf55a3e5cb87dfe5c299', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/technology/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/technology/lessons.jsonl', 240185, 'a497e1dd9a1163f0ac96548dcab53807fb5def6027bfda4aad43444243e9e02c', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/technology/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/courses/technology/units.json', 6300, '2755be5492e5089b05c025815f580a9d1e3ea22589fb9307f0fbc8eb21b2815e', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/technology/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/daily-schedule.csv', 28603, '4e427df1822be9cc94985b5098e67e9a82a44d9f2aaba36c6092e3f4dcd8d3e3', 'text/csv;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/daily-schedule.csv'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/family-weekly-overview.md', 15807, '8b7dc46ee385c39d8a57ef3f5e67583554616a1a92e98641cfc4bb388b4b1f44', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/family-weekly-overview.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/grade-overview.md', 2736, '9beba48ba3855117f55bfdb8573a28007b4a2a0267035b5ea298022403bc3030', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/grade-overview.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/original-text-bank.json', 6656, '1b3e5939557dfd1e767845ce77b57ca5d1dc56f72a3036d81a9b1c0783acf82e', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/original-text-bank.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-5/original-text-bank.md', 6609, 'c7817f6f656228e287d3f41743bdef783b36cea489b7a27354d84a88ba643927', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-5/original-text-bank.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/arts-and-music/assessments.json', 15483, '678bf3f79e6d85332fe34ce56c3f9e938cfd97bc54ee0c1538ff67ea4505d970', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/arts-and-music/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/arts-and-music/course-guide.md', 3983, '485c95e69b131a9ebb5c29d4c790c23da62ec278f4816cc18fb8d73968901934', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/arts-and-music/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/arts-and-music/lesson-sequence.md', 72239, 'c6b0ab34409a869a43244f8695929b49d3a29116fa1cc389cde18fac39d8f06b', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/arts-and-music/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/arts-and-music/lessons.jsonl', 480399, 'e4a4e0c52d869ebb1106d893a64b9416022229997a1ce1157738980b1aa5b4b4', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/arts-and-music/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/arts-and-music/units.json', 8061, '55e39b8fd43050d949fce40c2af09a1ba66698e8d3881b85e3554a69449752f5', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/arts-and-music/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/english-language-arts/assessments.json', 26157, 'f638e3c35f187a7837e034c977cf0dc2d5e7b63cd8f03f8559372986d1d06793', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/english-language-arts/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/english-language-arts/course-guide.md', 4871, '627e4b0e36b44ace01220b58f88cc49023e56fd01d61a62e22fce0c95d346300', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/english-language-arts/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/english-language-arts/lesson-sequence.md', 177391, '71aa685a0516a03a19ecd3f82bcaca5dcb372da5b7df4d2e2f71e1825da764a4', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/english-language-arts/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/english-language-arts/lessons.jsonl', 1198168, '7cf5b3b782c95ed4ab6f171b53bbe404b7b6eb0634ac854a25a90780c009efe2', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/english-language-arts/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/english-language-arts/units.json', 17587, 'a8dc9238be47e97a80f09cafbe853a75d1dcd3429809117a55c4d3cc2d9e3cdf', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/english-language-arts/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/financial-literacy/assessments.json', 15367, '04145317a8c0167fdbcb0a22b022d1715991c8dcd2ba38c3fe60bd3c8259efea', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/financial-literacy/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/financial-literacy/course-guide.md', 3911, 'a4f1d705b4d09bed91bc64706242febe00a9ceb9d4bbdd6729f7498a67d13071', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/financial-literacy/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/financial-literacy/lesson-sequence.md', 35129, '26397633e80b935b223c7c4c10817c2cf61a6d60740a375343267dbd5ab272f8', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/financial-literacy/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/financial-literacy/lessons.jsonl', 240755, 'ee230cd097b1f74a1af9ebfd26af872aa5b5963e8ab8bbd4f8bd3d3b504a6e0d', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/financial-literacy/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/financial-literacy/units.json', 6748, 'd287764a2ca5cf0da7097f5d56ee017f5648e610f176d31d0e205d7aed7b713f', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/financial-literacy/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/health/assessments.json', 15716, '610a240109d1ecd686cc3f41fff76d8a09c45f697547184c2e915055ead7fada', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/health/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/health/course-guide.md', 4250, '7aefb1b90fcf9198d540f1222cac1acd064a96370996100e046a8cb55b63f079', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/health/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/health/lesson-sequence.md', 36893, '8ac21150a0ebacea7cdc1272d14ec105ce18c67cad51f74e9f0c8a2d59e3aefe', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/health/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/health/lessons.jsonl', 245323, 'c39615532340b1cacb135797c6a6be2c7e31d65c52837fe24dbbfafbc919eca6', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/health/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/health/units.json', 6520, 'dc8669f5171f43abfb57f34be6c02b9e9cc856061b37de15ed99bf9aefdafad6', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/health/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/mathematics/assessments.json', 25777, '5bee6f9158908af2d10fea8efe0b45485efd05ca86e4384db2ab9e58591a1592', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/mathematics/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/mathematics/course-guide.md', 4634, 'ebef0c3ecdddf71838dfbfcb122f8afd8b37c0730426964699ab54063c380418', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/mathematics/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/mathematics/lesson-sequence.md', 172745, '539a892b12cd6f0077bbe23671974cb13960c8d91471ee2a9ba2f3ad765b9fe5', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/mathematics/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/mathematics/lessons.jsonl', 1157386, 'cbb949e5850fcdfa3111d447273b7edc6e4a9ccea101c0629c55be719d43dd40', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/mathematics/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/mathematics/units.json', 15089, 'cbaa29f23d8c90a15f78ed03da90c1a820d9e74c1918427efd79883a7c3173ce', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/mathematics/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/physical-education/assessments.json', 22990, 'a0513a90ad049eb4483b6d7a400b8e52892ac9ef317f1cd49ef205de4274cb35', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/physical-education/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/physical-education/course-guide.md', 4419, 'de8f1a4863df966997ccc6d46a06837aecf5aac433fd5cf7287c4d90e16423f8', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/physical-education/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/physical-education/lesson-sequence.md', 104683, '9a1c296233afcdbc2d275a7b4f118d395eafa31ee3bc13e910e597569216d755', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/physical-education/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/physical-education/lessons.jsonl', 722308, '3ca60631b850eb020553642694f1bf1ec9ce50fb84ab5d1bb5952b7ca8576b8b', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/physical-education/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/physical-education/units.json', 12411, '0a28432932b788d9521580f899a01412d0220bb8970263916b95e37057f65ab4', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/physical-education/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/ready-for-life/assessments.json', 15481, 'f49084367a3da46eb61b18839591f03c58c53902d4d9c820b28205d2ec5c9a6d', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/ready-for-life/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/ready-for-life/course-guide.md', 4113, 'eb5da4f70836e4a4baf0ad170d7528a7644dc9ee23da838470b7d6bea4552dd3', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/ready-for-life/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/ready-for-life/lesson-sequence.md', 35942, '9452559f5b03b06ee2b88fea3271eca7e8b1564a1510bb0c845a85c7864b9635', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/ready-for-life/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/ready-for-life/lessons.jsonl', 247099, '3dbce5b453866ae5397d6c78ac550b83dd1fc69c7c1c0499d289e314befcc1bb', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/ready-for-life/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/ready-for-life/units.json', 6714, '1c82a590285fd0736a62d8f5366141b8106a3c2fd06fc896720d3ce1e2daa3c2', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/ready-for-life/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/science/assessments.json', 23218, 'da4b569483e0f493f26c9a04b641396d33559f5bd438980e832315554a5c7216', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/science/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/science/course-guide.md', 4515, '938b664a3d3dc2161c5123d48187c731a3601d504700f4e9232fbd24ad2082ea', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/science/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/science/lesson-sequence.md', 105988, '4f1362d47d901fecace1057a3dc3655571808cbee96412f03acae15f1fd549a4', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/science/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/science/lessons.jsonl', 719080, 'fd83577e27aa0726d4c69427f8b9e8e23d00c2a69ebf9b072ed04d85e62650f6', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/science/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/science/units.json', 11093, 'ca44f76964c172093903f024a49e230e1e4387e0c64cdc95897505f7654da660', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/science/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/social-studies/assessments.json', 23259, 'd3ee7496db222d623d44b87c0e5842308268a07b1fdd5cf3de3e2d570f96ef23', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/social-studies/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/social-studies/course-guide.md', 4682, 'e153bba498291f14f92777c0292fce706b2900851962f8b56bf36ada8fae877b', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/social-studies/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/social-studies/lesson-sequence.md', 103464, 'da3e5555ee9c078fd39e0631e24abdeff64ccb6934b30452a27eaf384f156e41', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/social-studies/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/social-studies/lessons.jsonl', 721064, '57dd04015452f11852835cbf9a352e06563b5903998f659e18286be41cccea98', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/social-studies/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/social-studies/units.json', 12230, '7359104a8911defd399b91d761c494952125f4c441069d65aa7a22783b35386a', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/social-studies/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/technology/assessments.json', 15468, '5e724a5cdd22baf29abd9fece591e3c73e4b9fbdd8b52fa4cd783519f3f30177', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/technology/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/technology/course-guide.md', 4098, '79f547cc0536759ab4e859b6c53e399dc5575c3e3127abb3d15593fc4d668a18', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/technology/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/technology/lesson-sequence.md', 36126, '845d69df490a1c0f94f310880b7d06cdd15c8d3f0c4fa36783e4903fa38a60e5', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/technology/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/technology/lessons.jsonl', 242745, '44aa54fc68979fabb7f2671e098fedce49f24a8b99105424df52e4198c822a88', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/technology/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/courses/technology/units.json', 6448, '0f71b6758783d465f4b09a1b6bd35ad85e93b7c977e382df1f12a444155dcec7', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/technology/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/daily-schedule.csv', 28603, '5099e5c4613d9c78b54e6c941cfe857f0571bc187e7b3e624ebaed2cdf855c23', 'text/csv;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/daily-schedule.csv'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/family-weekly-overview.md', 16809, 'be21b143ace52d5ffeb2e9c6e582b6e1597bde73503ca7eb27326e10e5685841', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/family-weekly-overview.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/grade-overview.md', 2806, 'ba7f05679a48b4780e602e1222a96d9952dd3207ece2609d4a2b8d4981102b0f', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/grade-overview.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/original-text-bank.json', 6522, '2b8b82d305e58b027430993516d15a9135134fd1434e0f3428d2fa0b5636f39c', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/original-text-bank.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-7/original-text-bank.md', 6471, 'b090059f2f35edd336017bae034f8ee573c2dc718332fbc0b32dc58863578f86', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-7/original-text-bank.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/arts-and-music/assessments.json', 15780, 'f7fce7513bbe71cdc744698248f12f571ada70e364f92e0370eeb65ebe848ec3', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/arts-and-music/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/arts-and-music/course-guide.md', 4095, 'e0c0661bdeeb6f77d6d38406a4461515b6ab256b985b4f9e70c05a6d17631f66', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/arts-and-music/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/arts-and-music/lesson-sequence.md', 73894, 'cb5de6138eeaadda4166200814d27ecce7a83304ba004c0101b279acfa6ed894', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/arts-and-music/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/arts-and-music/lessons.jsonl', 487663, '1e64512fb0e168f956793fc48f2158cdddbde6aa65a89b64186f035bc15ff68c', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/arts-and-music/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/arts-and-music/units.json', 8364, '731a6e2cdf42f65463755d8f889c2b667949fa01770fe99e94d19fa4664c54b0', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/arts-and-music/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/english-language-arts/assessments.json', 26410, 'b03accd3d7d5fb92b7536b72bc201c0b905faa7b38232685beed91c1fd545559', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/english-language-arts/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/english-language-arts/course-guide.md', 4871, '32259a78b241af0bb549c87f5e7f347f4f205167004daa981c488e33cc1d8914', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/english-language-arts/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/english-language-arts/lesson-sequence.md', 179594, '10fd7551fa6d1d0d454a3f91a9c20d14311d73b9d685dba0b07076d5be3cd810', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/english-language-arts/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/english-language-arts/lessons.jsonl', 1208686, 'dfb91ef8999218c47cb2023c02de0095126452ba20ff761840dafd1173f3caf4', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/english-language-arts/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/english-language-arts/units.json', 17838, 'f7ed61ad2433a7bd18b9c75ff0729e60b34658ad972f6f0ea66ce412009c2d25', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/english-language-arts/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/financial-literacy/assessments.json', 18408, 'e1486442d8e5a329da51db097b5dfa0eb21090ee7b29e248054066f8523c4ae0', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/financial-literacy/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/financial-literacy/course-guide.md', 4358, '5212ab93a814011fb1a558ccd8e564c55bb0f6fb8bacf8e7db2c26f2f4a6df67', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/financial-literacy/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/financial-literacy/lesson-sequence.md', 72257, '802abb36dec56722c5fec3e3760f397ba1839ea9abd1a6ffc2c48fb416a51658', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/financial-literacy/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/financial-literacy/lessons.jsonl', 494648, '71575087c3fbf8ca38bc0028730980927a72e0feb1518adc853db842649bd66d', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/financial-literacy/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/financial-literacy/units.json', 9587, '6bd3b9e9df192e7d31ed8b5dc9fdfc48f06c22d9f2890e2b4a0cff110ebc1cea', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/financial-literacy/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/health/assessments.json', 15994, '2f5078bc79f3d2e738589130627ee61b725a3413baee961528ad5d8d6450cf2d', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/health/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/health/course-guide.md', 4382, '524c402d60b221e67fe58f4ef394eac8aff808609abac5f43a4196ad50ede115', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/health/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/health/lesson-sequence.md', 37731, '0c93794ee41f037d5f2df8e69967fd8aeafbf10eb5cc2029bdef0987000e2337', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/health/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/health/lessons.jsonl', 248713, '9f7c77a7a7136519ecb998acb95185dd5395264ab18c822c2591ba2ce204a5f4', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/health/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/health/units.json', 6873, 'e59b6fa9a3afc0d16a17fe32e54bc47c653970685f65eb96bf6ab1ed24b052e0', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/health/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/mathematics/assessments.json', 26002, '9039abf7b44071a8491d8e34cc637cdf7e4d5ee13e7503278ba37b3e848b60b8', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/mathematics/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/mathematics/course-guide.md', 4621, '3ff612f5c45d5e10847877359e405709c42d788b6f3b7c43a8019f2a0b8bd981', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/mathematics/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/mathematics/lesson-sequence.md', 175230, '824848f429e472c5d079b557efe80a3b591c71cb2f459f20593d567b5e5ac193', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/mathematics/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/mathematics/lessons.jsonl', 1166038, 'b48fdfc682feba1577c921354d433ae63217131b5739da374c688ea4897a44e5', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/mathematics/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/mathematics/units.json', 15194, '1a53e49b0fa77ec55f052df26b7e1455e05c0f0ef62ab731343d8613a3709ef4', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/mathematics/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/physical-education/assessments.json', 23206, '76cd51a4ee3a70dd56d87d8f58865640f8c2ac0f038df73256a6a6b20bb7e451', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/physical-education/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/physical-education/course-guide.md', 4561, 'c84de08ea1da0f2d4fb4334ba9ef9a0f31ced5fb72f8caca6eb15db0fff767af', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/physical-education/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/physical-education/lesson-sequence.md', 105635, 'bb2675290b6310aed68875375fec94759147d2f43be49b0d18c5f2a2c9694d9e', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/physical-education/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/physical-education/lessons.jsonl', 725808, 'f5c2658e3c929b67ce93dc9f6b3c3470132779fc221b3d895c603f9810457f97', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/physical-education/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/physical-education/units.json', 12592, '28aed6adc5e28155b3f51e8b8b07e71e04ae4442257cc545bad4862cb07c4d87', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/physical-education/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/ready-for-life/assessments.json', 15632, '456f10bec6ecce919144ab6f8e4477c4bff6c60ba07783af6f3fe93f583ca015', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/ready-for-life/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/ready-for-life/course-guide.md', 4143, '0004ce433ed4678d5d240c1c876d11538965e25695bb8d05d2389d526bb13d89', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/ready-for-life/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/ready-for-life/lesson-sequence.md', 36518, '6b60bc30898c0e5619db1b4d30326ea48759cf087fec68cbf519be022306d460', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/ready-for-life/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/ready-for-life/lessons.jsonl', 250147, '59fc54d404611187308858aa2c8743507b67c81d9632c7061e505cfc067489e8', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/ready-for-life/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/ready-for-life/units.json', 6883, '715564a43ffbed549309cd792ace82addd71eac201136945849bf33bbdc043be', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/ready-for-life/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/science/assessments.json', 23377, '198687d3979b4f0ebbc672b250055222718055bf33287548839e054be4dbce9a', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/science/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/science/course-guide.md', 4706, '7198418c18feb1050a34c6a588dc316bf48a196127d29b8a1da3dc020bfcdff3', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/science/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/science/lesson-sequence.md', 106859, '108907f20fe355ac65d291d0b6d1157a8b3a2831cf61cbec3297d4a6a4eb8a79', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/science/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/science/lessons.jsonl', 720788, '4741c9b997b222e549e681f2d4b447ba64f8248867e79afa772b3c50c8a7ec7d', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/science/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/science/units.json', 11327, 'a52918e73afbd0c30113bbda65b10028e202000557704f75c828d798f686d886', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/science/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/social-studies/assessments.json', 23539, 'f001cc3abb77dd84dc8a95ba5b1baf4acf17e3f5daabb8e278d707bded697906', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/social-studies/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/social-studies/course-guide.md', 4741, '112406aaf7f03e76352c1c3f7e532a6040874c4d207630875cb638546cf4c0c7', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/social-studies/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/social-studies/lesson-sequence.md', 105278, '50e10b2c2879bfb765833b9a84e49da7aed29e7e692de8956dbc56809f3a01be', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/social-studies/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/social-studies/lessons.jsonl', 725876, '22b12b2674208504a8b9808705986c4d775733d310344448b192e9b247c4afd9', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/social-studies/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/social-studies/units.json', 12407, '26f64c0631002cbae069383694f327e776aa6fd426ba64d4c95388ee95c62f7b', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/social-studies/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/technology/assessments.json', 15695, '722eaff321a08a601861442115f19f3d21773ec0bc37a7108f701fe4507ec06b', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/technology/assessments.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/technology/course-guide.md', 4299, '861ee853836493cec02cf5ccffbcff30f2aa526a106618e275ee2cd17b3d099c', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/technology/course-guide.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/technology/lesson-sequence.md', 36940, '4d1544047b1974d49f6181c11ac5461a846f0dd3b848686bd7767aaf1f4c3d57', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/technology/lesson-sequence.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/technology/lessons.jsonl', 246073, '0709fc5d756712b0ea7de701caeb6d30912e5925c7bd1f1f417e56f6bdfeb266', 'application/x-ndjson', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/technology/lessons.jsonl'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/courses/technology/units.json', 6721, '8d6bb8a5a17d1086f57c9aa6097676689a2f38ebdbdddf66521f9569dcf499b7', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/technology/units.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/daily-schedule.csv', 29755, 'f5d1d585215e392a0455ac27b35c06061bd3220c4dbe713ba2b23910263ac49e', 'text/csv;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/daily-schedule.csv'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/family-weekly-overview.md', 17663, '0781dce8c796465552fa8d2f38f51b15b42704dd42af36b732dab770818b32c0', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/family-weekly-overview.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/grade-overview.md', 2764, '8fe64e81628f6efb21e5cc0b0176e0d77097d0783c8c7ce9e57ac9ec49f37800', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/grade-overview.md'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/original-text-bank.json', 6692, '305c25bd69366907c9dcbdf38326a5921f10f8a9afe53b53a4be2d1156e7c0a3', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/original-text-bank.json'),
  ('16000000-0000-4000-8000-000000000001', 'grades/grade-8/original-text-bank.md', 6639, '592cf01e3e5ee5c2acb0bf3aebf94864fe16e23eac9839f9ff748b3680678f11', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/grades/grade-8/original-text-bank.md'),
  ('16000000-0000-4000-8000-000000000001', 'integration/SESSION-CURR-1-CODEX-IMPORT-CARD.md', 4941, 'f6369f8106477de85a23a1ebe5b32f0bb9f46e7ca61f99e7eaa4945c382c33ad', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/integration/SESSION-CURR-1-CODEX-IMPORT-CARD.md'),
  ('16000000-0000-4000-8000-000000000001', 'lesson-index.csv', 654254, 'd3a3d8918e3c545e6ba0859b1285a2f3ebb6e8d19c792372870ae41cd2dd27d8', 'text/csv;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/lesson-index.csv'),
  ('16000000-0000-4000-8000-000000000001', 'MANIFEST.json', 33338, '38e6f27c24ec5371e4647364c088984fa0e1dbe25e1312847108a6d56d7404be', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/MANIFEST.json'),
  ('16000000-0000-4000-8000-000000000001', 'policies/instruction-mastery-accessibility-safety.md', 3845, '2e7526136082a58b5d7e64207b4b6a70e792ead2abd31355c4d105cbbfbb765b', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/policies/instruction-mastery-accessibility-safety.md'),
  ('16000000-0000-4000-8000-000000000001', 'README.md', 2951, '939bf2022e3ff8043d1159d4bfd14ec0e8c9061b26334953440c4f9e53e45b3e', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/README.md'),
  ('16000000-0000-4000-8000-000000000001', 'schemas/lesson.schema.json', 2119, 'e0939617d1b870a4e3f904dd87dc2b77fc12f2024b1ead5541d65a4ce661a9b6', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/schemas/lesson.schema.json'),
  ('16000000-0000-4000-8000-000000000001', 'SHA256SUMS.txt', 20845, 'c2ea2bfcfb7bb1983aacd36a52ff9b88ac22cc6791e1f4e1c89585d158b0f56a', 'text/plain;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/SHA256SUMS.txt'),
  ('16000000-0000-4000-8000-000000000001', 'shared/rubrics.md', 2359, '0645bd077820e1cb8be678dc5fcbd0c3ac55940a7c980848aec12ec1ef579068', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/shared/rubrics.md'),
  ('16000000-0000-4000-8000-000000000001', 'shared/student-learning-tools.md', 1117, 'cab74c8c84814ff2548e63871d34ab580f7c3fef1369fdea5df5b18186905569', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/shared/student-learning-tools.md'),
  ('16000000-0000-4000-8000-000000000001', 'shared/teacher-and-tutor-tools.md', 1576, 'a418b1656a3e67ff00940a2f03e911a9f87b8ba4aeae079a100a1f608492f09d', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/shared/teacher-and-tutor-tools.md'),
  ('16000000-0000-4000-8000-000000000001', 'standards/standards-reference.md', 3853, 'eadaa7f27a508c96a79c86a583a8a58d8e9129a2108c167985d3a0a3109d6bf3', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/standards/standards-reference.md'),
  ('16000000-0000-4000-8000-000000000001', 'unit-index.json', 312935, '74cf8ffc7aa11a3d4defe537f70e244968b1bebf19266b47d0a51176bbd2b008', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/unit-index.json'),
  ('16000000-0000-4000-8000-000000000001', 'validation/manifest-verification.txt', 72, 'da7d276e92bb694516adbbc8ba8177258a597c90f068b6f5a179c3b9c846e2cc', 'text/plain;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/validation/manifest-verification.txt'),
  ('16000000-0000-4000-8000-000000000001', 'validation/validation-report.md', 1579, 'def045f7d0cd7c5ba565b0ae2cd0d44e7f4f48677cf920a6260cd6957d764692', 'text/markdown;charset=utf-8', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/validation/validation-report.md'),
  ('16000000-0000-4000-8000-000000000001', 'validation/validation.json', 2298, '391c0fbf7a32af09537ef47a1df59011fe1842e1ccec24003ad74e03586410ec', 'application/json', 'metadata_only_internal_source', 'git_commit_path:4056e31d8beb36622be5ac27ea7f20145266343b:curriculum-content/manuel-academy/1.0.0/validation/validation.json');
-- END GENERATED 1.0.0 RELEASE FILE ROWS

insert into public.academy_curriculum_active_pointers (
  environment, release_id, revision, change_kind, binding_mode, registered_at
) values (
  'production', '16000000-0000-4000-8000-000000000001', 1,
  'migration_seed', 'registry_only', '2026-08-09 16:00:00+00'
);

create function public.academy_admin_list_curriculum_releases_v1(
  p_required_capability text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  projection jsonb;
begin
  if p_required_capability is distinct from 'curriculum:read' then
    raise exception 'curriculum:read capability marker is required';
  end if;

  select jsonb_build_object(
    'schemaVersion', 1,
    'releases', coalesce(jsonb_agg(jsonb_build_object(
      'packageId', release.package_id,
      'version', release.version,
      'status', release.status,
      'registeredAt', to_char(release.registered_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'authoredOn', to_char(release.authored_on, 'YYYY-MM-DD'),
      'provenanceClass', release.provenance_class,
      'sourceCommit', release.source_commit,
      'sourceRoot', release.source_root,
      'fileCount', release.file_count,
      'byteCount', release.byte_count,
      'counts', jsonb_build_object(
        'courses', release.course_count,
        'units', release.unit_count,
        'lessons', release.lesson_count,
        'assessments', release.assessment_count,
        'texts', release.text_count,
        'schedules', release.schedule_count
      )
    ) order by release.authored_on desc nulls last, release.version desc), '[]'::jsonb)
  ) into projection
  from public.academy_curriculum_releases as release;
  return projection;
end;
$$;

create function public.academy_admin_read_curriculum_release_v1(
  p_version text,
  p_required_capability text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  projection jsonb;
begin
  if p_required_capability is distinct from 'curriculum:read' then
    raise exception 'curriculum:read capability marker is required';
  end if;
  if p_version is null or p_version !~ '^[0-9]+\.[0-9]+\.[0-9]+$' then
    raise exception 'A canonical curriculum release version is required';
  end if;

  select jsonb_build_object(
    'schemaVersion', 1,
    'packageId', release.package_id,
    'version', release.version,
    'status', release.status,
    'registeredAt', to_char(release.registered_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'authoredOn', to_char(release.authored_on, 'YYYY-MM-DD'),
    'provenanceClass', release.provenance_class,
    'sourceCommit', release.source_commit,
    'sourceRoot', release.source_root,
    'digests', jsonb_build_object(
      'packageManifestSha256', release.package_manifest_sha256,
      'checksumManifestSha256', release.checksum_manifest_sha256,
      'curriculumManifestSha256', release.curriculum_manifest_sha256,
      'fileInventorySha256', release.file_inventory_sha256
    ),
    'fileCount', release.file_count,
    'byteCount', release.byte_count,
    'counts', jsonb_build_object(
      'courses', release.course_count,
      'units', release.unit_count,
      'lessons', release.lesson_count,
      'assessments', release.assessment_count,
      'texts', release.text_count,
      'schedules', release.schedule_count
    ),
    'gradeCounts', jsonb_build_object(
      '5', jsonb_build_object(
        'courses', release.grade_5_course_count, 'units', release.grade_5_unit_count,
        'lessons', release.grade_5_lesson_count, 'assessments', release.grade_5_assessment_count,
        'texts', release.grade_5_text_count, 'schedules', release.grade_5_schedule_count
      ),
      '7', jsonb_build_object(
        'courses', release.grade_7_course_count, 'units', release.grade_7_unit_count,
        'lessons', release.grade_7_lesson_count, 'assessments', release.grade_7_assessment_count,
        'texts', release.grade_7_text_count, 'schedules', release.grade_7_schedule_count
      ),
      '8', jsonb_build_object(
        'courses', release.grade_8_course_count, 'units', release.grade_8_unit_count,
        'lessons', release.grade_8_lesson_count, 'assessments', release.grade_8_assessment_count,
        'texts', release.grade_8_text_count, 'schedules', release.grade_8_schedule_count
      )
    ),
    'files', coalesce((
      select jsonb_agg(jsonb_build_object(
        'path', file.relative_path,
        'byteCount', file.byte_count,
        'sha256', file.sha256,
        'contentType', file.content_type,
        'safeClassification', file.safe_classification,
        'immutableLocator', file.immutable_locator
      ) order by file.relative_path)
      from public.academy_curriculum_release_files as file
      where file.release_id = release.release_id
    ), '[]'::jsonb)
  ) into projection
  from public.academy_curriculum_releases as release
  where release.version = p_version;
  return projection;
end;
$$;

create function public.academy_admin_read_curriculum_production_pointer_v1(
  p_required_capability text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  projection jsonb;
begin
  if p_required_capability is distinct from 'curriculum:read' then
    raise exception 'curriculum:read capability marker is required';
  end if;

  select jsonb_build_object(
    'schemaVersion', 1,
    'environment', pointer.environment,
    'packageId', release.package_id,
    'releaseVersion', release.version,
    'revision', pointer.revision,
    'changeKind', pointer.change_kind,
    'bindingMode', pointer.binding_mode,
    'registryOnly', true,
    'runtimeBinding', 'hard-coded',
    'registeredAt', to_char(pointer.registered_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  ) into projection
  from public.academy_curriculum_active_pointers as pointer
  join public.academy_curriculum_releases as release on release.release_id = pointer.release_id
  where pointer.environment = 'production';
  return projection;
end;
$$;

alter function public.academy_admin_list_curriculum_releases_v1(text) owner to postgres;
alter function public.academy_admin_read_curriculum_release_v1(text, text) owner to postgres;
alter function public.academy_admin_read_curriculum_production_pointer_v1(text) owner to postgres;

revoke all on table public.academy_curriculum_releases
  from public, anon, authenticated, service_role;
revoke all on table public.academy_curriculum_release_files
  from public, anon, authenticated, service_role;
revoke all on table public.academy_curriculum_active_pointers
  from public, anon, authenticated, service_role;

revoke all on function public.academy_admin_list_curriculum_releases_v1(text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_read_curriculum_release_v1(text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.academy_admin_read_curriculum_production_pointer_v1(text)
  from public, anon, authenticated, service_role;
grant execute on function public.academy_admin_list_curriculum_releases_v1(text)
  to service_role;
grant execute on function public.academy_admin_read_curriculum_release_v1(text, text)
  to service_role;
grant execute on function public.academy_admin_read_curriculum_production_pointer_v1(text)
  to service_role;

comment on table public.academy_curriculum_releases is
  'Immutable published Academy curriculum release custody; no drafts or runtime activation.';
comment on table public.academy_curriculum_release_files is
  'Digest-authoritative immutable file inventory; source bytes remain at commit-pinned locators.';
comment on table public.academy_curriculum_active_pointers is
  'Registry-only release pointer; learner runtime binding remains hard-coded.';
comment on function public.academy_admin_list_curriculum_releases_v1(text) is
  'Service-only curriculum:read release-list projection.';
comment on function public.academy_admin_read_curriculum_release_v1(text, text) is
  'Service-only curriculum:read immutable release-detail projection.';
comment on function public.academy_admin_read_curriculum_production_pointer_v1(text) is
  'Service-only curriculum:read registry pointer projection; does not bind learner runtime.';

commit;
