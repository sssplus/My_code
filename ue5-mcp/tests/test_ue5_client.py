"""Unit tests for UE5Client — all HTTP calls are mocked via respx."""

import json

import httpx
import pytest
import respx

from ue5_client import UE5Client, UE5RemoteControlError

BASE = "http://localhost:30010"


@pytest.fixture
def client():
    return UE5Client(host="localhost", port=30010)


# ---------------------------------------------------------------------------
# get_info
# ---------------------------------------------------------------------------

@respx.mock
@pytest.mark.asyncio
async def test_get_info_success(client):
    respx.get(f"{BASE}/remote/info").mock(
        return_value=httpx.Response(200, json={"version": "5.4.0"})
    )
    info = await client.get_info()
    assert info["version"] == "5.4.0"


@respx.mock
@pytest.mark.asyncio
async def test_get_info_server_error(client):
    respx.get(f"{BASE}/remote/info").mock(
        return_value=httpx.Response(503, text="Service Unavailable")
    )
    with pytest.raises(UE5RemoteControlError) as exc_info:
        await client.get_info()
    assert exc_info.value.status_code == 503


# ---------------------------------------------------------------------------
# get_property / set_property
# ---------------------------------------------------------------------------

@respx.mock
@pytest.mark.asyncio
async def test_get_property(client):
    respx.put(f"{BASE}/remote/object/property").mock(
        return_value=httpx.Response(200, json={"propertyValue": 42})
    )
    result = await client.get_property("/Game/Maps/Main.Main:PersistentLevel.MyActor_0", "Health")
    assert result["propertyValue"] == 42


@respx.mock
@pytest.mark.asyncio
async def test_set_property(client):
    route = respx.put(f"{BASE}/remote/object/property")
    route.mock(return_value=httpx.Response(200, json={}))
    await client.set_property("/Game/Maps/Main.Main:PersistentLevel.MyActor_0", "Health", 100)
    sent = json.loads(route.calls[0].request.content)
    assert sent["access"] == "WRITE_ACCESS"
    assert sent["propertyValue"] == 100


# ---------------------------------------------------------------------------
# call_function
# ---------------------------------------------------------------------------

@respx.mock
@pytest.mark.asyncio
async def test_call_function(client):
    route = respx.put(f"{BASE}/remote/object/call")
    route.mock(return_value=httpx.Response(200, json={"returnValue": "OK"}))
    result = await client.call_function("/Script/Engine.Default__Foo", "Bar", {"baz": 1})
    sent = json.loads(route.calls[0].request.content)
    assert sent["functionName"] == "Bar"
    assert result["returnValue"] == "OK"


# ---------------------------------------------------------------------------
# search_assets
# ---------------------------------------------------------------------------

@respx.mock
@pytest.mark.asyncio
async def test_search_assets_basic(client):
    respx.put(f"{BASE}/remote/assets/search").mock(
        return_value=httpx.Response(200, json={"Assets": []})
    )
    result = await client.search_assets(query="Wall")
    assert "Assets" in result


@respx.mock
@pytest.mark.asyncio
async def test_search_assets_with_class_filter(client):
    route = respx.put(f"{BASE}/remote/assets/search")
    route.mock(return_value=httpx.Response(200, json={"Assets": []}))
    await client.search_assets(query="SM_Rock", class_filter=["StaticMesh"])
    sent = json.loads(route.calls[0].request.content)
    assert "StaticMesh" in sent["ClassFilter"]


# ---------------------------------------------------------------------------
# exec_console_command
# ---------------------------------------------------------------------------

@respx.mock
@pytest.mark.asyncio
async def test_exec_console_command(client):
    route = respx.put(f"{BASE}/remote/object/call")
    route.mock(return_value=httpx.Response(200, json={}))
    await client.exec_console_command("stat fps")
    sent = json.loads(route.calls[0].request.content)
    assert sent["functionName"] == "ExecuteConsoleCommand"
    assert "stat fps" in json.dumps(sent["parameters"])


# ---------------------------------------------------------------------------
# batch
# ---------------------------------------------------------------------------

@respx.mock
@pytest.mark.asyncio
async def test_batch_returns_responses(client):
    respx.put(f"{BASE}/remote/batch").mock(
        return_value=httpx.Response(
            200,
            json={"Responses": [{"RequestId": 1, "ResponseCode": 200}]},
        )
    )
    requests = [{"RequestId": 1, "URL": "/remote/info", "Verb": "GET", "Body": {}}]
    responses = await client.batch(requests)
    assert len(responses) == 1
    assert responses[0]["RequestId"] == 1


# ---------------------------------------------------------------------------
# run_python
# ---------------------------------------------------------------------------

@respx.mock
@pytest.mark.asyncio
async def test_run_python(client):
    route = respx.put(f"{BASE}/remote/object/call")
    route.mock(return_value=httpx.Response(200, json={}))
    await client.run_python("print('hello')")
    sent = json.loads(route.calls[0].request.content)
    assert sent["functionName"] == "ExecutePythonScript"
    assert "print('hello')" in sent["parameters"]["PythonScript"]


# ---------------------------------------------------------------------------
# empty response body
# ---------------------------------------------------------------------------

@respx.mock
@pytest.mark.asyncio
async def test_empty_body_returns_dict(client):
    respx.put(f"{BASE}/remote/object/call").mock(
        return_value=httpx.Response(200, text="")
    )
    result = await client.exec_console_command("r.ScreenPercentage 75")
    assert result == {}
