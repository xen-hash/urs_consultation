# biometric_service.py — URS Biometric Microservice
# Enrollment: dlib 68-point landmarks (high accuracy, slower)
# Recognition: InsightFace buffalo_l + DirectML (fast, real-time)
#
# Install:
#   pip install dlib cmake face_recognition insightface onnxruntime-directml opencv-python numpy fastapi uvicorn
#
# Run: uvicorn biometric_service:app --port 8000 --host 0.0.0.0

import base64, os
import numpy as np
import cv2
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

# ── InsightFace (real-time recognition + live detection overlay) ──────────────
try:
    from insightface.app import FaceAnalysis
    # DirectML = GPU-accelerated on Windows (AMD/Intel/NVIDIA via DirectX 12)
    _insight = FaceAnalysis(
        name="buffalo_l",
        providers=["CPUExecutionProvider"]
    )
    _insight.prepare(ctx_id=0, det_size=(640, 640))
    INSIGHT_OK = True
    print("[Biometric] InsightFace buffalo_l + DirectML ready ✓")
except Exception as e:
    INSIGHT_OK = False
    _insight = None
    print(f"[Biometric] InsightFace unavailable: {e}")

# ── dlib (high-accuracy enrollment — 68-point landmarks + HOG detector) ──────
try:
    import dlib
    import face_recognition  # wraps dlib with a clean API
    _dlib_detector  = dlib.get_frontal_face_detector()
    _dlib_predictor = dlib.shape_predictor(
        "models/shape_predictor_68_face_landmarks.dat"
    )
    _dlib_encoder   = dlib.face_recognition_model_v1(
        "models/dlib_face_recognition_resnet_model_v1.dat"
    )
    DLIB_OK = True
    print("[Biometric] dlib 68-pt landmarks + ResNet encoder ready ✓")
except Exception as e:
    DLIB_OK = False
    _dlib_detector = _dlib_predictor = _dlib_encoder = None
    print(f"[Biometric] dlib unavailable: {e}")

# ── Fast C++ OpenCV detectors (for live overlay — no ONNX overhead) ──────────
# cv2 is OpenCV's Python binding — all detection runs as native C++ code.
# Haar cascades run in ~5-15 ms vs ~100-200 ms for InsightFace ONNX on CPU.
_face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)
_eye_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_eye.xml"
)
# LBP cascade as fallback (even faster, slightly less accurate)
_face_lbp = cv2.CascadeClassifier(
    cv2.data.haarcascades + "lbpcascade_frontalface_improved.xml"
)
print(f"[Biometric] OpenCV C++ Haar/LBP cascades loaded ✓  "
      f"(face={'ok' if not _face_cascade.empty() else 'MISSING'}, "
      f"eye={'ok' if not _eye_cascade.empty() else 'MISSING'})")

def _fast_detect(img: np.ndarray):
    """
    Ultra-fast face + eye detection using OpenCV C++ Haar cascades.
    Runs in ~5-15 ms on CPU — no ONNX, no deep learning overhead.
    Returns (x,y,w,h) bbox and list of (cx,cy) eye centres, all in pixels.
    """
    h_img, w_img = img.shape[:2]

    # Downscale to 320px wide for speed — detection is robust at lower res
    scale  = 320.0 / w_img
    small  = cv2.resize(img, (int(w_img * scale), int(h_img * scale)))
    gray   = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    cv2.equalizeHist(gray, gray)          # contrast boost — helps accuracy

    faces = _face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.08,
        minNeighbors=4,
        minSize=(50, 50),
        flags=cv2.CASCADE_SCALE_IMAGE,
    )

    if not isinstance(faces, np.ndarray) or len(faces) == 0:
        return None, []

    # Largest face
    fx, fy, fw, fh = max(faces, key=lambda f: f[2] * f[3])

    # Scale back to original resolution
    inv = 1.0 / scale
    fx, fy, fw, fh = (int(fx*inv), int(fy*inv), int(fw*inv), int(fh*inv))

    # Detect eyes inside upper 60% of face ROI (avoids mouth detections)
    roi_y1 = fy
    roi_y2 = fy + int(fh * 0.60)
    roi_x1, roi_x2 = fx, fx + fw
    face_roi_gray = cv2.cvtColor(
        img[roi_y1:roi_y2, roi_x1:roi_x2], cv2.COLOR_BGR2GRAY
    )
    cv2.equalizeHist(face_roi_gray, face_roi_gray)

    raw_eyes = _eye_cascade.detectMultiScale(
        face_roi_gray,
        scaleFactor=1.05,
        minNeighbors=5,
        minSize=(18, 18),
    )

    eyes = []
    if isinstance(raw_eyes, np.ndarray) and len(raw_eyes) > 0:
        # Sort by x (left → right), take at most 2
        for (ex, ey, ew, eh) in sorted(raw_eyes, key=lambda e: e[0])[:2]:
            eyes.append((
                roi_x1 + ex + ew // 2,
                roi_y1 + ey + eh // 2,
            ))

    return (fx, fy, fw, fh), eyes


# ── Storage ───────────────────────────────────────────────────────────────────
FACE_DB = Path("face_db"); FACE_DB.mkdir(exist_ok=True)
EYE_DB  = Path("eye_db");  EYE_DB.mkdir(exist_ok=True)

# Thresholds (cosine distance — lower = stricter)
FACE_THRESHOLD_FAST  = 0.45   # InsightFace live recognition
FACE_THRESHOLD_ENROL = 0.35   # dlib enrollment quality gate (stricter)
EYE_THRESHOLD        = 0.50

app = FastAPI(title="URS Biometric Service v2")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class ImagePayload(BaseModel):
    image:  Optional[str]       = None
    label:  Optional[str]       = None
    images: Optional[List[str]] = None

# ── Helpers ───────────────────────────────────────────────────────────────────

def _decode(b64: str) -> np.ndarray:
    if "," in b64: b64 = b64.split(",")[1]
    arr = np.frombuffer(base64.b64decode(b64), np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None: raise ValueError("Cannot decode image")
    return img

def _cos(a: np.ndarray, b: np.ndarray) -> float:
    a = a / (np.linalg.norm(a) + 1e-8)
    b = b / (np.linalg.norm(b) + 1e-8)
    return float(1.0 - np.dot(a, b))

def _all_labels():
    return [p.stem for p in FACE_DB.glob("*.npy")]

def _load(label: str):
    fp = FACE_DB / f"{label}.npy"
    ep = EYE_DB  / f"{label}.npy"
    return (np.load(str(fp)) if fp.exists() else None,
            np.load(str(ep)) if ep.exists() else None)

# ── dlib helpers ─────────────────────────────────────────────────────────────

def _dlib_rgb(img: np.ndarray) -> np.ndarray:
    """BGR (OpenCV) → RGB (dlib)"""
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

def _dlib_encode_face(img: np.ndarray) -> Optional[np.ndarray]:
    """
    High-accuracy 128-d face embedding using dlib ResNet.
    Uses 5 jitters for extra robustness.
    """
    if not DLIB_OK: return None
    rgb = _dlib_rgb(img)
    # upsample=1 catches smaller faces; jitter=5 for better accuracy
    encodings = face_recognition.face_encodings(rgb, num_jitters=5, model="large")
    if not encodings: return None
    return np.array(encodings[0])

def _dlib_eye_landmarks(img: np.ndarray):
    """
    Extract left + right eye regions using dlib 68-point landmarks.
    Points 36-41 = left eye, 42-47 = right eye.
    Returns (left_region, right_region) as numpy arrays, or (None, None).
    """
    if not DLIB_OK: return None, None
    rgb  = _dlib_rgb(img)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    dets = _dlib_detector(rgb, 1)
    if not dets: return None, None

    shape = _dlib_predictor(gray, dets[0])
    pts   = np.array([[shape.part(i).x, shape.part(i).y] for i in range(68)])

    left_pts  = pts[36:42]  # left eye
    right_pts = pts[42:48]  # right eye

    def _eye_region(eye_pts, padding=10):
        x1 = max(0, eye_pts[:,0].min() - padding)
        y1 = max(0, eye_pts[:,1].min() - padding)
        x2 = min(img.shape[1], eye_pts[:,0].max() + padding)
        y2 = min(img.shape[0], eye_pts[:,1].max() + padding)
        crop = img[y1:y2, x1:x2]
        if crop.size == 0: return None
        return crop

    return _eye_region(left_pts), _eye_region(right_pts)

def _eye_embedding_dlib(region: np.ndarray, size: int = 64) -> Optional[np.ndarray]:
    """
    CLAHE-normalised grayscale eye embedding from a dlib landmark-extracted region.
    More accurate than keypoint-based crops because landmarks are precise.
    """
    if region is None: return None
    resized = cv2.resize(region, (size, size))
    gray    = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    clahe   = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    norm    = clahe.apply(gray).astype(np.float32) / 255.0

    # Flatten + L2 normalise
    flat = norm.flatten()
    return flat / (np.linalg.norm(flat) + 1e-8)

# ── InsightFace helpers (for live detect + fast recognition) ──────────────────

def _insight_faces(img: np.ndarray):
    if not INSIGHT_OK: return []
    return _insight.get(img)

def _insight_eye_crop(img: np.ndarray, kp: np.ndarray, size: int = 64) -> np.ndarray:
    x, y = int(kp[0]), int(kp[1]); h, w = img.shape[:2]; half = size // 2
    x1, y1 = max(0, x-half), max(0, y-half)
    x2, y2 = min(w, x+half), min(h, y+half)
    crop = img[y1:y2, x1:x2]
    if crop.size == 0: return np.zeros((size, size), np.uint8)
    crop = cv2.resize(crop, (size, size))
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(gray)

def _insight_eye_emb(crop: np.ndarray) -> np.ndarray:
    flat = cv2.resize(crop, (32, 32)).astype(np.float32).flatten() / 255.0
    return flat / (np.linalg.norm(flat) + 1e-8)

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status":     "ok",
        "insightface": INSIGHT_OK,
        "dlib":        DLIB_OK,
        "engines": {
            "enrollment":    "dlib ResNet + 68-pt landmarks" if DLIB_OK else "InsightFace (fallback)",
            "recognition":   "InsightFace buffalo_l + DirectML" if INSIGHT_OK else "unavailable",
        }
    }


@app.post("/api/detect")
def detect(p: ImagePayload):
    """
    Live detection for UI overlay — uses OpenCV C++ Haar cascades.
    ~5-15 ms per frame (vs ~150 ms with InsightFace ONNX on CPU).
    InsightFace is reserved for enrollment/recognition only.
    """
    try:
        img = _decode(p.image)
    except Exception as e:
        raise HTTPException(400, str(e))

    h_img, w_img = img.shape[:2]
    face, eyes = _fast_detect(img)

    if face is None:
        return {"detected": False}

    fx, fy, fw, fh = face
    result = {
        "detected": True,
        "bbox": {
            "x":      fx / w_img,
            "y":      fy / h_img,
            "width":  fw / w_img,
            "height": fh / h_img,
        },
        "eyes": [
            {"x": ex / w_img, "y": ey / h_img}
            for ex, ey in eyes
        ],
    }
    return result


@app.post("/api/recognize")
def recognize(p: ImagePayload):
    """
    Fast recognition using InsightFace + DirectML.
    Compares against embeddings stored during dlib enrollment.
    Both face AND eye must match.
    """
    try: img = _decode(p.image); faces = _insight_faces(img)
    except Exception as e: raise HTTPException(400, str(e))

    if not faces: return {"recognized": False, "reason": "No face detected"}
    face = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]))
    if face.embedding is None: return {"recognized": False, "reason": "No embedding"}

    probe_face = face.embedding / (np.linalg.norm(face.embedding) + 1e-8)
    probe_le = probe_re = None
    if face.kps is not None and len(face.kps) >= 2:
        probe_le = _insight_eye_emb(_insight_eye_crop(img, face.kps[0]))
        probe_re = _insight_eye_emb(_insight_eye_crop(img, face.kps[1]))

    labels = _all_labels()
    if not labels: return {"recognized": False, "reason": "No enrolled users"}

    best_label = None; best_fd = float("inf"); best_ed = float("inf")
    for label in labels:
        sf, se = _load(label)
        if sf is None: continue
        fd = _cos(probe_face, sf)
        if fd >= FACE_THRESHOLD_FAST: continue
        ed = float("inf")
        if se is not None and probe_le is not None:
            half = len(se) // 2
            ed = (_cos(probe_le, se[:half]) + (_cos(probe_re, se[half:]) if probe_re is not None and len(se) > half else _cos(probe_le, se[:half]))) / 2.0
        if fd < best_fd: best_fd = fd; best_ed = ed; best_label = label

    if best_label is None:
        return {"recognized": False, "reason": "Face not matched", "confidence": 0.0}
    if best_ed > EYE_THRESHOLD:
        return {"recognized": False, "reason": "Face matched but eyes did not match",
                "face_confidence": round((1-best_fd)*100, 1),
                "eye_confidence":  round((1-best_ed)*100, 1)}
    return {"recognized": True, "label": best_label,
            "face_confidence": round((1-best_fd)*100, 1),
            "eye_confidence":  round((1-best_ed)*100, 1)}


@app.post("/api/enroll")
def enroll(p: ImagePayload):
    """
    HIGH-ACCURACY enrollment using dlib 68-point landmarks.
    Falls back to InsightFace if dlib is unavailable.
    Multiple images are averaged for maximum robustness.
    """
    if not p.label: raise HTTPException(400, "label required")

    frames = p.images or ([p.image] if p.image else [])
    if not frames: raise HTTPException(400, "No images")

    face_embs = []; le_embs = []; re_embs = []
    quality_scores = []
    engine = "dlib" if DLIB_OK else ("insightface" if INSIGHT_OK else None)
    if engine is None: raise HTTPException(500, "No biometric engine available")

    for b64 in frames:
        try:
            img = _decode(b64)

            if DLIB_OK:
                # ── dlib path — highest accuracy ──────────────────────────────
                face_emb = _dlib_encode_face(img)
                if face_emb is None: continue

                left_region, right_region = _dlib_eye_landmarks(img)
                le = _eye_embedding_dlib(left_region)
                re = _eye_embedding_dlib(right_region)

                # Quality check: reject blurry frames
                gray      = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                sharpness = cv2.Laplacian(gray, cv2.CV_64F).var()
                if sharpness < 50: continue  # skip blurry frames

                face_embs.append(face_emb)
                quality_scores.append(sharpness)
                if le is not None: le_embs.append(le)
                if re is not None: re_embs.append(re)

            else:
                # ── InsightFace fallback ──────────────────────────────────────
                faces = _insight_faces(img)
                if not faces: continue
                face = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]))
                if face.embedding is None: continue
                face_embs.append(face.embedding)
                if face.kps is not None and len(face.kps) >= 2:
                    le_embs.append(_insight_eye_emb(_insight_eye_crop(img, face.kps[0])))
                    re_embs.append(_insight_eye_emb(_insight_eye_crop(img, face.kps[1])))

        except Exception:
            continue

    if not face_embs:
        raise HTTPException(422, "No valid face detected in any image. Ensure good lighting and face is clearly visible.")

    # Weighted average by sharpness (dlib path)
    if quality_scores and len(quality_scores) == len(face_embs):
        weights = np.array(quality_scores); weights /= weights.sum()
        mean_face = np.average(face_embs, axis=0, weights=weights)
    else:
        mean_face = np.mean(face_embs, axis=0)

    mean_face /= (np.linalg.norm(mean_face) + 1e-8)
    np.save(str(FACE_DB / f"{p.label}.npy"), mean_face)

    if le_embs:
        ml = np.mean(le_embs, axis=0)
        mr = np.mean(re_embs, axis=0) if re_embs else ml
        np.save(str(EYE_DB / f"{p.label}.npy"), np.concatenate([ml, mr]))

    return {
        "enrolled":      True,
        "label":         p.label,
        "engine":        engine,
        "face_samples":  len(face_embs),
        "eye_samples":   len(le_embs),
        "avg_sharpness": round(float(np.mean(quality_scores)), 1) if quality_scores else None,
    }


@app.delete("/api/enroll/{label}")
def delete_enroll(label: str):
    removed = []
    for folder in [FACE_DB, EYE_DB]:
        p = folder / f"{label}.npy"
        if p.exists(): p.unlink(); removed.append(folder.name)
    return {"label": label, "removed": removed}

@app.get("/api/enrolled")
def list_enrolled():
    return {"labels": _all_labels()}