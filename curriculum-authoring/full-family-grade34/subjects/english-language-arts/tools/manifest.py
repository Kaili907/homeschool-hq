#!/usr/bin/env python3
"""Generate MANIFEST.json and SHA256SUMS.txt for the package.

Both files exclude themselves and any __pycache__ artifact, so the manifest is
stable across runs. Run after authoring/build.py and tools/validate.py.
"""
import hashlib, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXCLUDE = {"MANIFEST.json", "SHA256SUMS.txt"}

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()

files = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = sorted(d for d in dirnames if d != "__pycache__")
    for name in sorted(filenames):
        rel = os.path.relpath(os.path.join(dirpath, name), ROOT)
        if rel in EXCLUDE or rel.endswith(".pyc"):
            continue
        full = os.path.join(dirpath, name)
        files.append({"path": rel, "bytes": os.path.getsize(full), "sha256": sha256(full)})

with open(os.path.join(ROOT, "MANIFEST.json"), "w", encoding="utf-8") as fh:
    json.dump({"package_id": "manuel-academy-grades-3-4-ela-authoring-v1",
               "version": "1.0.0", "hash_algorithm": "sha256",
               "exclusions": sorted(EXCLUDE),
               "file_count": len(files),
               "total_bytes": sum(f["bytes"] for f in files),
               "files": files}, fh, indent=2, ensure_ascii=False)
    fh.write("\n")
with open(os.path.join(ROOT, "SHA256SUMS.txt"), "w", encoding="utf-8") as fh:
    for f in files:
        fh.write(f"{f['sha256']}  {f['path']}\n")
print(f"manifest: {len(files)} files, {sum(f['bytes'] for f in files)} bytes")
