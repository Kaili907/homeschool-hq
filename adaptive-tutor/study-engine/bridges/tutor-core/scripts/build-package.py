from __future__ import annotations

import argparse
import hashlib
import json
import re
import stat
import struct
import zipfile
from pathlib import Path, PurePosixPath


OWNED_ROOTS = (
    "adaptive-tutor/study-engine/bridges/tutor-core",
    "adaptive-tutor/study-engine/tests/tutor-core-bridge",
    "adaptive-tutor/study-engine/docs/tutor-core-bridge",
)
OUTPUT_NAME = "SESSION-6-R2-STUDY-CORE-BRIDGE.zip"
MANIFEST_PATH = (
    "adaptive-tutor/study-engine/docs/tutor-core-bridge/file-manifest.json"
)
PERSONAL_PATH_PATTERNS = (
    re.compile(rb"[A-Za-z]:[\\/]+Users[\\/]+", re.IGNORECASE),
    re.compile(rb"/" + b"Users" + rb"/[^/\s]+/", re.IGNORECASE),
    re.compile(rb"/" + b"home" + rb"/[^/\s]+/", re.IGNORECASE),
)
BRIDGE_PACKAGE_PATH = (
    "adaptive-tutor/study-engine/bridges/tutor-core/package.json"
)
EXPECTED_BRIDGE_VERSION = "1.0.1"
EXPECTED_CONTRACT_VERSION = 1


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest().upper()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def collect_files(repo_root: Path, include_manifest: bool) -> list[tuple[str, Path]]:
    files: list[tuple[str, Path]] = []
    for owned_root in OWNED_ROOTS:
        root = repo_root / PurePosixPath(owned_root)
        if not root.is_dir():
            continue
        for candidate in sorted(root.rglob("*")):
            if candidate.is_symlink():
                raise RuntimeError(f"Symlink is not allowed: {candidate}")
            if not candidate.is_file():
                continue
            relative = candidate.relative_to(repo_root).as_posix()
            if candidate.suffix.lower() == ".zip":
                continue
            if "__pycache__" in candidate.parts or "node_modules" in candidate.parts:
                continue
            if not include_manifest and relative == MANIFEST_PATH:
                continue
            files.append((relative, candidate))
    return files


def validate_names(files: list[tuple[str, Path]]) -> None:
    names = [name for name, _ in files]
    if len(names) != len(set(names)):
        raise RuntimeError("Duplicate archive path detected.")
    lowered = [name.casefold() for name in names]
    if len(lowered) != len(set(lowered)):
        raise RuntimeError("Case-colliding archive path detected.")
    for name in names:
        pure = PurePosixPath(name)
        if (
            "\\" in name
            or pure.is_absolute()
            or re.match(r"^[A-Za-z]:", name)
            or ".." in pure.parts
            or not any(
                name == root or name.startswith(f"{root}/")
                for root in OWNED_ROOTS
            )
        ):
            raise RuntimeError(f"Unsafe or out-of-ownership archive path: {name}")


def validate_bridge_package(repo_root: Path) -> None:
    package_path = repo_root / PurePosixPath(BRIDGE_PACKAGE_PATH)
    package = json.loads(package_path.read_text(encoding="utf-8"))
    if package.get("version") != EXPECTED_BRIDGE_VERSION:
        raise RuntimeError(
            "Bridge package version must be "
            f"{EXPECTED_BRIDGE_VERSION}; found {package.get('version')!r}."
        )
    if package.get("bridgeContractVersion") != EXPECTED_CONTRACT_VERSION:
        raise RuntimeError(
            "Bridge package contract version must remain "
            f"{EXPECTED_CONTRACT_VERSION}."
        )
    if package.get("type") != "module":
        raise RuntimeError("Bridge package must declare the local ESM boundary.")
    if package.get("private") is not True:
        raise RuntimeError("Bridge package must remain private.")

    adapter_manifest_path = (
        repo_root
        / "adaptive-tutor"
        / "study-engine"
        / "bridges"
        / "tutor-core"
        / "adapter-manifest.json"
    )
    adapter_manifest = json.loads(
        adapter_manifest_path.read_text(encoding="utf-8")
    )
    if adapter_manifest.get("version") != EXPECTED_BRIDGE_VERSION:
        raise RuntimeError(
            "Adapter manifest and bridge package versions must both be "
            f"{EXPECTED_BRIDGE_VERSION}."
        )
    if (
        adapter_manifest.get("bridgeContractVersion")
        != EXPECTED_CONTRACT_VERSION
    ):
        raise RuntimeError(
            "Bridge contract version must remain "
            f"{EXPECTED_CONTRACT_VERSION}."
        )


def scan_personal_paths(files: list[tuple[str, Path]]) -> None:
    for name, file_path in files:
        data = file_path.read_bytes()
        if any(pattern.search(data) for pattern in PERSONAL_PATH_PATTERNS):
            raise RuntimeError(f"Personal home-directory path found in: {name}")


def write_manifest(repo_root: Path) -> None:
    files = collect_files(repo_root, include_manifest=False)
    validate_names(files)
    manifest = {
        "contract": "study-core-bridge.file-manifest.v1",
        "contractVersion": 1,
        "manifestExcludesItself": True,
        "ownedRoots": list(OWNED_ROOTS),
        "fileCount": len(files),
        "files": [
            {
                "path": name,
                "bytes": file_path.stat().st_size,
                "sha256": sha256_file(file_path),
            }
            for name, file_path in files
        ],
    }
    destination = repo_root / PurePosixPath(MANIFEST_PATH)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def write_zip(repo_root: Path, output: Path) -> None:
    files = collect_files(repo_root, include_manifest=True)
    validate_names(files)
    scan_personal_paths(files)
    with zipfile.ZipFile(
        output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9
    ) as archive:
        for name, file_path in files:
            data = file_path.read_bytes()
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            info.flag_bits |= 0x800
            archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED)


def raw_central_directory_audit(output: Path) -> dict[str, object]:
    data = output.read_bytes()
    eocd_offset = data.rfind(b"PK\x05\x06")
    if eocd_offset < 0 or eocd_offset + 22 > len(data):
        raise RuntimeError("ZIP end-of-central-directory record is missing.")
    (
        _signature,
        disk_number,
        central_disk,
        entries_on_disk,
        entry_count,
        central_size,
        central_offset,
        comment_length,
    ) = struct.unpack_from("<IHHHHIIH", data, eocd_offset)
    if (
        disk_number != 0
        or central_disk != 0
        or entries_on_disk != entry_count
        or comment_length != len(data) - (eocd_offset + 22)
    ):
        raise RuntimeError("Unsupported split or malformed ZIP structure.")
    cursor = central_offset
    names: list[str] = []
    symlink_count = 0
    backslash_count = 0
    absolute_count = 0
    drive_qualified_count = 0
    traversal_count = 0
    out_of_ownership_count = 0
    for _ in range(entry_count):
        if data[cursor : cursor + 4] != b"PK\x01\x02":
            raise RuntimeError("Invalid central-directory signature.")
        fields = struct.unpack_from("<IHHHHHHIIIHHHHHII", data, cursor)
        filename_length = fields[10]
        extra_length = fields[11]
        entry_comment_length = fields[12]
        external_attributes = fields[15]
        name_start = cursor + 46
        raw_name = data[name_start : name_start + filename_length]
        name = raw_name.decode("utf-8")
        names.append(name)
        mode = (external_attributes >> 16) & 0xFFFF
        if stat.S_IFMT(mode) == stat.S_IFLNK:
            symlink_count += 1
        if "\\" in name:
            backslash_count += 1
        pure = PurePosixPath(name)
        if pure.is_absolute():
            absolute_count += 1
        if re.match(r"^[A-Za-z]:", name):
            drive_qualified_count += 1
        if ".." in pure.parts:
            traversal_count += 1
        if not any(
            name == root or name.startswith(f"{root}/") for root in OWNED_ROOTS
        ):
            out_of_ownership_count += 1
        cursor = name_start + filename_length + extra_length + entry_comment_length
    if cursor != central_offset + central_size:
        raise RuntimeError("Central-directory size does not match raw entries.")
    duplicate_count = len(names) - len(set(names))
    case_collision_count = len(names) - len({name.casefold() for name in names})
    result = {
        "result": "PASS",
        "entryCount": entry_count,
        "forwardSlashOnly": backslash_count == 0,
        "absolutePathCount": absolute_count,
        "driveQualifiedPathCount": drive_qualified_count,
        "traversalPathCount": traversal_count,
        "duplicatePathCount": duplicate_count,
        "caseCollisionCount": case_collision_count,
        "symlinkCount": symlink_count,
        "outOfOwnershipCount": out_of_ownership_count,
        "centralDirectorySize": central_size,
        "centralDirectoryOffset": central_offset,
    }
    if (
        backslash_count
        or absolute_count
        or drive_qualified_count
        or traversal_count
        or duplicate_count
        or case_collision_count
        or symlink_count
        or out_of_ownership_count
    ):
        result["result"] = "FAIL"
        raise RuntimeError(json.dumps(result, sort_keys=True))
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output")
    args = parser.parse_args()
    repo_root = Path(__file__).resolve().parents[5]
    validate_bridge_package(repo_root)
    output = (
        Path(args.output).resolve()
        if args.output
        else repo_root
        / "adaptive-tutor"
        / "study-engine"
        / "bridges"
        / "tutor-core"
        / OUTPUT_NAME
    )
    if output.parent != (
        repo_root
        / "adaptive-tutor"
        / "study-engine"
        / "bridges"
        / "tutor-core"
    ):
        raise RuntimeError("Output must stay in the owned Tutor bridge directory.")
    write_manifest(repo_root)
    write_zip(repo_root, output)
    audit = raw_central_directory_audit(output)
    report = {
        "result": "PASS",
        "output": output.name,
        "size": output.stat().st_size,
        "sha256": sha256_file(output),
        "rawCentralDirectoryAudit": audit,
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
