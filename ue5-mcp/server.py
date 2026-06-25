"""
Unreal Engine 5 MCP Server

Exposes UE5 editor capabilities to AI assistants via the Model Context Protocol.
Requires UE5 to be running with the Remote Control API plugin and web server enabled.

Usage:
    python server.py [--ue5-host HOST] [--ue5-port PORT]

    Or via MCP client configuration:
        {
          "ue5": {
            "command": "python",
            "args": ["/path/to/ue5-mcp/server.py"],
            "env": {
              "UE5_HOST": "localhost",
              "UE5_PORT": "30010"
            }
          }
        }

UE5 Setup:
    1. Enable "Remote Control API" and "Remote Control Web Interface" plugins in your project.
    2. Start the editor — the web server auto-starts on port 30010.
    3. Optional: enable "Python Editor Script Plugin" for full Python scripting support.
"""

from __future__ import annotations

import argparse
import logging
import os

from mcp.server.fastmcp import FastMCP

from ue5_client import UE5Client
from tools import actors, assets, blueprints, editor, levels

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("ue5-mcp")


def build_server(ue5_host: str, ue5_port: int) -> FastMCP:
    """Construct and return the FastMCP server with all UE5 tools registered."""
    mcp = FastMCP(
        "ue5-mcp",
        instructions=(
            "This server provides tools for controlling the Unreal Engine 5 editor "
            "via the Remote Control API. UE5 must be running with the Remote Control "
            "Web Interface plugin enabled (default port 30010)."
        ),
    )

    _client: UE5Client | None = None

    def get_client() -> UE5Client:
        nonlocal _client
        if _client is None:
            _client = UE5Client(host=ue5_host, port=ue5_port)
        return _client

    # Register tool groups
    editor.register(mcp, get_client)
    assets.register(mcp, get_client)
    actors.register(mcp, get_client)
    levels.register(mcp, get_client)
    blueprints.register(mcp, get_client)

    logger.info("UE5 MCP server initialised (targeting %s:%d)", ue5_host, ue5_port)
    return mcp


def main() -> None:
    parser = argparse.ArgumentParser(description="UE5 MCP Server")
    parser.add_argument(
        "--ue5-host",
        default=os.environ.get("UE5_HOST", "localhost"),
        help="UE5 Remote Control API host (default: localhost)",
    )
    parser.add_argument(
        "--ue5-port",
        type=int,
        default=int(os.environ.get("UE5_PORT", "30010")),
        help="UE5 Remote Control API port (default: 30010)",
    )
    args = parser.parse_args()

    mcp = build_server(args.ue5_host, args.ue5_port)
    mcp.run()


if __name__ == "__main__":
    main()
