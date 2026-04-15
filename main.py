from supabase import create_client

SUPABASE_URL = "https://kgjdbdgtgaqyrumgisqc.supabase.co"
SUPABASE_KEY = "sb_publishable_1gErmWZBnUObXQPEgMHamQ_fSvIu7zr"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


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



# ─────────────────────────────────────
#  Helpers de dades
# ─────────────────────────────────────

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
    res = supabase.table("communities").select("*").execute()
    return res.data


@app.post("/api/communities", status_code=201)
def create_community(comm: dict):
    existing = supabase.table("communities") \
        .select("id") \
        .eq("id", comm.get("id")) \
        .execute()

    if existing.data:
        raise HTTPException(400, f"Ja existeix una comunitat amb ID {comm.get('id')}")

    supabase.table("communities").insert(comm).execute()
    return comm


@app.put("/api/communities/{comm_id}")
def update_community(comm_id: str, comm: dict):
    res = supabase.table("communities") \
        .update(comm) \
        .eq("id", comm_id) \
        .execute()

    if not res.data:
        raise HTTPException(404, "Comunitat no trobada")

    return res.data[0]


@app.delete("/api/communities/{comm_id}")
def delete_community(comm_id: str):
    supabase.table("communities").delete().eq("id", comm_id).execute()
    supabase.table("clients").delete().eq("comunitat", comm_id).execute()
    return {"ok": True}


# ─────────────────────────────────────
#  /api/clients
# ─────────────────────────────────────
@app.get("/api/clients")
def get_clients():
    res = supabase.table("clients").select("*").execute()
    return res.data


@app.post("/api/clients", status_code=201)
def create_client(client: dict):
    existing = supabase.table("clients") \
        .select("codi") \
        .eq("codi", client.get("codi")) \
        .execute()

    if existing.data:
        raise HTTPException(400, f"Ja existeix un client amb codi {client.get('codi')}")

    supabase.table("clients").insert(client).execute()
    return client


@app.put("/api/clients/{codi}")
def update_client(codi: str, client: dict):
    res = supabase.table("clients") \
        .update(client) \
        .eq("codi", codi) \
        .execute()

    if not res.data:
        raise HTTPException(404, "Client no trobat")

    return res.data[0]


@app.delete("/api/clients/{codi}")
def delete_client(codi: str):
    supabase.table("clients").delete().eq("codi", codi).execute()
    return {"ok": True}
