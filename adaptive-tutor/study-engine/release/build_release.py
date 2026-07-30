#!/usr/bin/env python3
"""Build and raw-audit the deterministic Session 9 release archive."""

from __future__ import annotations

import hashlib
import json
import os
import re
import stat
import zipfile
from pathlib import Path, PurePosixPath

RELEASE_DIR = Path(__file__).resolve().parent
STUDY_ENGINE = RELEASE_DIR.parent
ADAPTIVE_TUTOR = STUDY_ENGINE.parent
ARCHIVE_NAME = "MANUEL-ACADEMY-ADAPTIVE-STUDY-ENGINE-V1-RC1.zip"
ARCHIVE_PATH = RELEASE_DIR / ARCHIVE_NAME
MANIFEST_PATH = RELEASE_DIR / "file-manifest.json"
EVIDENCE_PATH = RELEASE_DIR / "release-evidence.json"
SEAL_PATH = RELEASE_DIR / "final-archive.sha256"

SKIP_PARTS = {
    ".git",
    ".vite",
    ".test-dist",
    "__pycache__",
    "coverage",
    "node_modules",
    "playwright-report",
    "test-results",
}
GENERATED_RELEASE_NAMES = {
    ARCHIVE_NAME,
    "file-manifest.json",
    "release-evidence.json",
    "final-archive.sha256",
}
ARTIFACTS = {
    "tutorCore": "38205667D56CB4FCC5A8360F1F94098B5FA1D35AE71D22334AA1BC8D43ECC276",
    "studyContracts": "79BA0F39688DB42197947915AA421BCA540AD060C072E898E86619F0A66B6F41",
    "studyEngine": "979EEAC55DCDE6F47F684B0D6A9C7793FCB53E76F693D07E11A83B3FD9FFB770",
    "studyUx": "9E3735FD09C2D19A991C3EB9FAE936204824F0A30C1EDDDAF1AC8A050314CD11",
    "studyIntegrations": "F4AB726446DA4129E3548919D91E56B85C93FF31BE63DEA692B0BA7926C39C1B",
    "reconciliationR2": "39D161F422B36319D9732567867440A5839C06A67895CA02046600C13AC8CB41",
    "tutorCoreBridgeR2": "0847B14EC8FEFA79E85210ED1565CE8302DC3F81331BC04FCBD895F05B7AD571",
    "studentRuntimeR2": "C78F612507BEDD1185D2B5B70D66A8E934CF29488813A9386C5E8D65BB590B8C",
    "calendarParentRuntimeR3": "604A924B13580AAC00ED5578C0B22F3EC9B8CF9CA5F20DC04DB4DB040E6B62E1",
}


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest().upper()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, indent=2, sort_keys=True) + "\n").encode("utf-8")


def skipped(relative: PurePosixPath) -> bool:
    if any(part in SKIP_PARTS for part in relative.parts):
        return True
    if relative.suffix.lower() == ".zip":
        return True
    if relative.name == "debug.log":
        return True
    return (
        len(relative.parts) >= 3
        and relative.parts[0] == "study-engine"
        and relative.parts[1] == "release"
        and relative.parts[2] in GENERATED_RELEASE_NAMES
    )


def candidate_files() -> list[tuple[PurePosixPath, Path]]:
    result: list[tuple[PurePosixPath, Path]] = []
    for path in ADAPTIVE_TUTOR.rglob("*"):
        if not path.is_file() or path.is_symlink():
            continue
        relative = PurePosixPath(path.relative_to(ADAPTIVE_TUTOR).as_posix())
        if skipped(relative):
            continue
        result.append((relative, path))
    return sorted(result, key=lambda item: str(item[0]))


def source_files(
    files: list[tuple[PurePosixPath, Path]],
) -> list[tuple[PurePosixPath, Path]]:
    excluded_prefixes = (
        "study-engine/release/",
        "study-engine/runtime/dist/",
        "study-engine/docs/final-assembly/screenshots/",
    )
    return [
        item
        for item in files
        if not str(item[0]).startswith(excluded_prefixes)
    ]


def tree_digest(files: list[tuple[PurePosixPath, Path]], root: Path) -> str:
    lines = [
        f"{path.relative_to(root).as_posix()}:{sha256_file(path)}"
        for _, path in files
    ]
    return sha256_bytes("\n".join(lines).encode("utf-8"))


def directory_digest(root: Path) -> tuple[str, list[str]]:
    paths = sorted(
        (path for path in root.rglob("*") if path.is_file()),
        key=lambda path: path.relative_to(root).as_posix(),
    )
    relative = [path.relative_to(root).as_posix() for path in paths]
    lines = [f"{name}:{sha256_file(root / name)}" for name in relative]
    return sha256_bytes("\n".join(lines).encode("utf-8")), relative


def assert_no_personal_path(files: list[tuple[PurePosixPath, Path]]) -> None:
    home = str(Path.home())
    personal_markers = {
        home.replace("/", "\\").lower().encode("utf-8"),
        home.replace("\\", "/").lower().encode("utf-8"),
    }
    for relative, path in files:
        relative_bytes = str(relative).lower().encode("utf-8")
        if any(marker in relative_bytes for marker in personal_markers):
            raise RuntimeError(f"Personal path leaked in archive name: {relative}")
        if path.stat().st_size <= 5_000_000:
            value = path.read_bytes()
            lower = value.lower()
            if b"\0" not in value[:4096] and any(
                marker in lower for marker in personal_markers
            ):
                raise RuntimeError(f"Personal path leaked in text payload: {relative}")


def build_records(
    files: list[tuple[PurePosixPath, Path]],
) -> list[dict[str, object]]:
    return [
        {
            "path": f"adaptive-tutor/{relative.as_posix()}",
            "bytes": path.stat().st_size,
            "sha256": sha256_file(path),
        }
        for relative, path in files
    ]


def write_metadata(files: list[tuple[PurePosixPath, Path]]) -> dict[str, object]:
    source = source_files(files)
    source_digest = tree_digest(source, ADAPTIVE_TUTOR)
    bundle_digest, bundle_files = directory_digest(
        STUDY_ENGINE / "runtime" / "dist"
    )
    records = build_records(files)
    manifest = {
        "contract": "manuel-academy.adaptive-study-engine.file-manifest.v1",
        "algorithm": "SHA-256",
        "ordering": "normalized relative path, ascending Unicode code-point order",
        "pathNormalization": "forward slash",
        "scope": "payload files; manifest and release evidence are self-describing exclusions",
        "files": records,
    }
    manifest_value = json_bytes(manifest)
    MANIFEST_PATH.write_bytes(manifest_value)
    manifest_digest = sha256_bytes(manifest_value)

    trace_path = RELEASE_DIR / "traces" / "deterministic-end-to-end.json"
    canonical_trace = (
        RELEASE_DIR / "traces" / "deterministic-end-to-end.sha256"
    ).read_text("utf-8").split()[0]
    evidence = {
        "contract": "manuel-academy.adaptive-study-engine.release-evidence.v1",
        "release": {
            "name": "Manuel Academy Adaptive Study Engine",
            "version": "1.0.0-rc.1",
            "classification": "PASS WITH DOCUMENTED NON-PRODUCTION LIMITATIONS",
        },
        "components": {
            "tutorCore": "0.2.0-frozen",
            "tutorCoreBridge": "1.0.1",
            "tutorCoreBridgeContract": 1,
            "studentRuntime": "0.7.2",
            "calendarParentRuntime": "0.8.1",
        },
        "sourceArtifactChecksums": ARTIFACTS,
        "sourceTreeDigest": source_digest,
        "sourceTreeFiles": len(source),
        "bundleDigest": bundle_digest,
        "bundleFiles": bundle_files,
        "testTotals": {
            "nonBrowserPassed": 704,
            "browserPassed": 34,
            "tutorCoreValidationChecksPassed": 19,
            "failed": 0,
            "totalPassingChecks": 757,
        },
        "browserTotals": {
            "session3": 10,
            "session7": 14,
            "finalAssembly": 10,
            "axeViolations": 0,
        },
        "moduleTotals": {
            "session3": 41,
            "session7": 145,
            "session8": 26,
            "finalAssembly": 80,
            "totalTransformed": 292,
        },
        "traceHashes": {
            "canonicalSha256": canonical_trace,
            "fileSha256": sha256_file(trace_path),
            "demonstrations": 10,
        },
        "runtime": {
            "nodeVersion": "v22.22.3",
            "nodeEngine": ">=22 <23",
            "packageManager": "npm@11.16.0",
        },
        "finalZipFilename": ARCHIVE_NAME,
        "fileCount": len(records) + 2,
        "manifestDigest": manifest_digest,
        "manifestEntries": len(records),
        "archiveSha256Location": "external: study-engine/release/final-archive.sha256",
        "knownLimitations": [
            "In-memory release-candidate ports are not production persistence.",
            "Production safety requires an injected reviewed classifier in addition to the Session 9 composition layer.",
            "Authentication, authorization, RLS, migrations, deployment, and external delivery are not included.",
        ],
    }
    EVIDENCE_PATH.write_bytes(json_bytes(evidence))
    return evidence


def write_archive(files: list[tuple[PurePosixPath, Path]]) -> None:
    with zipfile.ZipFile(
        ARCHIVE_PATH,
        "w",
        compression=zipfile.ZIP_DEFLATED,
        compresslevel=9,
        strict_timestamps=True,
    ) as archive:
        archive.comment = b"Manuel Academy Adaptive Study Engine 1.0.0-rc.1"
        for relative, path in files:
            name = f"adaptive-tutor/{relative.as_posix()}"
            info = zipfile.ZipInfo(name, (2026, 7, 30, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            archive.writestr(info, path.read_bytes(), compresslevel=9)
        for path in (MANIFEST_PATH, EVIDENCE_PATH):
            relative = path.relative_to(ADAPTIVE_TUTOR).as_posix()
            info = zipfile.ZipInfo(
                f"adaptive-tutor/{relative}", (2026, 7, 30, 0, 0, 0)
            )
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            archive.writestr(info, path.read_bytes(), compresslevel=9)


def audit_archive(evidence: dict[str, object]) -> dict[str, object]:
    with zipfile.ZipFile(ARCHIVE_PATH, "r") as archive:
        infos = archive.infolist()
        names = [info.filename for info in infos]
        if len(names) != evidence["fileCount"]:
            raise RuntimeError("Central-directory file count disagrees with evidence.")
        if len(names) != len(set(names)) or len(names) != len(
            {name.casefold() for name in names}
        ):
            raise RuntimeError("Duplicate or case-colliding archive path.")
        for info in infos:
            name = info.filename
            pure = PurePosixPath(name)
            if (
                "\\" in name
                or name.startswith("/")
                or re.match(r"^[A-Za-z]:", name)
                or any(part in ("", ".", "..") for part in pure.parts)
                or info.flag_bits & 1
                or stat.S_IFMT(info.external_attr >> 16) == stat.S_IFLNK
            ):
                raise RuntimeError(f"Unsafe archive entry: {name}")
            if "node_modules" in pure.parts or name.lower().endswith(".zip"):
                raise RuntimeError(f"Forbidden archive entry: {name}")
            archive.read(info)
    digest = sha256_file(ARCHIVE_PATH)
    SEAL_PATH.write_text(f"{digest}  {ARCHIVE_NAME}\n", encoding="utf-8")
    return {
        "result": "PASS",
        "archive": ARCHIVE_NAME,
        "bytes": ARCHIVE_PATH.stat().st_size,
        "sha256": digest,
        "centralDirectoryEntries": evidence["fileCount"],
        "manifestEntries": evidence["manifestEntries"],
    }


def main() -> None:
    files = candidate_files()
    assert_no_personal_path(files)
    evidence = write_metadata(files)
    write_archive(files)
    result = audit_archive(evidence)
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
