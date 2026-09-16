"""Thin async client for Cloudflare D1 REST API."""

import logging

import httpx

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

D1_API_BASE = "https://api.cloudflare.com/client/v4/accounts"


def _raise_if_result_failed(result: dict, *, sql: str) -> None:
    """Check per-statement success in D1 response."""
    if result.get("success", True):
        return
    errors = result.get("errors") or result.get("error") or "unknown"
    raise RuntimeError(f"D1 statement failed for SQL={sql!r}: {errors}")


class D1Client:
    """Wraps the Cloudflare D1 HTTP query API."""

    def __init__(self, account_id: str, api_token: str, database_id: str) -> None:
        self._url = f"{D1_API_BASE}/{account_id}/d1/database/{database_id}/query"
        self._headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
        }
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=5.0)
        )

    async def aclose(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()

    def _check_response(self, resp: httpx.Response, *, context: str) -> None:
        """Raise with D1 error details on non-2xx responses."""
        if resp.is_success:
            return
        try:
            body = resp.json()
            errors = body.get("errors", [])
            detail = "; ".join(e.get("message", str(e)) if isinstance(e, dict) else str(e) for e in errors) if errors else resp.text
        except Exception:
            detail = resp.text
        raise httpx.HTTPStatusError(
            f"D1 {context}: {resp.status_code} — {detail}",
            request=resp.request,
            response=resp,
        )

    async def execute(
        self, sql: str, params: list | None = None
    ) -> list[dict]:
        """Execute a single SQL statement and return result rows as dicts."""
        body: dict = {"sql": sql}
        if params:
            body["params"] = params

        resp = await self._client.post(
            self._url, json=body, headers=self._headers
        )
        self._check_response(resp, context="execute")
        data = resp.json()

        if not data.get("success"):
            errors = data.get("errors", [])
            raise RuntimeError(f"D1 query failed: {errors}")

        results = data.get("result", [])
        if not results:
            return []
        first = results[0]
        _raise_if_result_failed(first, sql=sql)
        return first.get("results", [])

    async def batch(self, statements: list[dict]) -> list[list[dict]]:
        """Execute multiple SQL statements.

        Each statement is a dict with 'sql' and optional 'params' keys.

        If none of the statements have params, they are joined with semicolons
        into a single request. Otherwise, statements are executed sequentially.

        Returns a list of result-row lists, one per statement.
        """
        has_params = any(s.get("params") for s in statements)

        if not has_params:
            # Join all SQL into one semicolon-separated string
            combined = "; ".join(s["sql"] for s in statements)
            resp = await self._client.post(
                self._url,
                json={"sql": combined},
                headers=self._headers,
                timeout=60.0,
            )
            self._check_response(resp, context="batch")
            data = resp.json()

            if not data.get("success"):
                errors = data.get("errors", [])
                raise RuntimeError(f"D1 batch failed: {errors}")

            all_results = []
            for i, result in enumerate(data.get("result", [])):
                sql_label = statements[i]["sql"] if i < len(statements) else "<unknown>"
                _raise_if_result_failed(result, sql=sql_label)
                all_results.append(result.get("results", []))
            return all_results

        # Statements with params — execute sequentially
        all_results = []
        for stmt in statements:
            body: dict = {"sql": stmt["sql"]}
            if stmt.get("params"):
                body["params"] = stmt["params"]
            resp = await self._client.post(
                self._url, json=body, headers=self._headers
            )
            self._check_response(resp, context=f"batch statement: {stmt['sql'][:80]}")
            data = resp.json()

            if not data.get("success"):
                errors = data.get("errors", [])
                raise RuntimeError(f"D1 batch statement failed: {errors}")

            results = data.get("result", [])
            if results:
                _raise_if_result_failed(results[0], sql=stmt["sql"])
                all_results.append(results[0].get("results", []))
            else:
                all_results.append([])
        return all_results


def get_d1_client(settings: Settings | None = None) -> D1Client:
    """Factory — create a D1Client from app settings."""
    if settings is None:
        settings = get_settings()
    missing = [
        name for name, value in {
            "CLOUDFLARE_ACCOUNT_ID": settings.cloudflare_account_id,
            "CLOUDFLARE_API_TOKEN": settings.cloudflare_api_token,
            "D1_DATABASE_ID": settings.d1_database_id,
        }.items() if not value
    ]
    if missing:
        raise RuntimeError(f"Missing required D1 settings: {', '.join(missing)}")
    return D1Client(
        account_id=settings.cloudflare_account_id,
        api_token=settings.cloudflare_api_token,
        database_id=settings.d1_database_id,
    )
