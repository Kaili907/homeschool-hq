import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ARTIFACT_DIR_ENV = "STUDY_ARTIFACT_DIR";
export const DEFAULT_ARTIFACT_DIR = "artifacts";

export function artifactDirectory({
  env = process.env,
  cwd = process.cwd(),
  pathApi = path
} = {}) {
  const configured = env[ARTIFACT_DIR_ENV]?.trim();
  return pathApi.resolve(cwd, configured || DEFAULT_ARTIFACT_DIR);
}

export function artifactCandidateNames(artifact) {
  return [artifact.filename, ...(artifact.acceptedFilenames ?? [])];
}

export function resolveArtifactCandidate(directory, filename, pathApi = path) {
  return pathApi.resolve(directory, filename);
}

export async function resolveArtifactSet(
  artifactMap,
  {
    directory = artifactDirectory(),
    pathApi = path,
    accessFile = access
  } = {}
) {
  const resolved = [];
  const missing = [];
  for (const artifact of artifactMap.artifacts) {
    let match;
    for (const filename of artifactCandidateNames(artifact)) {
      const candidate = resolveArtifactCandidate(directory, filename, pathApi);
      try {
        await accessFile(candidate);
        match = { ...artifact, path: candidate, resolvedFilename: filename };
        break;
      } catch {
        // Candidate absence is reported once, after all portable aliases are tried.
      }
    }
    if (match) resolved.push(match);
    else missing.push({
      id: artifact.id,
      filename: artifact.filename,
      candidates: artifactCandidateNames(artifact)
    });
  }
  return { directory, resolved, missing };
}

export function formatMissingArtifacts({ directory, missing }) {
  const names = missing.map((artifact) => `  - ${artifact.filename}`).join("\n");
  return [
    `Missing ${missing.length} required Study artifact${missing.length === 1 ? "" : "s"} in: ${directory}`,
    names,
    `Set ${ARTIFACT_DIR_ENV} to the directory containing the five frozen ZIPs.`
  ].join("\n");
}

export async function readArtifactMap(
  mapPath = path.join(here, "artifact-map.json")
) {
  return JSON.parse(await readFile(mapPath, "utf8"));
}

export async function preflight(options = {}) {
  const artifactMap = options.artifactMap ?? await readArtifactMap();
  return resolveArtifactSet(artifactMap, options);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await preflight();
  if (result.missing.length > 0) {
    console.error(formatMissingArtifacts(result));
    process.exitCode = 2;
  } else {
    console.log(`Resolved ${result.resolved.length} Study artifacts from: ${result.directory}`);
    for (const artifact of result.resolved) console.log(`  - ${artifact.filename}`);
  }
}
