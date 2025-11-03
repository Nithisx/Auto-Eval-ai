# Result API Documentation

## Overview

The Result API endpoints allow you to store and retrieve evaluation results from the LLM evaluation service.

---

## Endpoints

### 1. Store Single Result

**POST** `/api/results`

Store a single evaluation result.

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "exam_id": "d0d95862-a399-4658-9013-691af8b4eb42",
  "section_id": "11b4859a-7561-43e8-aef5-b5b95c5fd763",
  "subject_id": "d371674e-7bf5-43b9-ad96-b7133fd8bb8b",
  "student_id": "192917d4-a580-4823-a252-53f429a92ae0",
  "questions": [
    {
      "question_number": 1,
      "question_text": "Explain the theme...",
      "student_answer": "The poem explores...",
      "ideal_answer": "The poem reflects...",
      "rubrics": "Rubrics:\n- Focus on theme - 4 marks...",
      "max_marks": 10,
      "awarded_marks": 8.5,
      "feedback": "Good understanding of the theme..."
    }
  ],
  "total_marks": 85.5,
  "max_total_marks": 100
}
```

**Response:**

```json
{
  "message": "Result stored successfully",
  "result": {
    "result_id": "uuid",
    "exam_id": "uuid",
    "section_id": "uuid",
    "subject_id": "uuid",
    "student_id": "uuid",
    "questions": [...],
    "total_marks": 85.5,
    "max_total_marks": 100,
    "created_at": "2025-10-23T...",
    "updated_at": "2025-10-23T..."
  }
}
```

---

### 2. Store Bulk Results

**POST** `/api/results/bulk`

Store multiple evaluation results at once (used by LLM service).

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "results": [
    {
      "exam_id": "uuid",
      "section_id": "uuid",
      "subject_id": "uuid",
      "student_id": "uuid",
      "questions": [...],
      "total_marks": 85.5,
      "max_total_marks": 100
    },
    {
      "exam_id": "uuid",
      "section_id": "uuid",
      "subject_id": "uuid",
      "student_id": "uuid",
      "questions": [...],
      "total_marks": 72.0,
      "max_total_marks": 100
    }
  ]
}
```

**Response:**

```json
{
  "message": "Bulk results processed",
  "stored": 2,
  "errors": 0,
  "results": [...],
  "failed": []
}
```

---

### 3. Get Single Result by ID

**GET** `/api/results/:resultId`

Get a specific result by its ID.

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "result": {
    "result_id": "uuid",
    "exam_id": "uuid",
    "section_id": "uuid",
    "subject_id": "uuid",
    "student_id": "uuid",
    "questions": [...],
    "total_marks": 85.5,
    "max_total_marks": 100,
    "created_at": "2025-10-23T...",
    "updated_at": "2025-10-23T..."
  }
}
```

---

### 4. Get All Results for a Student

**GET** `/api/results/student/:studentId`

Get all evaluation results for a specific student across all exams.

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "student_id": "uuid",
  "total_results": 5,
  "results": [
    {
      "result_id": "uuid",
      "exam_id": "uuid",
      "subject_id": "uuid",
      "subject_name": "Mathematics",
      "exam_title": "Midterm March 2025",
      "exam_date": "2025-03-10T09:00:00.000Z",
      "total_marks": 85.5,
      "max_total_marks": 100,
      "created_at": "2025-10-23T..."
    }
  ]
}
```

---

### 5. Get Student's Result for Specific Exam/Subject

**GET** `/api/results/sections/:sectionId/exams/:examId/subjects/:subjectId/students/:studentId`

Get a student's result for a specific exam and subject.

**Headers:**

```
Authorization: Bearer <token>
```

**Example:**

```
GET /api/results/sections/11b4859a-7561-43e8-aef5-b5b95c5fd763/exams/d0d95862-a399-4658-9013-691af8b4eb42/subjects/d371674e-7bf5-43b9-ad96-b7133fd8bb8b/students/192917d4-a580-4823-a252-53f429a92ae0
```

**Response:**

```json
{
  "result": {
    "result_id": "uuid",
    "exam_id": "uuid",
    "section_id": "uuid",
    "subject_id": "uuid",
    "student_id": "uuid",
    "student_name": "S One",
    "student_email": "s1@example.com",
    "roll_number": "01",
    "subject_name": "Mathematics",
    "exam_title": "Midterm March 2025",
    "questions": [
      {
        "question_number": 1,
        "question_text": "Explain...",
        "student_answer": "...",
        "ideal_answer": "...",
        "rubrics": "...",
        "max_marks": 10,
        "awarded_marks": 8.5,
        "feedback": "..."
      }
    ],
    "total_marks": 85.5,
    "max_total_marks": 100,
    "created_at": "2025-10-23T..."
  }
}
```

---

### 6. Get All Results for Exam/Section/Subject

**GET** `/api/results/sections/:sectionId/exams/:examId/subjects/:subjectId`

Get all students' results for a specific exam and subject (class-wide results).

**Headers:**

```
Authorization: Bearer <token>
```

**Example:**

```
GET /api/results/sections/11b4859a-7561-43e8-aef5-b5b95c5fd763/exams/d0d95862-a399-4658-9013-691af8b4eb42/subjects/d371674e-7bf5-43b9-ad96-b7133fd8bb8b
```

**Response:**

```json
{
  "exam_id": "uuid",
  "section_id": "uuid",
  "subject_id": "uuid",
  "total_students": 3,
  "statistics": {
    "total_students": "3",
    "average_score": "78.50",
    "highest_score": "85.50",
    "lowest_score": "68.00",
    "max_possible_score": "100.00"
  },
  "results": [
    {
      "result_id": "uuid",
      "student_id": "uuid",
      "student_name": "S One",
      "roll_number": "01",
      "total_marks": "85.50",
      "max_total_marks": "100.00",
      "created_at": "2025-10-23T..."
    },
    {
      "result_id": "uuid",
      "student_id": "uuid",
      "student_name": "S Two",
      "roll_number": "02",
      "total_marks": "78.00",
      "max_total_marks": "100.00",
      "created_at": "2025-10-23T..."
    }
  ]
}
```

---

### 7. Get Statistics Only

**GET** `/api/results/sections/:sectionId/exams/:examId/subjects/:subjectId/statistics`

Get only the statistics for an exam/section/subject (without full result details).

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "exam_id": "uuid",
  "section_id": "uuid",
  "subject_id": "uuid",
  "statistics": {
    "total_students": "3",
    "average_score": "78.50",
    "highest_score": "85.50",
    "lowest_score": "68.00",
    "max_possible_score": "100.00"
  }
}
```

---

### 8. Delete Result

**DELETE** `/api/results/:resultId`

Delete a specific result.

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "message": "Result deleted successfully",
  "result": {
    "result_id": "uuid",
    ...
  }
}
```

---

## Database Migration

Run this SQL to create the `evaluation_results` table:

```sql
CREATE TABLE IF NOT EXISTS evaluation_results (
  result_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL,
  section_id UUID NOT NULL,
  subject_id UUID NOT NULL,
  student_id UUID NOT NULL,
  evaluated_by UUID,
  questions JSONB NOT NULL,
  total_marks DECIMAL(10, 2) NOT NULL DEFAULT 0,
  max_total_marks DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(exam_id, section_id, subject_id, student_id)
);

CREATE INDEX idx_evaluation_results_exam ON evaluation_results(exam_id);
CREATE INDEX idx_evaluation_results_section ON evaluation_results(section_id);
CREATE INDEX idx_evaluation_results_subject ON evaluation_results(subject_id);
CREATE INDEX idx_evaluation_results_student ON evaluation_results(student_id);
CREATE INDEX idx_evaluation_results_exam_section_subject ON evaluation_results(exam_id, section_id, subject_id);
```

---

## Integration with LLM Service

The LLM evaluation service automatically stores results after evaluation using the bulk endpoint:

```python
# In Models/App.py
store_success = evaluator.store_results_to_backend(
    results=results['evaluation_results'],
    exam_id=exam_id,
    section_id=section_id,
    subject_id=subject_id,
    token=token,
    backend_url=backend_url
)
```

This happens automatically when you call:

```
POST http://localhost:5000/evaluate
```
