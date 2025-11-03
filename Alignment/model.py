# sheet_align_agent_v6.py
# Robust worksheet alignment + per-question segmentation
# v6: Hybrid FINAL CROP after deskew (ink projections ∩ paper mask),
#     warp modes (auto|gemini|minrect), multi-quad + subpixel refine, Radon deskew.

import os, json, base64, argparse
from dataclasses import dataclass, asdict
from typing import List, Tuple, Optional, Dict

import numpy as np
import cv2
from PIL import Image, ImageOps
from skimage.filters import threshold_local
from skimage.transform import radon, rotate as sk_rotate

# Optional Gemini
try:
    import google.generativeai as gen
except Exception:
    gen = None

# ------------------------- I/O -------------------------
def ensure_dir(p: str):
    if p:
        os.makedirs(p, exist_ok=True)

def imread_rgb(path: str) -> np.ndarray:
    im = Image.open(path)
    im = ImageOps.exif_transpose(im)  # obey EXIF
    im = im.convert("RGB")
    return np.array(im)

def imwrite_rgb(path: str, rgb: np.ndarray):
    ensure_dir(os.path.dirname(path))
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    cv2.imwrite(path, bgr)

def save_dbg(out_dir: str, name: str, img: np.ndarray):
    imwrite_rgb(os.path.join(out_dir, name), img)

# ------------------------- Quality -------------------------
def estimate_noise_sigma(gray: np.ndarray) -> float:
    lap = cv2.Laplacian(gray, cv2.CV_64F)
    mad = np.median(np.abs(lap - np.median(lap)))
    return float(mad)

def assess_quality(gray: np.ndarray) -> Dict:
    H, W = gray.shape
    contrast = float(np.std(gray) / 255.0)
    noise = estimate_noise_sigma(gray)
    bw = cv2.threshold(gray, 0, 255, cv2.THRESH_OTSU | cv2.THRESH_BINARY)[1]
    ink = float(np.sum(255 - bw)) / (255.0 * H * W)
    return {"contrast": contrast, "noise_mad_lap": noise, "ink_density": ink}

# ------------------------- Preprocess -------------------------
def preprocess(gray: np.ndarray, use_median: bool=False):
    den = cv2.medianBlur(gray, 3) if use_median else cv2.GaussianBlur(gray, (5,5), 0)
    bg  = cv2.GaussianBlur(den, (0,0), 35)
    flat= cv2.normalize(den - bg + 128, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    cla = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
    con = cla.apply(flat)
    return den, flat, con

# ------------------------- Paper Mask (LAB, pre-warp) -------------------------
def paper_mask_from_lab(rgb: np.ndarray) -> np.ndarray:
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    L, a, b = cv2.split(lab)
    Ln  = cv2.normalize(L, None, 0, 255, cv2.NORM_MINMAX)
    sat = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)[...,1]
    T_L = max(170, int(np.percentile(Ln, 75)))
    T_S = int(np.percentile(sat, 35))
    mask = ((Ln >= T_L) & (sat <= T_S)).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9,9), np.uint8), 1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN,  np.ones((5,5), np.uint8), 1)
    return mask

def biggest_contour(mask: np.ndarray):
    cnts,_ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts: return None
    return max(cnts, key=cv2.contourArea)

# ------------------------- Multi-Quad Selection -------------------------
def rect_score_for_quad(pts: np.ndarray) -> Tuple[float, float]:
    pts = pts.astype(np.float32).reshape(-1,2)
    s = pts.sum(axis=1); d = np.diff(pts, axis=1).reshape(-1)
    tl = pts[np.argmin(s)]; br = pts[np.argmax(s)]
    tr = pts[np.argmin(d)]; bl = pts[np.argmax(d)]
    P = np.array([tl,tr,br,bl], np.float32)

    v = np.vstack([P[(i+1)%4] - P[i] for i in range(4)])
    lens = np.linalg.norm(v, axis=1) + 1e-6
    u = v / lens[:,None]
    dots = [abs(np.dot(u[i], u[(i+1)%4])) for i in range(4)]
    ortho = 1.0 - np.mean(np.clip(dots, 0, 1))

    poly_area = cv2.contourArea(P.astype(np.int32))
    rect      = cv2.minAreaRect(P.astype(np.float32))
    box       = cv2.boxPoints(rect)
    rect_area = cv2.contourArea(box.astype(np.int32)) + 1e-6
    rectangularity = float(poly_area / rect_area)

    return float(ortho * rectangularity), float(poly_area)

def refine_corners_subpix(gray: np.ndarray, corners: np.ndarray) -> np.ndarray:
    g8 = gray if gray.ndim == 2 else cv2.cvtColor(gray, cv2.COLOR_RGB2GRAY)
    g8 = cv2.GaussianBlur(g8, (3,3), 0)
    term = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 40, 0.01)
    pts = corners.astype(np.float32).reshape(-1,1,2)
    cv2.cornerSubPix(g8, pts, (9,9), (-1,-1), term)
    return pts.reshape(4,2)

def focus_sharpness(gray: np.ndarray) -> float:
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())

def candidate_quads_from_mask_and_edges(rgb: np.ndarray, gray: np.ndarray) -> List[np.ndarray]:
    quads = []
    # LAB mask candidates
    mask = paper_mask_from_lab(rgb)
    cnts,_ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for c in sorted(cnts, key=cv2.contourArea, reverse=True)[:3]:
        peri  = cv2.arcLength(c, True)
        approx= cv2.approxPolyDP(c, 0.015*peri, True)
        if len(approx) >= 4:
            hull  = cv2.convexHull(approx)
            poly  = cv2.approxPolyDP(hull, 0.02*cv2.arcLength(hull, True), True)
            if len(poly) == 4 and cv2.isContourConvex(poly):
                quads.append(poly.reshape(4,2).astype(np.float32))
    # Edge candidates
    edges = cv2.Canny(gray, 60, 160)
    edges = cv2.dilate(edges, np.ones((3,3), np.uint8), 2)
    cnts,_ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for c in sorted(cnts, key=cv2.contourArea, reverse=True)[:5]:
        peri  = cv2.arcLength(c, True)
        approx= cv2.approxPolyDP(c, 0.02*peri, True)
        if len(approx) == 4 and cv2.isContourConvex(approx):
            quads.append(approx.reshape(4,2).astype(np.float32))
    # Deduplicate
    uniq, seen = [], set()
    for q in quads:
        x,y,w,h = cv2.boundingRect(q.astype(np.int32))
        key = (x//20, y//20, w//20, h//20)
        if key not in seen:
            seen.add(key); uniq.append(q)
    return uniq

def warp_from_quad(rgb: np.ndarray, gray: np.ndarray, quad: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    q = quad.astype(np.float32)
    s = q.sum(axis=1); d = np.diff(q, axis=1).reshape(-1)
    tl = q[np.argmin(s)]; br = q[np.argmax(s)]
    tr = q[np.argmin(d)]; bl = q[np.argmax(d)]
    P = np.array([tl,tr,br,bl], np.float32)

    w1 = np.linalg.norm(br - bl); w2 = np.linalg.norm(tr - tl)
    h1 = np.linalg.norm(tr - br); h2 = np.linalg.norm(tl - bl)
    Wt = int(max(w1,w2)); Ht = int(max(h1,h2))
    Wt = max(Wt, 600); Ht = max(Ht, 800)

    dst = np.array([[0,0],[Wt-1,0],[Wt-1,Ht-1],[0,Ht-1]], np.float32)
    M = cv2.getPerspectiveTransform(P, dst)
    wr = cv2.warpPerspective(rgb,  M, (Wt,Ht), flags=cv2.INTER_LINEAR,  borderMode=cv2.BORDER_REPLICATE)
    wg = cv2.warpPerspective(gray, M, (Wt,Ht), flags=cv2.INTER_LINEAR,  borderMode=cv2.BORDER_REPLICATE)
    return wr, wg

def best_warp(rgb: np.ndarray, gray: np.ndarray) -> Tuple[np.ndarray, np.ndarray, Optional[np.ndarray], Dict]:
    H, W = gray.shape
    candidates = candidate_quads_from_mask_and_edges(rgb, gray)
    if not candidates:
        return rgb.copy(), gray.copy(), None, {"branch":"no_quad"}

    scored = []
    for q in candidates:
        rscore, area = rect_score_for_quad(q)
        coverage = float(area / (H*W))
        cov_penalty = 1.0 - float(abs(np.clip(coverage,0,1) - 0.65))  # prefer ~65% coverage
        s = rscore * cov_penalty
        scored.append((s, q, coverage, rscore))

    scored.sort(key=lambda z: z[0], reverse=True)
    top = scored[:4]

    best = None
    best_val = -1e9
    dbg = []
    for s, q, cov, rscore in top:
        q_ref = refine_corners_subpix(gray, q)
        wr, wg = warp_from_quad(rgb, gray, q_ref)
        sharp = focus_sharpness(cv2.cvtColor(wr, cv2.COLOR_RGB2GRAY))
        total = sharp * (1.0 + 0.3*s)
        dbg.append({"sharp":sharp, "layout_score":float(s), "coverage":float(cov)})
        if total > best_val:
            best_val = total
            best = (wr, wg, q_ref)

    wr, wg, q_used = best
    return wr, wg, q_used, {"branch":"multiquad", "candidates":dbg}

# ------------------------- FINAL CROP (after deskew) -------------------------
def paper_mask_on_deskewed(rgb: np.ndarray) -> np.ndarray:
    """White-paper mask computed on the DESKEWED image."""
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    L, a, b = cv2.split(lab)
    Ln = cv2.normalize(L, None, 0, 255, cv2.NORM_MINMAX)
    sat = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)[...,1]
    TL = max(160, int(np.percentile(Ln, 70)))
    TS = int(np.percentile(sat, 40))
    mask = ((Ln >= TL) & (sat <= TS)).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((11,11), np.uint8), 2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN,  np.ones((7,7),  np.uint8), 1)
    return mask

def box_from_mask(mask: np.ndarray):
    cnts,_ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts: return None
    c = max(cnts, key=cv2.contourArea)
    hull = cv2.convexHull(c)
    rect = cv2.minAreaRect(hull)
    box  = cv2.boxPoints(rect).astype(np.int32)
    x,y,w,h = cv2.boundingRect(box)
    return (x,y,w,h)

def final_hybrid_crop_after_deskew(rgb: np.ndarray, pad: int = 8) -> np.ndarray:
    """
    Very tight crop after deskew using the INTERSECTION of:
      - ink projection box (content-driven)
      - minAreaRect of the (deskewed) paper mask (shape-driven)
    """
    g = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)

    # Ink projections
    bg = cv2.GaussianBlur(g, (0,0), 35)
    n  = cv2.normalize(g - bg + 128, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    T  = threshold_local(n, 41, offset=5, method="gaussian")
    bw = (n < T).astype(np.uint8)  # ink=1
    H, W = bw.shape
    kx = max(5, W // 200); ky = max(5, H // 200)
    hor = cv2.blur(bw.astype(np.float32), (kx, 1)).sum(axis=1)
    ver = cv2.blur(bw.astype(np.float32), (1, ky)).sum(axis=0)
    th_h = max(10.0, 0.08 * np.max(hor))
    th_v = max(10.0, 0.08 * np.max(ver))
    rows = np.where(hor > th_h)[0]
    cols = np.where(ver > th_v)[0]

    # Paper box on deskewed
    pm = paper_mask_on_deskewed(rgb)
    b2 = box_from_mask(pm)

    if rows.size == 0 or cols.size == 0:
        if b2 is None:  # give up
            return rgb
        x2,y2,w2,h2 = b2
        x0 = max(int(0.01*W), x2 - pad); y0 = max(int(0.01*H), y2 - pad)
        x1 = min(int(0.99*W), x2 + w2 + pad); y1 = min(int(0.99*H), y2 + h2 + pad)
        return rgb[y0:y1, x0:x1]

    y0_i, y1_i = int(rows[0]), int(rows[-1])
    x0_i, x1_i = int(cols[0]), int(cols[-1])

    if b2 is None:
        x0 = max(int(0.01*W), x0_i - pad); y0 = max(int(0.01*H), y0_i - pad)
        x1 = min(int(0.99*W), x1_i + pad); y1 = min(int(0.99*H), y1_i + pad)
        if y1 <= y0 or x1 <= x0: return rgb
        return rgb[y0:y1, x0:x1]

    x2,y2,w2,h2 = b2
    # Intersection
    x0 = max(int(0.01*W), max(x0_i, x2) - pad)
    y0 = max(int(0.01*H), max(y0_i, y2) - pad)
    x1 = min(int(0.99*W), min(x1_i, x2 + w2) + pad)
    y1 = min(int(0.99*H), min(y1_i, y2 + h2) + pad)

    if y1 <= y0 or x1 <= x0:
        # choose tighter of the two boxes
        xa0 = max(int(0.01*W), x0_i - pad); ya0 = max(int(0.01*H), y0_i - pad)
        xa1 = min(int(0.99*W), x1_i + pad); ya1 = min(int(0.99*H), y1_i + pad)
        xb0 = max(int(0.01*W), x2 - pad);    yb0 = max(int(0.01*H), y2 - pad)
        xb1 = min(int(0.99*W), x2 + w2 + pad); yb1 = min(int(0.99*H), y2 + h2 + pad)
        area_a = max(0, xa1-xa0) * max(0, ya1-ya0)
        area_b = max(0, xb1-xb0) * max(0, yb1-yb0)
        if area_b and (area_b < area_a):
            x0,y0,x1,y1 = xb0,yb0,xb1,yb1
        else:
            x0,y0,x1,y1 = xa0,ya0,xa1,ya1

    return rgb[y0:y1, x0:x1]

# ------------------------- Orientation & Deskew -------------------------
def ensure_portrait(rgb: np.ndarray) -> np.ndarray:
    h,w = rgb.shape[:2]
    if w > h:
        rgb = cv2.rotate(rgb, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return rgb

def find_answer_band(gray: np.ndarray) -> Tuple[int,int,int,int]:
    thr = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C,
                                cv2.THRESH_BINARY_INV, 35, 10)
    thr = cv2.morphologyEx(thr, cv2.MORPH_OPEN, np.ones((3,3), np.uint8), 1)
    cnts,_ = cv2.findContours(thr, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    H,W = gray.shape
    squares=[]
    for c in cnts:
        x,y,w,h = cv2.boundingRect(c)
        if w*h < 150 or w*h > (W*H*0.02): continue
        ar = w/float(h)
        if 0.75<=ar<=1.25:
            approx = cv2.approxPolyDP(c, 0.05*cv2.arcLength(c, True), True)
            if len(approx)==4: squares.append((x,y,w,h))
    if not squares:
        return (int(W*0.72), int(H*0.15), int(W*0.26), int(H*0.73))
    right = min(W-1, max(x for (x,_,_,_) in squares) + 40)
    left  = max(0,   min(x for (x,_,_,_) in squares) - 40)
    top   = max(0,   min(y for (_,y,_,_) in squares) - 40)
    bot   = min(H-1, max(y+h for (_,y,_,h) in squares) + 40)
    return (left, top, right-left, bot-top)

def canonicalize(rgb: np.ndarray) -> np.ndarray:
    for _ in range(4):
        g = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        bx,by,bw,bh = find_answer_band(g)
        cx = bx + bw/2.0
        H,W = g.shape
        if W > H:
            rgb = cv2.rotate(rgb, cv2.ROTATE_90_COUNTERCLOCKWISE); continue
        if cx < W*0.5:
            rgb = cv2.rotate(rgb, cv2.ROTATE_180); continue
        return rgb
    return rgb

def radon_deskew(gray: np.ndarray, angle_range: int=15) -> Tuple[np.ndarray, float]:
    h, w = gray.shape
    scale = 1200 / max(h, w)
    small = cv2.resize(gray, (int(w*scale), int(h*scale)), interpolation=cv2.INTER_AREA) if scale < 1 else gray.copy()
    sb = cv2.GaussianBlur(small, (3,3), 0)
    sb = cv2.adaptiveThreshold(sb, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 35, 10)
    sb = 255 - sb
    thetas = np.linspace(-angle_range, angle_range, 2*angle_range+1)
    scores=[]
    for t in thetas:
        R = radon(sb, [t], circle=False)
        scores.append(float(np.var(R)))
    best = float(thetas[int(np.argmax(scores))])
    rot = sk_rotate(gray, -best, preserve_range=True, order=1, mode="edge").astype(np.uint8)
    return rot, best

# ------------------------- Rows & Answers -------------------------
@dataclass
class Row:
    id: str
    bbox: Tuple[int,int,int,int]
    answer_box_bbox: Optional[Tuple[int,int,int,int]]
    type: str
    confidence: float
    row_image: Optional[str] = None
    answer_image: Optional[str] = None

def split_rows(gray: np.ndarray, band: Tuple[int,int,int,int], min_y_frac: float) -> List[Tuple[int,int,int,int]]:
    H,W = gray.shape
    ex_x,ex_y,ex_w,ex_h = band
    mask = np.ones_like(gray, dtype=np.uint8) * 255
    mask[ex_y:ex_y+ex_h, ex_x:ex_x+ex_w] = 0
    T = threshold_local(gray, 41, offset=5, method='gaussian')
    bw = ((gray > T).astype(np.uint8)*255)
    bw = cv2.bitwise_and(bw, mask)
    proj = np.sum(255 - bw, axis=1)
    thresh = np.mean(proj) * 0.4
    segments=[]; in_seg=False; y0=0
    min_h = max(40, H//40)
    for y in range(H):
        if proj[y] > thresh and not in_seg:
            in_seg=True; y0=y
        elif (proj[y] <= thresh or y==H-1) and in_seg:
            in_seg=False; y1=y
            if (y1-y0) >= min_h:
                segments.append((0, max(0,y0-4), W, min(H-1,y1+4)-max(0,y0-4)))
    merged=[]
    for seg in segments:
        if not merged: merged.append(seg); continue
        x,y,w,h = seg; px,py,pw,ph = merged[-1]
        if y <= (py+ph+12): merged[-1] = (px,py,pw,(y+h)-py)
        else: merged.append(seg)
    top_cut = int(H * min_y_frac)
    out=[]
    for (x,y,w,h) in merged:
        y2 = max(y, top_cut)
        if (y+h) > top_cut and (y2-y) < h:
            out.append((x,y2,w,(y+h)-y2))
    return out

def attach_answer_boxes(rows, band, gray) -> List[Row]:
    bx,by,bw,bh = band
    out=[]; qid=1
    for (x,y,w,h) in sorted(rows, key=lambda r:r[1]):
        ry = y + h//2
        has = (by <= ry <= by+bh)
        ab=None; typ="mcq"; conf=0.86
        if has:
            band_row = gray[max(by,y):min(by+bh,y+h), bx:bx+bw]
            thr = cv2.adaptiveThreshold(band_row, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 35, 10)
            cnts,_ = cv2.findContours(thr, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            cand=[]
            for c in cnts:
                X,Y,W,H = cv2.boundingRect(c)
                ar = W/float(H)
                if 0.75<=ar<=1.25 and 12<=W<=200 and 12<=H<=200:
                    cy = Y + H/2
                    global_cy = max(by,y) + cy
                    cand.append((abs(global_cy-ry),(X,Y,W,H)))
            if cand:
                _,(X,Y,W,H)=min(cand, key=lambda z:z[0])
                ab=(bx+X, max(by,y)+Y, W, H)
        else:
            typ="text"; conf=0.72
        out.append(Row(id=f"q{qid}", bbox=(x,y,w,h), answer_box_bbox=ab, type=typ, confidence=conf))
        qid+=1
    return out

# ------------------------- Gemini helpers -------------------------
def gem_ready() -> bool:
    if gen is None: return False
    key = os.environ.get("GEMINI_API_KEY")
    if not key: return False
    try:
        gen.configure(api_key=key)
        return True
    except Exception:
        return False

def gemini_corners(rgb_small: np.ndarray) -> Optional[np.ndarray]:
    if not gem_ready(): return None
    model = gen.GenerativeModel("models/gemini-1.5-flash")
    _, png = cv2.imencode(".png", cv2.cvtColor(rgb_small, cv2.COLOR_RGB2BGR))
    b64 = base64.b64encode(png.tobytes()).decode("ascii")
    prompt = {
        "role": "user",
        "parts": [
            {"text": "Return JSON only: {\"corners\": [[x_tl,y_tl],[x_tr,y_tr],[x_br,y_br],[x_bl,y_bl]]} of the paper sheet."},
            {"inline_data": {"mime_type": "image/png", "data": b64}}
        ]
    }
    try:
        resp = model.generate_content(prompt)
        data = json.loads(resp.text.strip())
        cs = np.array(data["corners"], dtype=np.float32)
        if cs.shape == (4,2): return cs
    except Exception:
        pass
    return None

# ------------------------- Main Pipeline -------------------------
def process(input_path: str, out_dir: str, use_gemini: bool, min_y_frac: float,
           use_median: bool=False, warp_mode: str="auto"):
    ensure_dir(out_dir)

    # 0) Load
    rgb0 = imread_rgb(input_path)
    save_dbg(out_dir, "00_input.png", rgb0)
    gray0 = cv2.cvtColor(rgb0, cv2.COLOR_RGB2GRAY)

    # 1) Preprocess
    den, flat, con = preprocess(gray0, use_median=use_median)
    save_dbg(out_dir, "01_denoised.png", cv2.cvtColor(den,  cv2.COLOR_GRAY2RGB))
    save_dbg(out_dir, "02_flattened.png", cv2.cvtColor(flat, cv2.COLOR_GRAY2RGB))
    save_dbg(out_dir, "03_contrast.png",  cv2.cvtColor(con,  cv2.COLOR_GRAY2RGB))

    # 2) Normalize size (~1500 px max side)
    scale = 1500.0 / max(rgb0.shape[:2])
    if scale < 1.0:
        target = (int(rgb0.shape[1]*scale), int(rgb0.shape[0]*scale))
        rgb = cv2.resize(rgb0, target, interpolation=cv2.INTER_AREA)
        gray= cv2.resize(con,  target, interpolation=cv2.INTER_AREA)
    else:
        rgb, gray = rgb0, con

    # 3) Warp selection (mode-based)
    used_quad, warp_debug = None, {"branch":"none"}
    if warp_mode == "gemini":
        if use_gemini and gem_ready():
            small = rgb if rgb.shape[1] <= 900 else cv2.resize(
                rgb, (900, int(rgb.shape[0]*900/rgb.shape[1])), interpolation=cv2.INTER_AREA
            )
            cs = gemini_corners(small)
            if cs is not None:
                sx = rgb.shape[1] / small.shape[1]
                sy = rgb.shape[0] / small.shape[0]
                cs[:,0]*=sx; cs[:,1]*=sy
                wr, wg = warp_from_quad(rgb, gray, cs)
                used_quad = cs
                warp_debug = {"branch":"gemini-only"}
            else:
                wr, wg, used_quad, warp_debug = best_warp(rgb, gray)
        else:
            wr, wg, used_quad, warp_debug = best_warp(rgb, gray)

    elif warp_mode == "minrect":
        mask = paper_mask_from_lab(rgb)
        cnt = biggest_contour(mask)
        if cnt is not None:
            rect = cv2.minAreaRect(cnt)
            box  = cv2.boxPoints(rect).astype(np.float32)
            wr, wg = warp_from_quad(rgb, gray, box)
            used_quad = box
            warp_debug = {"branch":"minrect-only"}
        else:
            wr, wg, used_quad, warp_debug = best_warp(rgb, gray)

    else:  # auto
        wr, wg, used_quad, warp_debug = best_warp(rgb, gray)
        if used_quad is None and use_gemini and gem_ready():
            small = rgb if rgb.shape[1] <= 900 else cv2.resize(
                rgb, (900, int(rgb.shape[0]*900/rgb.shape[1])), interpolation=cv2.INTER_AREA
            )
            cs = gemini_corners(small)
            if cs is not None:
                sx = rgb.shape[1] / small.shape[1]
                sy = rgb.shape[0] / small.shape[0]
                cs[:,0]*=sx; cs[:,1]*=sy
                wr, wg = warp_from_quad(rgb, gray, cs)
                used_quad = cs
                warp_debug = {"branch":"auto->gemini"}

    if used_quad is not None:
        overlay = rgb.copy()
        cv2.polylines(overlay, [used_quad.astype(np.int32)], True, (255,0,0), 3)
        save_dbg(out_dir, "10_selected_quad.png", overlay)

    warped_rgb, warped_gray = wr, wg
    save_dbg(out_dir, "11_warp_raw.png", warped_rgb)

    # 4) Orientation + Radon deskew (no crop yet)
    warped_rgb = ensure_portrait(warped_rgb)
    warped_rgb = canonicalize(warped_rgb)
    g = cv2.cvtColor(warped_rgb, cv2.COLOR_RGB2GRAY)
    bg = cv2.GaussianBlur(g, (0,0), 35)
    g  = cv2.normalize(g - bg + 128, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    g, angle = radon_deskew(g, angle_range=15)
    aligned_rgb = cv2.cvtColor(g, cv2.COLOR_GRAY2RGB)
    save_dbg(out_dir, "13_deskew.png", aligned_rgb)

    # 5) FINAL hybrid crop after deskew
    aligned_rgb = final_hybrid_crop_after_deskew(aligned_rgb, pad=10)
    save_dbg(out_dir, "14_final_crop.png", aligned_rgb)

    # 6) Band + rows on the final-cropped image
    g2 = cv2.cvtColor(aligned_rgb, cv2.COLOR_RGB2GRAY)
    band = find_answer_band(g2)
    rows = split_rows(g2, band, min_y_frac=min_y_frac)
    rows_info = attach_answer_boxes(rows, band, g2)

    # 7) Debug overlay
    dbg = aligned_rgb.copy()
    bx,by,bw,bh = band
    cv2.rectangle(dbg, (bx,by), (bx+bw,by+bh), (0,180,255), 2)
    for r in rows_info:
        x,y,w,h = r.bbox
        cv2.rectangle(dbg, (x,y), (x+w,y+h), (0,255,0), 2)
        cv2.putText(dbg, r.id, (x+5,y+18), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,120,0), 2)
        if r.answer_box_bbox:
            ax,ay,aw,ah = r.answer_box_bbox
            cv2.rectangle(dbg, (ax,ay), (ax+aw,ay+ah), (255,0,0), 2)
    save_dbg(out_dir, "20_rows_overlay.png", dbg)

    # 8) Save outputs
    imwrite_rgb(os.path.join(out_dir, "aligned.png"), aligned_rgb)
    rows_dir = os.path.join(out_dir, "rows"); ensure_dir(rows_dir)
    saved=[]
    for r in rows_info:
        x,y,w,h = r.bbox
        row_img = aligned_rgb[y:y+h, x:x+w]
        row_fn  = f"{r.id}.png"; row_path = os.path.join(rows_dir, row_fn)
        imwrite_rgb(row_path, row_img)
        ans_path = None
        if r.answer_box_bbox:
            ax,ay,aw,ah = r.answer_box_bbox
            ans_img = aligned_rgb[ay:ay+ah, ax:ax+aw]
            ans_fn  = f"{r.id}_answer.png"
            ans_path= os.path.join(rows_dir, ans_fn)
            imwrite_rgb(ans_path, ans_img)
        r.row_image   = os.path.relpath(row_path, out_dir).replace("\\","/")
        r.answer_image= os.path.relpath(ans_path, out_dir).replace("\\","/") if ans_path else None
        saved.append(asdict(r))

    layout = {
        "image_size": [aligned_rgb.shape[1], aligned_rgb.shape[0]],
        "aligned_image": "aligned.png",
        "rows": saved,
        "notes": "bboxes are [x,y,w,h] on aligned.png; row_image/answer_image paths are relative."
    }
    with open(os.path.join(out_dir, "layout.json"), "w", encoding="utf-8") as f:
        json.dump(layout, f, indent=2)

    quality = {
        "preprocess": assess_quality(con),
        "aligned": assess_quality(cv2.cvtColor(aligned_rgb, cv2.COLOR_RGB2GRAY)),
        "warp_debug": warp_debug,
        "radon_angle_deg": angle
    }
    with open(os.path.join(out_dir, "quality.json"), "w", encoding="utf-8") as f:
        json.dump(quality, f, indent=2)

    return {"layout": layout, "quality": quality}

# ------------------------- CLI -------------------------
if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Robust alignment + per-question segmentation (hybrid final crop)")
    ap.add_argument("--input", required=True)
    ap.add_argument("--out_dir", default="./out")
    ap.add_argument("--use_gemini", default="false", choices=["true","false"])
    ap.add_argument("--warp_mode", default="auto", choices=["auto","gemini","minrect"],
                    help="auto (multi-quad), gemini (Gemini-only), minrect (largest minAreaRect).")
    ap.add_argument("--min_y_frac", type=float, default=0.26, help="Ignore header above this fraction [0..1]")
    ap.add_argument("--use_median", action="store_true", help="Median blur denoise (salt & pepper)")
    args = ap.parse_args()

    result = process(
        input_path=args.input,
        out_dir=args.out_dir,
        use_gemini=(args.use_gemini.lower()=="true"),
        min_y_frac=args.min_y_frac,
        use_median=args.use_median,
        warp_mode=args.warp_mode
    )
    print(json.dumps({
        "aligned_image": result["layout"]["aligned_image"],
        "rows": [{"id": r["id"], "row_image": r["row_image"], "answer_image": r["answer_image"]}
                 for r in result["layout"]["rows"]],
        "quality": result["quality"]
    }, indent=2))
