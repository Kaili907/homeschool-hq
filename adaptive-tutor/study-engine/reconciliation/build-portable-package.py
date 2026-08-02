from __future__ import annotations

import sys
import zipfile
from pathlib import Path, PurePosixPath


def collect_files(workspace: Path) -> list[tuple[Path, str]]:
    study = workspace / "adaptive-tutor" / "study-engine"
    roots = (
        study / "reconciliation",
        study / "docs" / "reconciliation",
        study / "tests" / "reconciliation",
    )
    output: list[tuple[Path, str]] = []
    for root in roots:
        for source in root.rglob("*"):
            if not source.is_file() or source.suffix.lower() == ".zip":
                continue
            archive_name = source.relative_to(workspace).as_posix()
            output.append((source, archive_name))
    output.sort(key=lambda item: (item[1].casefold(), item[1]))
    return output


def validate_names(files: list[tuple[Path, str]]) -> None:
    exact: set[str] = set()
    folded: set[str] = set()
    for _, name in files:
        posix = PurePosixPath(name)
        if "\\" in name:
            raise ValueError(f"Backslash path: {name}")
        if posix.is_absolute() or ".." in posix.parts:
            raise ValueError(f"Unsafe path: {name}")
        if name in exact:
            raise ValueError(f"Duplicate path: {name}")
        if name.casefold() in folded:
            raise ValueError(f"Case-colliding path: {name}")
        exact.add(name)
        folded.add(name.casefold())
        allowed = (
            "adaptive-tutor/study-engine/reconciliation/",
            "adaptive-tutor/study-engine/docs/reconciliation/",
            "adaptive-tutor/study-engine/tests/reconciliation/",
        )
        if not name.startswith(allowed):
            raise ValueError(f"Outside ownership: {name}")


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: build-portable-package.py WORKSPACE OUTPUT")
    workspace = Path(sys.argv[1]).resolve()
    destination = Path(sys.argv[2]).resolve()
    files = collect_files(workspace)
    validate_names(files)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(
        destination,
        "w",
        compression=zipfile.ZIP_DEFLATED,
        compresslevel=9,
        strict_timestamps=True,
    ) as archive:
        for source, name in files:
            archive.write(source, arcname=name)
    print(f"{destination}|{len(files)}")


if __name__ == "__main__":
    main()
