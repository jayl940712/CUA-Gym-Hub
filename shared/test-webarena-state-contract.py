#!/usr/bin/env python3
"""Black-box state API contract tests for the five WebArena mocks.

The tests mutate uniquely named SIDs at each target.  They can exercise one or
more already-running servers:

    python3 shared/test-webarena-state-contract.py http://127.0.0.1:5173
    python3 shared/test-webarena-state-contract.py gitlab=http://host:5173 \
        reddit=http://host:5174

They can also start npm dev/preview servers, sequentially, from this Hub checkout:

    python3 shared/test-webarena-state-contract.py --mock all --mode both
    python3 shared/test-webarena-state-contract.py --mock webarena_gitlab_mock \
        --mode preview --skip-build

Only Python's standard library is required.  Managed preview mode builds the
selected mock unless ``--skip-build`` is supplied.
"""

from __future__ import annotations

import argparse
import copy
import http.client
import json
import os
import re
import signal
import shutil
import socket
import ssl
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen


HUB_ROOT = Path(__file__).resolve().parent.parent
MOCKS = (
    "webarena_gitlab_mock",
    "webarena_reddit_mock",
    "webarena_shopping_mock",
    "webarena_shopping_admin_mock",
    "webarena_classifieds_mock",
)
BROWSER_FIXTURES = {
    "webarena_gitlab_mock": (
        "/",
        "webarena_gitlab_mock_state",
        ("ui", "sidebarCollapsed"),
        False,
        True,
    ),
    "webarena_reddit_mock": (
        "/",
        "webarena_reddit_mock_state",
        ("hiddenForums",),
        [],
        ["books"],
    ),
    "webarena_shopping_mock": (
        "/",
        "webarena_shopping_mock_state",
        ("newsletterSubscribed",),
        False,
        True,
    ),
    "webarena_shopping_admin_mock": (
        "/admin/",
        "shopping_admin_mock_state",
        ("gridBookmarks",),
        {},
        {"contract": {"latest": "contract=1"}},
    ),
    "webarena_classifieds_mock": (
        "/",
        "classifieds_mock_state",
        ("marks",),
        [],
        [33164],
    ),
}
PROBE_KEY = "__webarena_state_contract_probe__"
SID_RE = re.compile(r"^[A-Za-z0-9_-]+$")


class ContractFailure(AssertionError):
    """A target did not satisfy the observable state contract."""


class RequestFailure(RuntimeError):
    """An HTTP request could not produce a successful JSON response."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ContractFailure(message)


def compact(value: Any, limit: int = 500) -> str:
    text = json.dumps(value, ensure_ascii=False, sort_keys=True)
    return text if len(text) <= limit else text[:limit] + "…"


class JsonClient:
    def __init__(self, base_url: str, timeout: float) -> None:
        parsed = urlsplit(base_url.rstrip("/"))
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise ValueError(f"base URL must be absolute HTTP(S): {base_url!r}")
        if parsed.query or parsed.fragment:
            raise ValueError(f"base URL must not contain a query or fragment: {base_url!r}")
        self.base_url = urlunsplit(
            (parsed.scheme, parsed.netloc, parsed.path.rstrip("/"), "", "")
        )
        self.parsed = urlsplit(self.base_url)
        self.timeout = timeout

    def _path(self, endpoint: str, sid: str) -> str:
        base_path = self.parsed.path.rstrip("/")
        return f"{base_path}/{endpoint.lstrip('/')}?{urlencode({'sid': sid})}"

    def _url(self, endpoint: str, sid: str) -> str:
        return urlunsplit(
            (
                self.parsed.scheme,
                self.parsed.netloc,
                self.parsed.path.rstrip("/") + "/" + endpoint.lstrip("/"),
                urlencode({"sid": sid}),
                "",
            )
        )

    def _decode(
        self, status: int, content_type: str, raw: bytes, description: str
    ) -> dict[str, Any]:
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise RequestFailure(f"{description}: response is not UTF-8: {exc}") from exc
        if not 200 <= status < 300:
            raise RequestFailure(
                f"{description}: HTTP {status}: {text[:1000]}"
            )
        if "json" not in content_type.lower():
            raise RequestFailure(
                f"{description}: expected JSON Content-Type, got {content_type!r}"
            )
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise RequestFailure(f"{description}: malformed JSON: {exc}") from exc
        if not isinstance(data, dict):
            raise RequestFailure(
                f"{description}: expected a JSON object, got {type(data).__name__}"
            )
        return data

    def request(
        self, method: str, endpoint: str, sid: str, payload: Any | None = None
    ) -> dict[str, Any]:
        body = None
        headers = {"Accept": "application/json"}
        if payload is not None:
            body = json.dumps(
                payload, ensure_ascii=False, separators=(",", ":")
            ).encode("utf-8")
            headers["Content-Type"] = "application/json; charset=utf-8"
        request = Request(
            self._url(endpoint, sid), data=body, headers=headers, method=method
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                raw = response.read()
                return self._decode(
                    response.status,
                    response.headers.get("Content-Type", ""),
                    raw,
                    f"{method} /{endpoint}",
                )
        except HTTPError as exc:
            raw = exc.read()
            return self._decode(
                exc.code,
                exc.headers.get("Content-Type", ""),
                raw,
                f"{method} /{endpoint}",
            )
        except (URLError, OSError, TimeoutError) as exc:
            raise RequestFailure(f"{method} /{endpoint}: {exc}") from exc

    def response_status(self, method: str, endpoint: str, sid: str) -> int:
        request = Request(
            self._url(endpoint, sid),
            headers={"Accept": "application/json"},
            method=method,
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                response.read()
                return response.status
        except HTTPError as exc:
            exc.read()
            return exc.code

    def raw_post_status(self, sid: str, body: bytes) -> int:
        request = Request(
            self._url("post", sid),
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                response.read()
                return response.status
        except HTTPError as exc:
            exc.read()
            return exc.code

    def _split_request(
        self, endpoint: str, sid: str, body: bytes, split_at: int
    ) -> dict[str, Any]:
        """Send one UTF-8 codepoint across two writes to expose chunk decoding."""
        host = self.parsed.hostname
        if not host:
            raise RequestFailure("base URL has no hostname")
        port = self.parsed.port or (443 if self.parsed.scheme == "https" else 80)
        if self.parsed.scheme == "https":
            connection: http.client.HTTPConnection = http.client.HTTPSConnection(
                host, port, timeout=self.timeout, context=ssl.create_default_context()
            )
        else:
            connection = http.client.HTTPConnection(host, port, timeout=self.timeout)
        try:
            connection.putrequest("POST", self._path(endpoint, sid))
            connection.putheader("Content-Type", "application/json; charset=utf-8")
            connection.putheader("Accept", "application/json")
            connection.putheader("Content-Length", str(len(body)))
            connection.endheaders()
            if connection.sock is not None:
                try:
                    connection.sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
                except OSError:
                    pass
            connection.send(body[:split_at])
            # Ensure the split normally reaches Node as separate stream chunks.
            time.sleep(0.02)
            connection.send(body[split_at:])
            response = connection.getresponse()
            raw = response.read()
            return self._decode(
                response.status,
                response.getheader("Content-Type", ""),
                raw,
                "POST /post (split UTF-8 body)",
            )
        except (OSError, TimeoutError, http.client.HTTPException) as exc:
            raise RequestFailure(f"POST /post (split UTF-8 body): {exc}") from exc
        finally:
            connection.close()

    def post(
        self,
        sid: str,
        action: str,
        state: dict[str, Any] | None = None,
        *,
        split_utf8: bool = False,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"action": action}
        if state is not None:
            payload["state"] = state
        if split_utf8:
            body = json.dumps(
                payload, ensure_ascii=False, separators=(",", ":")
            ).encode("utf-8")
            needle = "🌍".encode("utf-8")
            position = body.find(needle, len(body) // 2)
            if position < 0:
                position = body.find(needle)
            if position < 0:
                raise ValueError("split UTF-8 payload does not contain the sentinel")
            data = self._split_request("post", sid, body, position + 1)
        else:
            data = self.request("POST", "post", sid, payload)
        require(data.get("success") is True, f"{action} did not acknowledge success: {compact(data)}")
        return data

    def state(self, sid: str) -> dict[str, Any]:
        data = self.request("GET", "state", sid)
        required = {"stored_state", "has_custom_state", "sid"}
        require(required <= data.keys(), f"/state missing keys {sorted(required - data.keys())}")
        require(type(data["has_custom_state"]) is bool, "/state has_custom_state must be boolean")
        require(data["sid"] == sid, f"/state returned sid {data['sid']!r}, expected {sid!r}")
        if data["has_custom_state"]:
            require(data["stored_state"] is not None, "/state says custom state exists but returned null")
        else:
            require(data["stored_state"] is None, "/state says no custom state but returned a value")
        return data

    def go(self, sid: str) -> dict[str, Any]:
        data = self.request("GET", "go", sid)
        required = {"initial_state", "current_state", "state_diff"}
        require(required <= data.keys(), f"/go missing keys {sorted(required - data.keys())}")
        require(isinstance(data["initial_state"], dict), "/go initial_state must be an object")
        require(isinstance(data["current_state"], dict), "/go current_state must be an object")
        require(isinstance(data["state_diff"], dict), "/go state_diff must be an object")
        return data

    def upload(self, sid: str, filename: str, content: bytes) -> dict[str, Any]:
        boundary = f"webarena-contract-{uuid.uuid4().hex}"
        body = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
            "Content-Type: application/octet-stream\r\n\r\n"
        ).encode("utf-8") + content + f"\r\n--{boundary}--\r\n".encode("ascii")
        request = Request(
            self._url("upload", sid),
            data=body,
            headers={
                "Accept": "application/json",
                "Content-Type": f"multipart/form-data; boundary={boundary}",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                data = self._decode(
                    response.status,
                    response.headers.get("Content-Type", ""),
                    response.read(),
                    "POST /upload",
                )
        except HTTPError as exc:
            data = self._decode(
                exc.code,
                exc.headers.get("Content-Type", ""),
                exc.read(),
                "POST /upload",
            )
        require(data.get("success") is True, f"upload did not acknowledge success: {compact(data)}")
        files = data.get("files")
        require(isinstance(files, list) and len(files) == 1, f"upload returned invalid files: {compact(data)}")
        require(isinstance(files[0], dict), "upload file metadata must be an object")
        return files[0]

    def download(self, sid: str, stored_name: str) -> tuple[int, bytes]:
        endpoint = f"files/{quote(sid, safe='')}/{quote(stored_name, safe='')}"
        url = self.base_url.rstrip("/") + "/" + endpoint
        request = Request(url, headers={"Accept": "*/*"}, method="GET")
        try:
            with urlopen(request, timeout=self.timeout) as response:
                return response.status, response.read()
        except HTTPError as exc:
            return exc.code, exc.read()


class ContractSuite:
    def __init__(
        self,
        label: str,
        base_url: str,
        timeout: float,
        sid_prefix: str,
        utf8_bytes: int,
        mock_name: str | None = None,
        browser: bool = False,
        browser_executable: str | None = None,
    ) -> None:
        self.label = label
        self.client = JsonClient(base_url, timeout)
        self.timeout = timeout
        unique = uuid.uuid4().hex
        self.sid_a = f"{sid_prefix}_{unique}_a"
        self.sid_b = f"{sid_prefix}_{unique}_b"
        self.sid_never = f"{sid_prefix}_{unique}_never"
        self.utf8_bytes = utf8_bytes
        self.mock_name = mock_name
        self.browser = browser
        self.browser_executable = browser_executable

    @property
    def sids(self) -> tuple[str, str, str]:
        return self.sid_a, self.sid_b, self.sid_never

    @staticmethod
    def marker(state: dict[str, Any]) -> dict[str, Any]:
        value = state.get(PROBE_KEY)
        require(isinstance(value, dict), f"probe marker missing from state: {compact(state)}")
        return value

    def run_case(self, name: str, callback: Any) -> None:
        try:
            callback()
        except (ContractFailure, RequestFailure) as exc:
            raise ContractFailure(f"{name}: {exc}") from exc
        print(f"  PASS {name}")

    @staticmethod
    def diff_keys_for(diff: dict[str, Any], key: str) -> list[str]:
        return [
            path
            for path in diff
            if path == key or path.startswith(f"{key}.")
        ]

    @staticmethod
    def require_probe_transition(
        diff: dict[str, Any],
        old_version: int | None,
        new_version: int,
    ) -> None:
        if PROBE_KEY in diff:
            entry = diff[PROBE_KEY]
            require(isinstance(entry, dict), "probe diff entry must be an object")
            old_value = entry.get("old")
            new_value = entry.get("new")
            if old_version is None:
                require(old_value is None, "added probe diff must encode old as null")
            else:
                require(
                    isinstance(old_value, dict) and old_value.get("version") == old_version,
                    "probe diff old version is wrong",
                )
            require(
                isinstance(new_value, dict) and new_value.get("version") == new_version,
                "probe diff new version is wrong",
            )
            return

        version_path = f"{PROBE_KEY}.version"
        require(version_path in diff, f"probe version path missing: {compact(diff)}")
        entry = diff[version_path]
        require(isinstance(entry, dict), "probe version diff must be an object")
        require(entry.get("old") == old_version, "probe path old version is wrong")
        require(entry.get("new") == new_version, "probe path new version is wrong")

    def untouched(self) -> None:
        state = self.client.state(self.sid_a)
        require(state["has_custom_state"] is False, "new SID unexpectedly has stored state")
        go = self.client.go(self.sid_a)
        require(go["initial_state"] == go["current_state"], "untouched initial/current differ")
        require(not go["state_diff"], "untouched SID has a non-empty diff")

    def invalid_sids(self) -> None:
        for sid in ("", "_default", "a/b"):
            require(
                self.client.response_status("GET", "state", sid) == 400,
                f"invalid explicit SID {sid!r} was not rejected",
            )

    def set_and_reset(self) -> None:
        first = {PROBE_KEY: {"version": 1, "kind": "first-set"}}
        self.client.post(self.sid_a, "set", first)
        state = self.client.state(self.sid_a)
        go = self.client.go(self.sid_a)
        require(state["stored_state"] == go["current_state"], "/state and /go current disagree")
        require(go["initial_state"] == go["current_state"], "set did not establish both states")
        require(not go["state_diff"], "set produced a non-empty diff")
        require(self.marker(go["initial_state"])["version"] == 1, "first set marker was lost")
        old_baseline = copy.deepcopy(go["initial_state"])

        second = {PROBE_KEY: {"version": 2, "kind": "re-set"}}
        self.client.post(self.sid_a, "set", second)
        go = self.client.go(self.sid_a)
        require(go["initial_state"] == go["current_state"], "re-set left initial/current unequal")
        require(not go["state_diff"], "re-set produced a non-empty diff")
        require(self.marker(go["initial_state"])["version"] == 2, "re-set did not replace baseline")
        require(go["initial_state"] != old_baseline, "re-set preserved the previous baseline")
        baseline = copy.deepcopy(go["initial_state"])

        mutated = copy.deepcopy(baseline)
        mutated[PROBE_KEY] = {"version": 3, "kind": "set-current"}
        self.client.post(self.sid_a, "set_current", mutated)
        state = self.client.state(self.sid_a)
        go = self.client.go(self.sid_a)
        require(go["initial_state"] == baseline, "set_current changed the baseline")
        require(go["current_state"] == mutated, "set_current did not replace current state")
        require(state["stored_state"] == mutated, "/state did not expose set_current state")
        self.require_probe_transition(go["state_diff"], 2, 3)

        self.client.post(self.sid_a, "reset")
        state = self.client.state(self.sid_a)
        go = self.client.go(self.sid_a)
        require(go["initial_state"] == baseline, "reset changed the baseline")
        require(go["current_state"] == baseline, "reset did not restore current from baseline")
        require(state["stored_state"] == baseline, "/state did not expose reset state")
        require(not go["state_diff"], "reset left a non-empty diff")

    def never_seeded_mutation(self) -> None:
        mutation = {PROBE_KEY: {"version": 1, "kind": "never-seeded"}}
        self.client.post(self.sid_never, "set_current", mutation)
        state = self.client.state(self.sid_never)
        go = self.client.go(self.sid_never)
        require(state["stored_state"] == mutation, "never-seeded mutation was not stored")
        require(go["current_state"] == mutation, "never-seeded current state is wrong")
        require(go["initial_state"] != mutation, "never-seeded mutation silently became baseline")
        self.require_probe_transition(go["state_diff"], None, 1)
        # With no baseline, reset should clear this probe rather than leave test data.
        self.client.post(self.sid_never, "reset")
        require(not self.client.state(self.sid_never)["has_custom_state"], "unseeded reset did not clear state")

    def sid_isolation(self) -> None:
        state_a = {PROBE_KEY: {"owner": "A"}}
        state_b = {PROBE_KEY: {"owner": "B"}}
        self.client.post(self.sid_a, "set", state_a)
        self.client.post(self.sid_b, "set", state_b)
        go_a = self.client.go(self.sid_a)
        go_b = self.client.go(self.sid_b)
        require(self.marker(go_a["current_state"])["owner"] == "A", "SID A was overwritten")
        require(self.marker(go_b["current_state"])["owner"] == "B", "SID B was overwritten")
        require(go_a["initial_state"] == go_a["current_state"], "SID A baseline mismatch")
        require(go_b["initial_state"] == go_b["current_state"], "SID B baseline mismatch")
        require(self.client.state(self.sid_a)["stored_state"] == go_a["current_state"], "SID A changed after reading SID B")

    def utf8_round_trip(self) -> None:
        unit = "Zażółć gęślą — 你好 — café — 🌍🚀\n"
        repeats = self.utf8_bytes // len(unit.encode("utf-8")) + 2
        value = unit * repeats
        require(len(value.encode("utf-8")) >= self.utf8_bytes, "UTF-8 fixture is too small")
        posted = {PROBE_KEY: {"kind": "large-utf8", "value": value}}
        self.client.post(self.sid_a, "set", posted, split_utf8=True)
        state = self.client.state(self.sid_a)
        go = self.client.go(self.sid_a)
        require(go["initial_state"] == go["current_state"], "UTF-8 set did not establish baseline")
        require(state["stored_state"] == go["current_state"], "UTF-8 /state and /go disagree")
        require(self.marker(go["current_state"])["value"] == value, "large UTF-8 value was corrupted")
        require(not go["state_diff"], "UTF-8 set produced a diff")

    def invalid_utf8_rejected(self) -> None:
        body = b'{"action":"set","state":{"value":"\xff"}}'
        require(
            self.client.raw_post_status(self.sid_a, body) == 400,
            "invalid UTF-8 request body was not rejected",
        )

    def top_level_deletion(self) -> None:
        deleted_key = "__webarena_deleted_probe__"
        baseline = {
            PROBE_KEY: {"kind": "deletion"},
            deleted_key: "must-disappear",
        }
        self.client.post(self.sid_a, "set", baseline)
        go = self.client.go(self.sid_a)
        current = copy.deepcopy(go["current_state"])
        current.pop(deleted_key, None)
        self.client.post(self.sid_a, "set_current", current)
        go = self.client.go(self.sid_a)
        require(deleted_key in go["initial_state"], "deletion baseline key is missing")
        require(deleted_key not in go["current_state"], "deleted key remains in current state")
        require(deleted_key in go["state_diff"], f"deleted key is absent from state_diff: {compact(go['state_diff'])}")
        entry = go["state_diff"][deleted_key]
        require(isinstance(entry, dict), "deletion diff entry must be an object")
        require(entry.get("old") == "must-disappear", "deletion diff lost old value")
        require("new" in entry and entry["new"] is None, "deletion diff must encode new as null")
        self.client.post(self.sid_a, "reset")

    def uploaded_files(self) -> None:
        filename = "contract-fixture.txt"
        content = b"deterministic WebArena upload\n"
        first = self.client.upload(self.sid_a, filename, content)
        second = self.client.upload(self.sid_a, filename, content)
        stored_name = first.get("stored_name")
        require(isinstance(stored_name, str) and stored_name, "upload returned no stored_name")
        require(second.get("stored_name") == stored_name, "identical upload produced a different stored_name")

        status, downloaded = self.client.download(self.sid_a, stored_name)
        require(status == 200 and downloaded == content, "owning SID could not read uploaded bytes")
        other_status, _ = self.client.download(self.sid_b, stored_name)
        require(other_status == 404, "another SID could read the uploaded file")

        # Legacy reset restores state but deliberately leaves baseline fixture
        # files available. Expired-session cleanup is a separate admin concern.
        self.client.post(self.sid_a, "reset")
        reset_status, reset_content = self.client.download(self.sid_a, stored_name)
        require(
            reset_status == 200 and reset_content == content,
            "reset removed a baseline/session upload unexpectedly",
        )

    @staticmethod
    def nested_value(state: dict[str, Any], path: tuple[str, ...]) -> Any:
        value: Any = state
        for part in path:
            require(isinstance(value, dict) and part in value, f"missing browser fixture path {path}")
            value = value[part]
        return value

    def browser_reconciliation(self) -> None:
        require(self.mock_name in BROWSER_FIXTURES, f"no browser fixture for {self.mock_name}")
        route, storage_base, field_path, first_value, second_value = BROWSER_FIXTURES[self.mock_name]
        try:
            from playwright.sync_api import sync_playwright
        except ImportError as exc:
            raise ContractFailure(
                "Playwright is required for --browser; install the root project dependencies"
            ) from exc

        first = {PROBE_KEY: {"version": 1}, field_path[0]: first_value}
        if len(field_path) == 2:
            first[field_path[0]] = {field_path[1]: first_value}
        second = {PROBE_KEY: {"version": 2}, field_path[0]: second_value}
        if len(field_path) == 2:
            second[field_path[0]] = {field_path[1]: second_value}
        switched = copy.deepcopy(second)
        switched[PROBE_KEY] = {"version": 3}

        self.client.post(self.sid_a, "set", first)
        errors: list[str] = []
        with tempfile.TemporaryDirectory(prefix="webarena-browser-contract-") as profile:
            with sync_playwright() as playwright:
                context = playwright.chromium.launch_persistent_context(
                    profile,
                    headless=True,
                    executable_path=self.browser_executable,
                )
                page = context.pages[0] if context.pages else context.new_page()
                page.on("pageerror", lambda error: errors.append(str(error)))

                def storage_key(sid: str) -> str:
                    return f"{storage_base}_{sid}"

                def await_browser_state(sid: str, version: int) -> dict[str, Any]:
                    key = storage_key(sid)
                    page.wait_for_function(
                        """({ key, probeKey, version }) => {
                          try {
                            const state = JSON.parse(localStorage.getItem(key))
                            return state?.[probeKey]?.version === version
                          } catch {
                            return false
                          }
                        }""",
                        arg={"key": key, "probeKey": PROBE_KEY, "version": version},
                        timeout=int(self.timeout * 1000),
                    )
                    state = page.evaluate(
                        "key => JSON.parse(localStorage.getItem(key))",
                        arg=key,
                    )
                    require(isinstance(state, dict), "browser localStorage state is not an object")
                    return state

                def open_sid(sid: str, version: int) -> dict[str, Any]:
                    separator = "&" if "?" in route else "?"
                    page.goto(
                        f"{self.client.base_url}{route}{separator}{urlencode({'sid': sid})}",
                        wait_until="domcontentloaded",
                        timeout=int(self.timeout * 1000),
                    )
                    return await_browser_state(sid, version)

                open_sid(self.sid_a, 1)
                self.client.post(self.sid_a, "set", second)
                page.reload(wait_until="domcontentloaded", timeout=int(self.timeout * 1000))
                browser_a = await_browser_state(self.sid_a, 2)
                go_a = self.client.go(self.sid_a)
                require(self.marker(go_a["current_state"])["version"] == 2, "warm cache beat reinjection")
                require(
                    self.nested_value(browser_a, field_path) == second_value,
                    "browser localStorage did not adopt the reinjected schema field",
                )
                require(
                    self.nested_value(go_a["current_state"], field_path) == second_value,
                    "browser did not adopt the reinjected schema field",
                )
                require(not go_a["state_diff"], "browser boot polluted a freshly injected baseline")

                self.client.post(self.sid_b, "set", switched)
                browser_b = open_sid(self.sid_b, 3)
                go_b = self.client.go(self.sid_b)
                require(self.marker(go_b["current_state"])["version"] == 3, "SID switch kept prior state")
                require(self.marker(browser_b)["version"] == 3, "browser cache kept the prior SID")
                require(
                    self.marker(self.client.go(self.sid_a)["current_state"])["version"] == 2,
                    "SID switch overwrote the previous session",
                )

                if "(dev)" in self.label:
                    page.evaluate(
                        """async ({ sid, probeKey }) => {
                          const response = await fetch(`/go?sid=${encodeURIComponent(sid)}`)
                          const snapshot = await response.json()
                          const module = await import('/src/utils/dataManager.js')
                          module.saveState(
                            { ...snapshot.current_state, [probeKey]: { version: 4 } },
                            sid,
                          )
                          await new Promise(resolve => setTimeout(resolve, 0))
                          module.saveState(
                            { ...snapshot.current_state, [probeKey]: { version: 5 } },
                            sid,
                          )
                          await Promise.all([module.flushState(), module.flushState()])
                        }""",
                        arg={"sid": self.sid_b, "probeKey": PROBE_KEY},
                    )
                    require(
                        self.marker(self.client.go(self.sid_b)["current_state"])["version"] == 5,
                        "flushState returned before the newest coalesced write persisted",
                    )

                    if self.mock_name == "webarena_classifieds_mock":
                        latest = self.client.go(self.sid_b)["current_state"]
                        authoritative = {
                            **latest,
                            PROBE_KEY: {"version": 6},
                        }
                        self.client.post(self.sid_b, "set", authoritative)
                        page.evaluate(
                            """async ({ sid, probeKey }) => {
                              const module = await import('/src/utils/dataManager.js')
                              const cached = JSON.parse(
                                localStorage.getItem(`classifieds_mock_state_${sid}`),
                              )
                              module.saveState(
                                { ...cached, [probeKey]: { version: 7 } },
                                sid,
                              )
                              try { await module.flushState() } catch {}
                            }""",
                            arg={"sid": self.sid_b, "probeKey": PROBE_KEY},
                        )
                        recovered = await_browser_state(self.sid_b, 6)
                        require(
                            self.marker(recovered)["version"] == 6,
                            "Classifieds did not rehydrate after a revision conflict",
                        )
                        require(
                            self.marker(self.client.go(self.sid_b)["current_state"])["version"] == 6,
                            "stale Classifieds write overwrote newer setup",
                        )
                context.close()

        require(not errors, f"browser page errors: {errors}")

    def run(self) -> None:
        print(f"{self.label}: {self.client.base_url}")
        self.run_case("untouched SID and endpoint envelopes", self.untouched)
        if self.label != "self-test":
            self.run_case("invalid and reserved SIDs rejected", self.invalid_sids)
        self.run_case("set, re-set, set_current, and reset", self.set_and_reset)
        self.run_case("never-seeded set_current remains observable", self.never_seeded_mutation)
        self.run_case("two-SID isolation", self.sid_isolation)
        self.run_case("large split-boundary UTF-8 round trip", self.utf8_round_trip)
        self.run_case("invalid UTF-8 rejected", self.invalid_utf8_rejected)
        self.run_case("top-level deletion diff", self.top_level_deletion)
        if self.label != "self-test":
            self.run_case("deterministic SID-isolated uploads", self.uploaded_files)
        if self.browser:
            self.run_case("browser reinjection and SID switching", self.browser_reconciliation)
        elif self.label != "self-test":
            print("  SKIP browser reinjection/SID/flush checks (pass --browser)")


class ManagedServer:
    def __init__(
        self, mock_dir: Path, mode: str, port: int, startup_timeout: float
    ) -> None:
        self.mock_dir = mock_dir
        self.mode = mode
        self.port = port
        self.startup_timeout = startup_timeout
        self.process: subprocess.Popen[bytes] | None = None
        self.log = tempfile.TemporaryFile()

    @property
    def base_url(self) -> str:
        return f"http://127.0.0.1:{self.port}"

    def __enter__(self) -> "ManagedServer":
        command = [
            "npm",
            "run",
            self.mode,
            "--",
            "--host",
            "127.0.0.1",
            "--port",
            str(self.port),
            "--strictPort",
        ]
        self.process = subprocess.Popen(
            command,
            cwd=self.mock_dir,
            stdout=self.log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        try:
            deadline = time.monotonic() + self.startup_timeout
            probe = JsonClient(self.base_url, min(2.0, self.startup_timeout))
            while time.monotonic() < deadline:
                if self.process.poll() is not None:
                    raise RuntimeError(
                        self._failure_message("server exited during startup")
                    )
                try:
                    probe.state(f"contract_readiness_{uuid.uuid4().hex}")
                    return self
                except (RequestFailure, ContractFailure):
                    time.sleep(0.1)
            raise RuntimeError(self._failure_message("server did not become ready"))
        except BaseException:
            self._stop()
            self.log.close()
            raise

    def _failure_message(self, prefix: str) -> str:
        self.log.seek(0)
        output = self.log.read().decode("utf-8", errors="replace")
        return f"{prefix} ({self.mock_dir.name} {self.mode})\n{output[-4000:]}"

    def _stop(self) -> None:
        if self.process and self.process.poll() is None:
            try:
                os.killpg(self.process.pid, signal.SIGTERM)
                self.process.wait(timeout=5)
            except (OSError, subprocess.TimeoutExpired):
                try:
                    os.killpg(self.process.pid, signal.SIGKILL)
                except OSError:
                    pass
                self.process.wait(timeout=5)

    def __exit__(self, _type: Any, _value: Any, _traceback: Any) -> None:
        self._stop()
        self.log.close()


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def cleanup_managed_sids(mock_dir: Path, sids: tuple[str, ...]) -> None:
    state_dir = mock_dir / ".mock-states"
    files_dir = mock_dir / ".mock-files"
    for sid in sids:
        for suffix in (".json", ".initial.json", ".revision"):
            (state_dir / f"{sid}{suffix}").unlink(missing_ok=True)
        upload_dir = files_dir / sid
        if upload_dir.is_dir() and not upload_dir.is_symlink():
            shutil.rmtree(upload_dir)


def run_target(
    label: str,
    base_url: str,
    args: argparse.Namespace,
    cleanup_dir: Path | None = None,
) -> str | None:
    suite = ContractSuite(
        label,
        base_url,
        args.timeout,
        args.sid_prefix,
        args.utf8_bytes,
        cleanup_dir.name if cleanup_dir is not None else None,
        args.browser,
        args.browser_executable,
    )
    try:
        suite.run()
        return None
    except (ContractFailure, RequestFailure, ValueError) as exc:
        print(f"  FAIL {exc}", file=sys.stderr)
        return f"{label}: {exc}"
    finally:
        if cleanup_dir is not None:
            cleanup_managed_sids(cleanup_dir, suite.sids)


def parse_target(spec: str) -> tuple[str, str]:
    if "=" in spec and not spec.startswith(("http://", "https://")):
        label, url = spec.split("=", 1)
        if not label:
            raise ValueError(f"empty target label in {spec!r}")
        return label, url
    return spec, spec


def make_self_test_server() -> tuple[ThreadingHTTPServer, threading.Thread]:
    states: dict[str, dict[str, Any]] = {}
    initials: dict[str, dict[str, Any]] = {}
    default = {"default": True, "items": []}

    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, _format: str, *_args: Any) -> None:
            return

        def send_json(self, payload: dict[str, Any], status: int = 200) -> None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def sid(self) -> str:
            query = parse_qs(urlsplit(self.path).query)
            return query.get("sid", [""])[0]

        def do_GET(self) -> None:
            route = urlsplit(self.path).path
            sid = self.sid()
            if route == "/state":
                state = states.get(sid)
                self.send_json(
                    {
                        "stored_state": state,
                        "has_custom_state": state is not None,
                        "sid": sid,
                    }
                )
                return
            if route == "/go":
                initial = initials.get(sid, default)
                current = states.get(sid, initial)
                diff = {}
                for key in set(initial) | set(current):
                    if initial.get(key) != current.get(key):
                        diff[key] = {
                            "old": initial.get(key),
                            "new": current.get(key),
                        }
                self.send_json(
                    {
                        "initial_state": initial,
                        "current_state": current,
                        "state_diff": diff,
                    }
                )
                return
            self.send_json({"error": "not found"}, 404)

        def do_POST(self) -> None:
            if urlsplit(self.path).path != "/post":
                self.send_json({"error": "not found"}, 404)
                return
            length = int(self.headers.get("Content-Length", "0"))
            try:
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                self.send_json({"error": str(exc)}, 400)
                return
            sid = self.sid()
            action = payload.get("action", "set")
            if action == "set":
                states[sid] = copy.deepcopy(payload["state"])
                initials[sid] = copy.deepcopy(payload["state"])
            elif action == "set_current":
                states[sid] = copy.deepcopy(payload["state"])
            elif action == "reset":
                if sid in initials:
                    states[sid] = copy.deepcopy(initials[sid])
                else:
                    states.pop(sid, None)
            else:
                self.send_json({"error": "unknown action"}, 400)
                return
            self.send_json({"success": True, "sid": sid})

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "targets",
        nargs="*",
        metavar="[LABEL=]BASE_URL",
        help="already-running target; may be repeated",
    )
    parser.add_argument(
        "--mock",
        action="append",
        choices=(*MOCKS, "all"),
        help="manage this local mock with npm (repeatable, or use 'all')",
    )
    parser.add_argument(
        "--mode",
        choices=("dev", "preview", "both"),
        default="both",
        help="managed server mode (default: both)",
    )
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="use an existing dist/ for managed preview mode",
    )
    parser.add_argument(
        "--hub-root",
        type=Path,
        default=HUB_ROOT,
        help=f"Hub checkout containing websites/ (default: {HUB_ROOT})",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=30.0,
        help="per-request timeout in seconds (default: 30)",
    )
    parser.add_argument(
        "--startup-timeout",
        type=float,
        default=60.0,
        help="managed server startup timeout in seconds (default: 60)",
    )
    parser.add_argument(
        "--utf8-bytes",
        type=int,
        default=256 * 1024,
        help="minimum UTF-8 fixture size (default: 262144)",
    )
    parser.add_argument(
        "--sid-prefix",
        default="state_contract",
        help="prefix for unique test SIDs (default: state_contract)",
    )
    parser.add_argument(
        "--self-test",
        action="store_true",
        help="run against an in-memory conforming server",
    )
    parser.add_argument(
        "--browser",
        action="store_true",
        help="test real browser behavior (enabled by default for managed mocks)",
    )
    parser.add_argument(
        "--api-only",
        action="store_true",
        help="skip browser checks for managed mocks and report an API-only result",
    )
    parser.add_argument(
        "--browser-executable",
        help="optional Chromium/Chrome executable path for --browser",
    )
    args = parser.parse_args(argv)
    if args.timeout <= 0 or args.startup_timeout <= 0:
        parser.error("timeouts must be positive")
    if args.utf8_bytes < 65536:
        parser.error("--utf8-bytes must be at least 65536")
    if not SID_RE.fullmatch(args.sid_prefix):
        parser.error("--sid-prefix may contain only letters, digits, hyphens, and underscores")
    if args.self_test and (args.targets or args.mock):
        parser.error("--self-test cannot be combined with targets or --mock")
    if args.browser and not args.mock:
        parser.error("--browser requires managed --mock targets")
    if args.browser and args.api_only:
        parser.error("--browser and --api-only are mutually exclusive")
    if args.targets and args.mock:
        parser.error("use already-running targets or --mock, not both")
    if not args.self_test and not args.targets and not args.mock:
        parser.error("provide at least one BASE_URL, --mock, or --self-test")
    if args.mock and not args.api_only:
        args.browser = True
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    failures: list[str] = []

    if args.self_test:
        server, thread = make_self_test_server()
        try:
            url = f"http://127.0.0.1:{server.server_port}"
            failure = run_target("self-test", url, args)
            if failure:
                failures.append(failure)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)
    elif args.targets:
        for spec in args.targets:
            try:
                label, url = parse_target(spec)
            except ValueError as exc:
                failures.append(str(exc))
                continue
            failure = run_target(label, url, args)
            if failure:
                failures.append(failure)
    else:
        selected = list(MOCKS) if "all" in args.mock else list(dict.fromkeys(args.mock))
        modes = ("dev", "preview") if args.mode == "both" else (args.mode,)
        for mock in selected:
            mock_dir = args.hub_root.resolve() / "websites" / mock
            if not (mock_dir / "package.json").is_file():
                message = f"{mock}: package.json not found under {mock_dir}"
                print(f"FAIL {message}", file=sys.stderr)
                failures.append(message)
                continue
            for mode in modes:
                label = f"{mock} ({mode})"
                try:
                    if mode == "preview" and not args.skip_build:
                        print(f"{label}: building")
                        subprocess.run(["npm", "run", "build"], cwd=mock_dir, check=True)
                    with ManagedServer(
                        mock_dir, mode, free_port(), args.startup_timeout
                    ) as server:
                        failure = run_target(label, server.base_url, args, mock_dir)
                        if failure:
                            failures.append(failure)
                except (OSError, RuntimeError, subprocess.CalledProcessError) as exc:
                    message = f"{label}: {exc}"
                    print(f"FAIL {message}", file=sys.stderr)
                    failures.append(message)

    if failures:
        print(f"\nFAILED: {len(failures)} target(s)", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        return 1
    if args.mock and args.api_only:
        print("\nPASS: API-only state-contract targets (browser checks skipped)")
    else:
        print("\nPASS: all state-contract targets")
    return 0


if __name__ == "__main__":
    sys.exit(main())
