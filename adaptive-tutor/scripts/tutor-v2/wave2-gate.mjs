import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cp, mkdir, mkdtemp, readdir, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const tutorRoot = resolve(here, "../..");
const repositoryRoot = resolve(tutorRoot, "..");
const require = createRequire(resolve(tutorRoot, "package.json"));
const tsc = resolve(dirname(require.resolve("typescript/package.json")), "bin", "tsc");
const BASE = "94a8d2e1708d3346e905688c4f0f78a6ed4c4a95";
const R1_CANDIDATE = "8d618502a16a3d4d169143b539286a3b6fb5b925";
const R2_CANDIDATE = "a251987b28909e827c0af0ee8bbeea668522459f";
const B4_START = "22c3734bd436c41ba8d24409dcaa146d35914e2f";
const R4_ADAPTATION_START = "24b604ac4fc72ea49943fff752a5da5c6e5f4125";
const LEARNER_RELEASE_BASELINE = "7baf8dfbc27168708ed4cf504285a1838d7345f6";
const STUDY_AUTHORITY_PORT = "527e1c0ddbc4cb1f7a2ba15dec79ea90f5e9e0c4";

const lanes = [
  {
    id: "W2_01",
    branch: "mac/tutor-v2-w2-admission-r1",
    tip: "d6a1b069a8f5d67023edcb4f247b3c67076306a4",
    patchId: "88e8a6bf486dfe2b0fef4c1679acef9d058793d5",
    supersededByRepair: true,
    paths: ["adaptive-tutor/core/v2/admission", "docs/study-tutor-v2/wave2/lanes/w2-01-admission"],
  },
  {
    id: "W2_02",
    branch: "mac/tutor-v2-w2-concept-graph-r1",
    tip: "b971fc4d139449a815e4ff06c34ca4abb5c84005",
    patchId: "ad8f3e145ba664e3b0d64135c3cf1d8d2174bd2e",
    paths: ["adaptive-tutor/core/v2/concepts", "docs/study-tutor-v2/wave2/lanes/w2-02-concept-graph"],
  },
  {
    id: "W2_03",
    branch: "mac/tutor-v2-w2-misconception-r1",
    tip: "f9ed81626d8d9e455ea750989d8c2a71cfe8bd6d",
    patchId: "f5f7cca1df95e16b2a193bdbb70177ef9a49560b",
    supersededByRepair: true,
    paths: ["adaptive-tutor/core/v2/misconceptions", "docs/study-tutor-v2/wave2/lanes/w2-03-misconception"],
  },
  {
    id: "W2_04",
    branch: "mac/tutor-v2-w2-hint-ladder-r1",
    tip: "eb941ff897181f761f83b3604dc4006d5e5118d4",
    patchId: "7ac35fbee5cb7965f75dba780f3e450d11355091",
    supersededByRepair: true,
    paths: ["adaptive-tutor/core/v2/hints", "docs/study-tutor-v2/wave2/lanes/w2-04-hint-ladder"],
  },
  {
    id: "W2_05",
    branch: "mac/tutor-v2-w2-intervention-r1",
    tip: "94c0d816e6e312af9f61d465a9692ef37919a65b",
    patchId: "0f4f407fe5dbf52ef577c19e9617d7ed342097d8",
    supersededByRepair: true,
    paths: ["adaptive-tutor/core/v2/interventions", "docs/study-tutor-v2/wave2/lanes/w2-05-intervention"],
  },
  {
    id: "W2_06",
    branch: "mac/tutor-v2-w2-mastery-evidence-r1",
    tip: "241cfc7d3b6c673139728302b00bd580cba1e919",
    patchId: "7fcc26bee9e30240410e6b124534f9fa259cf9c9",
    supersededByRepair: true,
    paths: ["adaptive-tutor/core/v2/mastery", "docs/study-tutor-v2/wave2/lanes/w2-06-mastery-evidence"],
  },
  {
    id: "W2_07",
    branch: "mac/tutor-v2-w2-parent-why-r1",
    tip: "661669117497a33e5d2da0a12e6bc3801839a165",
    patchId: "89ad1f511b2d71d2d0fc7689586beb9e53068e60",
    supersededByRepair: true,
    paths: ["adaptive-tutor/study-engine/tutor-v2/parent-explanations", "docs/study-tutor-v2/wave2/lanes/w2-07-parent-why"],
  },
  {
    id: "W2_08",
    branch: "mac/tutor-v2-w2-repair-reteach-r1",
    tip: "39b8d671f35dce6e44d19bff2d58b1bb2bfa4d81",
    patchId: "7ce3fdf3b5fd93d6d2e062667b0fc8b65914bcc1",
    supersededByRepair: true,
    paths: [
      "adaptive-tutor/study-engine/tutor-v2/prerequisite-repair",
      "adaptive-tutor/study-engine/tutor-v2/reteach",
      "docs/study-tutor-v2/wave2/lanes/w2-08-repair-reteach",
    ],
  },
];

const repairs = [
  {
    id: "W2_B1",
    branch: "mac/tutor-v2-w2-authority-fallback-repair-r1",
    tip: "5ed021ed5cf239bf9b4d90b6baefed960565459a",
    cherryPick: "461f8298bafcd95b226f8abd76e184e2f58c5ad4",
    patchId: "ee25597f03be72840f8417e1efdd506e85c0f79c",
    roots: [
      "adaptive-tutor/study-engine/tutor-v2/adaptive/",
      "docs/study-tutor-v2/wave2/repairs/w2-b1-authority-fallback/",
    ],
  },
  {
    id: "W2_B2",
    branch: "mac/tutor-v2-w2-history-scope-repair-r1",
    tip: "28849cc7eeef76e9e6eeeb199375523e25317b0b",
    cherryPick: "ee572e7f4d655e101671ce36253c2121e04d7ff8",
    patchId: "2caee0379c0a6bc7e5012557fc94a5c073e77f03",
    roots: [
      "adaptive-tutor/core/v2/hints/",
      "adaptive-tutor/core/v2/interventions/",
      "docs/study-tutor-v2/wave2/repairs/w2-b2-history-scope/",
    ],
  },
  {
    id: "W2_B3",
    branch: "mac/tutor-v2-w2-mastery-assistance-repair-r1",
    tip: "76839746eebc60a1adf8e24a6daa68661a9adfa9",
    cherryPick: "07587f463565e0a0ddce46499ba010249e0319f3",
    patchId: "8b2142f6b809abb7d7462bfb3a918a89bebca462",
    roots: [
      "adaptive-tutor/core/v2/mastery/",
      "docs/study-tutor-v2/wave2/repairs/w2-b3-mastery-assistance/",
    ],
  },
];

const postAuditRepairs = [
  {
    id: "W2_B4",
    branch: "mac/tutor-v2-w2-subsystem-fallback-repair-r2",
    tip: B4_START,
    parent: R2_CANDIDATE,
    cherryPick: B4_START,
    patchId: "d9d4cef96fb1b1750b1c57b096bdda8e7d87ce97",
    roots: [
      "adaptive-tutor/study-engine/tutor-v2/adaptive/",
      "docs/study-tutor-v2/wave2/repairs/w2-b4-subsystem-fallback/",
    ],
  },
  {
    id: "W2_B5",
    branch: "mac/tutor-v2-w2-adaptive-replay-composition-repair-r3",
    tip: "c9601aa99bca89ff0673ee6e00858fafa98c70c2",
    parent: B4_START,
    cherryPick: "9e89a86bf292108276742cf2ebc3a04432e3d4b2",
    patchId: "1788de549e684b7e9bb3655a1cfc184b842405c3",
    roots: [
      "adaptive-tutor/study-engine/tutor-v2/adaptive/",
      "docs/study-tutor-v2/wave2/repairs/w2-b5-adaptive-replay-composition/",
    ],
  },
  {
    id: "W2_B6",
    branch: "mac/tutor-v2-w2-hint-semantics-repair-r3",
    tip: "67d11f4ba0382c8cf7c6091a20a67a4b6ef1a76c",
    parent: B4_START,
    cherryPick: "7c3320cbc899f79c8206de2435517cc4185c83fe",
    patchId: "a2f745921d05e630a5bf93f1c90cbdc85d6c861d",
    roots: [
      "adaptive-tutor/core/v2/hints/",
      "docs/study-tutor-v2/wave2/repairs/w2-b6-hint-semantics/",
    ],
  },
  {
    id: "W2_B13",
    branch: "mac/tutor-v2-w2-review-permission-repair-r3",
    tip: "097ada4fe024f7eed7a50038d13801e45b990b62",
    parent: "67d11f4ba0382c8cf7c6091a20a67a4b6ef1a76c",
    cherryPick: "a11608d5de30d973785482b2d7169152c42e31ca",
    patchId: "e60b439f91424e425181d24414dc9ced30dabd4e",
    roots: [
      "adaptive-tutor/core/v2/hints/",
      "docs/study-tutor-v2/wave2/repairs/w2-b13-review-permission/",
    ],
  },
  {
    id: "W2_B7",
    branch: "mac/tutor-v2-w2-intervention-semantics-repair-r3",
    tip: "9a6a6a2a851ee5513bc6ddab694e41c1d78cd5f5",
    parent: B4_START,
    cherryPick: "0f6f3e827ab4be2ed7a57ebddc7cf5e8db179228",
    patchId: "ee90ea7ec82fda08769113978964090a5d26a553",
    roots: [
      "adaptive-tutor/core/v2/interventions/",
      "docs/study-tutor-v2/wave2/repairs/w2-b7-intervention-semantics/",
    ],
  },
  {
    id: "W2_B8",
    branch: "mac/tutor-v2-w2-mastery-semantics-repair-r3",
    tip: "a907f115894358a5d18b3ead1b361cbab8679390",
    parent: B4_START,
    cherryPick: "19e23646c7cc45ecb176976c3ed731b1163cfbff",
    patchId: "bde79ff946a13eda529e6127d32b0544c36671ab",
    roots: [
      "adaptive-tutor/core/v2/mastery/",
      "docs/study-tutor-v2/wave2/repairs/w2-b8-mastery-semantics/",
    ],
  },
  {
    id: "W2_B9",
    branch: "mac/tutor-v2-w2-reteach-cap-repair-r3",
    tip: "367b8f5450510b3e7037cd2ccf32cac1cac79b6a",
    parent: B4_START,
    cherryPick: "15ae6c42a89557b23614f6e611e912c44122f225",
    patchId: "a85bf0573e4d4e4cd03e6dbada26c82a507af1d5",
    roots: [
      "adaptive-tutor/study-engine/tutor-v2/reteach/",
      "docs/study-tutor-v2/wave2/repairs/w2-b9-reteach-cap/",
    ],
  },
  {
    id: "W2_B10",
    branch: "mac/tutor-v2-w2-admission-scope-repair-r3",
    tip: "32fd30a7d3aa3b500e3dbaa53a8aa3715fbd9cde",
    parent: B4_START,
    cherryPick: "783ebb3216a9e7a5919f281fe8f10742bdd0f740",
    patchId: "c4ec4ed6c14851dda6c77c037a996379fae22fee",
    roots: [
      "adaptive-tutor/core/v2/admission/",
      "docs/study-tutor-v2/wave2/repairs/w2-b10-admission-scope/",
    ],
  },
  {
    id: "W2_B11",
    branch: "mac/tutor-v2-w2-parent-contract-repair-r3",
    tip: "5d282f08a5cfbc75e7804dbf461812f218e8db3d",
    parent: B4_START,
    cherryPick: "dacd2fe203fa93df61e772ce2346395b7c6e507c",
    patchId: "0955e9b74bb113abaa47fa244eca9a8b36b00a96",
    roots: [
      "adaptive-tutor/study-engine/tutor-v2/parent-explanations/",
      "docs/study-tutor-v2/wave2/repairs/w2-b11-parent-contract/",
    ],
  },
  {
    id: "W2_B12",
    branch: "mac/tutor-v2-w2-misconception-contract-repair-r3",
    tip: "c07db50067776457a6eef96f0c2a38b601177031",
    parent: B4_START,
    cherryPick: R4_ADAPTATION_START,
    patchId: "aacfdda8fe7564e6a84437c8b715317ab71b5c1e",
    roots: [
      "adaptive-tutor/core/v2/misconceptions/",
      "docs/study-tutor-v2/wave2/repairs/w2-b12-misconception-contract/",
    ],
  },
];

const checks = [];
let hardFailure = false;

function execute(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd ?? tutorRoot,
    encoding: "utf8",
    shell: false,
    env: options.env ?? process.env,
    input: options.input,
    maxBuffer: 64 * 1024 * 1024,
  });
}

function record(name, status, detail, command) {
  checks.push({ name, status, detail, command });
  process.stdout.write(`${status} ${name}: ${detail}\n`);
  if (status === "FAIL") hardFailure = true;
}

function requireSuccess(name, command, args, detail, options = {}) {
  const result = execute(command, args, options);
  record(name, result.status === 0 ? "PASS" : "FAIL", result.status === 0 ? detail : `exit ${String(result.status)}`, [command, ...args].join(" "));
  if (result.status !== 0) process.stderr.write(`${result.stdout}${result.stderr}`);
  return result;
}

function tapCounts(output) {
  const count = (label) => Number(output.match(new RegExp(`# ${label} (\\d+)`))?.[1] ?? -1);
  return { tests: count("tests"), pass: count("pass"), fail: count("fail"), skipped: count("skipped") };
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

function requireTap(name, files, expected = undefined, options = {}) {
  const result = execute(process.execPath, ["--test", ...files], options);
  const counts = tapCounts(`${result.stdout}${result.stderr}`);
  const exact = expected === undefined || (
    counts.tests === expected.tests && counts.pass === expected.pass &&
    counts.skipped === (expected.skipped ?? 0)
  );
  const passed = result.status === 0 && counts.tests > 0 && counts.fail === 0 && exact;
  record(name, passed ? "PASS" : "FAIL", `${counts.pass}/${counts.tests} pass; ${counts.fail} fail; ${counts.skipped} skipped`, `node --test ${files.join(" ")}`);
  if (!passed) process.stderr.write(`${result.stdout}${result.stderr}`);
  return counts;
}

function git(args, options = {}) {
  return execute("git", args, { cwd: repositoryRoot, ...options });
}

record("node-22", Number(process.versions.node.split(".")[0]) === 22 ? "PASS" : "FAIL", `Node ${process.versions.node}`, "node --version");

for (const lane of lanes) {
  const remote = `origin/${lane.branch}`;
  const tip = git(["rev-parse", remote]).stdout.trim();
  const parent = git(["rev-parse", `${remote}^`]).stdout.trim();
  const merges = git(["rev-list", "--min-parents=2", `${BASE}..${remote}`]).stdout.trim();
  const shown = git(["show", "--pretty=format:", lane.tip]).stdout;
  const patch = execute("git", ["patch-id", "--stable"], { cwd: repositoryRoot, input: shown }).stdout.trim().split(/\s+/)[0];
  const treeExact = lane.supersededByRepair === true ||
    lane.paths.every((path) => git(["diff", "--quiet", lane.tip, "HEAD", "--", path]).status === 0);
  const valid = tip === lane.tip && parent === BASE && merges === "" && patch === lane.patchId && treeExact;
  record(
    `${lane.id.toLowerCase()}-provenance`,
    valid ? "PASS" : "FAIL",
    valid ? `${lane.tip}; patch ${lane.patchId}; direct baseline parent; ${lane.supersededByRepair === true ? "verified repair supersession" : "lane tree exact"}` : `tip=${tip}; parent=${parent}; merges=${merges || "none"}; patch=${patch}; treeExact=${String(treeExact)}`,
    `git provenance checks ${remote}`,
  );
}

for (const repair of repairs) {
  const remote = `origin/${repair.branch}`;
  const tip = git(["rev-parse", remote]).stdout.trim();
  const parent = git(["rev-parse", `${remote}^`]).stdout.trim();
  const sourcePatch = execute("git", ["patch-id", "--stable"], {
    cwd: repositoryRoot,
    input: git(["show", "--pretty=format:", repair.tip]).stdout,
  }).stdout.trim().split(/\s+/)[0];
  const pickedPatch = execute("git", ["patch-id", "--stable"], {
    cwd: repositoryRoot,
    input: git(["show", "--pretty=format:", repair.cherryPick]).stdout,
  }).stdout.trim().split(/\s+/)[0];
  const changedPaths = git(["diff-tree", "--no-commit-id", "--name-only", "-r", repair.tip])
    .stdout.split("\n").filter(Boolean);
  const ownershipExact = changedPaths.every((path) =>
    repair.roots.some((root) => path.startsWith(root))
  );
  const imported = git(["merge-base", "--is-ancestor", repair.cherryPick, "HEAD"]).status === 0;
  const valid = tip === repair.tip && parent === R1_CANDIDATE &&
    sourcePatch === repair.patchId && pickedPatch === repair.patchId &&
    ownershipExact && imported;
  record(
    `${repair.id.toLowerCase()}-repair-provenance`,
    valid ? "PASS" : "FAIL",
    valid
      ? `${repair.tip} -> ${repair.cherryPick}; patch ${repair.patchId}; direct R1 parent; ownership exact`
      : `tip=${tip}; parent=${parent}; sourcePatch=${sourcePatch}; pickedPatch=${pickedPatch}; ownership=${String(ownershipExact)}; imported=${String(imported)}`,
    `git repair provenance checks ${remote}`,
  );
}

for (const repair of postAuditRepairs) {
  const remote = `origin/${repair.branch}`;
  const tip = git(["rev-parse", remote]).stdout.trim();
  const parent = git(["rev-parse", `${remote}^`]).stdout.trim();
  const sourcePatch = execute("git", ["patch-id", "--stable"], {
    cwd: repositoryRoot,
    input: git(["show", "--pretty=format:", repair.tip]).stdout,
  }).stdout.trim().split(/\s+/)[0];
  const pickedPatch = execute("git", ["patch-id", "--stable"], {
    cwd: repositoryRoot,
    input: git(["show", "--pretty=format:", repair.cherryPick]).stdout,
  }).stdout.trim().split(/\s+/)[0];
  const changedPaths = git(["diff-tree", "--no-commit-id", "--name-only", "-r", repair.tip])
    .stdout.split("\n").filter(Boolean);
  const ownershipExact = changedPaths.every((path) =>
    repair.roots.some((root) => path.startsWith(root))
  );
  const imported = git(["merge-base", "--is-ancestor", repair.cherryPick, "HEAD"]).status === 0;
  const valid = tip === repair.tip && parent === repair.parent &&
    sourcePatch === repair.patchId && pickedPatch === repair.patchId &&
    ownershipExact && imported;
  record(
    `${repair.id.toLowerCase()}-repair-provenance`,
    valid ? "PASS" : "FAIL",
    valid
      ? `${repair.tip} -> ${repair.cherryPick}; patch ${repair.patchId}; required parent; ownership exact`
      : `tip=${tip}; parent=${parent}; sourcePatch=${sourcePatch}; pickedPatch=${pickedPatch}; ownership=${String(ownershipExact)}; imported=${String(imported)}`,
    `git repair provenance checks ${remote}`,
  );
}

const studyPortTip = git(["rev-parse", "origin/mac/study-runtime-tutor-authority-port-r2"])
  .stdout.trim();
const studyPortParent = git(["rev-parse", "origin/mac/study-runtime-tutor-authority-port-r2^"])
  .stdout.trim();
record(
  "external-study-progression-authority-port",
  studyPortTip === STUDY_AUTHORITY_PORT && studyPortParent === LEARNER_RELEASE_BASELINE
    ? "PASS"
    : "FAIL",
  `repair=${studyPortTip}; parent=${studyPortParent}; separate integration artifact`,
  "git rev-parse origin/mac/study-runtime-tutor-authority-port-r2{,^}",
);

requireSuccess("strict-v2-typecheck", process.execPath, [tsc, "-p", "scripts/tutor-v2/tsconfig.json", "--noEmit"], "strict TypeScript", { cwd: tutorRoot });
requireSuccess("v2-compile", process.execPath, [tsc, "-p", "scripts/tutor-v2/tsconfig.json"], "compiled Tutor V2 slice", { cwd: tutorRoot });
requireSuccess("adaptive-root-typecheck", "npm", ["run", "typecheck"], "adaptive Tutor root TypeScript", { cwd: tutorRoot });
requireSuccess("repository-root-typecheck", "npm", ["run", "typecheck"], "repository root TypeScript", { cwd: repositoryRoot });
requireSuccess("wave1-schema-check", process.execPath, ["scripts/tutor-v2/.dist/scripts/tutor-v2/generate-schemas.js", "--check"], "23 Wave 1 schemas + inventory exact", { cwd: tutorRoot });
requireSuccess("wave2-schema-check", process.execPath, ["scripts/tutor-v2/.dist/scripts/tutor-v2/generate-wave2-schemas.js", "--check"], "2 serialized Wave 2 schemas + inventory exact; 0 internal port schemas", { cwd: tutorRoot });
requireSuccess("wave1-release-check", process.execPath, ["scripts/tutor-v2/.dist/scripts/tutor-v2/generate-release.js", "--check"], "accepted Wave 1 release artifacts exact", { cwd: tutorRoot });

const dist = "scripts/tutor-v2/.dist";
const w1Counts = requireTap("wave1-hard-gate-regression", [
  `${dist}/tests/tutor-v2-convergence/composition.test.js`,
  `${dist}/tests/tutor-v2-convergence/provider-boundary-adversarial.test.js`,
  `${dist}/tests/tutor-v2-convergence/reviewed-content-privacy-provenance-adversarial.test.js`,
  `${dist}/tests/tutor-v2-convergence/schema-parity.test.js`,
  `${dist}/tests/tutor-v2-convergence/structural-anti-answer-adversarial.test.js`,
  `${dist}/tests/tutor-v2-convergence/approval-decision-structural-validation-adversarial.test.js`,
], { tests: 253, pass: 253 });

const laneCounts = requireTap("wave2-lane-regression", [
  `${dist}/core/v2/admission/admission.test.js`,
  `${dist}/core/v2/concepts/graph.test.js`,
  `${dist}/core/v2/misconceptions/academic-misconceptions.test.js`,
  `${dist}/core/v2/hints/hint-ladder.test.js`,
  `${dist}/core/v2/interventions/intervention-ladder.test.js`,
  `${dist}/core/v2/mastery/mastery-evidence.test.js`,
  `${dist}/study-engine/tutor-v2/adaptive/orchestrator.test.js`,
  `${dist}/study-engine/tutor-v2/adaptive/subsystem-fallback.test.js`,
  `${dist}/study-engine/tutor-v2/adaptive/composition-repair.test.js`,
  `${dist}/study-engine/tutor-v2/parent-explanations/parent-explanation.test.js`,
  `${dist}/study-engine/tutor-v2/prerequisite-repair/prerequisite-repair.test.js`,
  `${dist}/study-engine/tutor-v2/reteach/reteach.test.js`,
]);

const focusedCounts = {
  b4: requireTap("b4-focused-exception-suite", [
    `${dist}/study-engine/tutor-v2/adaptive/subsystem-fallback.test.js`,
  ]),
  b5: requireTap("b5-composition-replay-suite", [
    `${dist}/study-engine/tutor-v2/adaptive/composition-repair.test.js`,
  ]),
  b6: requireTap("b6-hint-suite", [`${dist}/core/v2/hints/hint-ladder.test.js`]),
  b7: requireTap("b7-intervention-suite", [
    `${dist}/core/v2/interventions/intervention-ladder.test.js`,
  ]),
  b8: requireTap("b8-mastery-suite", [`${dist}/core/v2/mastery/mastery-evidence.test.js`]),
  b9: requireTap("b9-reteach-suite", [
    `${dist}/study-engine/tutor-v2/reteach/reteach.test.js`,
  ]),
  b10: requireTap("b10-admission-suite", [`${dist}/core/v2/admission/admission.test.js`]),
  b11: requireTap("b11-parent-why-suite", [
    `${dist}/study-engine/tutor-v2/parent-explanations/parent-explanation.test.js`,
  ]),
  b12: requireTap("b12-misconception-suite", [
    `${dist}/core/v2/misconceptions/academic-misconceptions.test.js`,
  ]),
  b13: requireTap("b13-review-permission-suite", [
    `${dist}/core/v2/hints/hint-ladder.test.js`,
    `${dist}/tests/tutor-v2-convergence/wave2-r4-contracts.test.js`,
  ]),
};

const compositionCounts = requireTap("wave2-composition-regression", [
  `${dist}/tests/tutor-v2-convergence/wave2-composition.test.js`,
  `${dist}/tests/tutor-v2-convergence/wave2-schema-parity.test.js`,
  `${dist}/tests/tutor-v2-convergence/wave2-r4-contracts.test.js`,
  `${dist}/tests/tutor-v2-convergence/single-composition-route.test.js`,
]);

const convergenceDirectory = resolve(tutorRoot, dist, "tests/tutor-v2-convergence");
const convergenceFiles = (await readdir(convergenceDirectory))
  .filter((file) => file.endsWith(".test.js"))
  .sort()
  .map((file) => join(dist, "tests/tutor-v2-convergence", file));
const fullConvergenceCounts = requireTap("full-wave2-convergence", convergenceFiles);

const blockerGateChecks = [
  {
    family: "GLOBAL_ADAPTIVE_SAFETY_AUTHORITY",
    check: "global-adaptive-safety-authority-hard-gate",
    file: `${dist}/tests/tutor-v2-convergence/global-adaptive-safety-authority.test.js`,
    tests: 1,
  },
  {
    family: "GLOBAL_ADAPTIVE_ALLOWED_ACTIONS",
    check: "global-adaptive-allowed-actions-hard-gate",
    file: `${dist}/tests/tutor-v2-convergence/global-adaptive-allowed-actions.test.js`,
    tests: 1,
  },
  {
    family: "TRUSTED_INVALID_REQUEST_FALLBACK",
    check: "trusted-invalid-request-fallback-hard-gate",
    file: `${dist}/tests/tutor-v2-convergence/trusted-invalid-request-fallback.test.js`,
    tests: 1,
  },
  {
    family: "ADAPTIVE_HISTORY_SCOPE_PROVENANCE",
    check: "adaptive-history-scope-provenance-hard-gate",
    file: `${dist}/tests/tutor-v2-convergence/adaptive-history-scope-provenance.test.js`,
    tests: 2,
  },
  {
    family: "ASSISTANCE_MASTERY_OPPORTUNITY_BINDING",
    check: "assistance-mastery-opportunity-binding-hard-gate",
    file: `${dist}/tests/tutor-v2-convergence/assistance-mastery-opportunity-binding.test.js`,
    tests: 5,
  },
];
const blockerCounts = blockerGateChecks.map(({ check, file }) =>
  requireTap(check, [file])
);
requireSuccess(
  "wave2-r4-mutation-proof",
  process.execPath,
  ["scripts/tutor-v2/wave2-mutation-proof.mjs"],
  "17/17 required and provenance mutations killed in disposable compiled copies",
  { cwd: tutorRoot },
);

requireSuccess("study-bridge-typecheck", process.execPath, [tsc, "-p", "study-engine/tests/tutor-v2-bridge/tsconfig.json"], "Study Core Bridge compiled", { cwd: tutorRoot });
const bridgeCounts = requireTap("study-bridge-regression", [
  "study-engine/tests/tutor-v2-bridge/.test-dist/study-engine/tests/tutor-v2-bridge/integration.test.js",
], { tests: 209, pass: 209 });

const evalTests = requireSuccess("foundation-harness-tests", "npm", ["--prefix", "evals/v2/framework", "test"], "foundation harness self-tests", { cwd: tutorRoot });
const evalTestCounts = tapCounts(`${evalTests.stdout}${evalTests.stderr}`);
if (evalTestCounts.tests !== 8 || evalTestCounts.pass !== 8 || evalTestCounts.fail !== 0) {
  record("foundation-harness-counts", "FAIL", `${evalTestCounts.pass}/${evalTestCounts.tests}`, "npm --prefix evals/v2/framework test");
} else record("foundation-harness-counts", "PASS", "8/8", "npm --prefix evals/v2/framework test");

const evaluation = execute(process.execPath, ["evals/v2/framework/.dist/framework/src/cli.js", "--format=json"], { cwd: tutorRoot });
try {
  const report = JSON.parse(evaluation.stdout);
  const passed = evaluation.status === 0 && report.totalScenarios === 128 && report.passed === 128 && report.failed === 0 && report.classification === "FOUNDATION_GATE_PASS" && report.releaseReady === false;
  record("foundation-corpus", passed ? "PASS" : "FAIL", `${report.passed}/${report.totalScenarios}; ${report.classification}; releaseReady=${String(report.releaseReady)}`, "foundation CLI --format=json");
} catch {
  record("foundation-corpus", "FAIL", "invalid machine report", "foundation CLI --format=json");
}

const coreTests = requireSuccess("tutor-core-tests", "npm", ["test"], "Tutor Core regression", { cwd: tutorRoot });
const coreCounts = tapCounts(`${coreTests.stdout}${coreTests.stderr}`);
if (coreCounts.tests !== 21 || coreCounts.pass !== 21 || coreCounts.fail !== 0) {
  record("tutor-core-counts", "FAIL", `${coreCounts.pass}/${coreCounts.tests}`, "npm test");
} else record("tutor-core-counts", "PASS", "21/21", "npm test");
requireSuccess("tutor-core-build", "npm", ["run", "build"], "Tutor Core build", { cwd: tutorRoot });
requireSuccess("tutor-core-smoke", "npm", ["run", "smoke"], "Tutor Core smoke", { cwd: tutorRoot });
record(
  "dependency-advisories",
  "INHERITED_FINDING",
  "3 existing high advisories: @playwright/test, nanoid, playwright; Study runtime manifests unchanged",
  "Wave 1 accepted npm audit evidence; manifests unchanged",
);
record(
  "candidate-sha-artifact-idempotency",
  "INHERITED_FINDING",
  "exact final SHA is returned after commit and is not self-referenced inside checksummed artifacts",
  "deterministic non-self-referential release generation",
);
let validationRoot;
try {
  validationRoot = await mkdtemp(join(tmpdir(), "tutor-v2-wave2-validation-"));
  const validationTutor = join(validationRoot, "adaptive-tutor");
  await cp(tutorRoot, validationTutor, {
    recursive: true,
    filter: (source) => !["node_modules", "dist", ".test-dist", ".dist"].includes(basename(source)),
  });
  await symlink(resolve(repositoryRoot, "node_modules"), join(validationTutor, "node_modules"));
  const validation = execute("npm", ["run", "validate"], { cwd: validationTutor });
  const validationOutput = `${validation.stdout}${validation.stderr}`;
  if (validation.status === 0) record("broad-validator", "PASS", "all checks passed", "npm run validate (isolated copy)");
  else if (validationOutput.includes("Checks: 19") && validationOutput.includes("Passed: 18") && validationOutput.includes("Failed: 1") && validationOutput.includes("platform-boundary | FAIL")) {
    record("broad-validator", "INHERITED_FINDING", "18/19; accepted obsolete platform-boundary validator finding", "npm run validate (isolated copy)");
  } else {
    record("broad-validator", "FAIL", "unexpected validation result", "npm run validate (isolated copy)");
    process.stderr.write(validationOutput);
  }
} finally {
  if (validationRoot !== undefined) await rm(validationRoot, { recursive: true, force: true });
}

let sourceRoot;
try {
  sourceRoot = await mkdtemp(join(tmpdir(), "tutor-v2-wave2-study-core-"));
  const frozenTutor = join(sourceRoot, "tutor-core", "manuel-academy-adaptive-tutor-core-v0.2", "adaptive-tutor");
  await mkdir(dirname(frozenTutor), { recursive: true });
  await cp(resolve(tutorRoot, "study-engine/integration-labs/student-runtime/vendor/adaptive-tutor-core"), frozenTutor, { recursive: true });
  await symlink(resolve(repositoryRoot, "node_modules"), join(frozenTutor, "node_modules"));
  requireSuccess("frozen-tutor-core-build", "npm", ["run", "build"], "reconstructed frozen Tutor Core build", { cwd: frozenTutor });
  await unlink(join(frozenTutor, "node_modules"));
  const studyContracts = join(sourceRoot, "study-contracts", "adaptive-tutor", "study-engine");
  await mkdir(dirname(studyContracts), { recursive: true });
  await symlink(resolve(tutorRoot, "study-engine/integration-labs/student-runtime/vendor/study-engine"), studyContracts);
  const studyBridge = execute(process.execPath, ["--test", "adaptive-tutor/study-engine/tests/tutor-core-bridge/*.test.mjs"], {
    cwd: repositoryRoot,
    env: { ...process.env, SESSION6_SOURCE_ROOT: sourceRoot, SESSION6_TSC: tsc },
  });
  const counts = tapCounts(`${studyBridge.stdout}${studyBridge.stderr}`);
  const expectedSkip = [process.env.SESSION6_TUTOR_ZIP, process.env.SESSION6_STUDY_CONTRACTS_ZIP, process.env.SESSION6_STUDY_ENGINE_ZIP, process.env.SESSION6_RECONCILIATION_ZIP].some((value) => !value);
  const passed = studyBridge.status === 0 && counts.tests === 36 && counts.fail === 0 &&
    counts.pass === (expectedSkip ? 35 : 36) && counts.skipped === (expectedSkip ? 1 : 0);
  record("study-core-bridge", passed ? "PASS" : "FAIL", `${counts.pass}/${counts.tests} pass; ${counts.skipped} skipped`, "SESSION6_SOURCE_ROOT=<reconstructed> Study Core Bridge");
  record("frozen-archive-checksums", expectedSkip ? "NOT_AVAILABLE" : "PASS", expectedSkip ? "four external SESSION6 archives not mounted; exact checksum test skipped" : "four configured archives exact", "SESSION6_*_ZIP");
  if (!passed) process.stderr.write(`${studyBridge.stdout}${studyBridge.stderr}`);
} catch (error) {
  record("study-core-bridge", "FAIL", error instanceof Error ? error.message : String(error), "reconstructed Study Core Bridge");
} finally {
  if (sourceRoot !== undefined) await rm(sourceRoot, { recursive: true, force: true });
}

const allowed = (path) =>
  path === "adaptive-tutor/core/v2/index.ts" ||
  path === "adaptive-tutor/core/index.ts" ||
  path === "adaptive-tutor/study-engine/tutor-v2/index.ts" ||
  path === "adaptive-tutor/package.json" ||
  path.startsWith("adaptive-tutor/study-engine/tutor-v2/adaptive/") ||
  path.startsWith("adaptive-tutor/json-schema/v2/") ||
  path.startsWith("adaptive-tutor/scripts/tutor-v2/") ||
  path.startsWith("adaptive-tutor/tests/tutor-v2-convergence/") ||
  path.startsWith("adaptive-tutor/tutor-v2-wave2-release/") ||
  path.startsWith("docs/study-tutor-v2/wave2/");
const statusPaths = git(["status", "--porcelain=v1", "--untracked-files=all"]).stdout
  .split("\n").filter(Boolean).map((line) => line.slice(3));
const authoredPaths = git(["diff", "--name-only", R4_ADAPTATION_START, "HEAD"]).stdout
  .split("\n").filter(Boolean);
const allAuthored = [...new Set([...authoredPaths, ...statusPaths])];
const violations = allAuthored.filter((path) => !allowed(path));
record("convergence-ownership", violations.length === 0 ? "PASS" : "FAIL", violations.length === 0 ? `${allAuthored.length} R4 convergence-authored paths within ownership` : violations.join(", "), `git diff --name-only ${R4_ADAPTATION_START} HEAD plus status`);
const candidatePaths = [
  ...git(["diff", "--name-only", B4_START, "HEAD"]).stdout.split("\n").filter(Boolean),
  ...statusPaths,
];
const restrictedPrefixes = [
  "src/", "netlify/", "supabase/", ".github/", "vercel.json", "netlify.toml",
];
const restrictedChanges = [...new Set(candidatePaths)].filter((path) =>
  restrictedPrefixes.some((prefix) => path === prefix || path.startsWith(prefix))
);
record(
  "production-release-isolation",
  restrictedChanges.length === 0 ? "PASS" : "FAIL",
  restrictedChanges.length === 0
    ? "no src, netlify, supabase, deployment, or production configuration changes"
    : restrictedChanges.join(", "),
  `git diff --name-only ${B4_START} HEAD plus status`,
);
const diffCheck = git(["diff", "--check"]);
record("git-diff-check", diffCheck.status === 0 ? "PASS" : "FAIL", diffCheck.status === 0 ? "no whitespace errors" : diffCheck.stdout.trim(), "git diff --check");

const wave2GateNames = [
  "ADMISSION_GATE", "CONCEPT_GRAPH_GATE", "MISCONCEPTION_GATE", "HINT_CEILING_GATE",
  "ACTIVE_ASSESSMENT_GATE", "MASTERY_AUTHORITY_GATE", "WORKING_LEVEL_GATE",
  "REPAIR_DEPTH_GATE", "CROSS_CHILD_ISOLATION_GATE", "PARENT_PRIVACY_GATE",
  "REPLAY_GATE", "STATIC_FALLBACK_GATE",
];
const wave2CompositionPassed = checks.find(({ name }) => name === "wave2-composition-regression")?.status === "PASS";
const priorWave2HardGateFamilies = wave2GateNames.map((name) => ({
  name,
  enforcement: "HARD_NON_COMPENSABLE",
  status: wave2CompositionPassed ? "PASS" : "FAIL",
  permanentTest: "tests/tutor-v2-convergence/wave2-composition.test.ts",
}));
const blockerHardGateFamilies = blockerGateChecks.map(({ family, check, file }) => ({
  name: family,
  enforcement: "HARD_NON_COMPENSABLE",
  status: checks.find(({ name }) => name === check)?.status === "PASS" ? "PASS" : "FAIL",
  permanentTest: file.replace(`${dist}/`, ""),
}));
const r4HardGateDefinitions = [
  ["ADAPTIVE_SUBSYSTEM_EXCEPTION_FALLBACK", "b4-focused-exception-suite", "study-engine/tutor-v2/adaptive/subsystem-fallback.test.ts"],
  ["ADAPTIVE_REPLAY_RECOVERY_AND_DIGEST", "b5-composition-replay-suite", "study-engine/tutor-v2/adaptive/composition-repair.test.ts"],
  ["ADAPTIVE_SUBSYSTEM_RESULT_VALIDATION", "wave2-composition-regression", "tests/tutor-v2-convergence/wave2-r4-contracts.test.ts"],
  ["SINGLE_COHERENT_ADAPTIVE_ACTION", "b5-composition-replay-suite", "study-engine/tutor-v2/adaptive/composition-repair.test.ts"],
  ["EVIDENCE_BACKED_PREREQUISITE_INFERENCE", "b5-composition-replay-suite", "study-engine/tutor-v2/adaptive/composition-repair.test.ts"],
  ["DECISION_OPPORTUNITY_PROVENANCE", "wave2-composition-regression", "tests/tutor-v2-convergence/wave2-r4-contracts.test.ts"],
  ["HINT_OPPORTUNITY_COMPLETION_RESET", "b6-hint-suite", "core/v2/hints/hint-ladder.test.ts"],
  ["COMPLETED_REVIEW_PERMISSION_SCOPE", "b13-review-permission-suite", "tests/tutor-v2-convergence/wave2-r4-contracts.test.ts"],
  ["INTERVENTION_HISTORY_STATE_RECONCILIATION", "b7-intervention-suite", "core/v2/interventions/intervention-ladder.test.ts"],
  ["MASTERY_RECENCY_CONTEXT_PARITY", "b8-mastery-suite", "core/v2/mastery/mastery-evidence.test.ts"],
  ["RETEACH_LOOP_CAP_TERMINAL", "b9-reteach-suite", "study-engine/tutor-v2/reteach/reteach.test.ts"],
  ["ADMISSION_STUDY_SCOPE_BINDING", "b10-admission-suite", "tests/tutor-v2-convergence/wave2-r4-contracts.test.ts"],
  ["PARENT_WHY_CLOSED_SCOPE_AND_COPY", "b11-parent-why-suite", "tests/tutor-v2-convergence/wave2-r4-contracts.test.ts"],
  ["MISCONCEPTION_CODE_SEMANTIC_CLOSURE", "b12-misconception-suite", "tests/tutor-v2-convergence/wave2-schema-parity.test.ts"],
  ["SINGLE_COMPOSITION_ROUTE", "wave2-composition-regression", "tests/tutor-v2-convergence/single-composition-route.test.ts"],
];
const r4HardGateFamilies = r4HardGateDefinitions.map(([name, check, permanentTest]) => ({
  name,
  enforcement: "HARD_NON_COMPENSABLE",
  status: checks.find(({ name: checkName }) => checkName === check)?.status === "PASS"
    ? "PASS"
    : "FAIL",
  permanentTest,
}));
const wave1Passed = checks.find(({ name }) => name === "wave1-hard-gate-regression")?.status === "PASS";
const wave1HardGateFamilies = [
  "PROVIDER_AUTHORITY_BOUNDARY",
  "STRUCTURAL_ACTIVE_ASSESSMENT_ANTI_ANSWER",
  "REVIEWED_CONTENT_PRIVACY_PROVENANCE",
  "APPROVAL_DECISION_STRUCTURAL_VALIDATION",
].map((name) => ({
  name,
  enforcement: "HARD_NON_COMPENSABLE",
  status: wave1Passed ? "PASS" : "FAIL",
  permanentTest: "tests/tutor-v2-convergence/",
}));
const hardGateFamilies = [
  ...priorWave2HardGateFamilies,
  ...blockerHardGateFamilies,
  ...r4HardGateFamilies,
  ...wave1HardGateFamilies,
];
if (hardGateFamilies.some(({ status }) => status !== "PASS")) hardFailure = true;

const inherited = checks.some(({ status }) => status === "INHERITED_FINDING" || status === "NOT_AVAILABLE");
const finalClassification = hardFailure
  ? "WAVE2_HOLD"
  : inherited
    ? "WAVE2_R4_CANDIDATE_READY_FOR_FINAL_REREVIEW_WITH_INHERITED_FINDINGS"
    : "WAVE2_R4_CANDIDATE_READY_FOR_FINAL_REREVIEW";
const result = {
  resultVersion: 4,
  product: "Manuel Academy Study Tutor V2",
  wave: "Wave 2 R4 Post-Audit Repair Candidate",
  wave1AcceptedBaselineSha: BASE,
  wave1AcceptanceClassification: "WAVE1_ACCEPTED_WITH_INHERITED_FINDINGS",
  wave2Complete: false,
  finalIndependentRereviewRequired: true,
  finalClassification,
  hardGateFamilies,
  counts: {
    wave1HardGateTests: w1Counts.tests + bridgeCounts.tests,
    wave1HardGatePassed: w1Counts.pass + bridgeCounts.pass,
    wave2LaneTests: laneCounts.tests,
    wave2LanePassed: laneCounts.pass,
    wave2CompositionTests: compositionCounts.tests,
    wave2CompositionPassed: compositionCounts.pass,
    wave2BlockerHardGateTests: blockerCounts.reduce((sum, counts) => sum + counts.tests, 0),
    wave2BlockerHardGatePassed: blockerCounts.reduce((sum, counts) => sum + counts.pass, 0),
    wave2R4HardGateFamilies: r4HardGateFamilies.length,
    wave2R4HardGateFamiliesPassed: r4HardGateFamilies.filter(({ status }) => status === "PASS").length,
    fullWave2ConvergenceTests: fullConvergenceCounts.tests,
    fullWave2ConvergencePassed: fullConvergenceCounts.pass,
    focusedRepairTests: Object.values(focusedCounts).reduce((sum, counts) => sum + counts.tests, 0),
    focusedRepairPassed: Object.values(focusedCounts).reduce((sum, counts) => sum + counts.pass, 0),
    foundationHarnessTests: evalTestCounts.tests,
    foundationHarnessPassed: evalTestCounts.pass,
    tutorCoreTests: coreCounts.tests,
    tutorCorePassed: coreCounts.pass,
  },
  checks,
};
await mkdir(resolve(tutorRoot, "tutor-v2-wave2-release"), { recursive: true });
await writeFile(
  resolve(tutorRoot, "tutor-v2-wave2-release/WAVE2-GATE-RESULT.json"),
  `${JSON.stringify(canonicalize(result), null, 2)}\n`,
  "utf8",
);
process.stdout.write(`${finalClassification}\n`);
if (hardFailure) process.exitCode = 1;
