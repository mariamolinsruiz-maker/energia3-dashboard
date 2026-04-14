"""
ComunitatES · main.py
FastAPI — serveix l'HTML, /api/communities, /api/clients
"""
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import json
import pathlib

app = FastAPI(title="ComunitatES API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Fitxers estàtics (app.js, etc.) — servits a /static/
app.mount("/static", StaticFiles(directory="static"), name="static")

DATA_FILE = pathlib.Path("data/data.json")


# ─────────────────────────────────────
#  Helpers de dades
# ─────────────────────────────────────
def rdata() -> dict:
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def wdata(d: dict):
    DATA_FILE.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")


def _recalc_community(data: dict, comm_id: str):
    """Recalcula els totals d'una comunitat a partir dels seus clients."""
    cc = [c for c in data["clients"] if c["comunitat"] == comm_id]
    comm = next((c for c in data["communities"] if c["id"] == comm_id), None)
    if not comm:
        return
    comm["total_clients"]  = len(cc)
    comm["total_kw"]       = round(sum(c.get("kw", 0) for c in cc), 2)
    comm["total_estalvi"]  = round(sum(c.get("estalvi_brut", 0) for c in cc), 2)
    comm["clients_actius"] = sum(1 for c in cc if c.get("estat") == "Actiu")
    comm["inscrits"]       = sum(1 for c in cc if c.get("estat") in ("Actiu", "Proposat"))
    comm["sense_auth"]     = sum(1 for c in cc if c.get("cups_auth") == "Falten")


# ─────────────────────────────────────
#  Ruta principal — injecta app.js
#  sense modificar index.html al disc
# ─────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
def root():
    html = pathlib.Path("static/index.html").read_text(encoding="utf-8")
    # Injecta <script src="/static/app.js"> just before </body>
    html = html.replace("</body>", '<script src="/static/app.js"></script>\n</body>', 1)
    return HTMLResponse(content=html)


@app.get("/health")
def health():
    return {"status": "ok"}


# ─────────────────────────────────────
#  /api/communities
# ─────────────────────────────────────
@app.get("/api/communities")
def get_communities():
    return rdata()["communities"]


@app.post("/api/communities", status_code=201)
def create_community(comm: dict):
    data = rdata()
    if any(c["id"] == comm.get("id") for c in data["communities"]):
        raise HTTPException(400, f"Ja existeix una comunitat amb ID {comm.get('id')}")
    data["communities"].append(comm)
    wdata(data)
    return comm


@app.put("/api/communities/{comm_id}")
def update_community(comm_id: str, comm: dict):
    data = rdata()
    idx = next((i for i, c in enumerate(data["communities"]) if c["id"] == comm_id), None)
    if idx is None:
        raise HTTPException(404, "Comunitat no trobada")
    data["communities"][idx] = comm
    _recalc_community(data, comm_id)
    wdata(data)
    return data["communities"][idx]


@app.delete("/api/communities/{comm_id}")
def delete_community(comm_id: str):
    data = rdata()
    data["communities"] = [c for c in data["communities"] if c["id"] != comm_id]
    data["clients"]     = [c for c in data["clients"]     if c["comunitat"] != comm_id]
    wdata(data)
    return {"ok": True}


# ─────────────────────────────────────
#  /api/clients
# ─────────────────────────────────────
@app.get("/api/clients")
def get_clients():
    return rdata()["clients"]


@app.post("/api/clients", status_code=201)
def create_client(client: dict):
    data = rdata()
    if any(c["codi"] == client.get("codi") for c in data["clients"]):
        raise HTTPException(400, f"Ja existeix un client amb codi {client.get('codi')}")
    data["clients"].append(client)
    _recalc_community(data, client["comunitat"])
    wdata(data)
    return client


@app.put("/api/clients/{codi}")
def update_client(codi: str, client: dict):
    data = rdata()
    idx = next((i for i, c in enumerate(data["clients"]) if c["codi"] == codi), None)
    if idx is None:
        raise HTTPException(404, "Client no trobat")
    old_comm = data["clients"][idx].get("comunitat")
    data["clients"][idx] = client
    _recalc_community(data, client["comunitat"])
    if old_comm and old_comm != client["comunitat"]:
        _recalc_community(data, old_comm)
    wdata(data)
    return data["clients"][idx]


@app.delete("/api/clients/{codi}")
def delete_client(codi: str):
    data = rdata()
    client = next((c for c in data["clients"] if c["codi"] == codi), None)
    if client:
        data["clients"] = [c for c in data["clients"] if c["codi"] != codi]
        _recalc_community(data, client["comunitat"])
        wdata(data)
    return {"ok": True}
