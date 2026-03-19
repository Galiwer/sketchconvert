import os
import time
import base64
from io import BytesIO
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr
from PIL import Image
from dotenv import load_dotenv
from sqlalchemy.orm import Session

load_dotenv()

# Database and auth
from .db import get_db, init_db, User, Generation
from .auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    decode_access_token,
)

# Optional Celery integration
QUEUE_ENABLED = os.getenv("QUEUE_ENABLED", "false").lower() in {"1", "true", "yes"}
REDIS_URL = os.getenv("REDIS_URL")

app = FastAPI()

@app.on_event("startup")
def startup_event():
    init_db()
    logger.info("Database initialized")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CORS_ALLOW_ORIGINS", "*")],
    allow_methods=["*"],
    allow_headers=["*"]
)


class Sketch(BaseModel):
    image: str = Field(..., description="Base64 data URL or raw base64 of PNG/JPEG")
    prompt: Optional[str] = Field(None, description="Optional prompt text")
    style: Optional[str] = Field(None, description="Optional style preset")


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# Shared inference utilities
from .inference import run_inference_sync  # type: ignore

import logging
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("backend")


def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> Optional[User]:
    """Extract and validate JWT token, return User or None"""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    user = db.query(User).filter(User.id == int(user_id)).first()
    return user


def require_auth(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> User:
    """Require authenticated user or raise 401"""
    user = get_current_user(authorization, db)
    if not user:
        raise HTTPException(status_code=401, detail=_error("unauthorized", "Authentication required"))
    return user


def _error(code: str, message: str, details: Optional[str] = None):
    return {"success": False, "code": code, "error": message, "details": details}


def _validate_and_decode_image(image_b64: str, max_bytes: int = int(os.getenv("MAX_IMAGE_BYTES", str(5 * 1024 * 1024)))):
    if not image_b64 or len(image_b64) < 100:
        raise HTTPException(status_code=400, detail=_error("invalid_input", "Empty or too short image data"))

    header = ""
    base64_data = image_b64
    if "," in image_b64 and image_b64.startswith("data:image"):
        header, base64_data = image_b64.split(",", 1)
        if not (header.startswith("data:image/png") or header.startswith("data:image/jpeg")):
            raise HTTPException(status_code=415, detail=_error("unsupported_media_type", "Only PNG or JPEG data URLs are supported", header))

    try:
        raw = base64.b64decode(base64_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=_error("bad_base64", "Failed to decode base64 image", str(e)))

    if len(raw) > max_bytes:
        raise HTTPException(status_code=413, detail=_error("payload_too_large", f"Image too large (>{max_bytes} bytes)", f"size={len(raw)}"))

    try:
        img = Image.open(BytesIO(raw)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=_error("invalid_image", "Decoded bytes are not a valid PNG/JPEG", str(e)))

    return img


@app.post("/generate")
def generate(data: Sketch):
    start = time.perf_counter()
    logger.info("/generate start")
    logger.info({"prompt": data.prompt, "style": data.style, "image_len": len(data.image) if data.image else 0})
    if QUEUE_ENABLED:
        try:
            from .tasks import generate_face_task  # type: ignore
            task = generate_face_task.delay(data.image, data.prompt or None, data.style or None)
            duration_ms = int((time.perf_counter() - start) * 1000)
            logger.info({"event": "enqueue", "job_id": task.id, "enqueue_ms": duration_ms})
            return {"success": True, "queued": True, "job_id": task.id, "enqueue_ms": duration_ms}
        except Exception as e:
            logger.exception("Queue enqueue failed")
            raise HTTPException(status_code=500, detail=_error("queue_error", "Failed to enqueue job", str(e)))

    # Synchronous path
    try:
        img = _validate_and_decode_image(data.image)
        result_b64, meta = run_inference_sync(img, prompt=data.prompt, style=data.style)
        duration_ms = int((time.perf_counter() - start) * 1000)
        logger.info({"event": "inference_done", "inference_ms": duration_ms})
        return {
            "success": True,
            "queued": False,
            "output": f"data:image/png;base64,{result_b64}",
            "inference_ms": duration_ms,
            "meta": meta,
        }
    except HTTPException:
        # already structured
        raise
    except Exception as e:
        logger.exception("Inference error")
        raise HTTPException(status_code=500, detail=_error("inference_error", "Internal error during inference", str(e)))


@app.get("/status/{job_id}")
def status(job_id: str):
    if not QUEUE_ENABLED:
        raise HTTPException(status_code=400, detail=_error("queue_disabled", "Job queue is disabled"))
    try:
        from celery.result import AsyncResult  # type: ignore
        from .celery_app import celery_app  # type: ignore
        res = AsyncResult(job_id, app=celery_app)
        state = res.state
        logger.info({"event": "status", "job_id": job_id, "state": state})
        response = {"success": True, "state": state}
        if state == "SUCCESS":
            payload = res.get(propagate=False)
            response.update(payload)
        elif state == "FAILURE":
            response.update(_error("job_failed", "Job failed", str(res.info)))
        return response
    except Exception as e:
        logger.exception("Status check failed")
        raise HTTPException(status_code=500, detail=_error("status_error", "Failed to retrieve job status", str(e)))


# ============ AUTH ROUTES ============

@app.post("/auth/register", response_model=TokenResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    # Check if user exists
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail=_error("email_taken", "Email already registered"))
    
    # Create user
    user = User(
        email=req.email,
        full_name=req.full_name,
        hashed_password=get_password_hash(req.password),
        provider="email",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Generate token
    token = create_access_token(data={"sub": str(user.id)})
    return TokenResponse(
        access_token=token,
        user={"id": user.id, "email": user.email, "full_name": user.full_name},
    )


@app.post("/auth/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail=_error("invalid_credentials", "Invalid email or password"))
    
    if not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail=_error("invalid_credentials", "Invalid email or password"))
    
    token = create_access_token(data={"sub": str(user.id)})
    return TokenResponse(
        access_token=token,
        user={"id": user.id, "email": user.email, "full_name": user.full_name},
    )


@app.get("/auth/me")
def me(user: User = Depends(require_auth)):
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "default_style": user.default_style,
        "default_prompt": user.default_prompt,
    }


@app.patch("/auth/me")
def update_profile(updates: dict, user: User = Depends(require_auth), db: Session = Depends(get_db)):
    if "default_style" in updates:
        user.default_style = updates["default_style"]
    if "default_prompt" in updates:
        user.default_prompt = updates["default_prompt"]
    if "full_name" in updates:
        user.full_name = updates["full_name"]
    db.commit()
    return {"success": True, "user": {"id": user.id, "email": user.email, "full_name": user.full_name}}


# ============ GENERATION ROUTES ============

class SaveGenerationRequest(BaseModel):
    sketch_b64: str
    output_b64: str
    prompt: Optional[str] = None
    style: Optional[str] = None
    inference_ms: Optional[int] = None


@app.post("/generations")
def save_generation(
    req: SaveGenerationRequest,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db),
):
    """Save a generation to user's history"""
    logger.info(f"Saving generation for user {user.id}")
    gen = Generation(
        user_id=user.id,
        sketch_b64=req.sketch_b64,
        output_b64=req.output_b64,
        prompt=req.prompt,
        style=req.style,
        inference_ms=req.inference_ms,
    )
    db.add(gen)
    db.commit()
    db.refresh(gen)
    logger.info(f"Generation {gen.id} saved for user {user.id}")
    return {"success": True, "generation_id": gen.id}


@app.get("/generations")
def list_generations(user: User = Depends(require_auth), db: Session = Depends(get_db)):
    """Get all generations for the current user"""
    gens = db.query(Generation).filter(Generation.user_id == user.id).order_by(Generation.created_at.desc()).all()
    return {
        "success": True,
        "generations": [
            {
                "id": g.id,
                "sketch_b64": g.sketch_b64,
                "output_b64": g.output_b64,
                "prompt": g.prompt,
                "style": g.style,
                "inference_ms": g.inference_ms,
                "created_at": g.created_at.isoformat(),
            }
            for g in gens
        ],
    }


@app.get("/generations/{gen_id}")
def get_generation(gen_id: int, user: User = Depends(require_auth), db: Session = Depends(get_db)):
    """Get a specific generation"""
    gen = db.query(Generation).filter(Generation.id == gen_id, Generation.user_id == user.id).first()
    if not gen:
        raise HTTPException(status_code=404, detail=_error("not_found", "Generation not found"))
    return {
        "success": True,
        "generation": {
            "id": gen.id,
            "sketch_b64": gen.sketch_b64,
            "output_b64": gen.output_b64,
            "prompt": gen.prompt,
            "style": gen.style,
            "inference_ms": gen.inference_ms,
            "created_at": gen.created_at.isoformat(),
        },
    }


@app.delete("/generations/{gen_id}")
def delete_generation(gen_id: int, user: User = Depends(require_auth), db: Session = Depends(get_db)):
    """Delete a generation"""
    gen = db.query(Generation).filter(Generation.id == gen_id, Generation.user_id == user.id).first()
    if not gen:
        raise HTTPException(status_code=404, detail=_error("not_found", "Generation not found"))
    db.delete(gen)
    db.commit()
    return {"success": True}


os.environ["NUM_STEPS"] = "30"
