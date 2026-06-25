# UE5 MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes Unreal Engine 5 editor capabilities to AI assistants (Claude, etc.).

## Features

| Tool | Description |
|---|---|
| `ue5_get_editor_info` | Retrieve running UE5 instance info |
| `ue5_execute_console_command` | Run any UE5 console command |
| `ue5_run_python_script` | Execute Python in the UE5 editor |
| `ue5_take_screenshot` | Capture a viewport screenshot |
| `ue5_save_all` | Save all dirty assets and the current map |
| `ue5_search_assets` | Search the Content Browser |
| `ue5_get_asset_properties` | Inspect an asset's properties |
| `ue5_open_asset` | Open an asset in its editor |
| `ue5_set_object_property` | Set a property on any UObject |
| `ue5_call_function` | Call a function on any UObject |
| `ue5_get_actors_in_level` | List actors in the current level |
| `ue5_get_actor_properties` | Get position / rotation / scale of an actor |
| `ue5_spawn_actor` | Spawn a Blueprint actor into the level |
| `ue5_set_actor_transform` | Move / rotate / scale an actor |
| `ue5_set_actor_label` | Rename an actor's editor label |
| `ue5_delete_actor` | Remove an actor from the level |
| `ue5_get_level_info` | Level name, actor count, world settings |
| `ue5_load_level` | Open a level in the editor |
| `ue5_save_current_level` | Save the current map |
| `ue5_new_level` | Create a new blank / templated level |
| `ue5_set_world_gravity` | Change the world's gravity |
| `ue5_list_sublevels` | List all streaming sublevels |
| `ue5_create_blueprint` | Create a new Blueprint class |
| `ue5_compile_blueprint` | Compile a Blueprint |
| `ue5_get_blueprint_variables` | List Blueprint variables |
| `ue5_set_blueprint_variable` | Set a Blueprint CDO variable |
| `ue5_add_component_to_blueprint` | Add a component to a Blueprint |

## UE5 Setup

1. Open your UE5 project and go to **Edit → Plugins**.
2. Enable **Remote Control API** and **Remote Control Web Interface**.
3. Optionally enable **Python Editor Script Plugin** (required for `ue5_run_python_script` and most other tools that use the `unreal` Python module).
4. Restart the editor. The web server starts automatically on **port 30010**.

## Installation

```bash
cd ue5-mcp
pip install -r requirements.txt
```

## Running

```bash
# Default: connects to UE5 on localhost:30010
python server.py

# Custom host/port or environment variables
UE5_HOST=192.168.1.5 UE5_PORT=30010 python server.py
python server.py --ue5-host 192.168.1.5 --ue5-port 30010
```

## MCP Client Configuration

Add to your `claude_desktop_config.json` (or equivalent):

```json
{
  "mcpServers": {
    "ue5": {
      "command": "python",
      "args": ["/absolute/path/to/ue5-mcp/server.py"],
      "env": {
        "UE5_HOST": "localhost",
        "UE5_PORT": "30010"
      }
    }
  }
}
```

## Development

```bash
pip install -r requirements.txt respx pytest pytest-asyncio
python -m pytest
```

## Architecture

```
ue5-mcp/
├── server.py          # FastMCP server entry point
├── ue5_client.py      # Async HTTP client for the UE5 Remote Control REST API
├── tools/
│   ├── editor.py      # Console commands, Python execution, screenshots, save-all
│   ├── assets.py      # Content browser search, property get/set, function calls
│   ├── actors.py      # Spawn, list, transform, delete actors
│   ├── levels.py      # Load/save/new levels, sublevels, world settings
│   └── blueprints.py  # Create, compile, inspect, modify Blueprints
├── tests/
│   ├── test_ue5_client.py    # HTTP client tests (mocked with respx)
│   └── test_server_tools.py  # Tool handler tests (mocked UE5Client)
└── requirements.txt
```

All tools communicate with UE5 through the **Remote Control REST API** (`PUT /remote/object/call`, `PUT /remote/object/property`, etc.) or by executing Python scripts via the `ExecutePythonScript` function when the Python plugin is active.
