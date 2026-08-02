from __future__ import annotations

import hashlib
import json
import sys
import zipfile


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def files_in(archive: zipfile.ZipFile) -> dict[str, zipfile.ZipInfo]:
    return {entry.filename: entry for entry in archive.infolist() if not entry.is_dir()}


def reconcile_math(path: str) -> dict[str, object]:
    prefix = (
        "manuel-academy-adaptive-tutor-math-v1/"
        "adaptive-tutor/subjects/math/"
    )
    with zipfile.ZipFile(path) as archive:
        files = files_in(archive)
        sums_name = prefix + "SHA256SUMS.txt"
        sums = archive.read(sums_name).decode("utf-8").splitlines()
        listed: set[str] = set()
        mismatches: list[str] = []
        for line in filter(str.strip, sums):
            expected, relative = line.split(maxsplit=1)
            relative = relative.removeprefix("./")
            name = prefix + relative
            listed.add(name)
            if name not in files:
                mismatches.append(f"missing:{relative}")
                continue
            if digest(archive.read(name)) != expected.lower():
                mismatches.append(f"hash:{relative}")
        package_files = {name for name in files if name.startswith(prefix)}
        return {
            "archive": path,
            "package_file_count": len(package_files),
            "manifest_entry_count": len(listed),
            "mismatches": mismatches,
            "unlisted": sorted(package_files - listed),
            "outside_package_files": sorted(set(files) - package_files),
        }


def reconcile_core(path: str) -> dict[str, object]:
    prefix = (
        "manuel-academy-adaptive-tutor-core-v0.2/"
        "adaptive-tutor/"
    )
    with zipfile.ZipFile(path) as archive:
        files = files_in(archive)
        manifest_name = prefix + "MANIFEST.json"
        manifest = json.loads(archive.read(manifest_name))
        listed: set[str] = set()
        mismatches: list[str] = []
        for item in manifest["files"]:
            name = prefix + item["path"]
            listed.add(name)
            if name not in files:
                mismatches.append(f"missing:{item['path']}")
                continue
            data = archive.read(name)
            if len(data) != item["bytes"]:
                mismatches.append(f"bytes:{item['path']}")
            if digest(data) != item["sha256"].lower():
                mismatches.append(f"hash:{item['path']}")
        package_files = {name for name in files if name.startswith(prefix)}
        return {
            "archive": path,
            "declared_file_count": manifest["file_count"],
            "declared_total_bytes": manifest["total_bytes"],
            "manifest_entry_count": len(listed),
            "manifest_entry_bytes": sum(item["bytes"] for item in manifest["files"]),
            "package_file_count": len(package_files),
            "mismatches": mismatches,
            "unlisted": sorted(package_files - listed),
            "outside_package_files": sorted(set(files) - package_files),
        }


print(
    json.dumps(
        {
            "math": reconcile_math(sys.argv[1]),
            "core": reconcile_core(sys.argv[2]),
        },
        indent=2,
    )
)
