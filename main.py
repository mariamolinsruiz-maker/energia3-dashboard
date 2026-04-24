"""
ComunitatES · main.py
FastAPI — serveix l'HTML, /api/communities, /api/clients, /api/energy
"""
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client
import pathlib

# ─────────────────────────────────────────────────────────────
#  Supabase
# ─────────────────────────────────────────────────────────────

SUPABASE_URL = "https://kgjdbdgtgaqyrumgisqc.supabase.co"
SUPABASE_KEY = "sb_publishable_1gErmWZBnUObXQPEgMHamQ_fSvIu7zr"
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─────────────────────────────────────────────────────────────
#  App
# ─────────────────────────────────────────────────────────────

app = FastAPI(title="ComunitatES API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")

# ─────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────

def parse_float(value):
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    value = str(value).replace("kW", "").replace(",", ".").strip()
    try:
        return float(value)
    except ValueError:
        return 0.0

def parse_int(value, default=0):
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default

# ─────────────────────────────────────────────────────────────
#  Ruta principal
# ─────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
def root():
    html = pathlib.Path("static/index.html").read_text(encoding="utf-8")
    html = html.replace("</body>", '<script src="/static/app.js"></script>\n</body>', 1)
    return HTMLResponse(content=html)


@app.get("/health")
def health():
    return {"status": "ok"}


# ─────────────────────────────────────────────────────────────
#  /api/communities
# ─────────────────────────────────────────────────────────────

@app.get("/api/communities")
def get_communities():
    res = supabase.table("communities").select("*").execute()
    return res.data


@app.post("/api/communities", status_code=201)
def create_community(comm: dict):
    try:
        clean = {}

        clean["id"]       = str(comm.get("id", ""))
        clean["nom"]      = str(comm.get("nom", ""))
        clean["adreca"]   = str(comm.get("adreca", ""))
        clean["promotor"] = str(comm.get("promotor", ""))
        clean["contacte"] = str(comm.get("contacte", ""))
        clean["email"]    = str(comm.get("email", ""))
        clean["telefon"]  = str(comm.get("telefon", ""))

        clean["lat"]      = parse_float(comm.get("lat"))
        clean["lng"]      = parse_float(comm.get("lng"))
        clean["color"]    = str(comm.get("color", "#1B4D31"))

        # Dades de la instal·lació (camps existents a Supabase)
        clean["potencia"]            = parse_float(comm.get("potencia"))
        clean["producció_anual_kwh"] = parse_float(comm.get("producció_anual_kwh"))
        clean["cups_generacio"]      = str(comm.get("cups_generacio", ""))
        clean["inversor_marca"]      = str(comm.get("inversor_marca", ""))
        clean["inversor_model"]      = str(comm.get("inversor_model", ""))

        clean["onboarding"]      = str(comm.get("onboarding", "Obert"))
        clean["acord_reparto"]   = str(comm.get("acord_reparto", "Pendent"))
        clean["fi_inscripcions"] = str(comm.get("fi_inscripcions", ""))
        clean["informe_auto"]    = str(comm.get("informe_auto", ""))
        clean["marca_blanca"]    = str(comm.get("marca_blanca", ""))

        clean["clients_actius"]      = parse_int(comm.get("clients_actius"))
        clean["inscrits"]            = parse_int(comm.get("inscrits"))
        clean["cups_auth_actius"]    = parse_int(comm.get("cups_auth_actius"))
        clean["cups_auth_proposats"] = parse_int(comm.get("cups_auth_proposats"))
        clean["sense_auth"]          = parse_int(comm.get("sense_auth"))
        clean["datadis_actius"]      = parse_int(comm.get("datadis_actius"))
        clean["clients_app"]         = parse_int(comm.get("clients_app"))
        clean["sense_dades"]         = parse_int(comm.get("sense_dades"))
        clean["sol_licituds"]        = parse_int(comm.get("sol_licituds"))
        clean["autoconsumos"]        = str(comm.get("autoconsumos", "0/0"))
        clean["total_clients"]       = parse_int(comm.get("total_clients"))
        clean["total_kw"]            = parse_float(comm.get("total_kw"))
        clean["total_estalvi"]       = parse_float(comm.get("total_estalvi"))

        print("INSERT community:", clean)
        res = supabase.table("communities").insert(clean).execute()
        return res.data

    except Exception as e:
        print("ERROR CREATE COMMUNITY:", e)
        raise HTTPException(500, str(e))


@app.put("/api/communities/{comm_id}")
def update_community(comm_id: str, comm: dict):
    try:
        clean = {}

        clean["nom"]      = str(comm.get("nom", ""))
        clean["promotor"] = str(comm.get("promotor", ""))
        clean["adreca"]   = str(comm.get("adreca", ""))
        clean["contacte"] = str(comm.get("contacte", ""))
        clean["email"]    = str(comm.get("email", ""))
        clean["telefon"]  = str(comm.get("telefon", ""))

        clean["lat"]      = parse_float(comm.get("lat"))
        clean["lng"]      = parse_float(comm.get("lng"))
        clean["color"]    = str(comm.get("color", "#1B4D31"))

        # Dades de la instal·lació (camps existents a Supabase)
        clean["potencia"]            = parse_float(comm.get("potencia"))
        clean["producció_anual_kwh"] = parse_float(comm.get("producció_anual_kwh"))
        clean["cups_generacio"]      = str(comm.get("cups_generacio", ""))
        clean["inversor_marca"]      = str(comm.get("inversor_marca", ""))
        clean["inversor_model"]      = str(comm.get("inversor_model", ""))

        clean["onboarding"]      = str(comm.get("onboarding", ""))
        clean["acord_reparto"]   = str(comm.get("acord_reparto", ""))
        clean["fi_inscripcions"] = str(comm.get("fi_inscripcions", ""))
        clean["informe_auto"]    = str(comm.get("informe_auto", ""))
        clean["marca_blanca"]    = str(comm.get("marca_blanca", ""))

        clean["total_clients"] = parse_int(comm.get("total_clients"))
        clean["total_kw"]      = parse_float(comm.get("total_kw"))
        clean["total_estalvi"] = parse_float(comm.get("total_estalvi"))

        res = supabase.table("communities").update(clean).eq("id", comm_id).execute()

        if not res.data:
            raise HTTPException(404, "Comunitat no trobada")

        return res.data[0]

    except HTTPException:
        raise
    except Exception as e:
        print("ERROR UPDATE COMMUNITY:", e)
        raise HTTPException(500, str(e))


@app.delete("/api/communities/{comm_id}")
def delete_community(comm_id: str):
    supabase.table("clients").delete().eq("comunitat", comm_id).execute()
    supabase.table("communities").delete().eq("id", comm_id).execute()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────
#  /api/clients
# ─────────────────────────────────────────────────────────────

@app.get("/api/clients")
def get_clients():
    res = supabase.table("clients").select("*").execute()
    return res.data


@app.post("/api/clients", status_code=201)
def create_client(client: dict):
    existing = supabase.table("clients").select("codi").eq("codi", client.get("codi")).execute()
    if existing.data:
        raise HTTPException(400, f"Ja existeix un client amb codi {client.get('codi')}")
    supabase.table("clients").insert(client).execute()
    return client


@app.put("/api/clients/{codi}")
def update_client(codi: str, client: dict):
    res = supabase.table("clients").update(client).eq("codi", codi).execute()
    if not res.data:
        raise HTTPException(404, "Client no trobat")
    return res.data[0]


@app.delete("/api/clients/{codi}")
def delete_client(codi: str):
    supabase.table("clients").delete().eq("codi", codi).execute()
    return {"ok": True}

# ─────────────────────────────────────────────────────────────
#  /api/studies
# ─────────────────────────────────────────────────────────────

@app.get("/api/studies")
def get_studies():
    res = supabase.table("studies").select("*").execute()
    return res.data


@app.post("/api/studies", status_code=201)
def create_study(data: dict):
    res = supabase.table("studies").insert(data).execute()
    return res.data

# ─────────────────────────────────────────────────────────────
#  /api/energy/{comm_id}
# ─────────────────────────────────────────────────────────────

@app.get("/api/energy/{comm_id}")
def get_energy(comm_id: str, start: str = None, end: str = None):
    # 1. Obtenir codis de clients de la comunitat
    clients_res = supabase.table("clients").select("codi").eq("comunitat", comm_id).execute()
    client_codis = [c["codi"] for c in clients_res.data]

    print("CLIENT CODIS:", client_codis)

    if not client_codis:
        return {"labels": [], "autoconsum": [], "excedent": [], "estalvi_total": 0}

    # 2. Obtenir totes les dades d'energia (sense filtre de data a la query)
    res = supabase.table("clients_energy") \
        .select("*") \
        .in_("codi", client_codis) \
        .order("year", desc=False) \
        .order("month", desc=False) \
        .execute()

    rows = res.data
    print("ROWS ENERGY (total):", len(rows))

    # 3. Filtre de dates en Python (evita problemes de rang any/mes a Supabase)
    if start:
        try:
            y_s, m_s = map(int, start.split("-"))
            start_key = y_s * 100 + m_s
            rows = [r for r in rows if r.get("year", 0) * 100 + r.get("month", 0) >= start_key]
        except ValueError:
            pass  # ignorar dates mal formades

    if end:
        try:
            y_e, m_e = map(int, end.split("-"))
            end_key = y_e * 100 + m_e
            rows = [r for r in rows if r.get("year", 0) * 100 + r.get("month", 0) <= end_key]
        except ValueError:
            pass

    print("ROWS ENERGY (filtrats):", len(rows))

    # 4. Agrupar per mes
    data_by_month = {}
    for r in rows:
        key = f"{r['year']}-{r['month']:02d}"
        if key not in data_by_month:
            data_by_month[key] = {
                "autoconsum": 0,
                "consum": 0,
                "estalvi_brut": 0,
                "estalvi_net": 0,
            }
        data_by_month[key]["autoconsum"] += r.get("autoconsum_kwh", 0) or 0
        data_by_month[key]["consum"]     += r.get("consum_kwh", 0) or 0
        data_by_month[key]["estalvi_brut"] += r.get("estalvi_mes", 0) or 0
        data_by_month[key]["estalvi_net"]  += r.get("estalvi_net", 0) or 0
    
    # 5. Format final
    labels = sorted(data_by_month.keys())
    return {
        "labels": labels,
        "autoconsum": [data_by_month[k]["autoconsum"] for k in labels],
        "consum": [data_by_month[k]["consum"] for k in labels],
        "estalvi_brut": [data_by_month[k]["estalvi_brut"] for k in labels],
        "estalvi_net": [data_by_month[k]["estalvi_net"] for k in labels],
        "estalvi_brut_total": sum(data_by_month[k]["estalvi_brut"] for k in labels),
        "estalvi_net_total": sum(data_by_month[k]["estalvi_net"] for k in labels),
        "consum_total": sum(data_by_month[k]["consum"] for k in labels),
        "autoconsum_total": sum(data_by_month[k]["autoconsum"] for k in labels)
    }


# ─────────────────────────────────────────────────────────────
#  /api/energy/debug/{comm_id} — diagnòstic (eliminar en producció)
# ─────────────────────────────────────────────────────────────

@app.get("/api/energy/debug/{comm_id}")
def debug_energy(comm_id: str):
    """Retorna els codis de clients i les files d'energia disponibles."""
    clients_res = supabase.table("clients").select("codi").eq("comunitat", comm_id).execute()
    client_codis = [c["codi"] for c in clients_res.data]

    energy_res = supabase.table("clients_energy").select("codi,year,month").execute()
    energy_codis = list({r["codi"] for r in energy_res.data})

    matching = [c for c in client_codis if c in energy_codis]

    return {
        "community": comm_id,
        "client_codis": client_codis,
        "energy_codis_available": energy_codis,
        "matching_codis": matching,
        "total_energy_rows": len(energy_res.data),
    }


# ─────────────────────────────────────────────────────────────
#  /api/agreements  &  /api/incidents
# ─────────────────────────────────────────────────────────────

@app.get("/api/agreements")
def get_agreements():
    res = supabase.table("agreements").select("*").execute()
    return res.data


@app.get("/api/incidents")
def get_incidents():
    res = supabase.table("incidents").select("*").execute()
    return res.data
    
# ─────────────────────────────────────────────────────────────
#  studies
# ─────────────────────────────────────────────────────────────

@app.post("/api/studies")
async def create_study(data: dict):
    res = supabase.table("studies").insert(data).execute()
    return res.data

@app.get("/api/studies")
async def get_studies():
    res = supabase.table("studies").select("*").execute()
    return res.data

from fastapi import UploadFile, File

@app.post("/api/studies/{study_id}/upload")
async def upload_study_file(study_id: str, file: UploadFile = File(...)):
    path = f"studies/{study_id}/{file.filename}"
    content = await file.read()

    supabase.storage.from_("files").upload(path, content)

    supabase.table("study_files").insert({
        "study_id": study_id,
        "file_url": path
    }).execute()

    return {"ok": True}
