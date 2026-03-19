# FaceSketch — Sketch-to-Face Generation API

> **Convert hand-drawn face sketches into photorealistic portrait photos** using Stable Diffusion + ControlNet.

---

## Demo

| Sketch Input                                   | Generated Output                                 |
| ---------------------------------------------- | ------------------------------------------------ |
| <img src="assets/images-4.jpeg" width="300" /> | <img src="assets/ai_output-3.png" width="300" /> |

---

## What It Does

FaceSketch takes a user-drawn sketch and generates a photorealistic human face from it using a ControlNet-guided Stable Diffusion pipeline. Users can optionally provide a text prompt and style preset to guide the generation.

**Key capabilities:**

- 🎨 Sketch → photorealistic face via ControlNet (Canny edges)
- 📝 Optional text prompt and style preset support
- 👤 JWT-based user authentication and registration
- 🗄️ Per-user generation history stored in PostgreSQL
- ⚡ Optional async job queue via Celery + Redis
- 🔁 Switchable inference backend: local model weights or Hugging Face Hub API

---

## Architecture

```
Frontend (sketch canvas)
        │
        │  POST /generate  (base64 sketch + prompt + style)
        ▼
┌─────────────────────────────────────────┐
│              FastAPI Backend            │
│                                         │
│  ┌────────────────────────────────────┐ │
│  │         Inference Pipeline         │ │
│  │                                    │ │
│  │  sketch ──► CannyDetector          │ │
│  │                  │ edge map        │ │
│  │                  ▼                 │ │
│  │  prompt ──► _build_prompt()        │ │
│  │                  │ final prompt    │ │
│  │                  ▼                 │ │
│  │  ControlNetModel + SD Pipeline     │ │
│  │                  │                 │ │
│  │                  ▼                 │ │
│  │           PNG base64 output        │ │
│  └────────────────────────────────────┘ │
│                                         │
│  Auth: JWT  │  DB: PostgreSQL           │
│  Queue: Celery + Redis (optional)       │
└─────────────────────────────────────────┘
```

---

## Tech Stack

| Layer                | Technology                                           |
| -------------------- | ---------------------------------------------------- |
| API                  | FastAPI, Uvicorn                                     |
| ML Pipeline          | Stable Diffusion v1.x, ControlNet (Canny), Diffusers |
| Sketch Preprocessing | controlnet_aux `CannyDetector`                       |
| Auth                 | JWT (PyJWT), bcrypt (passlib)                        |
| Database             | PostgreSQL, SQLAlchemy                               |
| Queue                | Celery, Redis _(optional)_                           |
| Device               | Apple MPS (M-series Mac) or CPU                      |

---

## Setup

### 1. Clone and create a virtual environment

```bash
git clone https://github.com/Galiwer/sketchconvert.git
cd facesketch
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Download model weights

**Option A — Local (recommended for development)**

Download a photorealistic Stable Diffusion checkpoint (e.g. [Realistic Vision v5.1](https://civitai.com/models/4201)) and the [ControlNet Canny model](https://huggingface.co/lllyasviel/sd-controlnet-canny):

```
models/
├── stable-diffusion-v1-4/     ← or your photorealistic checkpoint
└── sd-controlnet-canny/
```

**Option B — Hugging Face Hub**

Set `INFERENCE_MODE=hf` in your `.env` and provide `HF_API_TOKEN`, `HF_SD_REPO`, and `HF_CONTROLNET_REPO`.

### 3. Configure environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Key variables:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/facesketch
INFERENCE_MODE=local           # 'local' or 'hf'
SD_MODEL_PATH=./models/stable-diffusion-v1-4
CONTROLNET_PATH=./models/sd-controlnet-canny
GUIDANCE_SCALE=7.0             # 6.5–7.5 for photorealism
COND_SCALE=0.8                 # 0.75–0.85 = sketch-faithful + realistic
NUM_STEPS=30
```

### 4. Set up the database

```bash
# Create the PostgreSQL database
createdb facesketch

# Tables are created automatically on first startup
```

### 5. Run the server

```bash
uvicorn main:app --reload --port 8000
```

---

## API Reference

### `POST /generate`

Generate a face from a sketch.

```json
{
  "image": "data:image/png;base64,...",
  "prompt": "young woman with glasses",
  "style": "cinematic"
}
```

**Styles:** `photorealistic` · `id-photo` · `anime` · `cinematic` · `artistic`

**Response:**

```json
{
  "success": true,
  "output": "data:image/png;base64,...",
  "inference_ms": 4200,
  "meta": {
    "final_prompt": "...",
    "negative_prompt": "...",
    "style": "cinematic",
    "prompt_truncated": "false"
  }
}
```

---

### Auth Routes

| Method  | Endpoint         | Description                    |
| ------- | ---------------- | ------------------------------ |
| `POST`  | `/auth/register` | Register with email + password |
| `POST`  | `/auth/login`    | Login, receive JWT token       |
| `GET`   | `/auth/me`       | Get current user profile       |
| `PATCH` | `/auth/me`       | Update profile / default style |

### Generation History Routes

| Method   | Endpoint            | Description                   |
| -------- | ------------------- | ----------------------------- |
| `POST`   | `/generations`      | Save a generation to history  |
| `GET`    | `/generations`      | List all generations for user |
| `GET`    | `/generations/{id}` | Get a specific generation     |
| `DELETE` | `/generations/{id}` | Delete a generation           |

---

## Inference Tuning Reference

| Parameter        | Range     | Effect                                                 |
| ---------------- | --------- | ------------------------------------------------------ |
| `GUIDANCE_SCALE` | 6.5 – 7.5 | Higher = more prompt-adherent but stylised             |
| `COND_SCALE`     | 0.6 – 1.0 | Lower = more realistic skin; higher = closer to sketch |
| `CANNY_LOW`      | 30 – 100  | Lower catches more sketch lines                        |
| `CANNY_HIGH`     | 100 – 200 | Keep ~3× `CANNY_LOW`                                   |
| `NUM_STEPS`      | 20 – 50   | More steps = sharper detail, slower                    |

---

## Running Tests

```bash
python -m pytest tests/ -v
```

Tests are designed to run without GPU or model weights via mocked ML dependencies.

---

## Project Structure

```
facesketch/
├── main.py          # FastAPI app, routes, auth
├── inference.py     # ControlNet + SD pipeline, prompt builder
├── db.py            # SQLAlchemy models (User, Generation)
├── auth.py          # JWT, password hashing
├── tasks.py         # Celery async task
├── celery_app.py    # Celery + Redis config
├── tests/
│   └── test_inference.py
├── models/          # Local model weights (gitignored)
├── requirements.txt
└── .env             # Local config (gitignored)
```

---

## Author

Built by [Your Name](https://github.com/Galiwer) · [LinkedIn](https://www.linkedin.com/in/omindukumara)
