# Student Image Answer API Guide

This API allows students to submit exam answers as images and enables teachers to grade them.

## Database Setup

First, run the SQL migration to create the required table:

```sql
-- Run the contents of Backend/Migration/Studentimageanswer.sql
```

## API Endpoints

### 1. Submit Student Image Answer

**POST** `/api/student-image-answers`

Submit multiple images as an exam answer.

**Authentication:** Required (Student role)

**Content-Type:** `multipart/form-data`

**Form Data:**

- `section_id` (UUID, required): Section ID
- `exam_id` (UUID, required): Exam ID
- `subject_id` (UUID, required): Subject ID
- `student_id` (UUID, required): Student ID
- `question_id` (UUID, optional): Question ID if answer is for specific question
- `images` (files, required): Multiple image files (max 10)

**Supported file types:** JPG, PNG, WebP, TIFF, PDF
**Max file size:** 15MB per file

**Example Response:**

```json
{
  "success": true,
  "message": "Image answer submitted successfully",
  "data": {
    "answer_id": "uuid",
    "section_id": "uuid",
    "exam_id": "uuid",
    "subject_id": "uuid",
    "student_id": "uuid",
    "image_paths": ["answers/1234567890-student-id/image1.jpg"],
    "original_filenames": ["my_answer.jpg"],
    "status": "submitted",
    "upload_timestamp": "2024-01-01T10:00:00Z"
  }
}
```

### 2. Get Student Image Answers

**GET** `/api/student-image-answers`

Retrieve student image answers with filters.

**Authentication:** Required (Student, Teacher, or Principal role)

**Query Parameters:**

- `section_id` (UUID, optional): Filter by section
- `exam_id` (UUID, optional): Filter by exam
- `subject_id` (UUID, optional): Filter by subject
- `student_id` (UUID, optional): Filter by student
- `question_id` (UUID, optional): Filter by question
- `status` (string, optional): Filter by status (submitted, graded, reviewed)

**Example:** `/api/student-image-answers?exam_id=uuid&section_id=uuid`

### 3. Get Specific Image Answer

**GET** `/api/student-image-answers/:answerId`

Get a specific student image answer by ID.

**Authentication:** Required (Student, Teacher, or Principal role)

### 4. Grade Student Image Answer

**PUT** `/api/student-image-answers/:answerId/grade`

Grade a student's image answer.

**Authentication:** Required (Teacher or Principal role)

**Request Body:**

```json
{
  "marks_obtained": 85.5,
  "teacher_feedback": "Good work, but could improve on...",
  "status": "graded"
}
```

### 5. Get Exam Statistics

**GET** `/api/student-image-answers/exam/:examId/statistics`

Get submission statistics for an exam.

**Authentication:** Required (Teacher or Principal role)

**Response:**

```json
{
  "success": true,
  "data": {
    "total_submissions": 25,
    "submitted_count": 20,
    "graded_count": 5,
    "reviewed_count": 0,
    "average_marks": 78.5,
    "highest_marks": 95,
    "lowest_marks": 62
  }
}
```

### 6. Delete Image Answer

**DELETE** `/api/student-image-answers/:answerId`

Delete a student image answer (also removes uploaded files).

**Authentication:** Required (Principal role only)

## File Storage

- Images are stored in `Backend/uploads/answers/[timestamp-studentid]/`
- Each submission gets its own directory
- Original filenames are preserved in database
- File paths are stored relative to the uploads directory

## Error Responses

Common error responses:

```json
{
  "error": "Missing required fields: section_id, exam_id, subject_id, student_id"
}
```

```json
{
  "error": "Student has already submitted an answer for this exam/subject",
  "existing_submission": { "answer_id": "uuid", "status": "submitted" }
}
```

```json
{
  "error": "No images uploaded"
}
```

## Usage Example (JavaScript/Fetch)

```javascript
// Submit image answer
const formData = new FormData();
formData.append("section_id", "section-uuid");
formData.append("exam_id", "exam-uuid");
formData.append("subject_id", "subject-uuid");
formData.append("student_id", "student-uuid");

// Add multiple images
fileInput.files.forEach((file) => {
  formData.append("images", file);
});

const response = await fetch("/api/student-image-answers", {
  method: "POST",
  headers: {
    Authorization: "Bearer your-jwt-token",
  },
  body: formData,
});

const result = await response.json();
```

## Database Schema

The `student_image_answers` table includes:

- `answer_id`: Primary key (UUID)
- `section_id`, `exam_id`, `subject_id`, `student_id`: Foreign keys
- `image_paths`: Array of file paths
- `original_filenames`: Array of original file names
- `file_sizes`: Array of file sizes in bytes
- `mime_types`: Array of MIME types
- `status`: submitted, graded, reviewed
- `marks_obtained`: Numeric score
- `teacher_feedback`: Text feedback
- Timestamps for upload, grading, creation, updates
