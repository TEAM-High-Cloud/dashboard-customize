from fastapi import FastAPI, HTTPException, Header, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import openstack
import os
import re
import logging
import traceback
import base64
from openstack import connection
from keystoneauth1.identity import v3
from keystoneauth1 import session

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


AUTH_URL = "http://192.168.10.10:5000/v3"

def get_conn(token: str = None, project_id: str = None):
    if not token:
        raise HTTPException(status_code=401, detail="인증 토큰이 누락되었습니다.")
    
    try:
        if project_id:
            auth_plugin = v3.Token(
                auth_url=AUTH_URL,
                token=token,
                project_id=project_id,
                project_domain_id="10b5c69905f74f02b0d97b99a2f64910"
            )
        else:
            auth_plugin = v3.Token(
                auth_url=AUTH_URL,
                token=token,
            )
        os_session = session.Session(auth=auth_plugin)
        return connection.Connection(session=os_session, os_inherit=False)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"오픈스택 세션 생성 실패: {str(e)}")

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
    login_mode: Optional[str] = 'password'
    login_user: Optional[str] = 'ubuntu'
    login_password: Optional[str] = None
    volume_size: Optional[int] = None

@app.post("/create-instance")
def create_instance(req: CreateInstanceRequest, x_auth_token: Optional[str] = Header(None, alias="X-Auth-Token"),
    x_project_id: Optional[str] = Header(None, alias="X-Project-Id")):

    logger.info(f"token: {x_auth_token[:20] if x_auth_token else None}") ### log
    logger.info(f"project_id: {x_project_id}")

    conn = get_conn(token=x_auth_token, project_id=x_project_id)
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
        if req.login_mode == 'keypair':
            keypair_name = req.keypair if req.keypair else (keypairs[0].name if keypairs else None)
            if not keypair_name:
                raise HTTPException(status_code=400, detail="키페어를 먼저 생성해주세요.")
        else:
            keypair_name = keypairs[0].name if keypairs else None

        user_data = None
        if req.login_mode == 'password' and req.login_password:
            login_user = req.login_user or 'ubuntu'
            cloud_config = f"""#cloud-config
users:
  - name: {login_user}
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    lock_passwd: false
chpasswd:
  list: |
    {login_user}:{req.login_password}
  expire: false
ssh_pwauth: true
"""
            user_data = base64.b64encode(cloud_config.encode()).decode()

        server_kwargs = dict(
            name=req.name,
            flavor_id=req.flavor,
            networks=[{"uuid": net_id}],
            key_name=keypair_name,
            security_groups=[{"name": sg_name}],
        )

        if user_data:
            server_kwargs['user_data'] = user_data

        if req.volume_size:
            server_kwargs['block_device_mapping_v2'] = [{
                "boot_index": 0,
                "source_type": "image",
                "destination_type": "volume",
                "uuid": req.image,
                "volume_size": req.volume_size,
                "delete_on_termination": True,
            }]
        else:
            server_kwargs['image_id'] = req.image

        server = conn.compute.create_server(**server_kwargs)

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
def get_images(x_auth_token: Optional[str] = Header(None, alias="X-Auth-Token"),
    x_project_id: Optional[str] = Header(None, alias="X-Project-Id")):
    conn = get_conn(token=x_auth_token, project_id=x_project_id)
    images = list(conn.image.images(status='active'))
    return [
        {
            "key": img.id,
            "label": img.name,
            "os_version": getattr(img, "os_version", "-"),
            "min_disk": img.min_disk,
            "min_disk_label": f"{img.min_disk} GiB",
            "visibility": "공용" if img.visibility == "public" else "비공개",
            "size": f"{round(img.size / 1024 / 1024, 2)} MiB" if img.size else "-",
        }
        for img in images
    ]

@app.get("/flavors")
def get_flavors(x_auth_token: Optional[str] = Header(None, alias="X-Auth-Token"),
    x_project_id: Optional[str] = Header(None, alias="X-Project-Id")):
    conn = get_conn(token=x_auth_token, project_id=x_project_id)
    flavors = list(conn.compute.flavors())
    return [
        {
            "key": f.id,
            "label": f.name,
            "vcpu": f.vcpus,
            "ram": f"{round(f.ram / 1024)} GiB",
            "disk": f.disk,
            "disk_label": f"{f.disk} GiB",
        }
        for f in flavors
    ]

@app.get("/keypairs")
def get_keypairs(x_auth_token: Optional[str] = Header(None, alias="X-Auth-Token"),
    x_project_id: Optional[str] = Header(None, alias="X-Project-Id")):
    conn = get_conn(token=x_auth_token, project_id=x_project_id)
    keypairs = list(conn.compute.keypairs())
    return [{"key": kp.name, "name": kp.name} for kp in keypairs]

@app.get("/networks")
def get_networks(x_auth_token: Optional[str] = Header(None, alias="X-Auth-Token"),
    x_project_id: Optional[str] = Header(None, alias="X-Project-Id")):
    conn = get_conn(token=x_auth_token, project_id=x_project_id)
    networks = list(conn.network.networks())
    return [
        {
            "key": net.id,
            "id": net.id,
            "name": net.name if net.name else net.id,
            "label": net.name if net.name else net.id,
            "external": net.is_router_external,
            "status": net.status,
            "admin_state_up": net.is_admin_state_up,
        }
        for net in networks
    ]

@app.get("/security-groups")
def get_security_groups(x_auth_token: Optional[str] = Header(None, alias="X-Auth-Token"),
    x_project_id: Optional[str] = Header(None, alias="X-Project-Id")):
    conn = get_conn(token=x_auth_token, project_id=x_project_id)
    project_id = conn.current_project_id
    sgs = list(conn.network.security_groups(project_id=project_id))
    return [
        {
            "key": sg.id,
            "name": sg.name if sg.name else sg.id,
            "label": sg.name if sg.name else sg.id,
            "description": sg.description,
        }
        for sg in sgs
    ]

@app.get("/quota")
def get_quota(x_auth_token: Optional[str] = Header(None, alias="X-Auth-Token"),
    x_project_id: Optional[str] = Header(None, alias="X-Project-Id")):
    conn = get_conn(token=x_auth_token, project_id=x_project_id)
    try:
        limits = conn.compute.get_limits()
        absolute = limits.absolute
        
        vol_quota = conn.block_storage.get_quota_set(
            conn.current_project_id, usage=True
        )
        qs = vol_quota.quota_set if hasattr(vol_quota, 'quota_set') else vol_quota

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
            },
            "volumes": {
                "used": getattr(getattr(qs, 'volumes', None), 'in_use', 0) or 0,
                "max": getattr(getattr(qs, 'volumes', None), 'limit', 4) or 4,
            },
            "volume_gb": {
                "used": getattr(getattr(qs, 'gigabytes', None), 'in_use', 0) or 0,
                "max": getattr(getattr(qs, 'gigabytes', None), 'limit', 100) or 100,
            },
        }
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))