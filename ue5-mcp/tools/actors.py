"""Actor tools: spawn, list, get/set properties, transforms, delete."""

from __future__ import annotations

from mcp.server.fastmcp import FastMCP
from mcp.types import TextContent

from ue5_client import UE5Client


def register(mcp: FastMCP, get_client: object) -> None:

    @mcp.tool()
    async def ue5_get_actors_in_level(
        class_filter: str = "",
        name_filter: str = "",
    ) -> list[TextContent]:
        """
        List all actors currently in the loaded UE5 level.

        Args:
            class_filter: Optional actor class name to filter, e.g. "StaticMeshActor".
            name_filter: Optional name substring filter, e.g. "Tree".
        """
        client: UE5Client = get_client()
        script = (
            "import unreal, json\n"
            "actors = unreal.EditorLevelLibrary.get_all_level_actors()\n"
            "result = []\n"
            "for a in actors:\n"
            f"    if '{class_filter}' and '{class_filter}'.lower() not in a.get_class().get_name().lower(): continue\n"
            f"    if '{name_filter}' and '{name_filter}'.lower() not in a.get_actor_label().lower(): continue\n"
            "    t = a.get_actor_location()\n"
            "    result.append({'label': a.get_actor_label(), 'class': a.get_class().get_name(), 'path': a.get_path_name(), 'location': {'X': t.x, 'Y': t.y, 'Z': t.z}})\n"
            "print(json.dumps(result))"
        )
        result = await client.run_python(script)
        return [TextContent(type="text", text=str(result))]

    @mcp.tool()
    async def ue5_get_actor_properties(actor_path: str) -> list[TextContent]:
        """
        Get properties of a specific actor.

        Args:
            actor_path: Full path of the actor in the level, e.g.
                        "/Game/Maps/Main.Main:PersistentLevel.BP_Character_C_0".
        """
        client: UE5Client = get_client()
        script = (
            "import unreal, json\n"
            f"a = unreal.find_object(None, '{actor_path}')\n"
            "if a:\n"
            "    loc = a.get_actor_location()\n"
            "    rot = a.get_actor_rotation()\n"
            "    scl = a.get_actor_scale3d()\n"
            "    print(json.dumps({'label': a.get_actor_label(), 'class': a.get_class().get_name(), "
            "'location': {'X': loc.x, 'Y': loc.y, 'Z': loc.z}, "
            "'rotation': {'Pitch': rot.pitch, 'Yaw': rot.yaw, 'Roll': rot.roll}, "
            "'scale': {'X': scl.x, 'Y': scl.y, 'Z': scl.z}, "
            "'hidden': a.is_hidden_ed()}))\n"
            "else:\n"
            "    print(json.dumps({'error': 'Actor not found'}))"
        )
        result = await client.run_python(script)
        return [TextContent(type="text", text=str(result))]

    @mcp.tool()
    async def ue5_spawn_actor(
        blueprint_path: str,
        location_x: float = 0.0,
        location_y: float = 0.0,
        location_z: float = 0.0,
        rotation_pitch: float = 0.0,
        rotation_yaw: float = 0.0,
        rotation_roll: float = 0.0,
        label: str = "",
    ) -> list[TextContent]:
        """
        Spawn an actor (Blueprint class) into the current UE5 level.

        Args:
            blueprint_path: Content path to the Blueprint, e.g. "/Game/Blueprints/BP_Tree".
            location_x: X position in world units (cm).
            location_y: Y position in world units (cm).
            location_z: Z position in world units (cm).
            rotation_pitch: Pitch in degrees.
            rotation_yaw: Yaw in degrees.
            rotation_roll: Roll in degrees.
            label: Optional editor label for the new actor.
        """
        client: UE5Client = get_client()
        script = (
            "import unreal\n"
            f"bp = unreal.EditorAssetLibrary.load_asset('{blueprint_path}')\n"
            f"loc = unreal.Vector({location_x}, {location_y}, {location_z})\n"
            f"rot = unreal.Rotator({rotation_pitch}, {rotation_yaw}, {rotation_roll})\n"
            "actor = unreal.EditorLevelLibrary.spawn_actor_from_object(bp, loc, rot)\n"
        )
        if label:
            script += f"if actor: actor.set_actor_label('{label}')\n"
        script += "print(actor.get_path_name() if actor else 'FAILED')"
        result = await client.run_python(script)
        return [TextContent(type="text", text=str(result))]

    @mcp.tool()
    async def ue5_set_actor_transform(
        actor_path: str,
        location_x: float | None = None,
        location_y: float | None = None,
        location_z: float | None = None,
        rotation_pitch: float | None = None,
        rotation_yaw: float | None = None,
        rotation_roll: float | None = None,
        scale_x: float | None = None,
        scale_y: float | None = None,
        scale_z: float | None = None,
    ) -> list[TextContent]:
        """
        Move, rotate, or scale an actor in the UE5 level.

        Args:
            actor_path: Full actor path in the level.
            location_x/y/z: New world position (cm). Omit to keep current.
            rotation_pitch/yaw/roll: New rotation (degrees). Omit to keep current.
            scale_x/y/z: New scale factors. Omit to keep current.
        """
        client: UE5Client = get_client()

        parts: list[str] = [
            "import unreal",
            f"a = unreal.find_object(None, '{actor_path}')",
            "if not a: raise RuntimeError('Actor not found')",
        ]

        if any(v is not None for v in [location_x, location_y, location_z]):
            parts += [
                "cur_loc = a.get_actor_location()",
                f"new_loc = unreal.Vector({location_x if location_x is not None else 'cur_loc.x'}, "
                f"{location_y if location_y is not None else 'cur_loc.y'}, "
                f"{location_z if location_z is not None else 'cur_loc.z'})",
                "a.set_actor_location(new_loc, False, False)",
            ]

        if any(v is not None for v in [rotation_pitch, rotation_yaw, rotation_roll]):
            parts += [
                "cur_rot = a.get_actor_rotation()",
                f"new_rot = unreal.Rotator({rotation_pitch if rotation_pitch is not None else 'cur_rot.pitch'}, "
                f"{rotation_yaw if rotation_yaw is not None else 'cur_rot.yaw'}, "
                f"{rotation_roll if rotation_roll is not None else 'cur_rot.roll'})",
                "a.set_actor_rotation(new_rot, False)",
            ]

        if any(v is not None for v in [scale_x, scale_y, scale_z]):
            parts += [
                "cur_scl = a.get_actor_scale3d()",
                f"new_scl = unreal.Vector({scale_x if scale_x is not None else 'cur_scl.x'}, "
                f"{scale_y if scale_y is not None else 'cur_scl.y'}, "
                f"{scale_z if scale_z is not None else 'cur_scl.z'})",
                "a.set_actor_scale3d(new_scl)",
            ]

        parts.append("print('Transform updated')")
        script = "\n".join(parts)
        result = await client.run_python(script)
        return [TextContent(type="text", text=str(result))]

    @mcp.tool()
    async def ue5_delete_actor(actor_path: str) -> list[TextContent]:
        """
        Delete an actor from the current UE5 level.

        Args:
            actor_path: Full path of the actor to delete.
        """
        client: UE5Client = get_client()
        script = (
            "import unreal\n"
            f"a = unreal.find_object(None, '{actor_path}')\n"
            "if a:\n"
            "    unreal.EditorLevelLibrary.destroy_actor(a)\n"
            "    print('Actor deleted')\n"
            "else:\n"
            "    print('Actor not found')"
        )
        result = await client.run_python(script)
        return [TextContent(type="text", text=str(result))]

    @mcp.tool()
    async def ue5_set_actor_label(actor_path: str, new_label: str) -> list[TextContent]:
        """
        Rename an actor's editor label.

        Args:
            actor_path: Full path of the actor.
            new_label: New display name for the actor in the editor.
        """
        client: UE5Client = get_client()
        script = (
            "import unreal\n"
            f"a = unreal.find_object(None, '{actor_path}')\n"
            "if a:\n"
            f"    a.set_actor_label('{new_label}')\n"
            "    print('Label updated')\n"
            "else:\n"
            "    print('Actor not found')"
        )
        result = await client.run_python(script)
        return [TextContent(type="text", text=str(result))]
