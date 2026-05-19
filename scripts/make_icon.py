"""Render tapedeck.ico (Windows) and tapedeck.icns (macOS) from the favicon design.

Run when the favicon changes.
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT_ICO = ROOT / "tapedeck.ico"
OUT_ICNS = ROOT / "tapedeck.icns"

BG = "#1a1a1a"
WHITE = "#fafafa"
ORANGE = "#e8a35c"

# Audio-waveform bars: mirrored top/bottom around y=16 in the 32x32 viewBox.
# (x_center, half_height, color). Heights vary to suggest a real audio peak shape.
BARS_DETAIL = [
    (4,  2.5,  WHITE),
    (8,  6,    WHITE),
    (12, 9.5,  WHITE),
    (16, 13,   ORANGE),
    (20, 7,    WHITE),
    (24, 11,   WHITE),
    (28, 4,    WHITE),
]
STROKE_DETAIL = 2.4

# Simplified 5-bar design used at small icon sizes where 7 bars would smear.
BARS_SMALL = [
    (5,  3,    WHITE),
    (11, 10,   WHITE),
    (16, 13,   ORANGE),
    (22, 6,    WHITE),
    (27, 8,    WHITE),
]
STROKE_SMALL = 3.2

CORNER = 7
CENTER_Y = 16


def render(size: int) -> Image.Image:
    bars, stroke = (BARS_SMALL, STROKE_SMALL) if size <= 24 else (BARS_DETAIL, STROKE_DETAIL)
    s = size * 4  # supersample for smooth edges, downsampled at the end
    scale = s / 32
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    draw.rounded_rectangle((0, 0, s - 1, s - 1), radius=CORNER * scale, fill=BG)

    half = (stroke * scale) / 2
    cy = CENTER_Y * scale
    for x, hh, color in bars:
        cx = x * scale
        ey1 = cy - hh * scale
        ey2 = cy + hh * scale
        draw.rectangle((cx - half, ey1, cx + half, ey2), fill=color)
        draw.ellipse((cx - half, ey1 - half, cx + half, ey1 + half), fill=color)
        draw.ellipse((cx - half, ey2 - half, cx + half, ey2 + half), fill=color)

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    frames = [render(s) for s in ico_sizes]
    # Pass each pre-rendered frame so PIL writes that exact image (not a downsample of 256).
    frames[-1].save(
        OUT_ICO,
        format="ICO",
        sizes=[(s, s) for s in ico_sizes],
        append_images=frames[:-1],
    )
    print(f"Wrote {OUT_ICO}")

    # macOS ICNS: needs a 1024x1024 master; PIL downsamples to required slots.
    master_1024 = render(1024)
    master_1024.save(OUT_ICNS, format="ICNS")
    print(f"Wrote {OUT_ICNS}")


if __name__ == "__main__":
    main()
