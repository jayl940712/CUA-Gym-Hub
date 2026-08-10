#!/usr/bin/env python3
"""Redact third-party credentials from the extracted gitlab seed.

The WebArena gitlab instance mirrors real public GitHub repositories, and some
of those repositories contain credentials their authors committed by mistake.
When the seed carries real file content, those credentials come with it and
GitHub's push protection (correctly) blocks the push:

    Heroku Postgres Connection URL
      path: websites/webarena_gitlab_mock/src/data/repo_files.json

These are NOT our secrets and they are not ours to allow through. They are also
not task-relevant: no anchor in assets/task_anchors.md asserts on them. So the
credential portion is masked while the surrounding file content, the file's
presence in the tree, and the URL's shape are all preserved -- a project browsing
that file still sees a realistic connection string.

Only user:password pairs pointing at PUBLIC hosts are masked. A URL against
localhost or an RFC1918 private address is left alone: it is unreachable, it is
not flagged by secret scanning, and in at least one case (issues.json,
172.27.109.128) it is pre-existing seed data that predates the expansion.

Run after merge.py, before committing. Idempotent.
"""
import ipaddress
import json
import re
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parents[3] / "src" / "data"

# user:pass@host -- the credential-bearing form only
CRED_URL = re.compile(
    r"(?P<scheme>postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp)://"
    r"(?P<user>[^:/\s\"']+):(?P<pw>[^@\s\"']+)@(?P<host>[^:/\s\"'<>]+)",
    re.IGNORECASE,
)


def is_public(host: str) -> bool:
    """True if the host is not localhost, not a placeholder and not RFC1918."""
    h = host.lower()
    if h in ("localhost", "127.0.0.1", "::1", "host", "hostname", "db", "database"):
        return False
    if h.isupper() or h in ("HOST", "DATABASE"):
        return False
    try:
        return ipaddress.ip_address(h).is_global
    except ValueError:
        pass  # a DNS name
    return True


def redact(text: str) -> tuple[str, int]:
    n = 0

    def sub(m):
        nonlocal n
        if not is_public(m.group("host")):
            return m.group(0)
        n += 1
        return f"{m.group('scheme')}://REDACTED:REDACTED@{m.group('host')}"

    return CRED_URL.sub(sub, text), n


def main() -> int:
    total = 0
    for path in sorted(DATA.glob("*.json")):
        raw = path.read_text(encoding="utf-8")
        out, n = redact(raw)
        if n:
            json.loads(out)  # refuse to write anything that is not valid JSON
            path.write_text(out, encoding="utf-8")
            print(f"{path.name}: redacted {n}")
            total += n
    print(f"total redacted: {total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
