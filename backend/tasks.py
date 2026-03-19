import base64
import time
from io import BytesIO
from typing import Optional

from PIL import Image

from .celery_app import celery_app
from .inference import run_inference_sync


def _decode_image(image_b64: str) -> Image.Image:
    """Decode base64 (optionally data URL) to PIL Image RGB."""
    base64_data = image_b64
    if "," in image_b64 and image_b64.startswith("data:image"):
        _, base64_data = image_b64.split(",", 1)
    raw = base64.b64decode(base64_data)
    img = Image.open(BytesIO(raw)).convert("RGB")
    return img


@celery_app.task(bind=True)
def generate_face_task(self, image_b64: str, prompt: Optional[str] = None, style: Optional[str] = None):
    start = time.perf_counter()
    try:
        img = _decode_image(image_b64)
        output_b64, meta = run_inference_sync(img, prompt=prompt, style=style)
        duration_ms = int((time.perf_counter() - start) * 1000)
        return {
            "success": True,
            "queued": True,
            "job_id": self.request.id,
            "output": f"data:image/png;base64,{output_b64}",
            "inference_ms": duration_ms,
            "meta": meta,
        }
    except Exception as e:
        return {"success": False, "code": "task_error", "error": str(e), "job_id": self.request.id}
