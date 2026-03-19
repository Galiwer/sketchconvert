"""
Unit tests for inference._build_prompt

Heavy ML dependencies (torch, diffusers, controlnet_aux) are patched at import
time so these tests run anywhere — no GPU, no model weights required.
"""

import sys
import types
import unittest
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# Stub out all heavy imports BEFORE inference.py is imported.
# This lets the module-level pipeline-loading code be skipped entirely.
# ---------------------------------------------------------------------------

def _make_stub(name: str):
    mod = types.ModuleType(name)
    mod.__spec__ = None
    return mod


# torch stub
torch_stub = _make_stub("torch")
torch_stub.float16 = "float16"
torch_stub.float32 = "float32"
torch_stub.backends = MagicMock()
torch_stub.backends.mps.is_available.return_value = False
torch_stub.mps = MagicMock()
sys.modules.setdefault("torch", torch_stub)

# diffusers stubs
for mod_name in [
    "diffusers",
    "diffusers.utils",
    "diffusers.utils.logging",
]:
    stub = _make_stub(mod_name)
    stub.StableDiffusionControlNetPipeline = MagicMock()
    stub.ControlNetModel = MagicMock()
    stub.set_verbosity_error = MagicMock()
    sys.modules.setdefault(mod_name, stub)

# controlnet_aux stub
cnet_stub = _make_stub("controlnet_aux")
cnet_stub.CannyDetector = MagicMock()
sys.modules.setdefault("controlnet_aux", cnet_stub)

# PIL stub (only needs Image)
pil_stub = _make_stub("PIL")
pil_image_stub = _make_stub("PIL.Image")
pil_image_stub.Image = MagicMock()
sys.modules.setdefault("PIL", pil_stub)
sys.modules.setdefault("PIL.Image", pil_image_stub)
pil_stub.Image = pil_image_stub

# Now we can safely import _build_prompt.
# Patch the module-level INFERENCE_MODE so the pipeline block is skipped.
with patch.dict(
    "os.environ",
    {
        "INFERENCE_MODE": "local",   # triggers the if-block
        "CONTROLNET_PATH": "/fake/controlnet",
        "SD_MODEL_PATH": "/fake/sd",
        "NUM_STEPS": "20",
        "GUIDANCE_SCALE": "7.0",
        "COND_SCALE": "0.8",
        "CANNY_LOW": "50",
        "CANNY_HIGH": "150",
    },
):
    # Prevent the actual ControlNetModel / Pipeline from being constructed
    with patch("diffusers.ControlNetModel") as _cn, \
         patch("diffusers.StableDiffusionControlNetPipeline") as _pipe:
        _cn.from_pretrained.return_value = MagicMock()
        _pipe.from_pretrained.return_value = MagicMock()
        import inference  # noqa: E402

_build_prompt = inference._build_prompt


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestBuildPromptEmptyInput(unittest.TestCase):
    """When the frontend sends nothing, the base prompt must be used."""

    def test_no_prompt_uses_base(self):
        final, meta = _build_prompt("")
        self.assertIn("photorealistic", final)
        self.assertIn("front-facing", final)

    def test_none_prompt_uses_base(self):
        final, meta = _build_prompt(None)
        self.assertIn("photorealistic", final)

    def test_whitespace_only_uses_base(self):
        final, meta = _build_prompt("   ")
        self.assertIn("front-facing", final)

    def test_empty_sets_no_user_prompt_in_meta(self):
        _, meta = _build_prompt("")
        self.assertNotIn("user_prompt", meta)

    def test_empty_prompt_not_truncated(self):
        _, meta = _build_prompt("")
        self.assertEqual(meta["prompt_truncated"], "false")

    def test_negative_prompt_always_present(self):
        _, meta = _build_prompt("")
        self.assertIn("negative_prompt", meta)
        self.assertGreater(len(meta["negative_prompt"]), 10)

    def test_final_prompt_stored_in_meta(self):
        final, meta = _build_prompt("")
        self.assertEqual(final, meta["final_prompt"])


class TestBuildPromptWithUserText(unittest.TestCase):
    """User prompt should appear first in the composed prompt."""

    def test_user_text_in_output(self):
        final, meta = _build_prompt("young woman with glasses")
        self.assertIn("young woman with glasses", final)

    def test_user_text_recorded_in_meta(self):
        _, meta = _build_prompt("young woman with glasses")
        self.assertEqual(meta["user_prompt"], "young woman with glasses")

    def test_user_text_appears_before_base(self):
        final, _ = _build_prompt("young woman with glasses")
        user_pos = final.index("young woman")
        base_pos = final.index("front-facing")
        self.assertLess(user_pos, base_pos)

    def test_strips_leading_whitespace(self):
        _, meta = _build_prompt("  portrait of a man  ")
        self.assertEqual(meta["user_prompt"], "portrait of a man")


class TestBuildPromptWithStyle(unittest.TestCase):
    """Known style presets should be injected into the prompt."""

    def test_known_style_injected(self):
        final, meta = _build_prompt("", style="cinematic")
        self.assertIn("cinematic", final)
        self.assertEqual(meta["style"], "cinematic")

    def test_unknown_style_ignored(self):
        final, meta = _build_prompt("", style="vaporwave")
        self.assertNotIn("style", meta)

    def test_style_with_user_prompt(self):
        final, meta = _build_prompt("portrait of a man", style="id-photo")
        self.assertIn("portrait of a man", final)
        self.assertIn("ID photo", final)
        self.assertEqual(meta["style"], "id-photo")

    def test_all_known_styles_accepted(self):
        known = ["photorealistic", "id-photo", "anime", "cinematic", "artistic"]
        for style in known:
            with self.subTest(style=style):
                _, meta = _build_prompt("", style=style)
                self.assertEqual(meta["style"], style)


class TestBuildPromptTokenBudget(unittest.TestCase):
    """Prompt should be truncated when it exceeds the CLIP token budget (~77)."""

    def _long_prompt(self, word_count: int) -> str:
        return " ".join(["word"] * word_count)

    def test_short_prompt_not_truncated(self):
        _, meta = _build_prompt("portrait")
        self.assertEqual(meta["prompt_truncated"], "false")

    def test_very_long_prompt_is_truncated(self):
        # 80+ word user prompt will push composed prompt past 77 tokens
        long = self._long_prompt(80)
        _, meta = _build_prompt(long)
        self.assertEqual(meta["prompt_truncated"], "true")

    def test_truncated_prompt_shorter_than_original(self):
        long = self._long_prompt(80)
        final_long, _ = _build_prompt(long)
        # The truncated version should be shorter than a non-padded composition
        _, meta = _build_prompt(long)
        self.assertLessEqual(len(meta["final_prompt"].split()), 100)


if __name__ == "__main__":
    unittest.main()
