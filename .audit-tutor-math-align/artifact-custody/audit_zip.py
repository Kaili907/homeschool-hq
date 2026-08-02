from __future__ import annotations

import argparse
import collections
import hashlib
import json
import posixpath
import re
import stat
import struct
import zipfile
from pathlib import PurePosixPath


def sha256_path(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def extra_field_ids(extra: bytes) -> list[str]:
    ids: list[str] = []
    offset = 0
    while offset + 4 <= len(extra):
        field_id, size = struct.unpack_from("<HH", extra, offset)
        ids.append(f"0x{field_id:04x}")
        offset += 4 + size
    if offset != len(extra):
        ids.append("MALFORMED_TRAILER")
    return ids


def normalized_name(name: str) -> str:
    return posixpath.normpath(name.replace("\\", "/")).casefold()


def unsafe_reasons(name: str) -> list[str]:
    reasons: list[str] = []
    slash_name = name.replace("\\", "/")
    parts = PurePosixPath(slash_name).parts
    if "\x00" in name:
        reasons.append("NUL")
    if name.startswith(("/", "\\")):
        reasons.append("ABSOLUTE_PATH")
    if re.match(r"^[A-Za-z]:", name):
        reasons.append("DRIVE_PREFIX")
    if "\\" in name:
        reasons.append("BACKSLASH_SEPARATOR")
    if any(part == ".." for part in parts):
        reasons.append("PARENT_TRAVERSAL")
    if any(part == "." for part in parts):
        reasons.append("DOT_SEGMENT")
    if slash_name.startswith("//"):
        reasons.append("UNC_OR_NETWORK_PATH")
    return reasons


def entry_kind(info: zipfile.ZipInfo) -> tuple[str, str]:
    unix_mode = (info.external_attr >> 16) & 0xFFFF
    if info.is_dir():
        return "directory", f"{unix_mode:06o}"
    if info.create_system == 3:
        if stat.S_ISLNK(unix_mode):
            return "symlink", f"{unix_mode:06o}"
        if stat.S_ISDIR(unix_mode):
            return "directory-mode-without-trailing-slash", f"{unix_mode:06o}"
        if stat.S_ISREG(unix_mode):
            return "file", f"{unix_mode:06o}"
        if stat.S_IFMT(unix_mode):
            return "special", f"{unix_mode:06o}"
    return "file", f"{unix_mode:06o}"


def audit(path: str) -> dict:
    result: dict = {
        "path": path,
        "sha256": sha256_path(path),
    }
    with zipfile.ZipFile(path, "r") as archive:
        infos = archive.infolist()
        exact_groups = collections.defaultdict(list)
        normalized_groups = collections.defaultdict(list)
        unsafe = []
        symlinks = []
        special = []
        encrypted = []
        metadata = []
        totals = collections.Counter()

        for index, info in enumerate(infos):
            kind, unix_mode = entry_kind(info)
            reasons = unsafe_reasons(info.filename)
            exact_groups[info.filename].append(index)
            normalized_groups[normalized_name(info.filename)].append(
                {"index": index, "name": info.filename}
            )
            if reasons:
                unsafe.append(
                    {"index": index, "name": info.filename, "reasons": reasons}
                )
            if kind == "symlink":
                symlinks.append({"index": index, "name": info.filename})
            elif kind in {"special", "directory-mode-without-trailing-slash"}:
                special.append({"index": index, "name": info.filename, "kind": kind})
            if info.flag_bits & 0x1:
                encrypted.append({"index": index, "name": info.filename})
            totals[kind] += 1
            metadata.append(
                {
                    "index": index,
                    "name": info.filename,
                    "kind": kind,
                    "create_system": info.create_system,
                    "version_created": info.create_version,
                    "version_needed": info.extract_version,
                    "flag_bits": f"0x{info.flag_bits:04x}",
                    "compression": info.compress_type,
                    "compressed_size": info.compress_size,
                    "uncompressed_size": info.file_size,
                    "crc32": f"{info.CRC:08x}",
                    "unix_mode": unix_mode,
                    "dos_attrs": f"0x{info.external_attr & 0xffff:04x}",
                    "extra_field_ids": extra_field_ids(info.extra),
                    "comment_length": len(info.comment),
                }
            )

        exact_duplicates = [
            {"name": name, "indexes": indexes}
            for name, indexes in exact_groups.items()
            if len(indexes) > 1
        ]
        normalized_collisions = [
            {"normalized": name, "entries": entries}
            for name, entries in normalized_groups.items()
            if len(entries) > 1
        ]
        crc_failure = archive.testzip()
        result.update(
            {
                "entry_count": len(infos),
                "archive_comment_length": len(archive.comment),
                "kind_counts": dict(totals),
                "exact_duplicates": exact_duplicates,
                "case_and_separator_normalized_collisions": normalized_collisions,
                "unsafe_paths": unsafe,
                "symlinks": symlinks,
                "special_entries": special,
                "encrypted_entries": encrypted,
                "crc_first_failure": crc_failure,
                "entries": metadata,
            }
        )
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("archives", nargs="+")
    args = parser.parse_args()
    print(json.dumps([audit(path) for path in args.archives], indent=2))


if __name__ == "__main__":
    main()
