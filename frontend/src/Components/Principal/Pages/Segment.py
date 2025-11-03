#!/usr/bin/env python3
"""
segment_answers_with_metrics.py

Reads default ./label.csv (template coordinates) and images from ./answersheet
Outputs aligned images, per-question crops, per-image metadata, and an overall summary.json.

Key features:
 - Robust alignment (feature homography -> contour detection -> safe fallbacks)
 - Decomposition of the applied transform to measure:
     * Skew correction (rotation degrees)
     * Scale correction (scale_x, scale_y)
     * Shear
     * Translation correction (pixels and percent)
     * Perspective distortion (% measured on mapped corners)
     * Perspective strength (homography h20,h21 magnitude)
 - Alignment confidence + residual MAD (warped vs template)
 - Flags pages needing manual checks with reasons
 - Debug mode saves intermediate images

Usage:
    python segment_answers_with_metrics.py --debug --template template.jpg
    python segment_answers_with_metrics.py

Requirements:
    pip install opencv-python numpy pandas
"""

import os
import json
import argparse
from pathlib import Path
from typing import Tuple, Dict, Any, List, Optional
import cv2
import numpy as np
import math
import pandas as pd

### ---------------- CONFIG ----------------
TEMPLATE_W = 1700
TEMPLATE_H = 2200

# thresholds to flag manual check (tuneable)
CONFIDENCE_THRESHOLD = 0.60
RESIDUAL_MAD_THRESHOLD = 30.0        # mean absolute grayscale diff
ROTATION_THRESHOLD_DEG = 10.0       # degrees
SCALE_PERCENT_THRESHOLD = 10.0      # percent (|scale-1|*100)
PERSPECTIVE_DISTORTION_PCT = 8.0    # percent distortion measured from corner side lengths
MIN_DOC_AREA_RATIO = 0.004          # minimal accepted detected paper area ratio
SIZE_TOL_PCT = 0.02                 # 2% size tolerance to avoid warping if same size

### ----------------------------------------

def debug_mkdir(p): Path(p).mkdir(parents=True, exist_ok=True)

def read_bboxes(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path, sep=None, engine='python')
    df.columns = [c.strip() for c in df.columns]
    required = {'label_name','bbox_x','bbox_y','bbox_width','bbox_height','image_name'}
    if not required.issubset(set(df.columns)):
        raise ValueError(f"CSV missing required columns. Found columns: {df.columns.tolist()}")
    return df

def order_points(pts: np.ndarray) -> np.ndarray:
    rect = np.zeros((4,2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect

# ---------- Homography & decomposition utilities ----------
def compute_homography_via_features(template_gray: np.ndarray, img_gray: np.ndarray) -> Tuple[Optional[np.ndarray], Dict[str,Any]]:
    orb = cv2.ORB_create(4000)
    kp1, des1 = orb.detectAndCompute(template_gray, None)
    kp2, des2 = orb.detectAndCompute(img_gray, None)
    stats = {'inliers':0, 'matches':0, 'median_reproj_err': float('inf'),
             'kp1': kp1, 'kp2': kp2, 'des1_exists': des1 is not None, 'des2_exists': des2 is not None}
    if des1 is None or des2 is None or len(kp1) < 4 or len(kp2) < 4:
        return None, stats
    matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    matches = matcher.match(des1, des2)
    matches = sorted(matches, key=lambda x: x.distance)
    stats['matches'] = len(matches)
    stats['matches_list'] = matches
    if len(matches) < 4:
        return None, stats
    pts1 = np.float32([kp1[m.queryIdx].pt for m in matches])
    pts2 = np.float32([kp2[m.trainIdx].pt for m in matches])
    H, mask = cv2.findHomography(pts1, pts2, cv2.RANSAC, 5.0)
    if H is None:
        return None, stats
    inliers = int(mask.sum())
    stats['inliers'] = inliers
    if inliers > 0:
        pts1_h = cv2.convertPointsToHomogeneous(pts1).reshape(-1,3).T
        projected = (H @ pts1_h).T
        projected = projected[:, :2] / projected[:, 2:3]
        dists = np.linalg.norm(projected - pts2, axis=1)
        stats['median_reproj_err'] = float(np.median(dists[mask.ravel()==1])) if inliers>0 else float(np.median(dists))
    stats['H_template_to_img'] = H
    stats['mask'] = mask
    return H, stats

def warp_image_with_H(img: np.ndarray, H_img_to_template: np.ndarray, template_size=(TEMPLATE_W,TEMPLATE_H)):
    """Apply image->template homography and return warped image. H_img_to_template maps image->template coords."""
    try:
        warped = cv2.warpPerspective(img, H_img_to_template, (template_size[0], template_size[1]), flags=cv2.INTER_LINEAR)
        return warped
    except Exception:
        return None

def safe_inverse(H: np.ndarray) -> Optional[np.ndarray]:
    try:
        return np.linalg.inv(H)
    except Exception:
        return None

def decompose_homography(H_img_to_template: np.ndarray) -> Dict[str, float]:
    """
    Decompose 3x3 homography (image -> template) roughly into:
     - affine linear part A (2x2)
     - translation t (2)
     - projective terms p = [h20, h21]
    Then compute rotation (deg), scale_x, scale_y, shear, tx, ty (pixels).
    """
    # normalize
    H = H_img_to_template.astype(np.float64)
    if abs(H[2,2]) < 1e-12:
        H = H / (H[2,2] + 1e-12)
    else:
        H = H / H[2,2]
    A = H[0:2,0:2]
    t = H[0:2,2]
    p = H[2,0:2]
    # polar decomposition on A to get rotation R and symmetric S
    try:
        U, s_vals, Vt = np.linalg.svd(A)
        R = U @ Vt
        # ensure proper rotation (det=+1)
        if np.linalg.det(R) < 0:
            Vt[-1,:] *= -1
            R = U @ Vt
        scales = s_vals  # singular values are scale factors (>=0)
    except Exception:
        # fallback: compute angle approx from A directly
        R = np.eye(2)
        scales = np.array([np.linalg.norm(A[:,0]), np.linalg.norm(A[:,1])])
    # rotation angle from R
    angle_rad = math.atan2(R[1,0], R[0,0])
    angle_deg = math.degrees(angle_rad)
    # shear estimate: compute S = R^T A => upper-triangular-ish; shear = S[0,1]
    S = R.T @ A
    shear = float(S[0,1])
    scale_x = float(scales[0])
    scale_y = float(scales[1])
    # return dictionary
    return {
        'rotation_deg': float(angle_deg),
        'scale_x': float(scale_x),
        'scale_y': float(scale_y),
        'shear': float(shear),
        'tx': float(t[0]),
        'ty': float(t[1]),
        'h20': float(p[0]),
        'h21': float(p[1])
    }

def measure_perspective_from_template_to_image(H_template_to_img: np.ndarray, template_w=TEMPLATE_W, template_h=TEMPLATE_H) -> Dict[str, float]:
    """
    Map template corners through H_template_to_img to image and compute:
     - side lengths of the quadrilateral
     - distortion_pct = (max_side/min_side - 1) * 100
    """
    corners = np.array([[0,0],[template_w-1,0],[template_w-1,template_h-1],[0,template_h-1]], dtype=np.float32).reshape(-1,1,2)
    mapped = cv2.perspectiveTransform(corners, H_template_to_img).reshape(-1,2)
    # compute side lengths
    lens = []
    for i in range(4):
        p1 = mapped[i]
        p2 = mapped[(i+1)%4]
        lens.append(float(np.linalg.norm(p2-p1)))
    lens = np.array(lens)
    if lens.min() <= 1e-6:
        distortion_pct = 0.0
    else:
        distortion_pct = float((lens.max() / lens.min() - 1.0) * 100.0)
    return {
        'corner_points_image': mapped.tolist(),
        'side_lengths': lens.tolist(),
        'perspective_distortion_pct': distortion_pct
    }

def compute_alignment_confidence_from_stats(stats: Dict[str,Any], fallback=False, doc_area_ratio=0.0) -> float:
    if fallback:
        return float(np.clip((doc_area_ratio - 0.2) / 0.75, 0.0, 1.0))
    matches = stats.get('matches', 0)
    inliers = stats.get('inliers', 0)
    if matches <= 0: return 0.0
    inlier_ratio = inliers / matches
    reproj = stats.get('median_reproj_err', 999.0)
    reproj_norm = np.clip(1.0 - (reproj / 50.0), 0.0, 1.0)
    score = 0.7 * inlier_ratio + 0.3 * reproj_norm
    return float(np.clip(score, 0.0, 1.0))

# ---------- simple helpers ----------
def is_mostly_blank(img: np.ndarray, white_thresh=245, pct=0.98) -> bool:
    if img is None:
        return True
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim==3 else img
    total = gray.size
    white_pixels = np.sum(gray >= white_thresh)
    return (white_pixels / total) >= pct

def crop_bbox_from_template_coords(warped_img: np.ndarray, bbox: Dict[str,Any], pad=8):
    x = int(round(bbox['bbox_x'])) - pad
    y = int(round(bbox['bbox_y'])) - pad
    w = int(round(bbox['bbox_width'])) + 2*pad
    h = int(round(bbox['bbox_height'])) + 2*pad
    Hh, Ww = warped_img.shape[:2]
    x = max(0, x)
    y = max(0, y)
    if x + w > Ww: w = Ww - x
    if y + h > Hh: h = Hh - y
    if w <= 0 or h <= 0: return None
    return warped_img[y:y+h, x:x+w].copy()

# ---------- main pipeline ----------
def process_images(args):
    df = read_bboxes(args.bbox_csv)
    grouped = df.groupby('image_name')
    # load template if provided
    template_img = None
    template_gray = None
    if args.template:
        template_img = cv2.imread(args.template, cv2.IMREAD_COLOR)
        if template_img is None:
            print(f"[WARN] Can't read template {args.template}. Continuing without template.")
            template_img = None
        else:
            # ensure template is expected size
            th, tw = template_img.shape[:2]
            if (tw, th) != (TEMPLATE_W, TEMPLATE_H):
                template_img = cv2.resize(template_img, (TEMPLATE_W, TEMPLATE_H), interpolation=cv2.INTER_AREA)
            template_gray = cv2.cvtColor(template_img, cv2.COLOR_BGR2GRAY)
    summary = {}
    debug_root = os.path.join(args.out_dir, "debug")
    debug_mkdir(args.out_dir)
    for img_name, group in grouped:
        # find file (case-insensitive ext)
        img_path = os.path.join(args.images_dir, img_name)
        if not os.path.exists(img_path):
            base = os.path.splitext(img_name)[0]
            found = None
            for ext in ['.jpg','.jpeg','.png','.JPG','.JPEG','.PNG']:
                cand = os.path.join(args.images_dir, base + ext)
                if os.path.exists(cand):
                    found = cand
                    break
            if found:
                img_path = found
            else:
                print(f"[ERROR] Missing image {img_name} in {args.images_dir}")
                continue
        img = cv2.imread(img_path, cv2.IMREAD_COLOR)
        if img is None:
            print(f"[ERROR] Could not load {img_path}")
            continue
        h_img, w_img = img.shape[:2]
        print(f"\nProcessing {img_name} (size {w_img}x{h_img}) ...")
        debug_folder = os.path.join(debug_root, Path(img_name).stem)
        if args.debug:
            debug_mkdir(debug_folder)
            cv2.imwrite(os.path.join(debug_folder, "original.jpg"), img)
        # decide whether to skip warping (identity) if sizes are very close
        size_diff_ok = (abs(w_img - TEMPLATE_W) <= SIZE_TOL_PCT * TEMPLATE_W) and (abs(h_img - TEMPLATE_H) <= SIZE_TOL_PCT * TEMPLATE_H)
        warped = None
        used_method = None
        H_template_to_img = None
        H_img_to_template = None
        stats = {}
        confidence = 0.0
        doc_area_ratio = 0.0
        # 1) Try feature homography if template available
        if template_gray is not None and not args.force_warp:
            img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            H_t2i, stats = compute_homography_via_features(template_gray, img_gray)
            if H_t2i is not None:
                # invert to get image->template
                H_i2t = safe_inverse(H_t2i)
                if H_i2t is not None:
                    warped_candidate = warp_image_with_H(img, H_i2t)
                    if warped_candidate is not None:
                        warped = warped_candidate
                        used_method = 'feature_homography'
                        H_template_to_img = H_t2i
                        H_img_to_template = H_i2t
                        confidence = compute_alignment_confidence_from_stats(stats, fallback=False)
                        print(f"  -> feature_homography used (matches={stats.get('matches')}, inliers={stats.get('inliers')}, conf={confidence:.3f})")
                        if args.debug:
                            # save match visualization (limited)
                            try:
                                mm = cv2.drawMatches(template_img, stats.get('kp1'), img, stats.get('kp2'), stats.get('matches_list')[:50], None, flags=cv2.DrawMatchesFlags_NOT_DRAW_SINGLE_POINTS)
                                cv2.imwrite(os.path.join(debug_folder, "feature_matches.jpg"), mm)
                            except Exception:
                                pass
                    else:
                        print("  -> feature homography inverse warp failed.")
                else:
                    print("  -> Homography invert failed.")
            else:
                # keep stats for later
                stats = stats or {}
                # don't exit; will try contour fallback below
                pass

        # 2) If no good feature result, or template not provided, try contour-based detection using adaptive/otsu thresholds
        if warped is None:
            if size_diff_ok and not args.force_warp:
                warped = img.copy()
                used_method = 'identity_size_match'
                confidence = 0.95
                print("  -> Image matches template size — using identity (no warp).")
            else:
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                # try adaptive and otsu binarizations
                candidates = []
                try:
                    adapt = cv2.adaptiveThreshold(gray,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY,51,10)
                    candidates.append(('adaptive', adapt))
                    candidates.append(('adaptive_inv', cv2.bitwise_not(adapt)))
                except Exception:
                    pass
                try:
                    _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                    candidates.append(('otsu', otsu))
                    candidates.append(('otsu_inv', cv2.bitwise_not(otsu)))
                except Exception:
                    pass
                # also include simple edges
                edges = cv2.Canny(gray, 50, 150)
                candidates.append(('edges', edges))
                found = False
                found_corners = None
                found_area_ratio = 0.0
                for name, binimg in candidates:
                    # morphological close to join borders
                    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (11,11))
                    closed = cv2.morphologyEx(binimg, cv2.MORPH_CLOSE, kernel)
                    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                    if not contours:
                        if args.debug:
                            cv2.imwrite(os.path.join(debug_folder, f"bin_{name}.jpg"), binimg)
                        continue
                    contours = sorted(contours, key=cv2.contourArea, reverse=True)
                    img_area = gray.shape[0] * gray.shape[1]
                    for cnt in contours[:10]:
                        area = cv2.contourArea(cnt)
                        if area < (MIN_DOC_AREA_RATIO * img_area):
                            continue
                        peri = cv2.arcLength(cnt, True)
                        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
                        if len(approx) == 4:
                            pts = approx.reshape(4,2)
                            ordered = order_points(pts)
                            found = True
                            found_corners = ordered
                            found_area_ratio = area / img_area
                            if args.debug:
                                vis = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
                                cv2.drawContours(vis, [approx], -1, (0,255,0), 3)
                                for i,p in enumerate(ordered):
                                    cv2.circle(vis, tuple(p.astype(int)), 6, (0,0,255), -1)
                                cv2.imwrite(os.path.join(debug_folder, f"found_{name}.jpg"), vis)
                            break
                        # else continue
                    if found: break
                # Hough-lines fallback
                if not found:
                    # try Hough-lines rectangle estimation
                    lines = cv2.HoughLinesP(edges, 1, math.pi/180, threshold=100, minLineLength=int(min(gray.shape)*0.4), maxLineGap=50)
                    if lines is not None:
                        pts_list = []
                        for (x1,y1,x2,y2) in lines.reshape(-1,4):
                            pts_list.append([x1,y1]); pts_list.append([x2,y2])
                        pts_arr = np.array(pts_list, dtype=np.float32)
                        rect = cv2.minAreaRect(pts_arr)
                        box = cv2.boxPoints(rect)
                        ordered = order_points(box)
                        found = True
                        found_corners = ordered
                        found_area_ratio = (cv2.contourArea(box) / (gray.shape[0]*gray.shape[1]))
                        if args.debug:
                            vis = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
                            for i in range(4):
                                cv2.circle(vis, tuple(ordered[i].astype(int)), 6, (255,0,0), -1)
                            cv2.imwrite(os.path.join(debug_folder, "found_hough.jpg"), vis)
                # if found corners, compute H
                if found and found_corners is not None and found_area_ratio > MIN_DOC_AREA_RATIO:
                    dst = np.array([[0,0],[TEMPLATE_W-1,0],[TEMPLATE_W-1,TEMPLATE_H-1],[0,TEMPLATE_H-1]], dtype=np.float32)
                    H_t2i = cv2.getPerspectiveTransform(dst, found_corners.astype(np.float32))  # template->image
                    H_i2t = safe_inverse(H_t2i)
                    if H_i2t is not None:
                        warped_candidate = warp_image_with_H(img, H_i2t)
                        # quick blank check of warped candidate
                        if warped_candidate is not None:
                            gray_w = cv2.cvtColor(warped_candidate, cv2.COLOR_BGR2GRAY)
                            blank_frac = float(np.mean(gray_w >= 245))
                            if blank_frac > 0.90:
                                # reject and fallback
                                print(f"  -> doc_detect produce mostly-blank warp (frac {blank_frac:.3f}), rejecting.")
                            else:
                                warped = warped_candidate
                                used_method = 'doc_detect'
                                H_template_to_img = H_t2i
                                H_img_to_template = H_i2t
                                confidence = compute_alignment_confidence_from_stats({}, fallback=True, doc_area_ratio=found_area_ratio)
                                doc_area_ratio = found_area_ratio
                                print(f"  -> doc_detect used (area_ratio={found_area_ratio:.4f}, conf={confidence:.3f})")
                # if still not warped, last resort: resize or identity
                if warped is None:
                    if size_diff_ok:
                        warped = img.copy()
                        used_method = 'identity_after_failed_detection'
                        confidence = 0.5
                        print("  -> detection failed; image size matches template -> using identity (safer).")
                    else:
                        warped = cv2.resize(img, (TEMPLATE_W, TEMPLATE_H), interpolation=cv2.INTER_LINEAR)
                        used_method = 'simple_resize_fallback'
                        confidence = 0.0
                        print("  -> detection failed; used simple resize fallback.")
        # -------------- Now we have warped (image aligned to template coords) --------------
        if warped is None:
            print(f"  -> ERROR: could not produce warped aligned image for {img_name}. Skipping.")
            continue
        # save aligned image
        aligned_path = os.path.join(args.out_dir, f"{Path(img_name).stem}_aligned.jpg")
        cv2.imwrite(aligned_path, warped)
        if args.debug:
            cv2.imwrite(os.path.join(debug_folder, "warped_aligned.jpg"), warped)
        # compute residual mad vs template if template provided
        residual_mad = None
        if template_img is not None:
            tgray = cv2.cvtColor(template_img, cv2.COLOR_BGR2GRAY)
            wgray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
            try:
                residual_mad = float(np.mean(np.abs(tgray.astype(np.float32) - wgray.astype(np.float32))))
            except Exception:
                residual_mad = None
            if args.debug and residual_mad is not None:
                with open(os.path.join(debug_folder, "warp_vs_template_stats.txt"), "w") as f:
                    f.write(f"residual_mad_gray: {residual_mad:.4f}\n")
        # compute decomposition metrics
        transform_params = {}
        perspective_metrics = {}
        manual_reasons = []
        manual_flag = False
        if H_img_to_template is not None:
            # decompose H_img_to_template
            decomp = decompose_homography(H_img_to_template)
            transform_params.update(decomp)
            # compute perspective metrics from H_template_to_img (maps template->image)
            if H_template_to_img is not None:
                persp = measure_perspective_from_template_to_image(H_template_to_img, TEMPLATE_W, TEMPLATE_H)
                perspective_metrics.update(persp)
            else:
                perspective_metrics.update({'perspective_distortion_pct': 0.0, 'side_lengths': [], 'corner_points_image': []})
        else:
            # identity or resize used -> set zeros
            transform_params = {
                'rotation_deg': 0.0, 'scale_x': 1.0, 'scale_y': 1.0, 'shear': 0.0,
                'tx': 0.0, 'ty': 0.0, 'h20': 0.0, 'h21': 0.0
            }
            perspective_metrics = {'perspective_distortion_pct': 0.0, 'side_lengths': [], 'corner_points_image': []}
        # compute alignment confidence (if not already set)
        if confidence == 0.0:
            # try to compute from stats or fallback doc_area_ratio
            confidence = compute_alignment_confidence_from_stats(stats, fallback=(used_method and used_method.startswith('doc')), doc_area_ratio=doc_area_ratio)
        # add residual to metadata
        # manual check heuristics
        if confidence < CONFIDENCE_THRESHOLD:
            manual_reasons.append(f"low_confidence({confidence:.2f})")
        if residual_mad is not None and residual_mad > RESIDUAL_MAD_THRESHOLD:
            manual_reasons.append(f"high_residual_mad({residual_mad:.1f})")
        if abs(transform_params.get('rotation_deg',0.0)) > ROTATION_THRESHOLD_DEG:
            manual_reasons.append(f"high_rotation({transform_params.get('rotation_deg'):.1f}deg)")
        max_scale_pct = max(abs(transform_params.get('scale_x',1.0)-1.0)*100.0, abs(transform_params.get('scale_y',1.0)-1.0)*100.0)
        if max_scale_pct > SCALE_PERCENT_THRESHOLD:
            manual_reasons.append(f"scale_change({max_scale_pct:.1f}%)")
        if perspective_metrics.get('perspective_distortion_pct',0.0) > PERSPECTIVE_DISTORTION_PCT:
            manual_reasons.append(f"perspective_distortion({perspective_metrics.get('perspective_distortion_pct'):.1f}%)")
        manual_flag = len(manual_reasons) > 0
        # visualize boxes on warped
        vis = warped.copy()
        for _, row in group.iterrows():
            x = int(round(row['bbox_x'])); y = int(round(row['bbox_y'])); bw = int(round(row['bbox_width'])); bh = int(round(row['bbox_height']))
            cv2.rectangle(vis, (x,y), (x+bw, y+bh), (0,255,0), 2)
            cv2.putText(vis, str(row['label_name']), (x, max(10,y-6)), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0,0,255), 2)
        vis_path = os.path.join(args.out_dir, f"{Path(img_name).stem}_aligned_boxes.jpg")
        cv2.imwrite(vis_path, vis)
        if args.debug:
            cv2.imwrite(os.path.join(debug_folder, "warped_with_boxes.jpg"), vis)
        # crop per bbox and do blank/variance checks
        crops_meta = {}
        for _, row in group.iterrows():
            label = str(row['label_name'])
            bbox = {'bbox_x': float(row['bbox_x']), 'bbox_y': float(row['bbox_y']),
                    'bbox_width': float(row['bbox_width']), 'bbox_height': float(row['bbox_height'])}
            crop = crop_bbox_from_template_coords(warped, bbox, pad=args.pad)
            crop_path = None
            warnings = []
            if crop is None:
                warnings.append("invalid_crop")
            else:
                crop_path = os.path.join(args.out_dir, f"{Path(img_name).stem}_{label}.jpg")
                cv2.imwrite(crop_path, crop)
                if is_mostly_blank(crop, white_thresh=args.white_thresh, pct=args.blank_pct):
                    warnings.append("mostly_blank")
                var = float(np.var(cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)))
                if var < args.variance_thresh:
                    warnings.append(f"low_variance({var:.2f})")
            crops_meta[label] = {'crop_path': crop_path, 'bbox': bbox, 'warnings': warnings}
            # if crop warnings, mark manual check
            if len(warnings) > 0 and "mostly_blank" in warnings:
                if "mostly_blank_crop" not in manual_reasons:
                    manual_reasons.append("mostly_blank_crop")
                    manual_flag = True
        # build per-image metadata
        meta = {
            'image_name': img_name,
            'used_method': used_method,
            'aligned_image': aligned_path,
            'visualization': vis_path,
            'transform_params': transform_params,
            'perspective_metrics': perspective_metrics,
            'alignment_confidence': confidence,
            'residual_mad': residual_mad,
            'manual_check_needed': manual_flag,
            'manual_check_reasons': manual_reasons,
            'crops': crops_meta
        }
        # save per-image meta
        with open(os.path.join(args.out_dir, f"{Path(img_name).stem}_meta.json"), 'w') as f:
            json.dump(meta, f, indent=2)
        # add to summary
        summary[img_name] = {
            'alignment_confidence': confidence,
            'residual_mad': residual_mad,
            'rotation_deg': transform_params.get('rotation_deg'),
            'scale_x': transform_params.get('scale_x'),
            'scale_y': transform_params.get('scale_y'),
            'tx': transform_params.get('tx'),
            'ty': transform_params.get('ty'),
            'perspective_distortion_pct': perspective_metrics.get('perspective_distortion_pct'),
            'manual_check_needed': meta['manual_check_needed'],
            'manual_check_reasons': meta['manual_check_reasons']
        }
        print(f"  -> Saved aligned and metadata for {img_name} (conf={confidence:.3f}, residual_mad={residual_mad})")
    # save overall summary
    with open(os.path.join(args.out_dir, "summary.json"), 'w') as f:
        json.dump(summary, f, indent=2)
    print("\nAll done. Review ./output and ./output/debug (if debug enabled).")

# ---------- CLI ----------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Segment answer sheets and compute alignment/correction metrics.")
    parser.add_argument("--bbox_csv", default="./label.csv", help="CSV file with template bbox coords (default ./label.csv)")
    parser.add_argument("--images_dir", default="./answersheet", help="Directory with scanned images (default ./answersheet)")
    parser.add_argument("--template", required=False, help="Optional clean template image (1700x2200) to improve feature homography")
    parser.add_argument("--out_dir", default="./output", help="Output directory (default ./output)")
    parser.add_argument("--pad", type=int, default=8, help="Padding (px) around crops")
    parser.add_argument("--debug", action="store_true", help="Save debug images to ./output/debug/<image>/")
    parser.add_argument("--white_thresh", type=int, default=245, help="Threshold for white detection")
    parser.add_argument("--blank_pct", type=float, default=0.98, help="Fraction to treat crop as blank")
    parser.add_argument("--variance_thresh", type=float, default=20.0, help="Variance threshold for low-variance detection")
    parser.add_argument("--force_warp", action="store_true", help="Force warping even if sizes nearly match")
    args = parser.parse_args()
    # create out dir
    debug_mkdir(args.out_dir)
    process_images(args)
