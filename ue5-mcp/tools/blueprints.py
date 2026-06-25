"""Blueprint tools: create, compile, add components, get/set variables."""

from __future__ import annotations

import json

from mcp.server.fastmcp import FastMCP
from mcp.types import TextContent

from ue5_client import UE5Client


def register(mcp: FastMCP, get_client: object) -> None:

    @mcp.tool()
    async def ue5_create_blueprint(
        package_path: str,
        blueprint_name: str,
        parent_class: str = "Actor",
    ) -> list[TextContent]:
        """
        Create a new Blueprint class in the UE5 Content Browser.

        Args:
            package_path: Folder path in the content browser, e.g. "/Game/Blueprints".
            blueprint_name: Name of the new Blueprint (no extension), e.g. "BP_MyActor".
            parent_class: Unreal parent class name, e.g. "Actor", "Character", "Pawn",
                          "GameMode", "PlayerController", or a full class path.
        """
        client: UE5Client = get_client()
        script = (
            "import unreal\n"
            f"parent = unreal.load_class(None, '/Script/Engine.{parent_class}')\n"
            "if not parent:\n"
            f"    parent = unreal.load_class(None, '{parent_class}')\n"
            "if not parent:\n"
            "    print('ERROR: parent class not found'); exit(1)\n"
            "factory = unreal.BlueprintFactory()\n"
            "factory.parent_class = parent\n"
            "assetTools = unreal.AssetToolsHelpers.get_asset_tools()\n"
            f"bp = assetTools.create_asset('{blueprint_name}', '{package_path}', None, factory)\n"
            "if bp:\n"
            "    print(bp.get_path_name())\n"
            "else:\n"
            "    print('ERROR: Blueprint creation failed')"
        )
        result = await client.run_python(script)
        return [TextContent(type="text", text=str(result))]

    @mcp.tool()
    async def ue5_compile_blueprint(blueprint_path: str) -> list[TextContent]:
        """
        Compile a Blueprint asset.

        Args:
            blueprint_path: Content path to the Blueprint, e.g. "/Game/Blueprints/BP_MyActor".
        """
        client: UE5Client = get_client()
        script = (
            "import unreal\n"
            f"bp = unreal.EditorAssetLibrary.load_asset('{blueprint_path}')\n"
            "if not bp: print('ERROR: Blueprint not found'); exit(1)\n"
            "unreal.KismetEditorUtilities.compile_blueprint(bp)\n"
            "print('Compiled: ' + bp.get_path_name())"
        )
        result = await client.run_python(script)
        return [TextContent(type="text", text=str(result))]

    @mcp.tool()
    async def ue5_get_blueprint_variables(blueprint_path: str) -> list[TextContent]:
        """
        List all variables defined on a Blueprint class.

        Args:
            blueprint_path: Content path to the Blueprint, e.g. "/Game/Blueprints/BP_MyActor".
        """
        client: UE5Client = get_client()
        script = (
            "import unreal, json\n"
            f"bp = unreal.EditorAssetLibrary.load_asset('{blueprint_path}')\n"
            "if not bp: print(json.dumps({'error': 'Blueprint not found'})); exit(0)\n"
            "vars_info = []\n"
            "for prop in bp.generated_class.get_class().get_properties():\n"
            "    vars_info.append({'name': prop.get_name(), 'type': str(prop.__class__.__name__)})\n"
            "print(json.dumps(vars_info))"
        )
        result = await client.run_python(script)
        return [TextContent(type="text", text=str(result))]

    @mcp.tool()
    async def ue5_set_blueprint_variable(
        blueprint_path: str,
        variable_name: str,
        value_json: str,
    ) -> list[TextContent]:
        """
        Set a default value for a variable on a Blueprint class (Class Default Object).

        Args:
            blueprint_path: Content path to the Blueprint.
            variable_name: Name of the variable to set.
            value_json: JSON-encoded new value, e.g. "42", '"Hello"', "true", or '{"X":1,"Y":0,"Z":0}'.
        """
        client: UE5Client = get_client()
        try:
            value = json.loads(value_json)
        except json.JSONDecodeError:
            value = value_json
        script = (
            "import unreal\n"
            f"bp = unreal.EditorAssetLibrary.load_asset('{blueprint_path}')\n"
            "if not bp: print('ERROR: Blueprint not found'); exit(1)\n"
            "cdo = bp.generated_class.get_default_object()\n"
            f"if hasattr(cdo, '{variable_name}'):\n"
            f"    setattr(cdo, '{variable_name}', {repr(value)})\n"
            "    unreal.EditorAssetLibrary.save_loaded_asset(bp)\n"
            "    print('Variable set')\n"
            "else:\n"
            "    print('ERROR: Variable not found on CDO')"
        )
        result = await client.run_python(script)
        return [TextContent(type="text", text=str(result))]

    @mcp.tool()
    async def ue5_add_component_to_blueprint(
        blueprint_path: str,
        component_class: str,
        component_name: str = "",
    ) -> list[TextContent]:
        """
        Add a component to an existing Blueprint via Python scripting.

        Args:
            blueprint_path: Content path to the Blueprint.
            component_class: Component class name, e.g. "StaticMeshComponent", "PointLightComponent".
            component_name: Optional name for the new component.
        """
        client: UE5Client = get_client()
        comp_name = component_name or f"New{component_class}"
        script = (
            "import unreal\n"
            f"bp = unreal.EditorAssetLibrary.load_asset('{blueprint_path}')\n"
            "if not bp: print('ERROR: Blueprint not found'); exit(1)\n"
            f"comp_class = unreal.load_class(None, '/Script/Engine.{component_class}')\n"
            "if not comp_class: print('ERROR: Component class not found'); exit(1)\n"
            "subsystem = unreal.get_editor_subsystem(unreal.SubobjectEditorExtensionSubsystem)\n"
            f"subsystem.add_new_subobject(bp, comp_class, '{comp_name}')\n"
            "unreal.KismetEditorUtilities.compile_blueprint(bp)\n"
            "unreal.EditorAssetLibrary.save_loaded_asset(bp)\n"
            "print('Component added and Blueprint compiled')"
        )
        result = await client.run_python(script)
        return [TextContent(type="text", text=str(result))]
