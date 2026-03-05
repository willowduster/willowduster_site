#!/usr/bin/env python3
"""
render_all_models.py — Batch-render .blend models as neon wireframe animated
WebPs for the flying-wizard background effect.

Cross-platform (Windows / Linux / macOS).

Pipeline per model:
  1.  Blender (headless) → 36 rotation frames as PNGs   (render_wireframe.py)
  2.  Pillow            → animated WebP at 18 fps        (assemble_animated_webp.py)

Only processes models that already have a matching .webp in src/assets/
(i.e. models currently in use on the site).

Usage:
  python render_all_models.py                       # auto-detect Blender
  python render_all_models.py --blender /usr/bin/blender
  python render_all_models.py --size 128 --frames 24 --fps 12
  python render_all_models.py --models axe,sword-1  # render specific models only

Requirements:
  • Blender 4.x or 5.x (on PATH, or pass --blender)
  • Python 3.9+  with Pillow  (pip install Pillow)
"""

import argparse
import os
import platform
import random
import shutil
import subprocess
import sys
import tempfile

# ── Paths (relative to this script's location) ───────────────────────────────
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
MODELS_DIR   = os.path.join(SCRIPT_DIR, "models")
ASSETS_DIR   = os.path.join(PROJECT_ROOT, "src", "assets")

RENDER_PY   = os.path.join(SCRIPT_DIR, "render_wireframe.py")
ASSEMBLE_PY = os.path.join(SCRIPT_DIR, "assemble_animated_webp.py")

# Neon colours to cycle through (6-char hex, no #)
NEON_PALETTE = [
    "00FF2F", "00CCFF", "FF0080", "FF3300", "8000FF",
    "FFFF00", "00FFFF", "FF00FF", "66FF00", "FF8000",
]


def find_blender() -> str:
    """Auto-detect Blender executable."""
    # Check PATH first
    which = shutil.which("blender")
    if which:
        return which

    # Common install locations
    candidates = []
    if platform.system() == "Windows":
        base = os.path.join(os.environ.get("PROGRAMFILES", r"C:\Program Files"),
                            "Blender Foundation")
        if os.path.isdir(base):
            for d in sorted(os.listdir(base), reverse=True):
                candidates.append(os.path.join(base, d, "blender.exe"))
    elif platform.system() == "Darwin":
        candidates.append("/Applications/Blender.app/Contents/MacOS/Blender")
    else:
        candidates.extend(["/usr/bin/blender", "/snap/bin/blender"])

    for c in candidates:
        if os.path.isfile(c):
            return c

    return ""


def get_models_to_render(filter_names=None):
    """Return list of (name, blend_path) for models in use."""
    webp_names = {os.path.splitext(f)[0]
                  for f in os.listdir(ASSETS_DIR) if f.endswith(".webp")}
    blend_files = {os.path.splitext(f)[0]: os.path.join(MODELS_DIR, f)
                   for f in os.listdir(MODELS_DIR) if f.endswith(".blend")}

    matched = sorted(n for n in blend_files if n in webp_names)
    if filter_names:
        keep = set(filter_names)
        matched = [n for n in matched if n in keep]

    return [(n, blend_files[n]) for n in matched]


def main():
    parser = argparse.ArgumentParser(
        description="Batch-render .blend models as neon wireframe animated WebPs.")
    parser.add_argument("--blender", default="",
                        help="Path to blender executable (auto-detected if omitted)")
    parser.add_argument("--size", type=int, default=512,
                        help="Frame size in pixels (default: 512)")
    parser.add_argument("--frames", type=int, default=72,
                        help="Rotation frames per model (default: 72, ~5° per step)")
    parser.add_argument("--fps", type=int, default=10,
                        help="Playback framerate in animated WebP (default: 10)")
    parser.add_argument("--trail", type=int, default=3,
                        help="Motion trail ghost frames (default: 3, 0=off)")
    parser.add_argument("--models", default="",
                        help="Comma-separated model names to render (default: all in use)")
    args = parser.parse_args()

    blender = args.blender or find_blender()
    if not blender or not os.path.isfile(blender):
        print("ERROR: Blender not found. Install it or pass --blender <path>")
        sys.exit(1)
    print(f"Blender: {blender}")

    filter_names = [n.strip() for n in args.models.split(",") if n.strip()] or None
    models = get_models_to_render(filter_names)
    if not models:
        print("No matching models found.")
        sys.exit(0)

    print(f"Models to render: {len(models)}")
    trail_str = f", trail={args.trail}" if args.trail > 0 else ""
    print(f"Settings: {args.size}px, {args.frames} frames, {args.fps} fps{trail_str}\n")

    success = []
    failed  = []
    tmp_root = os.path.join(SCRIPT_DIR, "_render_temp")

    for idx, (name, blend_path) in enumerate(models, 1):
        colour = random.choice(NEON_PALETTE)
        frames_dir = os.path.join(tmp_root, name)
        output_webp = os.path.join(ASSETS_DIR, f"{name}.webp")

        print(f"[{idx}/{len(models)}]  {name}  (#{colour})")

        # Clean temp
        if os.path.isdir(frames_dir):
            shutil.rmtree(frames_dir)

        # Step 1: Render frames via Blender
        cmd = [
            blender, "--background",
            "--python", RENDER_PY,
            "--", blend_path, frames_dir,
            str(args.size), str(args.frames), colour,
        ]
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=300)
            # Print only progress lines
            for line in result.stdout.splitlines():
                if any(k in line for k in ["[", "DONE", "WARNING"]):
                    print(f"    {line.strip()}")
            if result.returncode != 0:
                # Show stderr for debugging
                for line in result.stderr.splitlines()[-5:]:
                    print(f"    ERR: {line}")
                raise RuntimeError(f"Blender exited with code {result.returncode}")
        except Exception as e:
            print(f"    FAILED: {e}")
            failed.append(name)
            continue

        # Verify frames exist
        frame0 = os.path.join(frames_dir, "frame_0000.png")
        if not os.path.isfile(frame0):
            print(f"    FAILED: no frames produced")
            failed.append(name)
            continue

        # Step 2: Assemble animated WebP
        try:
            result = subprocess.run(
                [sys.executable, ASSEMBLE_PY,
                 frames_dir, output_webp, str(args.size), str(args.fps),
                 str(args.trail)],
                capture_output=True, text=True, timeout=60)
            for line in result.stdout.splitlines():
                print(f"  {line}")
            if result.returncode != 0:
                raise RuntimeError(result.stderr.strip()[-200:])
        except Exception as e:
            print(f"    FAILED to assemble: {e}")
            failed.append(name)
            continue

        success.append(name)

    # Clean up temp
    if os.path.isdir(tmp_root):
        shutil.rmtree(tmp_root)

    # Summary
    print("\n" + "=" * 50)
    print(f"  Rendering complete!")
    print(f"  Success: {len(success)} / {len(models)}")
    if failed:
        print(f"  Failed:  {len(failed)}")
        for n in failed:
            print(f"    - {n}")
    print("=" * 50)


if __name__ == "__main__":
    main()
