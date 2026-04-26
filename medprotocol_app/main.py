import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from medprotocol_app.db import get_all_protocols, get_protocol, init_db, save_protocol
from medprotocol_app.llm import run_llm_check
from medprotocol_app.models import check_payload, make_protocol


logging.basicConfig(level=logging.INFO)
log = logging.getLogger("medprotocol")

app = FastAPI(title="MedProtocol")
static_dir = Path(__file__).resolve().parent / "static"
if static_dir.exists():
    app.mount("/ui", StaticFiles(directory=str(static_dir), html=True), name="ui")


@app.on_event("startup")
async def startup():
    await init_db()
    log.info("server started")


@app.get("/")
async def home():
    return RedirectResponse(url="/ui/")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/protocols")
async def create_protocol(request: Request):
    try:
        data = await request.json()
        protocol = make_protocol(data)
        saved = await save_protocol(protocol.serialize())
        log.info("protocol saved")
        return saved
    except:
        return {"status": "error", "message": "bad protocol"}


@app.get("/protocols")
async def list_protocols():
    try:
        data = await get_all_protocols()
        return {"items": data}
    except:
        return {"status": "error"}


@app.get("/protocols/{protocol_id}")
async def read_protocol(protocol_id):
    data = await get_protocol(protocol_id)
    if not data:
        return {"status": "error", "message": "not found"}
    return data


@app.post("/protocols/{protocol_id}/validate")
async def validate_protocol(protocol_id, request: Request):
    try:
        data = await get_protocol(protocol_id)
        if not data:
            return {"status": "error", "message": "not found"}

        payload = await request.json()
        protocol = make_protocol(data)
        checked = check_payload(protocol, payload)
        errors = await run_llm_check(protocol, checked)

        result = {}
        result["status"] = "ok"
        result["data"] = checked
        result["issues"] = errors
        log.info("protocol checked")
        return result
    except:
        return {"status": "error", "message": "bad data"}
