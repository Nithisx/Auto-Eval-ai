#!/usr/bin/env python3
"""
Segment.py - FastAPI Image Segmentation Service

Based on segment_answers_with_metrics.py with FastAPI integration.
Reads CSV template coordinates and processes uploaded images.

Key features:
 - Robust alignment (feature homography -> contour detection -> safe fallbacks)
 - Transform decomposition (rotation, scale, shear, translation)
 - Perspective distortion measurement
 - Alignment confidence + residual MAD
 - Manual check flags with reasons
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import pandas as pd
import base64
import io
import os
import json
import math
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional
import uvicorn

app = FastAPI(title="Image Segmentation Service", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

def json_serialize(obj):
    """Convert numpy types and other non-serializable objects to JSON-compatible types"""
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    elif isinstance(obj, dict):
        return {k: json_serialize(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [json_serialize(item) for item in obj]
    else:
        return obj

def debug_mkdir(p): 
    Path(p).mkdir(parents=True, exist_ok=True)

def read_bboxes(csv_path: str) -> pd.DataFrame:
    if not os.path.exists(csv_path):
        # Create default template if CSV doesn't exist
        default_data = {
            'label_name': ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'],
            'bbox_x': [100, 100, 100, 100, 100],
            'bbox_y': [200, 400, 600, 800, 1000],
            'bbox_width': [300, 300, 300, 300, 300],
            'bbox_height': [150, 150, 150, 150, 150],
            'image_name': ['template.jpg', 'template.jpg', 'template.jpg', 'template.jpg', 'template.jpg']
        }
        return pd.DataFrame(default_data)
    
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

def is_mostly_blank(img: np.ndarray, white_thresh=245, pct=0.98) -> bool:
    if img is None:
        return True
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim==3 else img
    total = gray.size
    white_pixels = np.sum(gray >= white_thresh)
    return (white_pixels / total) >= pct

def crop_bbox_from_template_coords(warped_img: np.ndarray, bbox: Dict[str,Any], pad=8):
    """Crop bounding box from template-aligned image with padding"""
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

def process_single_image(image_bytes, filename="image"):
    """
    Process a single image following the exact segmentation algorithm structure
    """
    try:
        # Convert bytes to numpy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise ValueError("Could not decode image")
        
        h_img, w_img = img.shape[:2]
        print(f"Processing {filename} (size {w_img}x{h_img}) ...")
        
        # Load bounding boxes from CSV
        df = read_bboxes("./label.csv")
        
        # Create template if available (blank white template)
        template_img = np.ones((TEMPLATE_H, TEMPLATE_W, 3), dtype=np.uint8) * 255
        template_gray = cv2.cvtColor(template_img, cv2.COLOR_BGR2GRAY)
        
        # Check if sizes match to avoid warping
        size_diff_ok = (abs(w_img - TEMPLATE_W) <= SIZE_TOL_PCT * TEMPLATE_W) and (abs(h_img - TEMPLATE_H) <= SIZE_TOL_PCT * TEMPLATE_H)
        
        warped = None
        used_method = None
        H_template_to_img = None
        H_img_to_template = None
        stats = {}
        confidence = 0.0
        doc_area_ratio = 0.0
        
        # 1) If sizes match, use identity
        if size_diff_ok:
            warped = img.copy()
            used_method = 'identity_size_match'
            confidence = 0.95
            print("  -> Image matches template size — using identity (no warp).")
        else:
            # 2) Try contour-based detection using adaptive/otsu thresholds
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            candidates = []
            
            try:
                adapt = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 51, 10)
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
            
            edges = cv2.Canny(gray, 50, 150)
            candidates.append(('edges', edges))
            
            found = False
            found_corners = None
            found_area_ratio = 0.0
            
            for name, binimg in candidates:
                kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (11, 11))
                closed = cv2.morphologyEx(binimg, cv2.MORPH_CLOSE, kernel)
                contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                if not contours:
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
                        pts = approx.reshape(4, 2)
                        ordered = order_points(pts)
                        found = True
                        found_corners = ordered
                        found_area_ratio = area / img_area
                        break
                if found:
                    break
            
            # If found corners, compute homography
            if found and found_corners is not None and found_area_ratio > MIN_DOC_AREA_RATIO:
                dst = np.array([[0, 0], [TEMPLATE_W-1, 0], [TEMPLATE_W-1, TEMPLATE_H-1], [0, TEMPLATE_H-1]], dtype=np.float32)
                H_t2i = cv2.getPerspectiveTransform(dst, found_corners.astype(np.float32))
                H_i2t = safe_inverse(H_t2i)
                if H_i2t is not None:
                    warped_candidate = warp_image_with_H(img, H_i2t)
                    if warped_candidate is not None:
                        gray_w = cv2.cvtColor(warped_candidate, cv2.COLOR_BGR2GRAY)
                        blank_frac = float(np.mean(gray_w >= 245))
                        if blank_frac <= 0.90:
                            warped = warped_candidate
                            used_method = 'doc_detect'
                            H_template_to_img = H_t2i
                            H_img_to_template = H_i2t
                            confidence = compute_alignment_confidence_from_stats({}, fallback=True, doc_area_ratio=found_area_ratio)
                            doc_area_ratio = found_area_ratio
                            print(f"  -> doc_detect used (area_ratio={found_area_ratio:.4f}, conf={confidence:.3f})")
                        else:
                            print(f"  -> doc_detect produce mostly-blank warp (frac {blank_frac:.3f}), rejecting.")
            
            # Fallback to resize
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
        
        if warped is None:
            raise ValueError("Could not produce warped aligned image")
        
        # Compute residual MAD vs template
        residual_mad = None
        if template_img is not None:
            tgray = cv2.cvtColor(template_img, cv2.COLOR_BGR2GRAY)
            wgray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
            try:
                residual_mad = float(np.mean(np.abs(tgray.astype(np.float32) - wgray.astype(np.float32))))
            except Exception:
                residual_mad = None
        
        # Compute decomposition metrics
        transform_params = {}
        perspective_metrics = {}
        manual_reasons = []
        manual_flag = False
        
        if H_img_to_template is not None:
            decomp = decompose_homography(H_img_to_template)
            transform_params.update(decomp)
            if H_template_to_img is not None:
                persp = measure_perspective_from_template_to_image(H_template_to_img, TEMPLATE_W, TEMPLATE_H)
                perspective_metrics.update(persp)
            else:
                perspective_metrics.update({'perspective_distortion_pct': 0.0, 'side_lengths': [], 'corner_points_image': []})
        else:
            transform_params = {
                'rotation_deg': 0.0, 'scale_x': 1.0, 'scale_y': 1.0, 'shear': 0.0,
                'tx': 0.0, 'ty': 0.0, 'h20': 0.0, 'h21': 0.0
            }
            perspective_metrics = {'perspective_distortion_pct': 0.0, 'side_lengths': [], 'corner_points_image': []}
        
        # Manual check heuristics
        if confidence < CONFIDENCE_THRESHOLD:
            manual_reasons.append(f"low_confidence({confidence:.2f})")
        if residual_mad is not None and residual_mad > RESIDUAL_MAD_THRESHOLD:
            manual_reasons.append(f"high_residual_mad({residual_mad:.1f})")
        if abs(transform_params.get('rotation_deg', 0.0)) > ROTATION_THRESHOLD_DEG:
            manual_reasons.append(f"high_rotation({transform_params.get('rotation_deg'):.1f}deg)")
        
        max_scale_pct = max(abs(transform_params.get('scale_x', 1.0)-1.0)*100.0, abs(transform_params.get('scale_y', 1.0)-1.0)*100.0)
        if max_scale_pct > SCALE_PERCENT_THRESHOLD:
            manual_reasons.append(f"scale_change({max_scale_pct:.1f}%)")
        if perspective_metrics.get('perspective_distortion_pct', 0.0) > PERSPECTIVE_DISTORTION_PCT:
            manual_reasons.append(f"perspective_distortion({perspective_metrics.get('perspective_distortion_pct'):.1f}%)")
        
        manual_flag = len(manual_reasons) > 0
        
        # Visualize boxes on warped using CSV bounding boxes
        vis = warped.copy()
        detected_regions = []
        
        for _, row in df.iterrows():
            x = int(round(row['bbox_x']))
            y = int(round(row['bbox_y'])) 
            bw = int(round(row['bbox_width']))
            bh = int(round(row['bbox_height']))
            cv2.rectangle(vis, (x, y), (x + bw, y + bh), (0, 255, 0), 2)
            cv2.putText(vis, str(row['label_name']), (x, max(10, y-6)), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)
            
            detected_regions.append({
                'region_id': len(detected_regions) + 1,
                'x': x, 'y': y, 'width': bw, 'height': bh,
                'area': bw * bh,
                'type': 'question_region',
                'label': str(row['label_name'])
            })
        
        # Convert processed image to base64
        _, buffer = cv2.imencode('.jpg', vis)
        processed_image_b64 = base64.b64encode(buffer).decode('utf-8')
        
        # Crop per bbox for individual analysis
        crops_meta = {}
        for _, row in df.iterrows():
            label = str(row['label_name'])
            bbox = {'bbox_x': float(row['bbox_x']), 'bbox_y': float(row['bbox_y']),
                    'bbox_width': float(row['bbox_width']), 'bbox_height': float(row['bbox_height'])}
            crop = crop_bbox_from_template_coords(warped, bbox, pad=8)
            warnings = []
            if crop is None:
                warnings.append("invalid_crop")
            else:
                if is_mostly_blank(crop, white_thresh=245, pct=0.98):
                    warnings.append("mostly_blank")
                var = float(np.var(cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)))
                if var < 20.0:
                    warnings.append(f"low_variance({var:.2f})")
            
            crops_meta[label] = {'bbox': bbox, 'warnings': warnings}
            if len(warnings) > 0 and "mostly_blank" in warnings:
                if "mostly_blank_crop" not in manual_reasons:
                    manual_reasons.append("mostly_blank_crop")
                    manual_flag = True
        
        # Generate summary with JSON serialization
        summary = json_serialize({
            'image_name': filename,
            'used_method': used_method,
            'alignment_confidence': confidence,
            'residual_mad': residual_mad,
            'manual_check_needed': manual_flag,
            'manual_check_reasons': manual_reasons,
            'transform_params': transform_params,
            'perspective_metrics': perspective_metrics,
            'image_dimensions': {'width': w_img, 'height': h_img},
            'template_dimensions': {'width': TEMPLATE_W, 'height': TEMPLATE_H},
            'detected_regions': detected_regions,
            'total_regions_detected': len(detected_regions),
            'doc_area_ratio': doc_area_ratio,
            'crops': crops_meta,
            'processing_notes': [
                f"Used method: {used_method}",
                f"Alignment confidence: {confidence:.3f}",
                f"Detected {len(detected_regions)} regions",
                f"Manual check needed: {'Yes' if manual_flag else 'No'}",
                f"Transform: rotation={transform_params.get('rotation_deg', 0):.1f}°, scale=({transform_params.get('scale_x', 1):.2f}, {transform_params.get('scale_y', 1):.2f})",
                "Segmentation analysis completed"
            ],
            'quality_metrics': {
                'paper_quality': 'Good' if confidence > 0.8 else 'Fair' if confidence > 0.5 else 'Poor',
                'blur_score': residual_mad,
                'edge_density': len(detected_regions) / (w_img * h_img) * 1000000,
                'blank_check': is_mostly_blank(warped)
            }
        })
        
        print(f"  -> Processed {filename} successfully (conf={confidence:.3f}, regions={len(detected_regions)})")
        return processed_image_b64, summary
        
    except Exception as e:
        raise Exception(f"Error processing image {filename}: {str(e)}")

def process_single_image_with_alignment(img: np.ndarray, filename: str, img_idx: int):
    """
    Process single image with full alignment pipeline from the original code
    """
    try:
        h_img, w_img = img.shape[:2]
        print(f"\nProcessing {filename} (size {w_img}x{h_img}) ...")
        
        # Create template (blank white template for now, can be enhanced later)
        template_img = np.ones((TEMPLATE_H, TEMPLATE_W, 3), dtype=np.uint8) * 255
        template_gray = cv2.cvtColor(template_img, cv2.COLOR_BGR2GRAY)
        
        # Check if sizes match to avoid warping
        size_diff_ok = (abs(w_img - TEMPLATE_W) <= SIZE_TOL_PCT * TEMPLATE_W) and (abs(h_img - TEMPLATE_H) <= SIZE_TOL_PCT * TEMPLATE_H)
        
        warped = None
        used_method = None
        H_template_to_img = None
        H_img_to_template = None
        stats = {}
        confidence = 0.0
        doc_area_ratio = 0.0
        
        # 1) Try feature homography if template available
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
                else:
                    print("  -> feature homography inverse warp failed.")
            else:
                print("  -> Homography invert failed.")
        
        # 2) If no good feature result, try contour-based detection
        if warped is None:
            if size_diff_ok:
                warped = img.copy()
                used_method = 'identity_size_match'
                confidence = 0.95
                print("  -> Image matches template size — using identity (no warp).")
            else:
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                # Try adaptive and otsu binarizations
                candidates = []
                try:
                    adapt = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 51, 10)
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
                
                edges = cv2.Canny(gray, 50, 150)
                candidates.append(('edges', edges))
                
                found = False
                found_corners = None
                found_area_ratio = 0.0
                
                for name, binimg in candidates:
                    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (11, 11))
                    closed = cv2.morphologyEx(binimg, cv2.MORPH_CLOSE, kernel)
                    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                    if not contours:
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
                            pts = approx.reshape(4, 2)
                            ordered = order_points(pts)
                            found = True
                            found_corners = ordered
                            found_area_ratio = area / img_area
                            break
                    if found:
                        break
                
                # Hough-lines fallback
                if not found:
                    lines = cv2.HoughLinesP(edges, 1, math.pi/180, threshold=100, 
                                          minLineLength=int(min(gray.shape)*0.4), maxLineGap=50)
                    if lines is not None:
                        pts_list = []
                        for (x1, y1, x2, y2) in lines.reshape(-1, 4):
                            pts_list.append([x1, y1])
                            pts_list.append([x2, y2])
                        pts_arr = np.array(pts_list, dtype=np.float32)
                        rect = cv2.minAreaRect(pts_arr)
                        box = cv2.boxPoints(rect)
                        ordered = order_points(box)
                        found = True
                        found_corners = ordered
                        found_area_ratio = (cv2.contourArea(box) / (gray.shape[0]*gray.shape[1]))
                
                # If found corners, compute homography
                if found and found_corners is not None and found_area_ratio > MIN_DOC_AREA_RATIO:
                    dst = np.array([[0, 0], [TEMPLATE_W-1, 0], [TEMPLATE_W-1, TEMPLATE_H-1], [0, TEMPLATE_H-1]], dtype=np.float32)
                    H_t2i = cv2.getPerspectiveTransform(dst, found_corners.astype(np.float32))
                    H_i2t = safe_inverse(H_t2i)
                    if H_i2t is not None:
                        warped_candidate = warp_image_with_H(img, H_i2t)
                        if warped_candidate is not None:
                            gray_w = cv2.cvtColor(warped_candidate, cv2.COLOR_BGR2GRAY)
                            blank_frac = float(np.mean(gray_w >= 245))
                            if blank_frac <= 0.90:
                                warped = warped_candidate
                                used_method = 'doc_detect'
                                H_template_to_img = H_t2i
                                H_img_to_template = H_i2t
                                confidence = compute_alignment_confidence_from_stats({}, fallback=True, doc_area_ratio=found_area_ratio)
                                doc_area_ratio = found_area_ratio
                                print(f"  -> doc_detect used (area_ratio={found_area_ratio:.4f}, conf={confidence:.3f})")
                            else:
                                print(f"  -> doc_detect produce mostly-blank warp (frac {blank_frac:.3f}), rejecting.")
                
                # Last resort fallback
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
        
        if warped is None:
            raise ValueError(f"Could not produce warped aligned image for {filename}")
        
        # Compute residual MAD vs template
        residual_mad = None
        if template_img is not None:
            tgray = cv2.cvtColor(template_img, cv2.COLOR_BGR2GRAY)
            wgray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
            try:
                residual_mad = float(np.mean(np.abs(tgray.astype(np.float32) - wgray.astype(np.float32))))
            except Exception:
                residual_mad = None
        
        # Compute transform decomposition and perspective metrics
        transform_params = {}
        perspective_metrics = {}
        manual_reasons = []
        manual_flag = False
        
        if H_img_to_template is not None:
            decomp = decompose_homography(H_img_to_template)
            transform_params.update(decomp)
            if H_template_to_img is not None:
                persp = measure_perspective_from_template_to_image(H_template_to_img, TEMPLATE_W, TEMPLATE_H)
                perspective_metrics.update(persp)
            else:
                perspective_metrics.update({'perspective_distortion_pct': 0.0, 'side_lengths': [], 'corner_points_image': []})
        else:
            transform_params = {
                'rotation_deg': 0.0, 'scale_x': 1.0, 'scale_y': 1.0, 'shear': 0.0,
                'tx': 0.0, 'ty': 0.0, 'h20': 0.0, 'h21': 0.0
            }
            perspective_metrics = {'perspective_distortion_pct': 0.0, 'side_lengths': [], 'corner_points_image': []}
        
        # Manual check heuristics
        if confidence < CONFIDENCE_THRESHOLD:
            manual_reasons.append(f"low_confidence({confidence:.2f})")
        if residual_mad is not None and residual_mad > RESIDUAL_MAD_THRESHOLD:
            manual_reasons.append(f"high_residual_mad({residual_mad:.1f})")
        if abs(transform_params.get('rotation_deg', 0.0)) > ROTATION_THRESHOLD_DEG:
            manual_reasons.append(f"high_rotation({transform_params.get('rotation_deg'):.1f}deg)")
        max_scale_pct = max(abs(transform_params.get('scale_x', 1.0)-1.0)*100.0, abs(transform_params.get('scale_y', 1.0)-1.0)*100.0)
        if max_scale_pct > SCALE_PERCENT_THRESHOLD:
            manual_reasons.append(f"scale_change({max_scale_pct:.1f}%)")
        if perspective_metrics.get('perspective_distortion_pct', 0.0) > PERSPECTIVE_DISTORTION_PCT:
            manual_reasons.append(f"perspective_distortion({perspective_metrics.get('perspective_distortion_pct'):.1f}%)")
        manual_flag = len(manual_reasons) > 0
        
        return warped, {
            'used_method': used_method,
            'transform_params': transform_params,
            'perspective_metrics': perspective_metrics,
            'alignment_confidence': confidence,
            'residual_mad': residual_mad,
            'manual_check_needed': manual_flag,
            'manual_check_reasons': manual_reasons,
            'doc_area_ratio': doc_area_ratio
        }
        
    except Exception as e:
        print(f"❌ Error processing image {filename}: {str(e)}")
        raise e

def crop_questions_from_images(image_list, filenames):
    """
    Process and crop questions from exactly 2 images with full alignment pipeline
    """
    try:
        print(f"🔍 Starting complete image processing pipeline for {len(image_list)} images")
        
        # Load CSV with bounding boxes
        try:
            label_df = read_bboxes('label.csv')
            print(f"📋 Loaded {len(label_df)} question regions from CSV")
        except Exception as csv_error:
            print(f"⚠️ Could not load label.csv: {csv_error}")
            raise ValueError(f"Could not load question dimensions: {csv_error}")
        
        cropped_questions = []
        image_metadata = {}
        
        # Process each image with full alignment pipeline
        for img_idx, (image, filename) in enumerate(zip(image_list, filenames)):
            print(f"📄 Processing image {img_idx + 1}: {filename}")
            
            # Apply full preprocessing and alignment pipeline
            warped_image, metadata = process_single_image_with_alignment(image, filename, img_idx)
            
            # Store image metadata
            page_name = f"{img_idx + 1}.jpg"
            image_metadata[page_name] = metadata
            
            # Get questions for this page
            page_questions = label_df[label_df['image_name'] == page_name]
            print(f"🔍 Found {len(page_questions)} questions for page {page_name}")
            
            # Crop each question from the aligned/warped image
            for _, question_row in page_questions.iterrows():
                try:
                    question_name = question_row['label_name']
                    bbox = {
                        'bbox_x': float(question_row['bbox_x']),
                        'bbox_y': float(question_row['bbox_y']),
                        'bbox_width': float(question_row['bbox_width']),
                        'bbox_height': float(question_row['bbox_height'])
                    }
                    
                    print(f"✂️ Cropping {question_name}: ({bbox['bbox_x']}, {bbox['bbox_y']}) {bbox['bbox_width']}x{bbox['bbox_height']}")
                    
                    # Crop using the template coordinates from aligned image
                    crop = crop_bbox_from_template_coords(warped_image, bbox, pad=8)
                    
                    if crop is not None:
                        # Convert to base64
                        _, buffer = cv2.imencode('.jpg', crop)
                        cropped_b64 = base64.b64encode(buffer).decode('utf-8')
                        
                        # Check for blank/low variance
                        warnings = []
                        if is_mostly_blank(crop, white_thresh=245, pct=0.98):
                            warnings.append("mostly_blank")
                        var = float(np.var(cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)))
                        if var < 20.0:
                            warnings.append(f"low_variance({var:.2f})")
                        
                        cropped_questions.append({
                            'question_name': question_name,
                            'page_number': img_idx + 1,
                            'original_filename': filename,
                            'cropped_image': cropped_b64,
                            'bbox': {
                                'x': int(bbox['bbox_x']), 'y': int(bbox['bbox_y']), 
                                'width': int(bbox['bbox_width']), 'height': int(bbox['bbox_height'])
                            },
                            'dimensions': f"{int(bbox['bbox_width'])}x{int(bbox['bbox_height'])}",
                            'warnings': warnings
                        })
                        
                        print(f"✅ Successfully cropped {question_name}")
                    else:
                        print(f"❌ Could not crop {question_name} - invalid crop region")
                        
                except Exception as crop_error:
                    print(f"❌ Error cropping {question_name}: {crop_error}")
                    continue
        
        print(f"📊 Successfully cropped {len(cropped_questions)} questions total")
        
        # Create comprehensive summary
        summary = {
            'total_questions_cropped': len(cropped_questions),
            'pages_processed': len(image_list),
            'questions_per_page': {
                f'page_{i+1}': len([q for q in cropped_questions if q['page_number'] == i+1])
                for i in range(len(image_list))
            },
            'processing_status': 'completed',
            'all_questions': [q['question_name'] for q in cropped_questions],
            'image_metadata': image_metadata  # Include detailed alignment metrics
        }
        
        return cropped_questions, json_serialize(summary)
        
    except Exception as e:
        print(f"❌ Error in question cropping: {str(e)}")
        import traceback
        traceback.print_exc()
        raise e

@app.post("/segment")
async def segment_images(images: List[UploadFile] = File(...)):
    """
    Process exactly 2 images and crop individual questions based on label.csv
    """
    try:
        print(f"📥 Received {len(images)} images for segmentation")
        
        # Enforce exactly 2 images
        if len(images) != 2:
            raise HTTPException(status_code=400, detail=f"Exactly 2 images required, got {len(images)}")
        
        if not images:
            raise HTTPException(status_code=400, detail="No images provided")
        
        # Read and decode both images
        image_list = []
        filenames = []
        
        for idx, image in enumerate(images):
            print(f"🔍 Reading image {idx + 1}: {image.filename} (content-type: {image.content_type})")
            
            if not image.content_type.startswith('image/'):
                raise HTTPException(status_code=400, detail=f"File {image.filename} is not an image")
            
            # Read image bytes
            image_bytes = await image.read()
            print(f"📖 Read {len(image_bytes)} bytes from {image.filename}")
            
            # Convert to OpenCV image
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                raise HTTPException(status_code=400, detail=f"Could not decode image {image.filename}")
            
            image_list.append(img)
            filenames.append(image.filename)
            print(f"✅ Successfully loaded {image.filename} ({img.shape[1]}x{img.shape[0]})")
        
        # Crop questions from both images
        cropped_questions, crop_summary = crop_questions_from_images(image_list, filenames)
        
        print(f"📊 Cropped {len(cropped_questions)} questions total")
        
        # Serialize the response to ensure JSON compatibility
        response_data = json_serialize({
            'success': True,
            'message': f'Successfully processed {len(images)} images and cropped {len(cropped_questions)} questions',
            'cropped_questions': cropped_questions,
            'summary': crop_summary
        })
        
        return JSONResponse(content=response_data)
        
    except Exception as e:
        print(f"💥 Critical error in segment_images: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing images: {str(e)}")


@app.get("/")
async def root():
    return {"message": "Image Segmentation Service is running", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "image-segmentation"}

if __name__ == "__main__":
    print("🚀 Starting Image Segmentation Service...")
    print("📍 Service will be available at: http://localhost:8001")
    print("📖 API docs will be available at: http://localhost:8001/docs")
    
    uvicorn.run(
        "Segment:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )