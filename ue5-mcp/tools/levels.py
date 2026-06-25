"""Level / world tools: info, load, save, sublevels, world settings."""

from __future__ import annotations

from mcp.server.fastmcp import FastMCP
from mcp.types import TextContent

from ue5_client import UE5Client


def register(mcp: FastMCP, get_client: object) -> None:

    @mcp.tool()
    async def ue5_get_level_info() -> list[TextContent]:
        """Return information about the currently loaded UE5 level (map name, actor count, world settings)."""
        client: UE5Client = get_client()
        script = (
            "import unreal, json\n"
            "world = unreal.EditorLevelLibrary.get_editor_world()\n"
            "actors = unreal.EditorLevelLibrary.get_all_level_actors()\n"
            "ws = world.get_world_settings()\n"
            "info = {\n"
            "    'world_name': world.get_name(),\n"
            "    'level_path': world.get_path_name(),\n"
            "    'actor_count': len(actors),\n"
            "    'gravity_z': ws.global_gravity_z,\n"
            "    'default_game_mode': ws.default_game_mode.get_name() if ws.default_game_mode else None,\n"
            "}\n"
            "print(json.dumps(info))"
        )
        result = await client.run_python(script)
        return [TextContent(type="text", text=str(result))]

    @mcp.tool()
    async def ue5_load_level(level_path: str) -> list[TextContent]:
        """
        Load a level (map) in the UE5 editor.

        Args:
            level_path: Content path of the level asset, e.g. "/Game/Maps/MainMenu".
        """
        client: UE5Client = get_client()
        script = (
            "import unreal\n"
            f"unreal.EditorLevelLibrary.load_level('{level_path}')\n"
            "print('Level loaded')"
        )
        result = await client.run_python(script)
        return [TextContent(type="text", text=str(result))]

    @mcp.tool()
    async def ue5_save_current_level() -> list[TextContent]:
        """Save the currently open level/map in the UE5 editor."""
        client: UE5Client = get_client()
        script = (
            "import unreal\n"
            "unreal.EditorLevelLibrary.save_current_level()\n"
            "print('Level saved')"
        )
        result = await client.run_python(script)
        return [TextContent(type="text", text=str(result))]

    @mcp.tool()
    async def ue5_new_level(template_path: str = "") -> list[TextContent]:
        """
        Create a new empty level (or from a template) in the UE5 editor.

        Args:
            template_path: Optional content path to a level template. Leave empty for a blank level.
        """
        client: UE5Client = get_client()
        script = (
            "import unreal\n"
            f"unreal.EditorLevelLibrary.new_level('{template_path}')\n"
            "print('New level created')"
        )
        result = await client.run_python(script)
        return [TextContent(type="text", text=str(result))]

    @mcp.tool()
    async def ue5_set_world_gravity(gravity_z: float = -980.0) -> list[TextContent]:
        """
        Set the global gravity of the current UE5 world.

        Args:
            gravity_z: Gravity in cm/s² along -Z axis (default -980 ≈ Earth gravity).
        """
        client: UE5Client = get_client()
        script = (
            "import unreal\n"
            "world = unreal.EditorLevelLibrary.get_editor_world()\n"
            "ws = world.get_world_settings()\n"
            f"ws.global_gravity_z = {gravity_z}\n"
            "print(f'Gravity set to {gravity_z}')"
        )
        result = await client.run_python(script)
        return [TextContent(type="text", text=str(result))]

    @mcp.tool()
    async def ue5_list_sublevels() -> list[TextContent]:
        """List all sub-levels (streaming levels) associated with the current persistent level."""
        client: UE5Client = get_client()
        script = (
            "import unreal, json\n"
            "world = unreal.EditorLevelLibrary.get_editor_world()\n"
            "subs = []\n"
            "for sl in world.get_streaming_levels():\n"
            "    subs.append({'name': sl.get_name(), 'loaded': sl.is_level_loaded(), "
            "'visible': sl.is_level_visible()})\n"
            "print(json.dumps(subs))"
        )
        result = await client.run_python(script)
        return [TextContent(type="text", text=str(result))]
