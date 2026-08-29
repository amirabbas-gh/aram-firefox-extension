#!/usr/bin/env python3
import math
import struct
import zlib
from pathlib import Path


def png(path, size, pixels):
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        raw.extend(pixels[y * size * 4 : (y + 1) * size * 4])

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    )


def sample(px, py, size):
    cream = (246, 240, 228)
    forest = (22, 53, 42)
    seed = (246, 240, 228)
    gold = (196, 164, 106)
    pad = size * 0.07
    radius = size * 0.22
    inside_x = pad <= px < size - pad
    inside_y = pad <= py < size - pad
    dx = min(px - pad, size - pad - 1 - px)
    dy = min(py - pad, size - pad - 1 - py)
    rounded = inside_x and inside_y and (dx >= radius or dy >= radius or math.hypot(max(0, radius - dx), max(0, radius - dy)) <= radius)
    if not rounded:
        return (*cream, 255)

    cx, cy = size / 2, size * 0.54
    leaf = ((px - cx) / (size * 0.17)) ** 2 + ((py - cy) / (size * 0.26)) ** 2 <= 1
    vein = abs(px - cx) < size * 0.018 and size * 0.32 < py < size * 0.76
    if leaf and vein:
        return (*gold, 255)
    if leaf:
        return (*seed, 255)
    return (*forest, 255)


def draw(size):
    scale = 4
    big = size * scale
    acc = [[0, 0, 0, 0] for _ in range(size * size)]
    for y in range(big):
        for x in range(big):
            r, g, b, a = sample(x / scale, y / scale, size)
            i = (y // scale) * size + (x // scale)
            acc[i][0] += r
            acc[i][1] += g
            acc[i][2] += b
            acc[i][3] += a
    pixels = bytearray()
    denom = scale * scale
    for rgba in acc:
        pixels.extend(int(channel / denom) for channel in rgba)
    return pixels


out = Path(__file__).resolve().parents[1] / "icons"
out.mkdir(exist_ok=True)
for size in (48, 96, 128):
    png(out / f"icon-{size}.png", size, draw(size))
print("icons ready")
