"""
HTTP client for Unreal Engine 5 Remote Control Plugin.

UE5 must have the Remote Control API plugin enabled and the Remote Control
Web Server running (default: http://localhost:30010).
"""

import json
import logging
from typing import Any
import httpx

logger = logging.getLogger(__name__)

DEFAULT_HOST = "localhost"
DEFAULT_PORT = 30010
REQUEST_TIMEOUT = 30.0


class UE5RemoteControlError(Exception):
    """Raised when the UE5 Remote Control API returns an error."""

    def __init__(self, message: str, status_code: int | None = None, body: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.body = body


class UE5Client:
    """Thin async HTTP client for the UE5 Remote Control REST API."""

    def __init__(
        self,
        host: str = DEFAULT_HOST,
        port: int = DEFAULT_PORT,
        timeout: float = REQUEST_TIMEOUT,
    ):
        self.base_url = f"http://{host}:{port}"
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=timeout,
            headers={"Content-Type": "application/json"},
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        await self.close()

    # -------------------------------------------------------------------------
    # Low-level helpers
    # -------------------------------------------------------------------------

    async def _get(self, path: str, params: dict | None = None) -> Any:
        resp = await self._client.get(path, params=params)
        return self._parse(resp)

    async def _put(self, path: str, body: dict) -> Any:
        resp = await self._client.put(path, content=json.dumps(body))
        return self._parse(resp)

    async def _post(self, path: str, body: dict) -> Any:
        resp = await self._client.post(path, content=json.dumps(body))
        return self._parse(resp)

    @staticmethod
    def _parse(resp: httpx.Response) -> Any:
        if resp.status_code >= 400:
            raise UE5RemoteControlError(
                f"UE5 Remote Control returned {resp.status_code}",
                status_code=resp.status_code,
                body=resp.text,
            )
        if not resp.text:
            return {}
        try:
            return resp.json()
        except Exception:
            return resp.text

    # -------------------------------------------------------------------------
    # Editor / server info
    # -------------------------------------------------------------------------

    async def get_info(self) -> dict:
        return await self._get("/remote/info")

    # -------------------------------------------------------------------------
    # Object property read/write
    # -------------------------------------------------------------------------

    async def get_property(self, object_path: str, property_name: str) -> Any:
        return await self._put(
            "/remote/object/property",
            {
                "objectPath": object_path,
                "access": "READ_ACCESS",
                "propertyName": property_name,
            },
        )

    async def set_property(
        self, object_path: str, property_name: str, property_value: Any
    ) -> Any:
        return await self._put(
            "/remote/object/property",
            {
                "objectPath": object_path,
                "access": "WRITE_ACCESS",
                "propertyName": property_name,
                "propertyValue": property_value,
            },
        )

    # -------------------------------------------------------------------------
    # Function calls
    # -------------------------------------------------------------------------

    async def call_function(
        self,
        object_path: str,
        function_name: str,
        parameters: dict | None = None,
        generate_transaction: bool = True,
    ) -> Any:
        return await self._put(
            "/remote/object/call",
            {
                "objectPath": object_path,
                "functionName": function_name,
                "parameters": parameters or {},
                "generateTransaction": generate_transaction,
            },
        )

    # -------------------------------------------------------------------------
    # Asset search
    # -------------------------------------------------------------------------

    async def search_assets(
        self,
        query: str = "",
        package_filter: str = "",
        class_filter: list[str] | None = None,
        limit: int = 50,
    ) -> dict:
        body: dict[str, Any] = {"Query": query, "Limit": limit}
        if package_filter:
            body["PackageFilter"] = package_filter
        if class_filter:
            body["ClassFilter"] = class_filter
        return await self._put("/remote/assets/search", body)

    # -------------------------------------------------------------------------
    # Preset operations
    # -------------------------------------------------------------------------

    async def get_preset(self, preset_name: str) -> dict:
        return await self._get(f"/remote/preset/{preset_name}")

    async def set_preset_property(
        self, preset_name: str, property_label: str, value: Any
    ) -> Any:
        return await self._put(
            f"/remote/preset/{preset_name}/property",
            {"PropertyLabel": property_label, "PropertyValue": value},
        )

    async def call_preset_function(
        self,
        preset_name: str,
        function_label: str,
        parameters: dict | None = None,
    ) -> Any:
        return await self._put(
            f"/remote/preset/{preset_name}/function",
            {"FunctionLabel": function_label, "Parameters": parameters or {}},
        )

    # -------------------------------------------------------------------------
    # Batch requests
    # -------------------------------------------------------------------------

    async def batch(self, requests: list[dict]) -> list[Any]:
        """
        Send multiple Remote Control requests in a single HTTP call.

        Each entry in *requests* should look like a normal Remote Control body
        with an extra "RequestId" and "URL" field, e.g.:
            {"RequestId": 1, "URL": "/remote/object/call", ...}
        """
        result = await self._put("/remote/batch", {"Requests": requests})
        return result.get("Responses", result)

    # -------------------------------------------------------------------------
    # Python script execution (requires Editor Scripting Utilities plugin)
    # -------------------------------------------------------------------------

    async def run_python(self, script: str, unattended: bool = True) -> Any:
        return await self._put(
            "/remote/object/call",
            {
                "objectPath": "/Script/PythonScriptPlugin.Default__PythonScriptLibrary",
                "functionName": "ExecutePythonScript",
                "parameters": {
                    "PythonScript": script,
                    "ExecutionMode": "ExecuteFile" if "\n" in script else "ExecuteStatement",
                },
                "generateTransaction": False,
            },
        )

    # -------------------------------------------------------------------------
    # Console command
    # -------------------------------------------------------------------------

    async def exec_console_command(self, command: str) -> Any:
        return await self._put(
            "/remote/object/call",
            {
                "objectPath": "/Script/UnrealEd.Default__EditorLevelLibrary",
                "functionName": "ExecuteConsoleCommand",
                "parameters": {"Command": command},
                "generateTransaction": False,
            },
        )
