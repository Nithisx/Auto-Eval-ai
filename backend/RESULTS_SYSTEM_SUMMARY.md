# Evaluation Results System - Summary

## Files Created

### Backend Files:

1. **Model/Resultmodel.js** - Database model for evaluation results
2. **Controllers/Resultcontroller.js** - Business logic for result operations
3. **Routes/Resultroutes.js** - API route definitions
4. **Result API Guide.md** - Complete API documentation

### Database:

- Updated **Migration/Migration.sql** with `evaluation_results` table

### Backend Integration:

- Updated **Server.js** to include result routes

### LLM Service:

- Updated **Models/App.py** to automatically store results
- Updated **Models/Files/Evualate.py** with `store_results_to_backend()` method

---

## Database Schema

```sql
evaluation_results
├── result_id (UUID, PRIMARY KEY)
├── exam_id (UUID)
├── section_id (UUID)
├── subject_id (UUID)
├── student_id (UUID)
├── evaluated_by (UUID, nullable)
├── questions (JSONB)
├── total_marks (DECIMAL)
├── max_total_marks (DECIMAL)
├── created_at (TIMESTAMPTZ)
├── updated_at (TIMESTAMPTZ)
└── UNIQUE(exam_id, section_id, subject_id, student_id)
```

---

## Key Features

### 1. Automatic Storage

When the LLM service evaluates students, it automatically stores results to the database via:

```
POST /api/results/bulk
```

### 2. View Single Student Result

Get a specific student's result for an exam:

```
GET /api/results/sections/:sectionId/exams/:examId/subjects/:subjectId/students/:studentId
```

### 3. View All Section Results

Get all students' results for an exam/subject:

```
GET /api/results/sections/:sectionId/exams/:examId/subjects/:subjectId
```

### 4. Statistics

Get class statistics (average, highest, lowest scores):

```
GET /api/results/sections/:sectionId/exams/:examId/subjects/:subjectId/statistics
```

### 5. Student History

Get all results for a student across all exams:

```
GET /api/results/student/:studentId
```

---

## Setup Instructions

### 1. Run Database Migration

```sql
-- Copy the migration from Migration.sql
CREATE TABLE IF NOT EXISTS evaluation_results (...);
```

### 2. Restart Backend Server

```bash
cd Backend
node Server.js
```

### 3. Test the Flow

#### Step 1: Evaluate students (LLM Service)

```bash
POST http://localhost:5000/evaluate
{
  "section_id": "uuid",
  "exam_id": "uuid",
  "subject_id": "uuid",
  "token": "bearer_token"
}
```

#### Step 2: View results (Backend)

```bash
GET http://localhost:4000/api/results/sections/{sectionId}/exams/{examId}/subjects/{subjectId}
Authorization: Bearer {token}
```

---

## API Endpoints Summary

| Method | Endpoint                                                                                 | Description               |
| ------ | ---------------------------------------------------------------------------------------- | ------------------------- |
| POST   | `/api/results`                                                                           | Store single result       |
| POST   | `/api/results/bulk`                                                                      | Store multiple results    |
| GET    | `/api/results/:resultId`                                                                 | Get result by ID          |
| GET    | `/api/results/student/:studentId`                                                        | Get all student results   |
| GET    | `/api/results/sections/:sectionId/exams/:examId/subjects/:subjectId/students/:studentId` | Get student's exam result |
| GET    | `/api/results/sections/:sectionId/exams/:examId/subjects/:subjectId`                     | Get all exam results      |
| GET    | `/api/results/sections/:sectionId/exams/:examId/subjects/:subjectId/statistics`          | Get statistics            |
| DELETE | `/api/results/:resultId`                                                                 | Delete result             |

---

## Data Flow

```
1. Teacher uploads answers → Backend DB
2. Students submit answers → Backend DB
3. Admin triggers evaluation → LLM Service (localhost:5000)
4. LLM Service:
   - Fetches teacher answers
   - Fetches all students
   - Fetches student answers
   - Evaluates using Mistral model
   - Stores results → Backend DB (POST /api/results/bulk)
5. View results → Backend API (GET /api/results/...)
```

---

## Example Usage

### Evaluate and Store

```bash
curl -X POST http://localhost:5000/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "section_id": "11b4859a-7561-43e8-aef5-b5b95c5fd763",
    "exam_id": "d0d95862-a399-4658-9013-691af8b4eb42",
    "subject_id": "d371674e-7bf5-43b9-ad96-b7133fd8bb8b",
    "token": "your_token_here"
  }'
```

### View Section Results

```bash
curl -X GET "http://localhost:4000/api/results/sections/11b4859a-7561-43e8-aef5-b5b95c5fd763/exams/d0d95862-a399-4658-9013-691af8b4eb42/subjects/d371674e-7bf5-43b9-ad96-b7133fd8bb8b" \
  -H "Authorization: Bearer your_token_here"
```

---

## Notes

- Results are automatically stored when evaluation completes
- If a result already exists for a student, it will be updated
- All endpoints require Bearer token authentication
- Statistics include average, highest, and lowest scores
- Questions array contains detailed feedback for each question
