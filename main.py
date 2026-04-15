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
@app.post("/api/communities", status_code=201)
def create_community(comm: dict):
    try:
        # 👇 neteja i tipus correctes
        clean = {}

        clean["id"] = str(comm.get("id"))
        clean["nom"] = str(comm.get("nom", ""))
        clean["adreca"] = str(comm.get("adreca", ""))
        clean["promotor"] = str(comm.get("promotor", ""))
        clean["contacte"] = str(comm.get("contacte", ""))
        clean["email"] = str(comm.get("email", ""))
        clean["telefon"] = str(comm.get("telefon", ""))

        clean["lat"] = float(comm.get("lat", 0))
        clean["lng"] = float(comm.get("lng", 0))
        clean["potencia"] = float(comm.get("potencia", 0))

        clean["color"] = str(comm.get("color", "#1B4D31"))

        clean["onboarding"] = str(comm.get("onboarding", "Obert"))
        clean["acord_reparto"] = str(comm.get("acord_reparto", "Pendent"))
        clean["fi_inscripcions"] = str(comm.get("fi_inscripcions", ""))
        clean["informe_auto"] = str(comm.get("informe_auto", ""))
        clean["marca_blanca"] = str(comm.get("marca_blanca", ""))

        # números
        clean["clients_actius"] = int(comm.get("clients_actius", 0))
        clean["inscrits"] = int(comm.get("inscrits", 0))
        clean["cups_auth_actius"] = int(comm.get("cups_auth_actius", 0))
        clean["cups_auth_proposats"] = int(comm.get("cups_auth_proposats", 0))
        clean["sense_auth"] = int(comm.get("sense_auth", 0))
        clean["datadis_actius"] = int(comm.get("datadis_actius", 0))
        clean["clients_app"] = int(comm.get("clients_app", 0))
        clean["sense_dades"] = int(comm.get("sense_dades", 0))
        clean["sol_licituds"] = int(comm.get("sol_licituds", 0))

        clean["autoconsumos"] = str(comm.get("autoconsumos", "0/0"))

        clean["total_clients"] = int(comm.get("total_clients", 0))
        clean["total_kw"] = float(comm.get("total_kw", 0))
        clean["total_estalvi"] = float(comm.get("total_estalvi", 0))

        print("INSERT:", clean)

        res = supabase.table("communities").insert(clean).execute()

        return res.data

    except Exception as e:
        print("ERROR REAL:", e)
        raise HTTPException(500, str(e))


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
