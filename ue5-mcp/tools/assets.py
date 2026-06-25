"""Asset management tools: search, open, import, get/set properties."""

from __future__ import annotations

import json

from mcp.server.fastmcp import FastMCP
from mcp.types import TextContent

from ue5_client import UE5Client


def register(mcp: FastMCP, get_client: object) -> None:

    @mcp.tool()
    async def ue5_search_assets(
        query: str = "",
        class_filter: str = "",
        package_filter: str = "/Game",
        limit: int = 20,
    ) -> list[TextContent]:
        """
        Search the UE5 Content Browser for assets.

        Args:
            query: Name substring to match, e.g. "Wall" or "M_Rock".
            class_filter: Comma-separated asset class names, e.g. "StaticMesh,Material".
            package_filter: Content path prefix to restrict results, e.g. "/Game/Environment".
            limit: Maximum number of results to return (default 20, max 100).
        """
        client: UE5Client = get_client()
        classes = [c.strip() for c in class_filter.split(",") if c.strip()] if class_filter else None
        result = await client.search_assets(
            query=query,
            package_filter=package_filter,
            class_filter=classes,
            limit=min(limit, 100),
        )
        return [TextContent(type="text", text=json.dumps(result, indent=2))]

    @mcp.tool()
    async def ue5_get_asset_properties(
        asset_path: str,
        property_name: str = "",
    ) -> list[TextContent]:
        """
        Get properties of an asset or a specific property value.

        Args:
            asset_path: Full content path, e.g. "/Game/Meshes/SM_Wall.SM_Wall".
            property_name: Leave empty to get all available metadata; otherwise name the property.
        """
        client: UE5Client = get_client()
        if property_name:
            result = await client.get_property(asset_path, property_name)
        else:
            result = await client.run_python(
                f"import unreal, json\n"
                f"a = unreal.EditorAssetLibrary.load_asset('{asset_path}')\n"
                f"print(json.dumps({{p: str(getattr(a, p, None)) for p in dir(a) if not p.startswith('_')}}, default=str))"
            )
        return [TextContent(type="text", text=json.dumps(result, indent=2) if isinstance(result, dict) else str(result))]

    @mcp.tool()
    async def ue5_open_asset(asset_path: str) -> list[TextContent]:
        """
        Open an asset in its default editor inside UE5.

        Args:
            asset_path: Full content path, e.g. "/Game/Blueprints/BP_Character".
        """
        client: UE5Client = get_client()
        result = await client.run_python(
            f"import unreal\n"
            f"asset = unreal.EditorAssetLibrary.load_asset('{asset_path}')\n"
            f"unreal.AssetEditorSubsystem().open_editor_for_assets([asset])"
        )
        return [TextContent(type="text", text=f"Opened asset: {asset_path}\n{result}")]

    @mcp.tool()
    async def ue5_set_object_property(
        object_path: str,
        property_name: str,
        property_value: str,
    ) -> list[TextContent]:
        """
        Set a property on any UE5 UObject (actor, component, asset, etc.).

        Args:
            object_path: The full object path, e.g. "/Game/Maps/Main.Main:PersistentLevel.StaticMeshActor_0".
            property_name: The property name as it appears in the UE5 API.
            property_value: JSON-encoded value, e.g. "true", "42", '"red"', or '{"X":0,"Y":0,"Z":100}'.
        """
        client: UE5Client = get_client()
        try:
            parsed_value = json.loads(property_value)
        except json.JSONDecodeError:
            parsed_value = property_value
        result = await client.set_property(object_path, property_name, parsed_value)
        return [TextContent(type="text", text=str(result))]

    @mcp.tool()
    async def ue5_call_function(
        object_path: str,
        function_name: str,
        parameters_json: str = "{}",
    ) -> list[TextContent]:
        """
        Call a function on any UE5 UObject via the Remote Control API.

        Args:
            object_path: Full object path of the target, e.g. "/Script/Engine.Default__KismetSystemLibrary".
            function_name: Name of the function to invoke.
            parameters_json: JSON object of named parameters, e.g. '{"WorldContext": "None"}'.
        """
        client: UE5Client = get_client()
        try:
            params = json.loads(parameters_json)
        except json.JSONDecodeError:
            return [TextContent(type="text", text=f"Invalid JSON in parameters_json: {parameters_json}")]
        result = await client.call_function(object_path, function_name, params)
        return [TextContent(type="text", text=json.dumps(result, indent=2) if isinstance(result, dict) else str(result))]
