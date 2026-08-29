#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = Path("/Users/amir/.cursor/projects/Users-amir-Desktop-focus-extention/assets")
OUT = ROOT / "assets"
OUT.mkdir(exist_ok=True)

CREAM = (246, 235, 212, 255)
INK = (22, 53, 42, 255)
GOLD = (242, 193, 78, 255)
CLAY = (224, 122, 61, 255)
MINT = (126, 184, 162, 255)


def pixelate(im, cell=56, out=224):
    im = im.convert("RGBA")
    # flatten near-white studio backdrop to cream so sprites sit on our UI
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 10 and r > 220 and g > 205 and b > 175:
                px[x, y] = CREAM
    small = im.resize((cell, cell), Image.Resampling.BOX)
    return small.resize((out, out), Image.Resampling.NEAREST)


def save_png(name, source_name, cell=56):
    src = SRC / source_name
    img = pixelate(Image.open(src), cell=cell)
    img.save(OUT / name, "PNG")
    return img


def blink_frame(img):
    frame = img.copy()
    draw = ImageDraw.Draw(frame)
    # close the eyes with a clay line across the upper third
    w, h = frame.size
    y = int(h * 0.42)
    draw.rectangle((int(w * 0.34), y, int(w * 0.44), y + 6), fill=INK)
    draw.rectangle((int(w * 0.54), y, int(w * 0.64), y + 6), fill=INK)
    return frame


def hop_frame(img, dy):
    frame = Image.new("RGBA", img.size, CREAM)
    frame.paste(img, (0, dy), img)
    return frame


def steam_frame(img, phase):
    frame = img.copy()
    draw = ImageDraw.Draw(frame)
    w, h = frame.size
    dots = [
        (int(w * 0.46), int(h * 0.18) - phase * 6),
        (int(w * 0.54), int(h * 0.12) - phase * 8),
        (int(w * 0.50), int(h * 0.08) - phase * 4),
    ]
    for x, y in dots:
        draw.rectangle((x, y, x + 8, y + 8), fill=MINT)
    return frame


def sand_frame(img, phase):
    frame = img.copy()
    draw = ImageDraw.Draw(frame)
    w, h = frame.size
    y = int(h * (0.38 + phase * 0.08))
    draw.rectangle((int(w * 0.46), y, int(w * 0.54), y + 8), fill=GOLD)
    return frame


def gif(name, frames, duration=280):
    first, *rest = frames
    first.save(
        OUT / name,
        save_all=True,
        append_images=rest,
        duration=duration,
        loop=0,
        disposal=2,
        optimize=False,
    )


def tiny_star_gif():
    frames = []
    for on in (True, False, True, False):
        im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        if on:
            d.point([(8, 3), (8, 4), (7, 8), (8, 8), (9, 8), (8, 12), (4, 8), (12, 8)], fill=GOLD)
            d.point([(8, 8)], fill=CLAY)
        else:
            d.point([(8, 8), (8, 7), (8, 9), (7, 8), (9, 8)], fill=GOLD)
        frames.append(im.resize((48, 48), Image.Resampling.NEAREST))
    gif("sparkle.gif", frames, 220)


def tiny_heart_gif():
    frames = []
    heart = [
        "0011001100",
        "0111111110",
        "1111111111",
        "1111111111",
        "0111111110",
        "0011111100",
        "0001111000",
        "0000110000",
    ]
    for scale in (1, 1, 1):
        im = Image.new("RGBA", (12, 10), (0, 0, 0, 0))
        px = im.load()
        for y, row in enumerate(heart):
            for x, bit in enumerate(row):
                if bit == "1":
                    px[x, y] = CLAY if y < 3 else (198, 86, 74, 255)
        frames.append(im.resize((36, 30), Image.Resampling.NEAREST))
    # pulse: second frame slightly bigger via pad
    big = frames[0].resize((42, 36), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (42, 36), (0, 0, 0, 0))
    canvas.paste(frames[0], (3, 3), frames[0])
    gif("heart.gif", [canvas, big, canvas], 320)


bulbul = save_png("bulbul.png", "pixel-bulbul.png", 52)
book = save_png("book.png", "pixel-book.png", 52)
tea = save_png("tea.png", "pixel-tea.png", 48)
hour = save_png("hourglass.png", "pixel-hourglass.png", 48)
save_png("moon.png", "pixel-moon.png", 48)
save_png("flower.png", "pixel-flower.png", 48)

gif("bulbul.gif", [bulbul, blink_frame(bulbul), bulbul, hop_frame(bulbul, -8)], 260)
gif("book.gif", [book, hop_frame(book, -6), book, hop_frame(book, -2)], 240)
gif("tea.gif", [steam_frame(tea, 0), steam_frame(tea, 1), steam_frame(tea, 2), steam_frame(tea, 1)], 200)
gif("hourglass.gif", [sand_frame(hour, 0), sand_frame(hour, 1), sand_frame(hour, 2), sand_frame(hour, 1)], 280)
tiny_star_gif()
tiny_heart_gif()

save_png("gate.png", "pixel-gate.png", 48)
lantern = save_png("lantern.png", "pixel-lantern.png", 44)
save_png("pen.png", "pixel-pen.png", 44)
save_png("cypress.png", "pixel-cypress.png", 40)

glow = lantern.copy()
g = ImageDraw.Draw(glow)
w, h = glow.size
g.ellipse((int(w * 0.38), int(h * 0.42), int(w * 0.62), int(h * 0.68)), outline=GOLD)
gif("lantern.gif", [lantern, glow, lantern, hop_frame(lantern, -4)], 240)

tile = Image.new("RGBA", (16, 16), (243, 226, 196, 255))
td = ImageDraw.Draw(tile)
td.rectangle((0, 0, 15, 15), outline=INK)
td.point([(8, 3), (8, 12), (3, 8), (12, 8), (8, 8)], fill=GOLD)
td.point([(4, 4), (11, 4), (4, 11), (11, 11)], fill=CLAY)
tile.resize((48, 48), Image.Resampling.NEAREST).save(OUT / "tile.png")

seal = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
sd = ImageDraw.Draw(seal)
sd.ellipse((1, 1, 30, 30), fill=CLAY, outline=INK)
sd.ellipse((6, 6, 25, 25), outline=GOLD)
sd.rectangle((14, 10, 17, 22), fill=GOLD)
seal.resize((64, 64), Image.Resampling.NEAREST).save(OUT / "seal.png")

# toolbar icon from nightingale
icon = pixelate(Image.open(SRC / "pixel-bulbul.png"), cell=32, out=128)
for size in (48, 96, 128):
    icon.resize((size, size), Image.Resampling.NEAREST).save(ROOT / "icons" / f"icon-{size}.png")

print("pixel assets ready")
