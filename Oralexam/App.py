# app.py
# FastAPI backend for oral exam auto-evaluator using Google's GenAI (Gemini)
import os
import json
import random
import tempfile
import time
from typing import List, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# Google GenAI SDK
from google import genai
from google.genai import types

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

QUESTIONS_FILE = "questions.json"
GENAI_MODEL = os.getenv("GENAI_MODEL", "gemini-2.0-flash-exp")
API_KEY = os.getenv("GOOGLE_API_KEY", "AIzaSyCqQr1uzFgx6mezEpGd5uYcnsgDgwGyGyc")

if not API_KEY:
    raise ValueError("GOOGLE_API_KEY environment variable is required")

# Initialize Gemini client
client = genai.Client(api_key=API_KEY)


def load_questions() -> List[Dict[str, Any]]:
    """Load questions from JSON file"""
    if not os.path.exists(QUESTIONS_FILE):
        raise FileNotFoundError(f"{QUESTIONS_FILE} not found")
    with open(QUESTIONS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data


@app.get("/")
async def root():
    return {"message": "Oral Exam Auto-Evaluator API", "status": "running"}


@app.get("/question/random")
async def get_random_question():
    """Get a random question from the question bank"""
    try:
        qs = load_questions()
        if not qs:
            raise HTTPException(status_code=404, detail="No questions available")
        
        q = random.choice(qs)
        return {
            "question_id": q.get("question_id"),
            "question": q.get("question"),
            "max_marks": q.get("max_marks"),
            "rubric": q.get("rubric"),
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading questions: {str(e)}")


def retry_with_backoff(func, max_retries=3, initial_delay=2):
    """Retry a function with exponential backoff"""
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            error_msg = str(e).lower()
            if "503" in error_msg or "overloaded" in error_msg or "unavailable" in error_msg:
                if attempt < max_retries - 1:
                    delay = initial_delay * (2 ** attempt)
                    print(f"Model overloaded. Retrying in {delay} seconds... (attempt {attempt + 1}/{max_retries})")
                    time.sleep(delay)
                else:
                    raise Exception("Model is currently overloaded. Please try again in a few minutes.")
            else:
                raise


def transcribe_with_gemini(audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
    """Transcribe audio using Gemini with retry logic"""
    def _transcribe():
        audio_part = types.Part.from_bytes(data=audio_bytes, mime_type=mime_type)
        
        prompt_text = (
            "You are an accurate speech-to-text system. "
            "Transcribe the following audio exactly as spoken. "
            "Return only the transcription, no additional commentary."
        )
        
        response = client.models.generate_content(
            model=GENAI_MODEL,
            contents=[prompt_text, audio_part],
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=500,
            )
        )
        
        transcription = response.text.strip() if hasattr(response, "text") else ""
        if not transcription:
            raise Exception("Empty transcription received")
        return transcription
    
    try:
        return retry_with_backoff(_transcribe, max_retries=3, initial_delay=2)
    except Exception as e:
        raise Exception(f"Transcription error: {str(e)}")


def evaluate_answer_with_gemini(transcription: str, question_obj: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluate the transcribed answer using Gemini with retry logic"""
    def _evaluate():
        rubric = question_obj.get("rubric", [])
        model_answer = question_obj.get("answer", "")
        max_marks = question_obj.get("max_marks", 10)
        
        system_instructions = (
            "You are an expert examiner evaluating student answers. "
            "You must return ONLY valid JSON with no additional text. "
            "Be fair, objective, and thorough in your evaluation."
        )
        
        user_prompt = f"""
Evaluate the following student answer against the model answer using the provided rubric.

STUDENT'S TRANSCRIBED ANSWER:
'''{transcription}'''

MODEL ANSWER:
'''{model_answer}'''

RUBRIC:
{json.dumps(rubric, indent=2)}

MAXIMUM MARKS: {max_marks}

EVALUATION INSTRUCTIONS:
1. For each criterion in the rubric, assign a score between 0.0 and 1.0 based on how well the student's answer meets that criterion
2. Calculate overall_score = sum(criterion_score × weight × max_marks) for all criteria
3. Round overall_score to 1 decimal place
4. Provide a brief explanation (1-2 sentences) for each criterion score
5. Give a final verdict summarizing the answer quality

Return ONLY this JSON structure (no markdown, no extra text):
{{
  "overall_score": <number between 0 and {max_marks}>,
  "breakdown": [
    {{
      "criterion": "<criterion name>",
      "score": <0.0 to 1.0>,
      "explanation": "<brief explanation>"
    }}
  ],
  "verdict": "<overall assessment in 2-3 sentences>"
}}
"""
        
        response = client.models.generate_content(
            model=GENAI_MODEL,
            contents=[system_instructions, user_prompt],
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=1000,
            )
        )
        
        raw = response.text.strip() if hasattr(response, "text") else str(response)
        
        # Try to parse JSON
        try:
            if "```json" in raw:
                raw = raw.split("```json")[1].split("```")[0].strip()
            elif "```" in raw:
                raw = raw.split("```")[1].split("```")[0].strip()
            
            parsed = json.loads(raw)
            return parsed
        except json.JSONDecodeError:
            import re
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            if match:
                try:
                    parsed = json.loads(match.group(0))
                    return parsed
                except:
                    pass
            
            return {
                "error": "Failed to parse evaluation",
                "raw_response": raw[:500],
                "overall_score": 0,
                "breakdown": [],
                "verdict": "Evaluation parsing failed. Please try again."
            }
    
    try:
        return retry_with_backoff(_evaluate, max_retries=3, initial_delay=2)
    except Exception as e:
        return {
            "error": "Evaluation error",
            "detail": str(e),
            "overall_score": 0,
            "breakdown": [],
            "verdict": f"Error occurred during evaluation: {str(e)}"
        }


@app.post("/evaluate")
async def evaluate(answer_audio: UploadFile = File(...), question_id: str = Form(...)):
    """Evaluate student's audio answer"""
    try:
        # Read audio content
        content = await answer_audio.read()
        
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Empty audio file received")
        
        # Determine MIME type
        filename = answer_audio.filename.lower()
        if filename.endswith('.wav'):
            mime_type = "audio/wav"
        elif filename.endswith('.ogg') or filename.endswith('.opus'):
            mime_type = "audio/ogg"
        elif filename.endswith('.mp3'):
            mime_type = "audio/mpeg"
        else:
            mime_type = "audio/webm"
        
        print(f"Processing audio: {len(content)} bytes, type: {mime_type}")
        
        # Transcribe audio
        try:
            transcription = transcribe_with_gemini(content, mime_type=mime_type)
        except Exception as e:
            error_msg = str(e)
            if "overloaded" in error_msg.lower():
                raise HTTPException(
                    status_code=503, 
                    detail="The AI service is currently busy. Please wait 30 seconds and try again."
                )
            raise HTTPException(status_code=500, detail=f"Transcription failed: {error_msg}")
        
        if not transcription or len(transcription.strip()) == 0:
            raise HTTPException(
                status_code=400, 
                detail="Could not transcribe audio. Please speak more clearly and try again."
            )
        
        print(f"Transcription: {transcription[:100]}...")
        
        # Load question
        questions = load_questions()
        question_obj = next((q for q in questions if q.get("question_id") == question_id), None)
        
        if not question_obj:
            raise HTTPException(status_code=404, detail=f"Question ID '{question_id}' not found")
        
        # Evaluate answer
        try:
            evaluation = evaluate_answer_with_gemini(transcription, question_obj)
        except Exception as e:
            error_msg = str(e)
            if "overloaded" in error_msg.lower():
                raise HTTPException(
                    status_code=503,
                    detail="The AI service is currently busy. Please wait 30 seconds and try again."
                )
            # If evaluation fails, return transcription with partial result
            evaluation = {
                "overall_score": 0,
                "breakdown": [],
                "verdict": f"Evaluation temporarily unavailable. Your answer was: {transcription[:100]}...",
                "error": str(e)
            }
        
        return {
            "transcription": transcription,
            "question_id": question_id,
            "evaluation": evaluation,
            "max_marks": question_obj.get("max_marks")
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model": GENAI_MODEL,
        "questions_available": len(load_questions())
    }


if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("🚀 Starting Oral Exam Auto-Evaluator API")
    print("=" * 60)
    print(f"📍 Server: http://localhost:7000")
    print(f"🤖 Model: {GENAI_MODEL}")
    print(f"📚 Questions: {len(load_questions())} loaded")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=7000)