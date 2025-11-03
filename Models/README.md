# Student Answer Evaluation System

This system uses Mistral-7B-Instruct model to automatically evaluate student answers against teacher's ideal answers using provided rubrics.

## Setup

1. Install dependencies:

```bash
pip install -r requirements.txt
```

2. Ensure the model file `mistral-7b-instruct-v0.2.Q4_K_M.gguf` is in the Models folder.

3. Make sure the backend API is running on `http://localhost:4000` (or specify a different URL).

## Running the Service

```bash
cd Models
python App.py
```

The service will start on `http://localhost:5000`

## API Usage

### Evaluate Students

**Endpoint:** `POST http://localhost:5000/evaluate`

**Request Body:**

```json
{
  "section_id": "11b4859a-7561-43e8-aef5-b5b95c5fd763",
  "exam_id": "d0d95862-a399-4658-9013-691af8b4eb42",
  "subject_id": "d371674e-7bf5-43b9-ad96-b7133fd8bb8b",
  "backend_url": "http://localhost:4000"
}
```

**Response:**

```json
{
  "status": "success",
  "evaluation_results": [
    {
      "student_id": "uuid",
      "student_name": "Student Name",
      "roll_number": "R001",
      "questions": [
        {
          "question_number": 1,
          "question_text": "Question text here",
          "student_answer": "Student's answer",
          "ideal_answer": "Teacher's ideal answer",
          "rubrics": "Rubrics text",
          "max_marks": 10,
          "awarded_marks": 8.5,
          "feedback": "Detailed feedback from AI"
        }
      ],
      "total_marks": 22.5,
      "max_total_marks": 100
    }
  ],
  "summary": {
    "total_students": 3,
    "average_score": 75.5,
    "max_possible_score": 100
  }
}
```

### Health Check

**Endpoint:** `GET http://localhost:5000/health`

**Response:**

```json
{
  "status": "healthy",
  "service": "Student Answer Evaluation Service",
  "model": "mistral-7b-instruct-v0.2"
}
```

## How It Works

1. **Fetch Teacher Answers:** Retrieves the teacher's ideal answers and rubrics for the given exam/subject/section
2. **Fetch Students List:** Gets all students enrolled in the specified section
3. **Fetch Student Answers:** For each student, retrieves their submitted answers
4. **AI Evaluation:** Uses Mistral-7B model to evaluate each answer against:
   - Ideal answer
   - Rubrics
   - Maximum marks
5. **Generate Results:** Produces detailed feedback and marks for each question and overall scores

## Example Test Request

```bash
curl -X POST http://localhost:5000/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "section_id": "11b4859a-7561-43e8-aef5-b5b95c5fd763",
    "exam_id": "d0d95862-a399-4658-9013-691af8b4eb42",
    "subject_id": "d371674e-7bf5-43b9-ad96-b7133fd8bb8b"
  }'
```

## Notes

- The model runs on CPU by default. For GPU acceleration, modify `n_gpu_layers` parameter in `Evualate.py`
- Evaluation may take time depending on the number of students and questions
- Ensure backend API endpoints are accessible and return expected data formats
