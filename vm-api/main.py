# vm-api/main.py

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import openstack
import os
import re
import logging
import traceback

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def load_openrc(path="~/highcloud-admin-openrc.sh"):
    with open(os.path.expanduser(path)) as f:
        content = f.read()
    for match in re.finditer(r'export\s+(\w+)="?([^"\n]+)"?', content):
        key, value = match.group(1), match.group(2)
        os.environ[key] = value

load_openrc()

def get_conn():
    return openstack.connect()

NETWORK_ID = "e702b8fe-c01c-4d3a-9f74-040da55f1cce"

class CreateInstanceRequest(BaseModel):
    name: str
    image: str
    flavor: str
    keypair: Optional[str] = None
    network_id: Optional[str] = None
    network_ids: Optional[list] = None
    security_group: Optional[str] = None
    security_groups: Optional[list] = None

@app.post("/create-instance")
def create_instance(req: CreateInstanceRequest):
    conn = get_conn()
    try:
        net_id = (req.network_ids[0] if req.network_ids else None) or req.network_id or NETWORK_ID

        sg_name = None
        if req.security_groups:
            sg = conn.network.get_security_group(req.security_groups[0])
            sg_name = sg.name if sg else 'default'
        elif req.security_group:
            sg_name = req.security_group
        else:
            sg_name = 'default'

        keypairs = list(conn.compute.keypairs())
        keypair_name = req.keypair if req.keypair else (keypairs[0].name if keypairs else None)
        if not keypair_name:
            raise HTTPException(status_code=400, detail="키페어를 먼저 생성해주세요.")

        server = conn.compute.create_server(
            name=req.name,
            flavor_id=req.flavor,
            image_id=req.image,
            networks=[{"uuid": net_id}],
            key_name=keypair_name,
            security_groups=[{"name": sg_name}],
        )

        return {
            "status": "success",
            "server_id": server.id,
            "name": req.name,
            "keypair": keypair_name,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/images")
def get_images():
    conn = get_conn()
    images = list(conn.image.images(status='active'))
    return [
        {
            "key": img.id,
            "label": img.name,
            "os_version": getattr(img, "os_version", "-"),
            "min_disk": f"{img.min_disk} GB",
            "visibility": "공용" if img.visibility == "public" else "비공개",
            "size": f"{round(img.size / 1024 / 1024, 2)} MiB" if img.size else "-",
        }
        for img in images
    ]

@app.get("/flavors")
def get_flavors():
    conn = get_conn()
    flavors = list(conn.compute.flavors())
    return [
        {
            "key": f.id,
            "label": f.name,
            "vcpu": f.vcpus,
            "ram": f"{round(f.ram / 1024)} GiB",
            "disk": f"{f.disk} GiB",
        }
        for f in flavors
        if not f.name.endswith('.bfv')
    ]

@app.get("/keypairs")
def get_keypairs():
    conn = get_conn()
    keypairs = list(conn.compute.keypairs())
    return [{"key": kp.name, "name": kp.name} for kp in keypairs]

@app.get("/networks")
def get_networks():
    conn = get_conn()
    networks = list(conn.network.networks())
    return [
        {
            "key": net.id,
            "id": net.id,
            "name": net.name,
            "shared": net.is_shared,
            "external": net.is_router_external,
            "status": net.status,
            "admin_state_up": net.is_admin_state_up,
        }
        for net in networks
    ]

@app.get("/security-groups")
def get_security_groups():
    conn = get_conn()
    project_id = conn.current_project_id
    sgs = list(conn.network.security_groups(project_id=project_id))
    return [
        {
            "key": sg.id,
            "name": sg.name,
            "description": sg.description,
        }
        for sg in sgs
    ]

@app.get("/quota")
def get_quota():
    conn = get_conn()
    try:
        limits = conn.compute.get_limits()
        absolute = limits.absolute
        return {
            "instances": {
                "used": absolute["totalInstancesUsed"],
                "max": absolute["maxTotalInstances"]
            },
            "cores": {
                "used": absolute["totalCoresUsed"],
                "max": absolute["maxTotalCores"]
            },
            "ram": {
                "used": absolute["totalRAMUsed"],
                "max": absolute["maxTotalRAMSize"]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))