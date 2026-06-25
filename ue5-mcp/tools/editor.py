"""Editor-level tools: info, console commands, Python scripts, screenshots."""

from __future__ import annotations

from mcp.server.fastmcp import FastMCP
from mcp.types import TextContent

from ue5_client import UE5Client


def register(mcp: FastMCP, get_client: object) -> None:
    """Register editor tools on *mcp*. *get_client* is a callable → UE5Client."""

    @mcp.tool()
    async def ue5_get_editor_info() -> list[TextContent]:
        """Return information about the running UE5 editor instance."""
        client: UE5Client = get_client()
        info = await client.get_info()
        return [TextContent(type="text", text=str(info))]

    @mcp.tool()
    async def ue5_execute_console_command(command: str) -> list[TextContent]:
        """
        Execute a UE5 console command in the editor.

        Args:
            command: The console command string, e.g. "stat fps" or "r.ScreenPercentage 75".
        """
        client: UE5Client = get_client()
        result = await client.exec_console_command(command)
        return [TextContent(type="text", text=str(result))]

    @mcp.tool()
    async def ue5_run_python_script(script: str) -> list[TextContent]:
        """
        Execute a Python script inside the UE5 editor (requires Editor Python Scripting plugin).

        Args:
            script: Python code to run, e.g. "import unreal; print(unreal.Engine.get_engine_version())".
        """
        client: UE5Client = get_client()
        result = await client.run_python(script)
        return [TextContent(type="text", text=str(result))]

    @mcp.tool()
    async def ue5_take_screenshot(
        filename: str = "screenshot",
        width: int = 1920,
        height: int = 1080,
    ) -> list[TextContent]:
        """
        Capture a screenshot from the UE5 editor viewport.

        Args:
            filename: Output filename (without extension). Saved to the project Screenshots dir.
            width: Image width in pixels.
            height: Image height in pixels.
        """
        client: UE5Client = get_client()
        cmd = f"HighResShot {width}x{height} filename={filename}"
        result = await client.exec_console_command(cmd)
        return [TextContent(type="text", text=f"Screenshot requested: {filename}.png\n{result}")]

    @mcp.tool()
    async def ue5_save_all() -> list[TextContent]:
        """Save all dirty assets and the current map in the UE5 editor."""
        client: UE5Client = get_client()
        result = await client.run_python(
            "import unreal\n"
            "unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)"
        )
        return [TextContent(type="text", text=f"Save all triggered.\n{result}")]
