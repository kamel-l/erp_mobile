import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional


class ApiClient:
    def __init__(self, base_url: str, token: Optional[str] = None, timeout: int = 20):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout

    def set_token(self, token: str):
        self.token = token

    def push_change(self, entity: str, action: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        endpoint = self._resolve_push_endpoint(entity, action)
        method = self._resolve_method(action)
        return self._request(method=method, path=endpoint, body=payload)

    def pull_changes(self, since_ts: str) -> Dict[str, Any]:
        query = urllib.parse.urlencode({"since": since_ts}) if since_ts else ""
        path = f"/sync?{query}" if query else "/sync"
        return self._request(method="GET", path=path)

    def _resolve_push_endpoint(self, entity: str, action: str) -> str:
        if entity == "sale" and action == "create":
            return "/sales"
        if entity == "stock" and action in ("update", "create"):
            return "/stock/update"
        if entity == "attendance" and action == "create":
            return "/attendance"
        raise ValueError(f"Unsupported push operation: entity={entity}, action={action}")

    @staticmethod
    def _resolve_method(action: str) -> str:
        if action == "delete":
            return "DELETE"
        if action == "update":
            return "PUT"
        return "POST"

    def _request(self, method: str, path: str, body: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        data = None
        if body is not None:
            data = json.dumps(body).encode("utf-8")

        req = urllib.request.Request(url=url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                raw = response.read().decode("utf-8")
                return json.loads(raw) if raw else {"success": True}
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8")
            try:
                parsed = json.loads(raw) if raw else {}
            except Exception:
                parsed = {"error": raw or str(e)}
            return {"success": False, "status": e.code, **parsed}
        except Exception as e:
            return {"success": False, "error": str(e)}
