# run_infer.py
from pathlib import Path
import numpy as np, cv2, torch
from ultralytics import YOLO
from mmocr.apis import MMOCRInferencer
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from PIL import Image

IMG = r"E:\EvaluationAI\Dataset\42.jpg"
OUT = Path(r"E:\EvaluationAI\autoevalaioutputs_v2"); OUT.mkdir(parents=True, exist_ok=True)

# 1) Load models
yolo = YOLO(r"E:\your_qnum_yolo\weights\best.pt")   # <-- your trained q-number detector
mmocr = MMOCRInferencer(det='DB_r18', rec=None)      # detector only
processor = TrOCRProcessor.from_pretrained("microsoft/trocr-base-handwritten")
trocr = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-base-handwritten").eval()

# 2) Read image
img = cv2.imread(IMG)
H, W = img.shape[:2]

# 3) Detect left anchors with YOLO
res = yolo.predict(source=IMG, imgsz=1024, conf=0.25, iou=0.5, verbose=False)[0]
anchors = []
for b in res.boxes:
    x0, y0, x1, y1 = map(int, b.xyxy[0].tolist())
    conf = float(b.conf[0])
    # read the visible number with a tiny ROI + crude digit OCR by shape (or rely on your dataset having class labels "2,3,4...").
    # Easiest: label each qnum with its *digit* as class (2,3,4...). Then:
    n = int(b.cls[0].item())  # class id == question number
    anchors.append({"n": n, "bbox":[x0,y0,x1,y1], "cy": (y0+y1)/2, "rx": x1})
anchors.sort(key=lambda a: a["cy"])

# 4) Choose vertical border (right edge of anchors + padding)
if anchors:
    x_border = int(np.percentile([a["rx"] for a in anchors], 90) + 10)
    x_border = min(max(x_border, int(0.08*W)), int(0.55*W))
else:
    x_border = int(0.18 * W)

# 5) Segment into question bands (midpoint to next anchor)
groups = []
for i, a in enumerate(anchors):
    y0 = 0 if i == 0 else int((anchors[i-1]["cy"] + a["cy"]) / 2)
    y1 = int((a["cy"] + (anchors[i+1]["cy"] if i+1 < len(anchors) else H-1)) / 2)
    y0 = max(0, y0 + 12); y1 = min(H-1, y1 - 12)
    groups.append({"label": f"Q{str(a['n']).zfill(3)}", "y0": y0, "y1": y1})

# 6) For each group: use DBNet++ to get word/line polygons to the right of border; crop lines & run TrOCR
def recog_line_trocr(bgr):
    pil = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
    inputs = processor(pil, return_tensors="pt")
    with torch.no_grad():
        out = trocr.generate(**{k:v for k,v in inputs.items()})
    return processor.batch_decode(out, skip_special_tokens=True)[0]

all_out = {"input": IMG, "border_x": x_border, "questions": []}
for g in groups:
    y0,y1 = g["y0"], g["y1"]
    roi_full = img[y0:y1, 0:W]
    roi_ocr  = img[y0:y1, x_border:W]
    # DBNet++ detect words/lines
    det = mmocr(roi_ocr, return_vis=False)
    polys = det["predictions"][0]["det_polygons"]  # list of polygons
    # sort by line (y); then by x
    items=[]
    for p in polys:
        p = np.array(p).reshape(-1,2)
        x0,y0p = p[:,0].min(), p[:,1].min()
        x1,y1p = p[:,0].max(), p[:,1].max()
        if (y1p-y0p) < 10: continue
        crop = roi_ocr[int(y0p):int(y1p), int(x0):int(x1)]
        if crop.size == 0: continue
        text = recog_line_trocr(crop)
        items.append({"y": (y0p+y1p)/2, "x": x0, "text": text})
    # line grouping
    items.sort(key=lambda t: (t["y"], t["x"]))
    lines=[]; cur=[]
    if items:
        cur=[items[0]]
        for it in items[1:]:
            if abs(it["y"] - cur[-1]["y"]) <= 14:
                cur.append(it)
            else:
                lines.append(" ".join([w["text"] for w in sorted(cur, key=lambda t:t["x"])]))
                cur=[it]
        lines.append(" ".join([w["text"] for w in sorted(cur, key=lambda t:t["x"])]))
    text_out="\n".join(lines)
    out_dir = OUT / "groups" / g["label"]; out_dir.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out_dir / "region.png"), roi_full)
    (out_dir / "text.txt").write_text(text_out, encoding="utf-8")
    all_out["questions"].append({"label": g["label"], "y_range": [g["y0"], g["y1"]],
                                 "image": f"groups/{g['label']}/region.png",
                                 "text_file": f"groups/{g['label']}/text.txt",
                                 "text": text_out})

(OUT / "questions.json").write_text(json.dumps(all_out, indent=2, ensure_ascii=False), encoding="utf-8")
print("Done:", OUT)
