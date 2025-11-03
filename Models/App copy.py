# main.py
import os
import logging
from typing import Any, Dict, Optional

from flask import Flask, request, jsonify
from flask_cors import CORS

# Import your evaluation engine (keep your existing path)
from Files.Evualate import EvaluationEngine

# Optional: If you want to run under uvicorn (ASGI), we'll expose `asgi_app` at the bottom.
try:
    from asgiref.wsgi import WsgiToAsgi  # type: ignore
    _ASGIREF_AVAILABLE = True
except Exception:
    _ASGIREF_AVAILABLE = False

# ----------------------------
# Config & logging
# ----------------------------
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", 5000))
DEBUG = os.environ.get("DEBUG", "true").lower() in ("1", "true", "yes")
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173")  # frontend origin

logging.basicConfig(
    level=logging.DEBUG if DEBUG else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
logger = logging.getLogger("evaluation_service")

# ----------------------------
# Flask app + CORS
# ----------------------------
app = Flask(__name__)
# Allow only your frontend origin by default; set ALLOWED_ORIGINS="*" to allow all.
CORS(app, resources={r"/*": {"origins": ALLOWED_ORIGINS}}, supports_credentials=True)

# ----------------------------
# Initialize evaluator (safe)
# ----------------------------
MODEL_FILENAME = "mistral-7b-instruct-v0.2.Q4_K_M.gguf"
_model_path = os.path.join(os.path.dirname(__file__), MODEL_FILENAME)

evaluator: Optional[EvaluationEngine] = None
_evaluator_load_error: Optional[str] = None

try:
    logger.info("Loading EvaluationEngine with model: %s", _model_path)
    evaluator = EvaluationEngine(model_path=_model_path)
    logger.info("EvaluationEngine loaded successfully.")
except Exception as ex:
    _evaluator_load_error = str(ex)
    logger.exception("Failed to initialize EvaluationEngine: %s", _evaluator_load_error)


# ----------------------------
# Helpers
# ----------------------------
def get_json_body() -> Optional[Dict[str, Any]]:
    """
    Safely fetch JSON body. Returns dict or None.
    """
    try:
        data = request.get_json(force=False, silent=True)
        if not isinstance(data, dict):
            return None
        return data
    except Exception:
        return None


def get_token_from_request(data: Optional[Dict[str, Any]]) -> Optional[str]:
    # Prefer Authorization header if present, otherwise token in JSON body
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if auth_header:
        # Accept "Bearer <token>" or raw token
        if auth_header.lower().startswith("bearer "):
            return auth_header.split(None, 1)[1].strip()
        return auth_header.strip()
    if data:
        token = data.get("token")
        if isinstance(token, str) and token.strip():
            return token.strip()
    return None


# ----------------------------
# Routes
# ----------------------------
@app.route("/evaluate", methods=["POST", "OPTIONS"])
def evaluate_exam():
    """
    Evaluate all students for given section/exam/subject.

    JSON body keys required:
      - section_id
      - exam_id
      - subject_id
    token may be provided in JSON as `token` or in Authorization header.
    optional:
      - backend_url (defaults to http://localhost:4000)
    """
    # CORS preflight is handled by flask_cors. For explicit handling:
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    data = get_json_body()
    if data is None:
        logger.warning("Missing or invalid JSON body in request.")
        return jsonify({"status": "error", "message": "Invalid or missing JSON body"}), 400

    # required params
    missing = [k for k in ("section_id", "exam_id", "subject_id") if k not in data]
    if missing:
        logger.warning("Missing parameters: %s", missing)
        return (
            jsonify({"status": "error", "message": f"Missing required parameters: {', '.join(missing)}"}),
            400,
        )

    token = get_token_from_request(data)
    if not token:
        logger.warning("Missing token (Authorization header or token in JSON).")
        return jsonify({"status": "error", "message": "Missing authentication token"}), 401

    if evaluator is None:
        logger.error("Evaluator not initialized: %s", _evaluator_load_error)
        return jsonify({"status": "error", "message": "Evaluator not available", "detail": _evaluator_load_error}), 500

    section_id = data["section_id"]
    exam_id = data["exam_id"]
    subject_id = data["subject_id"]
    backend_url = data.get("backend_url", "http://localhost:4000")

    logger.info("Starting evaluation: section=%s exam=%s subject=%s", section_id, exam_id, subject_id)

    try:
        results = evaluator.evaluate_all_students(
            section_id=section_id,
            exam_id=exam_id,
            subject_id=subject_id,
            token=token,
            backend_url=backend_url,
        )

        if not isinstance(results, dict):
            logger.error("Evaluator returned unexpected type: %s", type(results))
            return jsonify({"status": "error", "message": "Evaluator returned invalid response"}), 500

        if results.get("status") == "error":
            logger.error("Evaluator returned error: %s", results.get("message"))
            return jsonify(results), 400

        # Attempt to store results
        try:
            store_success = evaluator.store_results_to_backend(
                results=results.get("evaluation_results", []),
                exam_id=exam_id,
                section_id=section_id,
                subject_id=subject_id,
                token=token,
                backend_url=backend_url,
            )
        except Exception as ex_store:
            logger.exception("Failed to store results to backend: %s", ex_store)
            store_success = False

        logger.info(
            "Evaluation complete. Students evaluated: %d. Stored: %s",
            len(results.get("evaluation_results", [])),
            "yes" if store_success else "no",
        )

        # Attach store_success flag to response for client visibility
        results["_stored"] = bool(store_success)
        return jsonify(results), 200

    except Exception as ex:
        logger.exception("Unhandled error during evaluation: %s", ex)
        return jsonify({"status": "error", "message": "Internal server error", "detail": str(ex)}), 500


@app.route("/health", methods=["GET"])
def health_check():
    """
    Basic health endpoint. Reports whether model loaded successfully.
    """
    ok = evaluator is not None
    resp = {
        "status": "healthy" if ok else "unhealthy",
        "service": "Student Answer Evaluation Service",
        "model": MODEL_FILENAME,
        "model_loaded": ok,
    }
    if not ok:
        resp["error"] = _evaluator_load_error
    return jsonify(resp), (200 if ok else 500)


# ----------------------------
# Entrypoint
# ----------------------------
if __name__ == "__main__":
    logger.info("Starting Student Answer Evaluation Service (Flask dev server)")
    logger.info("Model: %s", MODEL_FILENAME)
    # For development only. For production, run gunicorn/uvicorn as shown below.
    app.run(host=HOST, port=PORT, debug=DEBUG, threaded=True)


# Expose ASGI app for uvicorn if asgiref is installed
if _ASGIREF_AVAILABLE:
    asgi_app = WsgiToAsgi(app)
else:
    # Provide a helpful variable so uvicorn errors are more obvious
    asgi_app = None
