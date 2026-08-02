import argparse
import binascii
import hashlib
import json
import os
import re
import stat
import struct
import sys
import zipfile
from pathlib import Path, PurePosixPath

ROOT_NAME = "manuel-academy-adaptive-tutor-math-v1-core-v0.2-aligned-r1"
ARTIFACT_NAME = f"{ROOT_NAME}.zip"
SUBJECT_PREFIX = f"{ROOT_NAME}/adaptive-tutor/subjects/math/"
EXPECTED_ADDED = [
    "standalone-demo/model.js",
    "tests/standalone-demo-regression.test.mjs",
]
EXPECTED_MODIFIED = [
    "README.md",
    "SHA256SUMS.txt",
    "director-handoff.md",
    "docs/core-v0.2-alignment-report.md",
    "manifest.json",
    "package.json",
    "standalone-demo/README.md",
    "standalone-demo/demo.css",
    "standalone-demo/demo.js",
    "standalone-demo/index.html",
    "test-results.txt",
    "validation-report.md",
    "validation-results.json",
]
EXPECTED_DELETED = []
WINDOWS_RESERVED = {
    "con", "prn", "aux", "nul", "clock$",
    *(f"com{i}" for i in range(1, 10)),
    *(f"lpt{i}" for i in range(1, 10)),
}
FORBIDDEN_PARTS = {
    ".git", "node_modules", "screenshots", "screenshot", "playwright-report",
    "test-results", ".cache", ".pnpm-store", "browser-profile", "profiles",
}


def fail(errors, message):
    errors.append(message)


def safe_name(name, errors):
    if not name or "\\" in name:
        fail(errors, f"unsafe separator or empty path: {name!r}")
        return
    if name.startswith(("/", "\\")) or re.match(r"^[A-Za-z]:", name):
        fail(errors, f"absolute path: {name}")
    if any(ord(char) < 32 or char == "\x7f" for char in name):
        fail(errors, f"control character in path: {name!r}")
    path = PurePosixPath(name)
    parts = path.parts
    if not parts or parts[0] != ROOT_NAME:
        fail(errors, f"wrong top-level root: {name}")
    if any(part in ("", ".", "..") for part in parts):
        fail(errors, f"dot, traversal, or empty segment: {name}")
    for part in parts:
        if ":" in part:
            fail(errors, f"colon/ADS path segment: {name}")
        if part.endswith((".", " ")):
            fail(errors, f"trailing dot/space path segment: {name}")
        stem = part.split(".", 1)[0].casefold()
        if stem in WINDOWS_RESERVED:
            fail(errors, f"Windows-reserved path segment: {name}")
    lowered = {part.casefold() for part in parts}
    if lowered & FORBIDDEN_PARTS:
        fail(errors, f"forbidden packaged directory: {name}")
    if name.casefold().endswith((".env", ".pem", ".key", ".p12", ".pfx")):
        fail(errors, f"secret-like file extension: {name}")
    if name.casefold().endswith(".zip"):
        fail(errors, f"nested ZIP: {name}")


def decode_local_name(raw_name, flags):
    return raw_name.decode("utf-8" if flags & 0x800 else "cp437")


def zip_payloads(zip_path, errors):
    payloads = {}
    with zipfile.ZipFile(zip_path, "r") as archive, open(zip_path, "rb") as raw_archive:
        infos = archive.infolist()
        names = [info.filename for info in infos]
        if len(names) != len(set(names)):
            fail(errors, "duplicate central-directory paths")
        folded = {}
        for name in names:
            key = name.casefold()
            if key in folded and folded[key] != name:
                fail(errors, f"case collision: {folded[key]} vs {name}")
            folded[key] = name
            safe_name(name.rstrip("/") if name.endswith("/") else name, errors)

        roots = {name.split("/", 1)[0] for name in names}
        if roots != {ROOT_NAME}:
            fail(errors, f"archive roots mismatch: {sorted(roots)}")

        bad_crc_name = archive.testzip()
        if bad_crc_name:
            fail(errors, f"ZipFile CRC failure: {bad_crc_name}")

        for info in infos:
            if info.flag_bits & 0x1:
                fail(errors, f"encrypted entry: {info.filename}")
            if info.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
                fail(errors, f"unsupported compression method {info.compress_type}: {info.filename}")

            unix_mode = (info.external_attr >> 16) & 0xFFFF
            file_type = stat.S_IFMT(unix_mode)
            if unix_mode and file_type not in (0, stat.S_IFREG, stat.S_IFDIR):
                fail(errors, f"symlink or special entry: {info.filename} mode={oct(unix_mode)}")

            raw_archive.seek(info.header_offset)
            header = raw_archive.read(30)
            if len(header) != 30:
                fail(errors, f"truncated local header: {info.filename}")
                continue
            signature, _version, flags, _method, _time, _date, _crc, _csize, _usize, name_len, extra_len = struct.unpack(
                "<IHHHHHIIIHH", header
            )
            if signature != 0x04034B50:
                fail(errors, f"invalid local header signature: {info.filename}")
                continue
            local_name = decode_local_name(raw_archive.read(name_len), flags)
            raw_archive.seek(extra_len, os.SEEK_CUR)
            if local_name != info.filename:
                fail(errors, f"local/central filename mismatch: {local_name!r} vs {info.filename!r}")
            if flags & 0x1:
                fail(errors, f"encrypted local header: {info.filename}")

            if info.is_dir():
                continue
            if not info.filename.startswith(SUBJECT_PREFIX):
                fail(errors, f"file outside subject boundary: {info.filename}")
                continue
            data = archive.read(info)
            if len(data) != info.file_size:
                fail(errors, f"uncompressed size mismatch: {info.filename}")
            if (binascii.crc32(data) & 0xFFFFFFFF) != info.CRC:
                fail(errors, f"CRC mismatch: {info.filename}")
            relative_name = info.filename[len(SUBJECT_PREFIX):]
            payloads[relative_name] = data
    return payloads


def verify_checksum_manifest(payloads, errors):
    manifest_name = "SHA256SUMS.txt"
    if manifest_name not in payloads:
        fail(errors, "missing SHA256SUMS.txt")
        return
    records = {}
    pattern = re.compile(r"^([0-9a-f]{64})  \./(.+)$")
    for line in payloads[manifest_name].decode("utf-8").splitlines():
        match = pattern.fullmatch(line)
        if not match:
            fail(errors, f"invalid checksum line: {line!r}")
            continue
        digest, name = match.groups()
        if name in records:
            fail(errors, f"duplicate checksum record: {name}")
        records[name] = digest
    expected_names = set(payloads) - {manifest_name}
    if set(records) != expected_names:
        fail(errors, f"checksum path reconciliation failed: missing={sorted(expected_names-set(records))}, extra={sorted(set(records)-expected_names)}")
    for name in expected_names & set(records):
        actual = hashlib.sha256(payloads[name]).hexdigest()
        if actual != records[name]:
            fail(errors, f"SHA256SUMS mismatch: {name}")


def baseline_payloads(baseline_zip, errors):
    result = {}
    with zipfile.ZipFile(baseline_zip, "r") as archive:
        marker = "/adaptive-tutor/subjects/math/"
        for info in archive.infolist():
            if info.is_dir() or marker not in info.filename:
                continue
            relative_name = info.filename.split(marker, 1)[1]
            result[relative_name] = archive.read(info)
    return result


def verify_delta(payloads, baseline, errors):
    added = sorted(set(payloads) - set(baseline))
    deleted = sorted(set(baseline) - set(payloads))
    modified = sorted(name for name in set(payloads) & set(baseline) if payloads[name] != baseline[name])
    delta = {"added": added, "modified": modified, "deleted": deleted}
    if added != EXPECTED_ADDED:
        fail(errors, f"added-file delta mismatch: {added}")
    if modified != EXPECTED_MODIFIED:
        fail(errors, f"modified-file delta mismatch: {modified}")
    if deleted != EXPECTED_DELETED:
        fail(errors, f"deleted-file delta mismatch: {deleted}")
    return delta


def verify_metadata(payloads, errors):
    package = json.loads(payloads["package.json"])
    manifest = json.loads(payloads["manifest.json"])
    if package.get("version") != "1.0.2":
        fail(errors, "package version is not 1.0.2")
    alignment = manifest.get("coreV02Alignment", {})
    if alignment.get("release") != "1.0.2":
        fail(errors, "manifest release is not 1.0.2")
    if alignment.get("derivedArtifact") != ARTIFACT_NAME:
        fail(errors, "manifest artifact name mismatch")
    for name in ("README.md", "director-handoff.md", "validation-report.md"):
        if ARTIFACT_NAME not in payloads[name].decode("utf-8"):
            fail(errors, f"artifact name missing from {name}")
    runtime_pattern = re.compile(rb"(?:[A-Za-z]:\\Users\\|/home/|/Users/)")
    for name, data in payloads.items():
        if name.startswith("standalone-demo/") and name.endswith((".js", ".css", ".html")):
            if runtime_pattern.search(data):
                fail(errors, f"local absolute path in runtime file: {name}")


def verify_extraction(payloads, extraction_root, errors):
    package_root = Path(extraction_root) / ROOT_NAME / "adaptive-tutor" / "subjects" / "math"
    if not package_root.is_dir():
        fail(errors, f"missing extracted package root: {package_root}")
        return
    disk_files = {
        path.relative_to(package_root).as_posix(): path.read_bytes()
        for path in package_root.rglob("*")
        if path.is_file()
    }
    if set(disk_files) != set(payloads):
        fail(errors, f"extracted file set mismatch: missing={sorted(set(payloads)-set(disk_files))}, extra={sorted(set(disk_files)-set(payloads))}")
    for name in set(disk_files) & set(payloads):
        if disk_files[name] != payloads[name]:
            fail(errors, f"extracted byte mismatch: {name}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("zip_path")
    parser.add_argument("baseline_zip")
    parser.add_argument("--extraction-root")
    parser.add_argument("--output")
    args = parser.parse_args()
    errors = []
    zip_path = Path(args.zip_path)
    if zip_path.name != ARTIFACT_NAME:
        fail(errors, f"artifact filename mismatch: {zip_path.name}")
    payloads = zip_payloads(zip_path, errors)
    verify_checksum_manifest(payloads, errors)
    baseline = baseline_payloads(args.baseline_zip, errors)
    delta = verify_delta(payloads, baseline, errors)
    verify_metadata(payloads, errors)
    if args.extraction_root:
        verify_extraction(payloads, args.extraction_root, errors)
    report = {
        "status": "PASS" if not errors else "FAIL",
        "artifact": zip_path.name,
        "sha256": hashlib.sha256(zip_path.read_bytes()).hexdigest(),
        "archiveFiles": len(payloads),
        "checksumRecords": len(payloads) - 1 if "SHA256SUMS.txt" in payloads else 0,
        "singleRoot": ROOT_NAME,
        "crcAndDecompression": "PASS" if not any("CRC" in error or "decompress" in error for error in errors) else "FAIL",
        "delta": delta,
        "errors": errors,
    }
    rendered = json.dumps(report, indent=2) + "\n"
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(rendered, encoding="utf-8")
    print(rendered, end="")
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
