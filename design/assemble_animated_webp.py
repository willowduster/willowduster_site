"""
assemble_animated_webp.py — Combine frame PNGs into a looping animated WebP.

Animated WebP plays natively in all modern browsers with smooth inter-frame
interpolation and excellent compression for sparse RGBA content (wireframes
on transparent backgrounds).

Includes an optional motion-trail effect that composites fading ghosts of
previous frames behind the current one, creating a glowing afterimage.

Usage (called by render_all_models.py, not typically run directly):
  python assemble_animated_webp.py <frames_dir> <output.webp> [size] [fps] [trail]

Arguments:
  frames_dir  — directory with frame_0000.png … frame_NNNN.png
  output.webp — output animated WebP path
  size        — optional final frame size in px (default: keep original)
  fps         — optional playback framerate (default: 18)
  trail       — number of ghost frames for motion trail (default: 4, 0=off)

Requires: Pillow  (pip install Pillow)
"""

import sys
import os
import glob
from PIL import Image, ImageEnhance

def apply_motion_trail(frames, trail_count):
    """
    For each frame, composite 'trail_count' previous frames underneath
    with exponentially decreasing opacity, creating a ghosting trail.
    The animation is cyclic so frame 0 wraps around to the end.
    """
    if trail_count <= 0:
        return frames

    n = len(frames)
    result = []

    for i in range(n):
        # Start with a blank transparent canvas
        canvas = Image.new("RGBA", frames[i].size, (0, 0, 0, 0))

        # Draw ghost frames from oldest to newest (so newest is on top)
        for g in range(trail_count, 0, -1):
            ghost_idx = (i - g) % n          # wrap around for cyclic loop
            ghost = frames[ghost_idx].copy()

            # Opacity falls off: oldest ghost is dimmest
            # e.g. trail_count=3: ghosts at ~8%, 15%, 22% opacity (subtle)
            opacity = 0.05 + (0.20 * (1 - g / (trail_count + 1)))
            # Scale the alpha channel
            alpha = ghost.split()[3]
            alpha = alpha.point(lambda a: int(a * opacity))
            ghost.putalpha(alpha)

            canvas = Image.alpha_composite(canvas, ghost)

        # Current frame at full opacity on top
        canvas = Image.alpha_composite(canvas, frames[i])
        result.append(canvas)

    return result

def main():
    if len(sys.argv) < 3:
        print("Usage: python assemble_animated_webp.py "
              "<frames_dir> <output.webp> [size] [fps] [trail]")
        sys.exit(1)

    frames_dir  = sys.argv[1]
    output_path = sys.argv[2]
    target_size = int(sys.argv[3]) if len(sys.argv) > 3 else None
    fps         = int(sys.argv[4]) if len(sys.argv) > 4 else 18
    trail       = int(sys.argv[5]) if len(sys.argv) > 5 else 4

    # Collect frames in order
    files = sorted(glob.glob(os.path.join(frames_dir, "frame_*.png")))
    if not files:
        print(f"ERROR: no frame_*.png in {frames_dir}")
        sys.exit(1)

    frames = [Image.open(f).convert("RGBA") for f in files]

    # Down-sample if requested (LANCZOS preserves wireframe crispness)
    if target_size:
        frames = [f.resize((target_size, target_size), Image.LANCZOS)
                  for f in frames]

    # Apply motion trail effect
    if trail > 0:
        frames = apply_motion_trail(frames, trail)

    # Frame duration in ms
    duration = round(1000 / fps)

    # Save animated WebP — lossy with high quality balances fidelity vs size
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    frames[0].save(
        output_path,
        format="WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=duration,
        loop=0,           # loop forever
        quality=75,        # lossy — great compression for wireframes
        method=4,          # encode effort (0=fast, 6=slowest/smallest)
        minimize_size=True,
    )

    total_kb = os.path.getsize(output_path) / 1024
    w, h = frames[0].size
    print(f"  OK {output_path}  ({w}x{h}, {len(frames)} frames, "
          f"{fps} fps, {total_kb:.1f} KB)")

if __name__ == "__main__":
    main()
