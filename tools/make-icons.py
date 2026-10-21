# Generates the app icon (skull + sword on a dark ember background).
from PIL import Image, ImageDraw, ImageFilter
import sys, os
S = 1024
img = Image.new('RGBA', (S, S))
d = ImageDraw.Draw(img)
for r in range(S // 2, 0, -2):
    t = r / (S / 2)
    c = (int(70 * (1 - t) + 12 * t), int(28 * (1 - t) + 10 * t), int(30 * (1 - t) + 18 * t), 255)
    d.ellipse([S/2 - r*1.45, S*0.52 - r*1.45, S/2 + r*1.45, S*0.52 + r*1.45], fill=c)
glow = Image.new('RGBA', (S, S), (0, 0, 0, 0)); gd = ImageDraw.Draw(glow)
gd.ellipse([S*0.2, S*0.2, S*0.8, S*0.8], fill=(255, 140, 50, 90))
img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(90)))
d = ImageDraw.Draw(img)
gold, gold2, dark = (226, 182, 92, 255), (250, 226, 160, 255), (40, 22, 12, 255)
# sword (vertical behind skull)
cx = S / 2
d.polygon([(cx - 34, S*0.12), (cx + 34, S*0.12), (cx + 34, S*0.70), (cx, S*0.80), (cx - 34, S*0.70)], fill=(200, 205, 215, 255), outline=dark)
d.line([(cx, S*0.13), (cx, S*0.72)], fill=(150, 155, 170, 255), width=8)
d.rounded_rectangle([cx - 170, S*0.72, cx + 170, S*0.765], 18, fill=gold, outline=dark, width=6)
d.rounded_rectangle([cx - 26, S*0.765, cx + 26, S*0.9], 10, fill=(90, 55, 30, 255), outline=dark, width=6)
d.ellipse([cx - 44, S*0.88, cx + 44, S*0.96], fill=gold2, outline=dark, width=6)
# skull
bone, shade = (238, 230, 210, 255), (190, 178, 150, 255)
d.ellipse([cx - 230, S*0.22, cx + 230, S*0.64], fill=bone, outline=dark, width=10)
d.rounded_rectangle([cx - 140, S*0.52, cx + 140, S*0.72], 40, fill=bone, outline=dark, width=10)
d.rectangle([cx - 128, S*0.50, cx + 128, S*0.60], fill=bone)
for sx in (-1, 1):
    d.ellipse([cx + sx*95 - 72, S*0.40, cx + sx*95 + 72, S*0.53], fill=(25, 10, 10, 255))
    d.ellipse([cx + sx*95 - 26, S*0.445, cx + sx*95 + 26, S*0.49], fill=(255, 90, 40, 255))
d.polygon([(cx, S*0.535), (cx - 30, S*0.59), (cx + 30, S*0.59)], fill=(30, 12, 10, 255))
for i in range(-2, 3):
    d.rounded_rectangle([cx + i*48 - 18, S*0.62, cx + i*48 + 18, S*0.70], 6, fill=bone, outline=dark, width=5)
out = sys.argv[1]
for size, name in [(512, 'icon-512.png'), (192, 'icon-192.png')]:
    img.resize((size, size), Image.LANCZOS).save(os.path.join(out, name))
img.save(os.path.join(out, 'icon-1024.png'))
print('ok')
