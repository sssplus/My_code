"""
Integration-style tests for MCP tool handlers.

We mock the UE5Client and verify that:
  - each tool sends the right Python script / API call
  - results are wrapped in TextContent correctly
"""

from __future__ import annotations

import json
import sys
import os

# Ensure the ue5-mcp package root is on sys.path so imports work when running
# pytest from the repo root or from within ue5-mcp/.
_pkg = os.path.dirname(os.path.dirname(__file__))
if _pkg not in sys.path:
    sys.path.insert(0, _pkg)

from unittest.mock import AsyncMock

import pytest
from mcp.server.fastmcp import FastMCP
from mcp.types import TextContent

from tools import actors, assets, blueprints, editor, levels
from ue5_client import UE5Client


# ---------------------------------------------------------------------------
# Shared fixture: one server + mock client per test
# ---------------------------------------------------------------------------

def _make_server_and_client():
    mcp = FastMCP("ue5-test")
    mock_client = AsyncMock(spec=UE5Client)

    mock_client.run_python.return_value = "{}"
    mock_client.exec_console_command.return_value = {}
    mock_client.get_info.return_value = {"version": "5.4.0"}
    mock_client.search_assets.return_value = {"Assets": []}
    mock_client.get_property.return_value = {"propertyValue": 0}
    mock_client.set_property.return_value = {}
    mock_client.call_function.return_value = {}
    mock_client.batch.return_value = []

    def get_client():
        return mock_client

    editor.register(mcp, get_client)
    assets.register(mcp, get_client)
    actors.register(mcp, get_client)
    levels.register(mcp, get_client)
    blueprints.register(mcp, get_client)

    return mcp, mock_client


async def _call(mcp: FastMCP, name: str, **kwargs):
    """Call a registered MCP tool by name and return the list of TextContent items."""
    content, _ = await mcp.call_tool(name, kwargs)
    return content


# ---------------------------------------------------------------------------
# Editor tools
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ue5_get_editor_info():
    mcp, client = _make_server_and_client()
    result = await _call(mcp, "ue5_get_editor_info")
    client.get_info.assert_called_once()
    assert isinstance(result[0], TextContent)
    assert "version" in result[0].text


@pytest.mark.asyncio
async def test_ue5_execute_console_command():
    mcp, client = _make_server_and_client()
    result = await _call(mcp, "ue5_execute_console_command", command="stat fps")
    client.exec_console_command.assert_called_once_with("stat fps")
    assert isinstance(result[0], TextContent)


@pytest.mark.asyncio
async def test_ue5_run_python_script():
    mcp, client = _make_server_and_client()
    client.run_python.return_value = "5.4.0"
    result = await _call(mcp, "ue5_run_python_script", script="import unreal")
    client.run_python.assert_called_once_with("import unreal")
    assert isinstance(result[0], TextContent)


@pytest.mark.asyncio
async def test_ue5_take_screenshot():
    mcp, client = _make_server_and_client()
    await _call(mcp, "ue5_take_screenshot", filename="test", width=1280, height=720)
    call_args = client.exec_console_command.call_args[0][0]
    assert "1280x720" in call_args
    assert "test" in call_args


@pytest.mark.asyncio
async def test_ue5_save_all():
    mcp, client = _make_server_and_client()
    await _call(mcp, "ue5_save_all")
    client.run_python.assert_called_once()
    assert "save_dirty_packages" in client.run_python.call_args[0][0]


# ---------------------------------------------------------------------------
# Asset tools
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ue5_search_assets_no_filter():
    mcp, client = _make_server_and_client()
    await _call(mcp, "ue5_search_assets", query="Wall", limit=10)
    client.search_assets.assert_called_once_with(
        query="Wall", package_filter="/Game", class_filter=None, limit=10
    )


@pytest.mark.asyncio
async def test_ue5_search_assets_with_class_filter():
    mcp, client = _make_server_and_client()
    await _call(mcp, "ue5_search_assets", query="Rock", class_filter="StaticMesh,Material", limit=5)
    call_kwargs = client.search_assets.call_args[1]
    assert call_kwargs["class_filter"] == ["StaticMesh", "Material"]


@pytest.mark.asyncio
async def test_ue5_search_assets_limit_capped():
    mcp, client = _make_server_and_client()
    await _call(mcp, "ue5_search_assets", limit=9999)
    assert client.search_assets.call_args[1]["limit"] == 100


@pytest.mark.asyncio
async def test_ue5_get_asset_properties_with_property():
    mcp, client = _make_server_and_client()
    client.get_property.return_value = {"propertyValue": "Red"}
    result = await _call(
        mcp,
        "ue5_get_asset_properties",
        asset_path="/Game/Meshes/SM_Wall",
        property_name="OverrideMaterials",
    )
    client.get_property.assert_called_once()
    assert isinstance(result[0], TextContent)


@pytest.mark.asyncio
async def test_ue5_open_asset():
    mcp, client = _make_server_and_client()
    await _call(mcp, "ue5_open_asset", asset_path="/Game/Blueprints/BP_Enemy")
    script = client.run_python.call_args[0][0]
    assert "open_editor_for_assets" in script
    assert "/Game/Blueprints/BP_Enemy" in script


@pytest.mark.asyncio
async def test_ue5_set_object_property_json_value():
    mcp, client = _make_server_and_client()
    await _call(
        mcp,
        "ue5_set_object_property",
        object_path="/Game/Maps/Main.Main:PersistentLevel.MyActor",
        property_name="Health",
        property_value="100",
    )
    client.set_property.assert_called_once_with(
        "/Game/Maps/Main.Main:PersistentLevel.MyActor", "Health", 100
    )


@pytest.mark.asyncio
async def test_ue5_call_function_valid_json():
    mcp, client = _make_server_and_client()
    await _call(
        mcp,
        "ue5_call_function",
        object_path="/Script/Engine.Default__Lib",
        function_name="DoThing",
        parameters_json='{"X": 1}',
    )
    client.call_function.assert_called_once_with(
        "/Script/Engine.Default__Lib", "DoThing", {"X": 1}
    )


@pytest.mark.asyncio
async def test_ue5_call_function_invalid_json():
    mcp, client = _make_server_and_client()
    result = await _call(
        mcp,
        "ue5_call_function",
        object_path="/Script/Engine.Default__Lib",
        function_name="DoThing",
        parameters_json="not-json",
    )
    assert "Invalid JSON" in result[0].text
    client.call_function.assert_not_called()


# ---------------------------------------------------------------------------
# Actor tools
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ue5_get_actors_in_level():
    mcp, client = _make_server_and_client()
    await _call(mcp, "ue5_get_actors_in_level")
    script = client.run_python.call_args[0][0]
    assert "get_all_level_actors" in script


@pytest.mark.asyncio
async def test_ue5_get_actors_with_filters():
    mcp, client = _make_server_and_client()
    await _call(mcp, "ue5_get_actors_in_level", class_filter="StaticMeshActor", name_filter="Tree")
    script = client.run_python.call_args[0][0]
    assert "StaticMeshActor" in script
    assert "Tree" in script


@pytest.mark.asyncio
async def test_ue5_spawn_actor_basic():
    mcp, client = _make_server_and_client()
    await _call(
        mcp,
        "ue5_spawn_actor",
        blueprint_path="/Game/Blueprints/BP_Tree",
        location_x=100.0,
        location_y=200.0,
        location_z=0.0,
    )
    script = client.run_python.call_args[0][0]
    assert "spawn_actor_from_object" in script
    assert "100.0" in script


@pytest.mark.asyncio
async def test_ue5_spawn_actor_with_label():
    mcp, client = _make_server_and_client()
    await _call(mcp, "ue5_spawn_actor", blueprint_path="/Game/Blueprints/BP_Tree", label="BigTree")
    script = client.run_python.call_args[0][0]
    assert "BigTree" in script
    assert "set_actor_label" in script


@pytest.mark.asyncio
async def test_ue5_set_actor_transform_location_only():
    mcp, client = _make_server_and_client()
    await _call(
        mcp,
        "ue5_set_actor_transform",
        actor_path="/Game/Maps/Test.Test:PersistentLevel.MyActor",
        location_x=500.0,
    )
    script = client.run_python.call_args[0][0]
    assert "set_actor_location" in script
    assert "500.0" in script
    assert "set_actor_rotation" not in script


@pytest.mark.asyncio
async def test_ue5_delete_actor():
    mcp, client = _make_server_and_client()
    await _call(mcp, "ue5_delete_actor", actor_path="/Game/Maps/Test.Test:PersistentLevel.MyActor")
    script = client.run_python.call_args[0][0]
    assert "destroy_actor" in script


# ---------------------------------------------------------------------------
# Level tools
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ue5_get_level_info():
    mcp, client = _make_server_and_client()
    await _call(mcp, "ue5_get_level_info")
    script = client.run_python.call_args[0][0]
    assert "get_editor_world" in script


@pytest.mark.asyncio
async def test_ue5_load_level():
    mcp, client = _make_server_and_client()
    await _call(mcp, "ue5_load_level", level_path="/Game/Maps/MainMenu")
    script = client.run_python.call_args[0][0]
    assert "load_level" in script
    assert "/Game/Maps/MainMenu" in script


@pytest.mark.asyncio
async def test_ue5_save_current_level():
    mcp, client = _make_server_and_client()
    await _call(mcp, "ue5_save_current_level")
    script = client.run_python.call_args[0][0]
    assert "save_current_level" in script


@pytest.mark.asyncio
async def test_ue5_set_world_gravity():
    mcp, client = _make_server_and_client()
    await _call(mcp, "ue5_set_world_gravity", gravity_z=-490.0)
    script = client.run_python.call_args[0][0]
    assert "-490.0" in script
    assert "global_gravity_z" in script


# ---------------------------------------------------------------------------
# Blueprint tools
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ue5_create_blueprint():
    mcp, client = _make_server_and_client()
    await _call(
        mcp,
        "ue5_create_blueprint",
        package_path="/Game/Blueprints",
        blueprint_name="BP_NewEnemy",
        parent_class="Character",
    )
    script = client.run_python.call_args[0][0]
    assert "BlueprintFactory" in script
    assert "BP_NewEnemy" in script
    assert "Character" in script


@pytest.mark.asyncio
async def test_ue5_compile_blueprint():
    mcp, client = _make_server_and_client()
    await _call(mcp, "ue5_compile_blueprint", blueprint_path="/Game/Blueprints/BP_Enemy")
    script = client.run_python.call_args[0][0]
    assert "compile_blueprint" in script
    assert "/Game/Blueprints/BP_Enemy" in script


@pytest.mark.asyncio
async def test_ue5_set_blueprint_variable():
    mcp, client = _make_server_and_client()
    await _call(
        mcp,
        "ue5_set_blueprint_variable",
        blueprint_path="/Game/Blueprints/BP_Enemy",
        variable_name="MaxHealth",
        value_json="250",
    )
    script = client.run_python.call_args[0][0]
    assert "MaxHealth" in script
    assert "250" in script


@pytest.mark.asyncio
async def test_ue5_add_component_to_blueprint():
    mcp, client = _make_server_and_client()
    await _call(
        mcp,
        "ue5_add_component_to_blueprint",
        blueprint_path="/Game/Blueprints/BP_Enemy",
        component_class="PointLightComponent",
        component_name="EyeGlow",
    )
    script = client.run_python.call_args[0][0]
    assert "PointLightComponent" in script
    assert "EyeGlow" in script
    assert "compile_blueprint" in script
