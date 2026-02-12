Built an AI-driven system to segment and evaluate handwritten exam answer sheets. The project combines computer-vision segmentation, OCR, and LLM-based evaluation to automate scoring workflows for paper-based exams.

Key ideas:

- Precise answer-level segmentation using Mask R-CNN / Mask R-CNN variants and other segmentation tools.
- OCR/recognition pipelines (EasyOCR, PaddleOCR, Tesseract/Evaluations) and custom post-processing for handwritten text and layout noise.
- LLM-assisted evaluation (LLaMA 2) for automated answer grading and feedback generation.

Repository (backend core): https://github.com/Nithisx/Autoevalai.git

**Tech stack**

- Backend: Node.js (Express) — RESTful APIs and business logic. (See backend/ folder)
- Frontend: Vite-based single-page app (React / similar) — UI for teachers/students. (See frontend/ folder)
- Models & CV: Python notebooks and scripts — Mask R-CNN, YOLO, DBNet, EasyOCR, PaddleOCR, custom trainers and evaluation scripts (see Alignment/, Models/, and other notebooks)
- Database: SQL migrations and model files present in `backend/Migration` and `backend/Model` (typical setup uses a relational DB; migration SQL files included)
- Authentication: JWT-based (see `backend/Utils/Jwt.js`)

**What this repo contains (high-level)**

- `backend/` — Server, API controllers, models, migrations, middleware, and upload handlers for the core AutoEval REST API.
- `frontend/` — Client app (Vite) for interacting with the system (teacher dashboards, uploading answers, reviewing results).
- `Alignment/` — Notebooks and scripts for segmentation, OCR experiments, and model training (Mask R-CNN, DBNet, OCR pipelines).
- `Models/`, `Oralexam/`, `Vectordb/` — Additional services and experiments: QA/oral exam tooling, vector DB helpers, small model runners.
- `Dataset/Images`, `uploads/` — Example inputs and upload storage.

**Quick Start (developer)**
Prerequisites: Node.js (16+), Python (3.8+), a relational DB (Postgres/MySQL/SQLite), and GPU drivers if training CV models.

1. Backend (API)

Install dependencies and start the server (from `backend/`):

```bash
cd backend
npm install
# common scripts: npm run dev  or  npm start
```

2. Frontend (dev)

```bash
cd frontend
npm install
# common scripts: npm run dev  or  npm start
```

3. Models & Notebooks

Open the Jupyter notebooks in `Alignment/` or other model folders to run segmentation/OCR experiments. Install Python dependencies from `requirements.txt` files near the notebooks.

```bash
python -m venv .venv
source .venv/Scripts/activate    # Windows: .venv\\Scripts\\activate
pip install -r Alignment/requirements.txt
jupyter notebook
```

**APIs & workflows (overview)**

- Authentication: JWT endpoints in `backend/Controllers/Authcontroller.js`.
- Resource CRUD: Classes, Exams, Students, TeacherAnswers, StudentAnswers routes under `backend/Routes`.
- Uploads: file upload middleware in `backend/Middleware/Uploadmiddleware.js` and storage under `backend/uploads/`.
- Scoring: automated scoring pipeline integrates segmentation -> OCR -> LLM evaluation and emits results stored via `Resultcontroller.js`.

**Notebooks and experiments**

- `Alignment/` contains training and evaluation notebooks for segmentation and OCR experiments (Mask R-CNN, DBNet, YOLO variants and grouping/word segmentation flows).

**Folder snapshot**

- backend/ • Server.js, controllers, models, routes, migrations
- frontend/ • Vite app and UI
- Alignment/ • CV notebooks, training scripts
- Models/, Vectordb/, Oralexam/ • experiment and auxiliary services


