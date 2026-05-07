"""
download_models.py  --  Downloads dlib model files needed for enrollment
Run once: python download_models.py
"""

import bz2, ssl, urllib.request
from pathlib import Path

# Fix SSL certificate verification failure on Python 3.13 / Windows
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode    = ssl.CERT_NONE
opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ssl_ctx))
urllib.request.install_opener(opener)

MODELS_DIR = Path("models")
MODELS_DIR.mkdir(exist_ok=True)

MODELS = [
    {
        "name": "shape_predictor_68_face_landmarks.dat",
        "url":  "https://github.com/davisking/dlib-models/raw/master/shape_predictor_68_face_landmarks.dat.bz2",
        "desc": "dlib 68-point face landmark predictor (~100 MB)",
    },
    {
        "name": "dlib_face_recognition_resnet_model_v1.dat",
        "url":  "https://github.com/davisking/dlib-models/raw/master/dlib_face_recognition_resnet_model_v1.dat.bz2",
        "desc": "dlib ResNet face recognition model (~22 MB)",
    },
]

def _progress(count, block, total):
    if total > 0:
        pct = min(100, count * block * 100 // total)
        print(f"\r    {pct}%...", end="", flush=True)

for m in MODELS:
    out  = MODELS_DIR / m["name"]
    bz2p = MODELS_DIR / (m["name"] + ".bz2")

    if out.exists():
        print(f"  [SKIP] {m['name']} already exists")
        continue

    print(f"  [DOWNLOAD] {m['desc']}")
    try:
        urllib.request.urlretrieve(m["url"], str(bz2p), reporthook=_progress)
        print()
    except Exception as e:
        print(f"\n  [ERROR] {e}")
        print(f"  Download manually from: {m['url']}")
        print(f"  Save the .bz2 file to: {bz2p}")
        continue

    print(f"  [EXTRACT] {m['name']}...")
    with bz2.open(str(bz2p), "rb") as fi, open(str(out), "wb") as fo:
        fo.write(fi.read())
    bz2p.unlink()
    print(f"  [OK] {m['name']}")

print("\nModels folder:")
for f in sorted(MODELS_DIR.iterdir()):
    print(f"  {f.name}  ({f.stat().st_size/1_048_576:.1f} MB)")
print("\nRun next: uvicorn biometric_service:app --port 8000 --host 0.0.0.0")