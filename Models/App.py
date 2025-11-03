from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uvicorn
import logging
import os

# Try to import both evaluator implementations. The repository contains two
# EvaluationEngine variants: one using Google Gemini (Models/Eval.py) and one
# using a local Mistral/llama model (Models/Files/Evualate.py). We'll attempt
# to use the local model if the file exists, otherwise fall back to the Gemini
# API-based engine.
try:
    from Files.Evualate import EvaluationEngine as FileEvaluationEngine
except Exception:
    FileEvaluationEngine = None

try:
    from Eval import EvaluationEngine as ApiEvaluationEngine
except Exception:
    ApiEvaluationEngine = None

app = FastAPI(title="Student Answer Evaluation API")

logger = logging.getLogger("evaluation_service")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s - %(message)s")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React dev server
        "http://localhost:5173",  # Vite dev server
        "http://localhost:8080",  # Your backend
        "http://localhost:4000",  # Your main backend
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:4000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Initialize evaluation engine with preference: local model -> API-based
MODEL_FILENAME = "mistral-7b-instruct-v0.2.Q4_K_M.gguf"
_model_path = os.path.join(os.path.dirname(__file__), "Files", MODEL_FILENAME)

evaluator = None
_evaluator_load_error: Optional[str] = None

if FileEvaluationEngine is not None:
    try:
        logger.info("Loading local EvaluationEngine with model: %s", _model_path)
        evaluator = FileEvaluationEngine(model_path=_model_path)
        logger.info("Local EvaluationEngine loaded successfully")
    except Exception as ex:
        _evaluator_load_error = str(ex)
        logger.exception("Failed to load local EvaluationEngine: %s", _evaluator_load_error)

if evaluator is None and ApiEvaluationEngine is not None:
    try:
        GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY", "")
        logger.info("Initializing API EvaluationEngine (Gemini) using env key: %s", "****" if GEMINI_API_KEY else "(none)")
        evaluator = ApiEvaluationEngine(api_key=GEMINI_API_KEY)
        logger.info("API EvaluationEngine initialized successfully")
    except Exception as ex:
        _evaluator_load_error = _evaluator_load_error or str(ex)
        logger.exception("Failed to initialize API EvaluationEngine: %s", ex)

if evaluator is None:
    logger.error("No EvaluationEngine available. Errors: %s", _evaluator_load_error)


class EvaluationRequest(BaseModel):
    section_id: str
    exam_id: str
    subject_id: str
    backend_url: str = "http://localhost:4000"


def _extract_token_from_auth_header(auth_header: Optional[str]) -> Optional[str]:
    if not auth_header:
        return None
    if auth_header.lower().startswith("bearer "):
        return auth_header.split(None, 1)[1].strip()
    return auth_header.strip()


async def _run_evaluation(section_id: str, exam_id: str, subject_id: str, token: str, backend_url: str) -> Dict[str, Any]:
    if evaluator is None:
        raise RuntimeError(f"Evaluator not initialized: {_evaluator_load_error}")

    results = evaluator.evaluate_all_students(
        section_id=section_id,
        exam_id=exam_id,
        subject_id=subject_id,
        token=token,
        backend_url=backend_url,
    )

    # If evaluation returned error structure, bubble it up
    if isinstance(results, dict) and results.get("status") == "error":
        return results

    # Try to store results if available
    store_success = False
    try:
        if isinstance(results, dict) and results.get("evaluation_results"):
            store_success = evaluator.store_results_to_backend(
                results=results.get("evaluation_results", []),
                exam_id=exam_id,
                section_id=section_id,
                subject_id=subject_id,
                token=token,
                backend_url=backend_url,
            )
            if isinstance(results, dict):
                results["_stored"] = bool(store_success)
    except Exception:
        logger.exception("Failed to store results to backend")

    return results


@app.get("/")
async def root():
    return {
        "message": "Student Answer Evaluation API",
        "version": "1.0.0",
        "endpoints": {
            "/eval": "POST - Evaluate all students in a section"
        }
    }


@app.post("/eval")
async def evaluate_students(
    request: EvaluationRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Evaluate all students in a section for a specific exam and subject
    
    Args:
        section_id: UUID of the section
        exam_id: UUID of the exam
        subject_id: UUID of the subject
        authorization: Bearer token (from header)
        backend_url: Base URL of the backend API
    
    Returns:
        Evaluation results for all students
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")

    # Extract token from "Bearer <token>"
    token = _extract_token_from_auth_header(authorization)

    if not token:
        raise HTTPException(status_code=401, detail="Invalid authorization token")
    
    print(f"\n{'='*80}")
    print(f"Received evaluation request:")
    print(f"  Section ID: {request.section_id}")
    print(f"  Exam ID: {request.exam_id}")
    print(f"  Subject ID: {request.subject_id}")
    print(f"  Backend URL: {request.backend_url}")
    print(f"{'='*80}\n")
    
    try:
        # Run evaluation via unified helper
        results = await _run_evaluation(
            section_id=request.section_id,
            exam_id=request.exam_id,
            subject_id=request.subject_id,
            token=token,
            backend_url=request.backend_url,
        )

        if isinstance(results, dict) and results.get('status') == 'error':
            raise HTTPException(status_code=400, detail=results.get('message'))

        return results

    except Exception as e:
        print(f"Error during evaluation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    ok = evaluator is not None
    resp = {
        "status": "healthy" if ok else "unhealthy",
        "service": "Student Answer Evaluation Service",
        "model": MODEL_FILENAME,
        "model_loaded": ok,
    }
    if not ok:
        resp["error"] = _evaluator_load_error
    return resp


# Flask-style compatible endpoint: accepts raw JSON body and Authorization header
@app.post("/evaluate")
async def evaluate_exam(request: Request):
    # Accept JSON body
    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"status": "error", "message": "Invalid or missing JSON body"}, status_code=400)

    if not isinstance(data, dict):
        return JSONResponse({"status": "error", "message": "Invalid or missing JSON body"}, status_code=400)

    missing = [k for k in ("section_id", "exam_id", "subject_id") if k not in data]
    if missing:
        return JSONResponse({"status": "error", "message": f"Missing required parameters: {', '.join(missing)}"}, status_code=400)

    # Extract token from header or JSON
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    token = _extract_token_from_auth_header(auth_header) or (data.get("token") if isinstance(data.get("token"), str) else None)
    if not token:
        return JSONResponse({"status": "error", "message": "Missing authentication token"}, status_code=401)

    if evaluator is None:
        return JSONResponse({"status": "error", "message": "Evaluator not available", "detail": _evaluator_load_error}, status_code=500)

    section_id = data["section_id"]
    exam_id = data["exam_id"]
    subject_id = data["subject_id"]
    backend_url = data.get("backend_url", "http://localhost:4000")

    try:
        results = await _run_evaluation(section_id, exam_id, subject_id, token, backend_url)
        status_code = 200 if (isinstance(results, dict) and results.get("status") != "error") else 400
        return JSONResponse(results, status_code=status_code)
    except Exception as ex:
        logger.exception("Unhandled error during /evaluate: %s", ex)
        return JSONResponse({"status": "error", "message": "Internal server error", "detail": str(ex)}, status_code=500)


if __name__ == "__main__":
    # Run the server
    print("\n" + "="*80)
    print("Starting Student Answer Evaluation API Server")
    print("="*80)
    print("API Docs: http://localhost:8000/docs")
    print("="*80 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)