import argparse, os, sys, json
import numpy as np
import cv2

A4_W, A4_H = 2480, 3508

def ensure_dir(p):
    d = os.path.dirname(p)
    if d and not os.path.exists(d):
        os.makedirs(d, exist_ok=True)

def to_gray(img):
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img

def auto_upscale(img, short_min=1500):
    h, w = img.shape[:2]
    s = min(h, w)
    if s >= short_min:
        return img
    sc = short_min / float(s)
    return cv2.resize(img, (int(w*sc), int(h*sc)), cv2.INTER_CUBIC)

def remove_glare(gray):
    glare = (gray > 245).astype(np.uint8) * 255
    glare = cv2.morphologyEx(glare, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    return cv2.inpaint(gray, glare, 5, cv2.INPAINT_TELEA) if np.any(glare) else gray

def order_corners(pts):
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).reshape(-1)
    tl = pts[np.argmin(s)]
    br = pts[np.argmax(s)]
    tr = pts[np.argmin(d)]
    bl = pts[np.argmax(d)]
    return np.array([tl, tr, br, bl], np.float32)

def intersect(p1, p2, p3, p4):
    x1,y1 = p1; x2,y2 = p2; x3,y3 = p3; x4,y4 = p4
    den = (x1-x2)*(y3-y4) - (y1-y2)*(x3-x4)
    if abs(den) < 1e-6: return None
    px = ((x1*y2 - y1*x2)*(x3 - x4) - (x1 - x2)*(x3*y4 - y3*x4)) / den
    py = ((x1*y2 - y1*x2)*(y3 - y4) - (y1 - y2)*(x3*y4 - y3*x4)) / den
    return np.array([px, py], np.float32)

def line_from_segment(seg, im_w, im_h, pad=50):
    x1,y1,x2,y2 = [float(x) for x in seg]
    if abs(x1 - x2) < 1e-6 and abs(y1 - y2) < 1e-6:
        return None
    pts = np.array([[x1,y1],[x2,y2]], np.float32).reshape(-1,1,2)
    vx, vy, x0, y0 = cv2.fitLine(pts, cv2.DIST_L2, 0, 0.01, 0.01)
    vx, vy, x0, y0 = vx.item(), vy.item(), x0.item(), y0.item()
    t = max(im_w, im_h) + pad
    pA = (x0 - vx*t, y0 - vy*t)
    pB = (x0 + vx*t, y0 + vy*t)
    return np.array([pA[0], pA[1], pB[0], pB[1]], np.float32)

def four_point_warp(img, quad, target_wh):
    dst = np.array([[0,0],
                    [target_wh[0]-1,0],
                    [target_wh[0]-1,target_wh[1]-1],
                    [0,target_wh[1]-1]], np.float32)
    H = cv2.getPerspectiveTransform(quad.astype(np.float32), dst)
    warped = cv2.warpPerspective(img, H, target_wh, flags=cv2.INTER_CUBIC)
    return warped, H

# ---------- Bright-paper method ----------
def detect_quad_bright(bgr):
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    L = lab[:,:,0]
    L = cv2.createCLAHE(2.0, (8,8)).apply(L)
    _, th = cv2.threshold(L, 0, 255, cv2.THRESH_BINARY+cv2.THRESH_OTSU)
    th = cv2.morphologyEx(th, cv2.MORPH_CLOSE, np.ones((7,7), np.uint8), 2)
    cnts,_ = cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return None
    cnt = max(cnts, key=cv2.contourArea)
    peri = cv2.arcLength(cnt, True)
    approx = cv2.approxPolyDP(cnt, 0.02*peri, True)
    if len(approx) < 4:
        rect = cv2.minAreaRect(cnt)
        approx = cv2.boxPoints(rect).astype(np.float32).reshape(-1,1,2)
    if len(approx) >= 4:
        quad = approx.reshape(-1,2).astype(np.float32)
        if len(quad) > 4:
            hull = cv2.convexHull(quad)
            peri = cv2.arcLength(hull, True)
            quad = cv2.approxPolyDP(hull, 0.02*peri, True).reshape(-1,2).astype(np.float32)
        if len(quad) == 4:
            return order_corners(quad)
    return None

# ---------- LSD method ----------
def detect_quad_lsd(bgr):
    h, w = bgr.shape[:2]
    gray = to_gray(bgr)
    gray = cv2.createCLAHE(2.0, (8,8)).apply(gray)
    gray = remove_glare(gray)

    k = 81
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k,k))
    bg = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel)
    rel = cv2.normalize(gray.astype(np.float32)/(bg.astype(np.float32)+1e-3), None, 0,255, cv2.NORM_MINMAX).astype(np.uint8)

    try:
        lsd = cv2.createLineSegmentDetector(refine=cv2.LSD_REFINE_ADV)
    except TypeError:
        lsd = cv2.createLineSegmentDetector(_refine=cv2.LSD_REFINE_ADV)

    retval = lsd.detect(rel)
    lines = retval[0] if retval is not None else None
    if lines is None:
        return None

    Hs, Vs = [], []
    for l in lines:
        x1,y1,x2,y2 = l[0]
        ang = np.degrees(np.arctan2(y2-y1, x2-x1))
        if abs(ang) < 20:           Hs.append([x1,y1,x2,y2])
        elif abs(abs(ang)-90) < 20: Vs.append([x1,y1,x2,y2])

    if len(Hs) < 2 or len(Vs) < 2:
        return None

    def seg_len(s): return float(np.hypot(s[2]-s[0], s[3]-s[1]))
    Hs = sorted(Hs, key=seg_len, reverse=True)[:10]
    Vs = sorted(Vs, key=seg_len, reverse=True)[:10]

    H_lines = [line_from_segment(s, w, h) for s in Hs if s is not None]
    V_lines = [line_from_segment(s, w, h) for s in Vs if s is not None]
    H_lines = [l for l in H_lines if l is not None]
    V_lines = [l for l in V_lines if l is not None]
    if len(H_lines) < 2 or len(V_lines) < 2:
        return None

    def line_y(l, x):
        x1,y1,x2,y2 = l
        if abs(x2-x1) < 1e-6: return None
        m = (y2-y1)/(x2-x1); b = y1 - m*x1
        return m*x + b
    def line_x(l, y):
        x1,y1,x2,y2 = l
        if abs(y2-y1) < 1e-6: return None
        m = (x2-x1)/(y2-y1); b = x1 - m*y1
        return m*y + b

    midx, midy = w/2, h/2
    top = min(H_lines, key=lambda L: line_y(L, midx) if line_y(L, midx) is not None else 1e9)
    bottom = max(H_lines, key=lambda L: line_y(L, midx) if line_y(L, midx) is not None else -1e9)
    left = min(V_lines, key=lambda L: line_x(L, midy) if line_x(L, midy) is not None else 1e9)
    right = max(V_lines, key=lambda L: line_x(L, midy) if line_x(L, midy) is not None else -1e9)

    TL = intersect(top[:2], top[2:], left[:2], left[2:])
    TR = intersect(top[:2], top[2:], right[:2], right[2:])
    BR = intersect(bottom[:2], bottom[2:], right[:2], right[2:])
    BL = intersect(bottom[:2], bottom[2:], left[:2], left[2:])
    if any(p is None for p in [TL,TR,BR,BL]):
        return None

    quad = np.stack([TL,TR,BR,BL]).astype(np.float32)
    quad[:,0] = np.clip(quad[:,0], -50, w+50)
    quad[:,1] = np.clip(quad[:,1], -50, h+50)
    return order_corners(quad)

# ---------- Min-rect fallback ----------
def detect_quad_minrect(bgr):
    g = to_gray(bgr)
    g = cv2.createCLAHE(2.0, (8,8)).apply(g)
    g = cv2.fastNlMeansDenoising(g, None, 7, 7, 21)
    kp = cv2.goodFeaturesToTrack(g, maxCorners=600, qualityLevel=0.01, minDistance=12)
    if kp is None:
        return None
    pts = kp.reshape(-1,2).astype(np.float32)
    rect = cv2.minAreaRect(pts)
    box = cv2.boxPoints(rect)
    return order_corners(box.astype(np.float32))

# ---------- Aligner ----------
def align_page(bgr):
    img = auto_upscale(bgr)
    gray = remove_glare(to_gray(img))
    pre = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)

    quad = detect_quad_bright(pre) or detect_quad_lsd(pre) or detect_quad_minrect(pre)
    if quad is None:
        raise RuntimeError("Page quad not found.")

    tl,tr,br,bl = quad
    wA = np.linalg.norm(br-bl); wB = np.linalg.norm(tr-tl)
    hA = np.linalg.norm(tr-br); hB = np.linalg.norm(tl-bl)
    portrait = max(hA,hB) >= max(wA,wB)
    target = (A4_W, A4_H) if portrait else (A4_H, A4_W)

    warped, H = four_point_warp(img, quad, target)

    g = to_gray(warped)
    k = 81; kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k,k))
    bg = cv2.morphologyEx(g, cv2.MORPH_CLOSE, kernel)
    rel = cv2.normalize(g.astype(np.float32)/(bg.astype(np.float32)+1e-3), None, 0,255, cv2.NORM_MINMAX).astype(np.uint8)
    warped = cv2.cvtColor(rel, cv2.COLOR_GRAY2BGR)

    meta = {
        "w": int(warped.shape[1]),
        "h": int(warped.shape[0]),
        "portrait": bool(portrait),
        "method": "bright|lsd|minrect"
    }
    return warped, H, meta

def main():
    ap = argparse.ArgumentParser("AutoEvalAI Alignment Agent v4")
    ap.add_argument("--scan", required=True)
    ap.add_argument("--out-aligned", default="outputs/aligned.png")
    ap.add_argument("--out-meta", default="outputs/meta.json")
    ap.add_argument("--show", action="store_true")
    args = ap.parse_args()

    img = cv2.imread(args.scan, cv2.IMREAD_COLOR)
    if img is None:
        print(f"Cannot read: {args.scan}", file=sys.stderr); sys.exit(2)

    try:
        aligned, H, meta = align_page(img)
    except Exception as e:
        print(f"[ERROR] {e}", file=sys.stderr); sys.exit(1)

    ensure_dir(args.out_aligned); cv2.imwrite(args.out_aligned, aligned)
    ensure_dir(args.out_meta); open(args.out_meta, "w").write(json.dumps(meta, indent=2))

    if args.show:
        disp = aligned.copy()
        cv2.rectangle(disp, (2,2), (disp.shape[1]-3, disp.shape[0]-3), (0,255,0), 2)
        disp = cv2.resize(disp, (int(disp.shape[1]*0.4), int(disp.shape[0]*0.4)))
        cv2.imshow("Aligned", disp); cv2.waitKey(0); cv2.destroyAllWindows()

    print(json.dumps(meta, indent=2))
    print(f"Saved aligned image to: {args.out_aligned}")

if __name__ == "__main__":
    main()
