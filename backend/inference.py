import os
import time
from io import BytesIO
from typing import Optional, Tuple, Dict
import logging
import sys

# ---------------------------------------------------------------------------
# Self-contained logging setup for this module.
# Works whether loaded via main.py, uvicorn, PyCharm, or run standalone.
# We attach a handler directly to THIS logger so it never depends on the
# root logger having handlers or the right level set.
# ---------------------------------------------------------------------------
logger = logging.getLogger("backend.inference")
logger.setLevel(logging.INFO)
if not logger.handlers:
    _h = logging.StreamHandler(sys.stdout)  # stdout so PyCharm/uvicorn always captures it
    _h.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
    logger.addHandler(_h)
    logger.propagate = False  # prevent duplicate output if root also has a handler

# Disable tqdm BEFORE importing anything that uses it (unless user opts in)
SHOW_PROGRESS = os.getenv("SHOW_PROGRESS", "false").lower() in {"1", "true", "yes"}
os.environ["DIFFUSERS_VERBOSITY"] = "error"
os.environ["TRANSFORMERS_VERBOSITY"] = "error"
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"

from PIL import Image
import base64
import torch
from diffusers import StableDiffusionControlNetPipeline, ControlNetModel
from diffusers.utils import logging as diffusers_logging
from controlnet_aux import CannyDetector

# Disable diffusers progress bars globally
diffusers_logging.set_verbosity_error()


# Inference mode: 'local' or 'hf' (Hugging Face Hub)
INFERENCE_MODE = os.getenv("INFERENCE_MODE", "local").lower()
HF_API_TOKEN = os.getenv("HF_API_TOKEN")
HF_SD_REPO = os.getenv("HF_SD_REPO")
HF_CONTROLNET_REPO = os.getenv("HF_CONTROLNET_REPO",)

CONTROLNET_PATH = os.getenv("CONTROLNET_PATH")
SD_MODEL_PATH = os.getenv("SD_MODEL_PATH")
CANNY_LOW  = int(os.getenv("CANNY_LOW",  "50"))   # lower = catches more sketch lines
CANNY_HIGH = int(os.getenv("CANNY_HIGH", "150"))  # upper threshold for edge hysteresis

# Device/dtype selection
if torch.backends.mps.is_available():
    DEVICE = "mps"
    DTYPE = torch.float16
else:
    DEVICE = "cpu"
    DTYPE = torch.float32


if INFERENCE_MODE == "local":
    logger.info(f"[USAGE] Using LOCAL models: SD_MODEL_PATH={SD_MODEL_PATH}, CONTROLNET_PATH={CONTROLNET_PATH}")
    logger.info(f"Loading local models on {DEVICE} with dtype {DTYPE}...")
    controlnet = ControlNetModel.from_pretrained(CONTROLNET_PATH, torch_dtype=DTYPE)
    _pipe = StableDiffusionControlNetPipeline.from_pretrained(
        SD_MODEL_PATH,
        controlnet=controlnet,
        torch_dtype=DTYPE,
    )
    _pipe.to(DEVICE)
    _pipe.set_progress_bar_config(disable=not SHOW_PROGRESS)
    _canny = CannyDetector()
    logger.info("Local pipeline loaded and ready.")

elif INFERENCE_MODE == "hf":
    logger.info(f"[USAGE] Using Hugging Face Hub API: HF_SD_REPO={HF_SD_REPO}, HF_CONTROLNET_REPO={HF_CONTROLNET_REPO}")
    logger.info("Loading models from Hugging Face Hub API...")
    controlnet = ControlNetModel.from_pretrained(
        HF_CONTROLNET_REPO,
        torch_dtype=DTYPE,
        use_auth_token=HF_API_TOKEN if HF_API_TOKEN else None,
    )
    _pipe = StableDiffusionControlNetPipeline.from_pretrained(
        HF_SD_REPO,
        controlnet=controlnet,
        torch_dtype=DTYPE,
        use_auth_token=HF_API_TOKEN if HF_API_TOKEN else None,
    )
    _pipe.to(DEVICE)
    _pipe.set_progress_bar_config(disable=not SHOW_PROGRESS)
    _canny = CannyDetector()
    logger.info("Hugging Face Hub pipeline loaded and ready.")
else:
    raise ValueError(f"Unknown INFERENCE_MODE: {INFERENCE_MODE}")


def _build_prompt(user_prompt: Optional[str], style: Optional[str] = None) -> Tuple[str, Dict[str, str]]:
    base_prompt = (
        "front-facing photo of a real human, photorealistic, neutral expression, clear facial features, clean lighting, simple background"
    )
    negative_prompt = (
        "lowres, blurry, overexposed, underexposed, ghostly, plastic skin, waxy skin, cartoon, anime, horror, uncanny, extra limbs, deformed, distorted, watermark, text"
    )

    # Style presets to bias the image toward the requested look without drowning user prompt
    style_prompts = {
        "photorealistic": "DSLR look, natural skin texture, sharp eyes",
        "id-photo": "ID photo, even lighting, plain background",
        "anime": "anime style, clean lineart, smooth shading",
        "cinematic": "cinematic lighting, shallow depth of field",
        "artistic": "painterly, soft brush strokes",
    }

    meta: Dict[str, str] = {}
    user = user_prompt.strip() if user_prompt else ""

    # Add style hint if known
    def style_fragment(s: Optional[str]) -> str:
        if s and s in style_prompts:
            meta["style"] = s
            return style_prompts[s]
        return ""

    frag_style = style_fragment(style)

    if not user:
        # Frontend sent empty/missing prompt — use the base prompt as the full prompt.
        # Prepend the style preset if one was requested.
        final_prompt = ", ".join([c for c in [frag_style, base_prompt] if c])
        meta["prompt_truncated"] = "false"
        logger.info("[PROMPT] No user prompt received — using BASE prompt.")
        logger.info(f"[PROMPT] Style preset   : {meta.get('style', 'none')}")
    else:
        meta["user_prompt"] = user
        # Compose: user text first (highest priority), then style preset, then base anchor.
        components = [c for c in [user, frag_style, base_prompt] if c]
        final_prompt = ", ".join(components)
        logger.info("[PROMPT] User prompt received — composing with style preset + base anchor.")
        logger.info(f"[PROMPT] User text      : {user}")
        logger.info(f"[PROMPT] Style preset   : {meta.get('style', 'none')}")

        # Ensure we don't exceed the ~77-token CLIP budget.
        estimated_tokens = len(final_prompt.split()) / 0.75
        if estimated_tokens > 77:
            meta["prompt_truncated"] = "true"
            shorter_base = "photorealistic face, neutral expression, clean background"
            parts_short = [c for c in [user, frag_style, shorter_base] if c]
            final_prompt = ", ".join(parts_short)
            logger.warning(f"[PROMPT] Prompt exceeded ~77 tokens — truncated to shorter base.")
        else:
            meta["prompt_truncated"] = "false"

    meta["final_prompt"] = final_prompt
    meta["negative_prompt"] = negative_prompt
    logger.info(f"[PROMPT] Final prompt   : {final_prompt}")
    logger.info(f"[PROMPT] Negative prompt: {negative_prompt}")
    return final_prompt, meta


def run_inference_sync(sketch_img: Image.Image, prompt: Optional[str] = None, style: Optional[str] = None) -> Tuple[str, Dict[str, str]]:
    """
    Takes a PIL Image (RGB) sketch, runs ControlNet-guided SD inference,
    returns PNG base64 (without data URL header) and meta.
    """
    logger.info(
        f"=== BACKEND USAGE === Inference backend: {INFERENCE_MODE.upper()} "
        f"| SD_MODEL_PATH={SD_MODEL_PATH if INFERENCE_MODE == 'local' else HF_SD_REPO} "
        f"| CONTROLNET_PATH={CONTROLNET_PATH if INFERENCE_MODE == 'local' else HF_CONTROLNET_REPO}"
    )
    start = time.perf_counter()

    # Edge map via Canny — use sketch-tuned thresholds so ControlNet gets clean, full edges
    logger.info(f"[CANNY] Running edge detection | low_threshold={CANNY_LOW}, high_threshold={CANNY_HIGH}")
    control = _canny(sketch_img, low_threshold=CANNY_LOW, high_threshold=CANNY_HIGH)
    if control is None:
        raise RuntimeError("Canny detector returned None")

    # Prompt handling — pass style so the preset is included in the final prompt
    final_prompt, meta = _build_prompt(prompt if prompt else "", style=style)
    logger.info(
        f"[PIPELINE] Sending to pipeline "
        f"| prompt_truncated={meta.get('prompt_truncated')} "
        f"| style={meta.get('style', 'none')} "
        f"| user_prompt={'yes' if meta.get('user_prompt') else 'no (base used)'}"
    )

    # Pipeline inference with explicit disable_progress_bar
    logger.info(f"Starting inference with {int(os.getenv('NUM_STEPS', '20'))} steps...")
    
    # Ensure clean state
    if DEVICE == "mps":
        torch.mps.synchronize()
    
    result = _pipe(
        prompt=final_prompt,
        image=control,
        num_inference_steps=int(os.getenv("NUM_STEPS")),
        guidance_scale=float(os.getenv("GUIDANCE_SCALE")),
        controlnet_conditioning_scale=float(os.getenv("COND_SCALE")),
        negative_prompt=meta.get("negative_prompt"),
    ).images[0]
    
    logger.info("Inference completed.")
    
    # Clean up tensors if using MPS to prevent memory issues
    if DEVICE == "mps":
        torch.mps.synchronize()
        torch.mps.empty_cache()

    # Encode PNG to base64
    buf = BytesIO()
    result.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode("utf-8")

    meta["inference_ms_internal"] = str(int((time.perf_counter() - start) * 1000))
    return encoded, meta
