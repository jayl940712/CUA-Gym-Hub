#!/usr/bin/env python3
"""Static audit for the five WebArena mocks' state contract.

This is deliberately a conservative source audit, not a substitute for
``test-webarena-state-contract.py``.  It checks invariants that can be identified
reliably in the current Vite/data-manager layout:

* ``set`` rewrites current state and the baseline on every call.
* ``set_current`` cannot write the baseline.
* a missing baseline in ``/go`` falls back to defaults, never current state.
* reset deletes both current and baseline session state.
* request bodies are buffered as bytes before one UTF-8 decode.
* ``/state`` and ``/go`` expose their required envelope keys in dev and preview.
* state paths are SID-specific.
* supplied SIDs are validated rather than lossy-sanitised.
* state writes use atomic replacement and uploads are content-addressed.
* top-level differs observe removed keys.
* browser writes are coalesced/serialized and expose ``flushState``.
* boot reconciliation treats injected server state as authoritative.

The checker exits 1 while any invariant is missing.  It intentionally scans only
the five mocks covered by HUB_IMPROVEMENT_PLAN.md.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path


HUB_ROOT = Path(__file__).resolve().parent.parent
WEBSITES = HUB_ROOT / "websites"
MOCKS = (
    "webarena_gitlab_mock",
    "webarena_reddit_mock",
    "webarena_shopping_mock",
    "webarena_shopping_admin_mock",
    "webarena_classifieds_mock",
)


def strip_js_comments(source: str) -> str:
    """Remove JS comments while retaining strings and line positions."""
    out: list[str] = []
    i = 0
    quote: str | None = None
    while i < len(source):
        char = source[i]
        nxt = source[i + 1] if i + 1 < len(source) else ""
        if quote:
            out.append(char)
            if char == "\\" and i + 1 < len(source):
                i += 1
                out.append(source[i])
            elif char == quote:
                quote = None
            i += 1
            continue
        if char in ("'", '"', "`"):
            quote = char
            out.append(char)
            i += 1
            continue
        if char == "/" and nxt == "/":
            out.extend((" ", " "))
            i += 2
            while i < len(source) and source[i] != "\n":
                out.append(" ")
                i += 1
            continue
        if char == "/" and nxt == "*":
            out.extend((" ", " "))
            i += 2
            while i < len(source):
                if source[i] == "*" and i + 1 < len(source) and source[i + 1] == "/":
                    out.extend((" ", " "))
                    i += 2
                    break
                out.append("\n" if source[i] == "\n" else " ")
                i += 1
            continue
        out.append(char)
        i += 1
    return "".join(out)


def balanced_body(source: str, opening: int) -> str | None:
    """Return a balanced brace body.

    The source has already had comments removed.  Counting braces in strings is
    intentional here: object-looking snippets and template substitutions still
    contain balanced pairs, while trying to lex all JavaScript regex/template
    edge cases made this lightweight audit less reliable than brace counting.
    """
    depth = 0
    for index in range(opening, len(source)):
        char = source[index]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return source[opening : index + 1]
    return None


def branch_body(source: str, action: str) -> str | None:
    match = re.search(
        rf"if\s*\(\s*action\s*===\s*['\"]{re.escape(action)}['\"]\s*\)\s*\{{",
        source,
    )
    return balanced_body(source, match.end() - 1) if match else None


def function_body(source: str, name: str) -> str | None:
    match = re.search(
        rf"\b(?:async\s+)?function\s+{re.escape(name)}\s*\([^)]*\)\s*\{{",
        source,
    )
    return balanced_body(source, match.end() - 1) if match else None


def route_body(source: str, route: str) -> str | None:
    match = re.search(
        rf"\.middlewares\.use\(\s*['\"]/{re.escape(route)}['\"]", source
    )
    if not match:
        return None
    arrow = source.find("=>", match.end())
    opening = source.find("{", arrow + 2) if arrow != -1 else -1
    return balanced_body(source, opening) if opening != -1 else None


INITIAL_CALL = re.compile(
    r"\b((?:write|save|publish|set)[A-Za-z_$]*[Ii]nitial[A-Za-z0-9_$]*)\s*\("
)
DIRECT_INITIAL_WRITE = re.compile(
    r"(?:writeFileSync|writeJson|atomicWrite(?:Json)?)\s*\(\s*"
    r"(?:getInitialStateFile\s*\(|initialPath\s*\(|initFile\b)"
)
GO_CURRENT_FALLBACK = re.compile(
    r"(?:const|let|var)\s+initial\s*=\s*[A-Za-z_$][\w$]*"
    r"\s*\|\|\s*(?:current[A-Za-z0-9_$]*|state)\b"
)


def initial_writer_calls(body: str | None) -> list[str]:
    return INITIAL_CALL.findall(body or "")


def helper_is_unconditional(source: str, name: str) -> bool:
    body = function_body(source, name)
    if not body or not DIRECT_INITIAL_WRITE.search(body):
        return False
    return "existsSync" not in body


def set_replaces_baseline(source: str, body: str | None) -> bool:
    if not body or not re.search(r"\bwriteState\s*\(", body):
        return False
    calls = initial_writer_calls(body)
    if any(helper_is_unconditional(source, name) for name in calls):
        return True
    return bool(DIRECT_INITIAL_WRITE.search(body) and "existsSync" not in body)


def set_current_preserves_baseline(body: str | None) -> bool:
    return bool(body) and not initial_writer_calls(body) and not DIRECT_INITIAL_WRITE.search(body)


def buffered_utf8(source: str, post_body: str | None) -> bool:
    if not post_body or re.search(r"\bbody\s*\+=\s*chunk\b", post_body):
        return False
    bodies = [post_body]
    seen: set[str] = set()
    frontier = re.findall(r"\b([A-Za-z_$][\w$]*)\s*\(\s*req\b", post_body)
    for _depth in range(3):
        next_frontier: list[str] = []
        for helper in frontier:
            if helper in seen:
                continue
            seen.add(helper)
            body = function_body(source, helper)
            if not body:
                continue
            bodies.append(body)
            next_frontier.extend(
                re.findall(r"\b([A-Za-z_$][\w$]*)\s*\(\s*req\b", body)
            )
        frontier = next_frontier
    combined = "\n".join(bodies)
    decoded_once = (
        ".toString(" in combined
        or bool(re.search(r"\bTextDecoder\s*\([^)]*\)\.decode\s*\(", combined))
    )
    return "Buffer.concat" in combined and decoded_once


def serialized_browser_writes(source: str) -> bool:
    has_pending = bool(re.search(r"\bpendingWrites?\b", source))
    single_chain = bool(
        re.search(
            r"(?:\bwriteChain\s*=|\bconst\s+run\s*=)\s*writeChain"
            r"[\s\S]{0,200}?\.then\s*\(",
            source,
        )
    )
    per_sid_chains = (
        bool(re.search(r"\bwriteChains\s*=\s*new\s+Map\s*\(", source))
        and bool(re.search(r"\bprevious[\s\S]{0,200}?\.then\s*\(", source))
    )
    return has_pending and (single_chain or per_sid_chains)


def has_envelope(body: str | None, keys: tuple[str, ...]) -> bool:
    if not body:
        return False
    return all(re.search(rf"\b{re.escape(key)}\b", body) for key in keys)


@dataclass(frozen=True)
class CheckResult:
    name: str
    passed: bool
    detail: str


@dataclass(frozen=True)
class MockResult:
    name: str
    checks: tuple[CheckResult, ...]

    @property
    def passed(self) -> bool:
        return all(check.passed for check in self.checks)


def audit_mock(name: str) -> MockResult:
    root = WEBSITES / name
    vite_path = root / "vite.config.js"
    data_path = root / "src" / "utils" / "dataManager.js"
    context_path = root / "src" / "context" / "AppContext.jsx"
    missing = [str(path.relative_to(HUB_ROOT)) for path in (vite_path, data_path, context_path) if not path.is_file()]
    if missing:
        return MockResult(
            name,
            (CheckResult("source files", False, "missing " + ", ".join(missing)),),
        )

    vite = strip_js_comments(vite_path.read_text(encoding="utf-8", errors="replace"))
    data = strip_js_comments(data_path.read_text(encoding="utf-8", errors="replace"))
    context = strip_js_comments(context_path.read_text(encoding="utf-8", errors="replace"))
    set_body = branch_body(vite, "set")
    current_body = branch_body(vite, "set_current")
    reset_body = branch_body(vite, "reset")
    state_body = route_body(vite, "state")
    go_body = route_body(vite, "go")
    post_body = route_body(vite, "post")
    upload_body = route_body(vite, "upload")
    diff_body = function_body(vite, "calculateStateDiff") or ""
    if name == "webarena_gitlab_mock":
        tracker_path = root / "src" / "utils" / "stateTracker.js"
        if tracker_path.is_file():
            diff_body += strip_js_comments(
                tracker_path.read_text(encoding="utf-8", errors="replace")
            )
    state_file = function_body(vite, "getStateFile") or ""
    initial_file = function_body(vite, "getInitialStateFile") or ""
    clear_body = function_body(vite, "clearState") or ""

    checks = (
        CheckResult(
            "set replaces baseline",
            set_replaces_baseline(vite, set_body),
            "set must rewrite current and initial state, even for a reused SID",
        ),
        CheckResult(
            "set_current preserves baseline",
            set_current_preserves_baseline(current_body),
            "set_current must write current state only",
        ),
        CheckResult(
            "missing baseline is observable",
            bool(go_body) and not GO_CURRENT_FALLBACK.search(go_body),
            "/go must use defaults rather than current state when the baseline is absent",
        ),
        CheckResult(
            "reset deletes session state",
            bool(reset_body)
            and bool(re.search(r"\bclearState\s*\(", reset_body))
            and bool(re.search(r"\bgetStateFile\s*\(", clear_body))
            and bool(re.search(r"\bgetInitialStateFile\s*\(", clear_body)),
            "reset must delete both current and initial state files",
        ),
        CheckResult(
            "SID-specific files",
            "sid" in state_file and "sid" in initial_file,
            "current and initial state paths must both depend on sid",
        ),
        CheckResult(
            "strict supplied SID validation",
            bool(re.search(r"\^[^\n]*\{1,128\}\$", vite))
            and bool(function_body(vite, "validateSid"))
            and not bool(re.search(r"\.replace\(\s*/\[\^a-zA-Z0-9_", vite)),
            "reject invalid supplied SIDs instead of stripping them into collisions",
        ),
        CheckResult(
            "atomic state writes",
            bool(re.search(r"\b(?:renameSync|promises\.rename)\s*\(", vite)),
            "write a temporary file and atomically rename it into place",
        ),
        CheckResult(
            "content-addressed uploads",
            bool(upload_body) and "createHash" in upload_body,
            "derive stored upload names from file content",
        ),
        CheckResult(
            "top-level deletions observable",
            "Object.keys(initial" in diff_body
            and "Object.keys(current" in diff_body,
            "compare the union of initial and current top-level keys",
        ),
        CheckResult(
            "buffered UTF-8 request body",
            buffered_utf8(vite, post_body),
            "concatenate bytes before decoding the /post body once",
        ),
        CheckResult(
            "/state envelope",
            has_envelope(state_body, ("stored_state", "has_custom_state", "sid")),
            "/state must expose stored_state, has_custom_state, and sid",
        ),
        CheckResult(
            "/go envelope",
            has_envelope(go_body, ("initial_state", "current_state", "state_diff")),
            "/go must expose initial_state, current_state, and state_diff",
        ),
        CheckResult(
            "dev/preview parity",
            "configureServer" in vite and "configurePreviewServer" in vite,
            "the same middleware must be registered for dev and preview",
        ),
        CheckResult(
            "serialized browser writes",
            serialized_browser_writes(data),
            "coalesce pending whole-state writes and chain network requests",
        ),
        CheckResult(
            "flushState export",
            bool(re.search(r"\bexport\s+(?:async\s+)?function\s+flushState\s*\(", data)),
            "export flushState so evaluation can await the final acknowledged write",
        ),
        CheckResult(
            "server-authoritative boot",
            "fetchServerState" in data
            and "fetchServerState" in context
            and "readStoredState" in context
            and "restoreServerState" in context
            and re.search(r"\bserver\.available\b", context) is not None,
            "adopt available server state and guard recovery with restore",
        ),
    )
    return MockResult(name, checks)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--list",
        action="store_true",
        help="print only mock names with one or more failed checks",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="emit machine-readable results",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="show passing checks as well as failures",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    results = tuple(audit_mock(name) for name in MOCKS)
    failed = tuple(result for result in results if not result.passed)

    if args.list:
        print("\n".join(result.name for result in failed))
        return 1 if failed else 0
    if args.json:
        print(
            json.dumps(
                {
                    "passed": not failed,
                    "mocks": [
                        {**asdict(result), "passed": result.passed} for result in results
                    ],
                },
                indent=2,
            )
        )
        return 1 if failed else 0

    print(f"scanned {len(results)} WebArena mocks: {len(results) - len(failed)} clean, {len(failed)} needing work")
    for result in results:
        failures = [check for check in result.checks if not check.passed]
        print(f"\n{result.name}: {'PASS' if not failures else 'FAIL'}")
        for check in result.checks:
            if args.verbose or not check.passed:
                marker = "ok" if check.passed else "FAIL"
                suffix = "" if check.passed else f" — {check.detail}"
                print(f"  [{marker:>4}] {check.name}{suffix}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
