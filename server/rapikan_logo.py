# Rapikan logo dari screenshot: tepi buram/bergerigi → bentuk hitam & tulisan merah yang tajam dan halus.
# Pakai: python rapikan_logo.py logo_sumber.png  → logo.png (1000²), ikon-512.png, ikon-192.png
import sys, os
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

SKALA = 4                                   # kerjakan di 4× ukuran supaya tepi bisa dihaluskan
MERAH = np.array([226, 56, 52], dtype=np.float32)

def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

src = Image.open(sys.argv[1]).convert("RGB")
n = src.width * SKALA
img = np.asarray(src.resize((n, n), Image.LANCZOS), dtype=np.float32) / 255
r, g, b = img[..., 0], img[..., 1], img[..., 2]

kemerahan = r - (g + b) / 2                                   # tulisan "sport"
gelap = 1 - (0.299 * r + 0.587 * g + 0.114 * b)
# haluskan sedikit sebelum dipotong → gerigi & noise kompresi hilang, sudut tetap tajam
a_merah = smooth(gaussian_filter(kemerahan, 1.6 * SKALA / 4), 0.16, 0.30)
a_hitam = smooth(gaussian_filter(gelap, 0.9 * SKALA / 4), 0.42, 0.58) * (1 - smooth(kemerahan, 0.10, 0.22))

out = np.ones_like(img)
out = out * (1 - a_hitam[..., None])                           # hitam murni
out = out * (1 - a_merah[..., None]) + (MERAH / 255) * a_merah[..., None]
hasil = Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))

d = os.path.dirname(os.path.abspath(sys.argv[1]))
hasil.resize((1000, 1000), Image.LANCZOS).save(os.path.join(d, "logo.png"))
hasil.resize((512, 512), Image.LANCZOS).save(os.path.join(d, "ikon-512.png"))
hasil.resize((192, 192), Image.LANCZOS).save(os.path.join(d, "ikon-192.png"))
print("selesai")
