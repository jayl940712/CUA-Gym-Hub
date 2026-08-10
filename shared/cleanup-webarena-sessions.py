#!/usr/bin/env python3
"""Remove expired legacy WebArena session state and uploads.

The command is dry-run by default. Use ``--apply`` to delete sessions whose
newest state/baseline/revision/upload artifact is older than ``--max-age-hours``.
Only the five ``webarena_*`` mocks covered by HUB_IMPROVEMENT_PLAN.md are
eligible.
"""

from __future__ import annotations

import argparse
import re
import shutil
import time
from collections import defaultdict
from pathlib import Path


HUB_ROOT = Path(__file__).resolve().parent.parent
MOCKS = (
    "webarena_gitlab_mock",
    "webarena_reddit_mock",
    "webarena_shopping_mock",
    "webarena_shopping_admin_mock",
    "webarena_classifieds_mock",
)
SID_RE = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
STATE_SUFFIXES = (".initial.json", ".revision", ".json")


def sid_from_state_file(path: Path) -> str | None:
    for suffix in STATE_SUFFIXES:
        if path.name.endswith(suffix):
            sid = path.name[: -len(suffix)]
            return sid if SID_RE.fullmatch(sid) else None
    return None


def session_artifacts(mock_dir: Path) -> dict[str, list[Path]]:
    artifacts: dict[str, list[Path]] = defaultdict(list)
    state_dir = mock_dir / ".mock-states"
    if state_dir.is_dir():
        for path in state_dir.iterdir():
            if not path.is_file() or path.is_symlink():
                continue
            sid = sid_from_state_file(path)
            if sid:
                artifacts[sid].append(path)

    files_dir = mock_dir / ".mock-files"
    if files_dir.is_dir():
        for path in files_dir.iterdir():
            if path.is_dir() and not path.is_symlink() and SID_RE.fullmatch(path.name):
                artifacts[path.name].append(path)
    return artifacts


def newest_mtime(paths: list[Path]) -> float:
    newest = 0.0
    for path in paths:
        newest = max(newest, path.stat().st_mtime)
        if path.is_dir():
            for child in path.rglob("*"):
                if child.is_file() and not child.is_symlink():
                    newest = max(newest, child.stat().st_mtime)
    return newest


def remove_artifact(path: Path) -> None:
    if path.is_dir():
        shutil.rmtree(path)
    else:
        path.unlink(missing_ok=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mock",
        action="append",
        choices=(*MOCKS, "all"),
        help="mock to clean; repeatable (default: all)",
    )
    parser.add_argument(
        "--max-age-hours",
        type=float,
        default=24.0,
        help="expire sessions older than this many hours (default: 24)",
    )
    parser.add_argument(
        "--hub-root",
        type=Path,
        default=HUB_ROOT,
        help=f"Hub checkout (default: {HUB_ROOT})",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="perform deletion; without this flag the command is a dry run",
    )
    args = parser.parse_args()
    if args.max_age_hours < 0:
        parser.error("--max-age-hours must be non-negative")
    return args


def main() -> int:
    args = parse_args()
    selected = list(MOCKS)
    if args.mock and "all" not in args.mock:
        selected = list(dict.fromkeys(args.mock))

    cutoff = time.time() - args.max_age_hours * 3600
    expired_count = 0
    artifact_count = 0
    for mock in selected:
        mock_dir = args.hub_root.resolve() / "websites" / mock
        for sid, paths in sorted(session_artifacts(mock_dir).items()):
            if newest_mtime(paths) >= cutoff:
                continue
            expired_count += 1
            artifact_count += len(paths)
            action = "DELETE" if args.apply else "WOULD DELETE"
            print(f"{action} {mock} sid={sid} artifacts={len(paths)}")
            if args.apply:
                for path in paths:
                    remove_artifact(path)

    mode = "deleted" if args.apply else "found"
    print(f"{mode} {expired_count} expired sessions ({artifact_count} artifacts)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
