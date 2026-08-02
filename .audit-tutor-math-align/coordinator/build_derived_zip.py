from __future__ import annotations

import pathlib
import stat
import sys
import zipfile


source = pathlib.Path(sys.argv[1]).resolve()
output = pathlib.Path(sys.argv[2]).resolve()
package_root = "manuel-academy-adaptive-tutor-math-v1-core-v0.2-aligned"
fixed_time = (2026, 7, 31, 0, 0, 0)


def entry(name: str, mode: int, is_dir: bool = False) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(name, fixed_time)
    info.create_system = 3
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = (mode & 0xFFFF) << 16
    if is_dir:
        info.external_attr |= 0x10
    return info


with zipfile.ZipFile(
    output,
    mode="x",
    compression=zipfile.ZIP_DEFLATED,
    compresslevel=9,
) as archive:
    directories = [
        package_root,
        f"{package_root}/adaptive-tutor",
        f"{package_root}/adaptive-tutor/subjects",
        f"{package_root}/adaptive-tutor/subjects/math",
    ]
    for directory in directories:
        archive.writestr(entry(f"{directory}/", stat.S_IFDIR | 0o755, True), b"")
    for path in sorted(source.rglob("*"), key=lambda item: item.as_posix()):
        relative = path.relative_to(source).as_posix()
        name = f"{package_root}/adaptive-tutor/subjects/math/{relative}"
        if path.is_dir():
            archive.writestr(entry(f"{name}/", stat.S_IFDIR | 0o755, True), b"")
        elif path.is_file():
            archive.writestr(entry(name, stat.S_IFREG | 0o644), path.read_bytes())
        else:
            raise RuntimeError(f"Unsupported package entry: {path}")

print(output)
