-- -- Enable UUID extension
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -- USERS: principal, teacher, student
-- CREATE TABLE users (
--   user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   email TEXT UNIQUE NOT NULL,
--   password_hash TEXT NOT NULL,            -- store salted hash
--   full_name TEXT NOT NULL,
--   role TEXT NOT NULL CHECK (role IN ('principal','teacher','student','admin')),
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
-- );

-- -- ORGANIZATION / SCHOOL (optional - keep project multi-classroom ready)
-- CREATE TABLE schools (
--   school_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   name TEXT NOT NULL,
--   address TEXT,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
-- );

-- -- PRINCIPAL -> assigns to school (optional relationship)
-- ALTER TABLE users ADD COLUMN school_id UUID;
-- ALTER TABLE users
--   ADD CONSTRAINT fk_users_school FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE SET NULL;

-- -- CLASS / GRADE (e.g., "3rd Standard")
-- CREATE TABLE classes (
--   class_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   school_id UUID,
--   name TEXT NOT NULL,                      -- e.g., "3rd Standard"
--   grade INTEGER,                           -- numeric grade if desired
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   CONSTRAINT fk_classes_school FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE CASCADE
-- );

-- -- SECTION (A, B, C) - belongs to a class
-- CREATE TABLE sections (
--   section_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   class_id UUID NOT NULL,
--   name TEXT NOT NULL,                      -- "A", "B"
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   CONSTRAINT fk_sections_class FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
--   UNIQUE (class_id, name)
-- );

-- -- Join table for teachers assigned to class+section
-- CREATE TABLE teacher_assignments (
--   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   teacher_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
--   class_id UUID NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
--   section_id UUID NOT NULL REFERENCES sections(section_id) ON DELETE CASCADE,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   UNIQUE (teacher_id, class_id, section_id)
-- );

-- -- STUDENTS: each student belongs to particular class+section
-- CREATE TABLE students (
--   student_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   user_id UUID UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
--   roll_number TEXT,                        -- school roll
--   class_id UUID NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
--   section_id UUID NOT NULL REFERENCES sections(section_id) ON DELETE CASCADE,
--   enrollment_date DATE,
--   CONSTRAINT fk_students_section FOREIGN KEY (section_id) REFERENCES sections(section_id)
-- );

-- -- SUBJECTS (Math, Science...)
CREATE TABLE IF NOT EXISTS subjects (
  subject_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  teacher_answer_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add teacher_answer_id column if it doesn't exist
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS teacher_answer_id UUID;

-- -- EXAMS (e.g., "Midterm March 2025") created by teacher/principal
-- CREATE TABLE exams (
--   exam_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   title TEXT NOT NULL,
--   description TEXT,
--   class_id UUID NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
--   section_id UUID NOT NULL REFERENCES sections(section_id) ON DELETE CASCADE,
--   subject_id UUID NOT NULL REFERENCES subjects(subject_id),
--   created_by UUID NOT NULL REFERENCES users(user_id) ON DELETE SET NULL,
--   start_time TIMESTAMP WITH TIME ZONE,
--   end_time TIMESTAMP WITH TIME ZONE,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
-- );

-- -- QUESTIONS belonging to an exam
-- CREATE TABLE questions (
--   question_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   exam_id UUID NOT NULL REFERENCES exams(exam_id) ON DELETE CASCADE,
--   question_number INTEGER NOT NULL,        -- ordering on paper
--   max_marks NUMERIC(6,2) NOT NULL,
--   prompt TEXT,                             -- text prompt if applicable
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   UNIQUE (exam_id, question_number)
-- );

-- -- RUBRICS: marking criteria for each question (teacher uploads)
-- CREATE TABLE rubrics (
--   rubric_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   question_id UUID NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE,
--   title TEXT,
--   description TEXT,                        -- detailed marking instructions
--   weight NUMERIC(5,2) DEFAULT 1.0,         -- relative weight if multiple rubrics per question
--   min_score NUMERIC(6,2) DEFAULT 0,
--   max_score NUMERIC(6,2),                  -- optional override (if null use question.max_marks)
--   created_by UUID REFERENCES users(user_id),
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
-- );

-- -- UPLOADS: store PDF metadata (teacher uploads scanned answer sheets + rubric doc)
-- CREATE TABLE uploads (
--   upload_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   uploader_id UUID NOT NULL REFERENCES users(user_id) ON DELETE SET NULL,
--   exam_id UUID REFERENCES exams(exam_id) ON DELETE CASCADE,
--   filename TEXT NOT NULL,
--   storage_path TEXT NOT NULL,              -- object store path or URL (S3/MinIO)
--   file_type TEXT,                          -- 'answer_pdf', 'rubric_doc', etc.
--   uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
-- );

-- -- PAGE / ANSWER FILE: If you split PDF into pages or images, store each page as record
-- CREATE TABLE uploaded_pages (
--   page_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   upload_id UUID NOT NULL REFERENCES uploads(upload_id) ON DELETE CASCADE,
--   page_number INTEGER NOT NULL,
--   storage_path TEXT NOT NULL,              -- path to image/page
--   ocr_text TEXT,                           -- text from OCR
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   UNIQUE (upload_id, page_number)
-- );

-- -- STUDENT_ANSWERS: mapped answers per student per question
-- CREATE TABLE student_answers (
--   student_answer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
--   question_id UUID NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE,
--   upload_id UUID,                          -- original scanned PDF upload
--   page_id UUID,                            -- specific page image reference
--   answer_text TEXT,                        -- extracted answer text (OCR)
--   answer_image_path TEXT,                  -- optional crop image path
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   UNIQUE (student_id, question_id)
-- );

-- -- AUTO_EVALUATIONS: provisional scores from the multi-agent AI
-- CREATE TABLE auto_evaluations (
--   auto_eval_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   student_answer_id UUID NOT NULL REFERENCES student_answers(student_answer_id) ON DELETE CASCADE,
--   rubric_id UUID REFERENCES rubrics(rubric_id),
--   score NUMERIC(6,2),
--   confidence NUMERIC(4,3),                 -- 0..1 AI confidence
--   explanation TEXT,                        -- AI explanation
--   vector_id TEXT,                          -- external Qdrant vector id (if needed)
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
-- );

-- -- TEACHER_REVIEW: teacher can accept/override the AI marks
-- CREATE TABLE teacher_reviews (
--   review_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   auto_eval_id UUID REFERENCES auto_evaluations(auto_eval_id) ON DELETE SET NULL,
--   student_answer_id UUID NOT NULL REFERENCES student_answers(student_answer_id),
--   reviewed_by UUID NOT NULL REFERENCES users(user_id),
--   final_score NUMERIC(6,2) NOT NULL,
--   comment TEXT,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
-- );

-- -- AGGREGATED_MARKS: per-student-per-exam totals (computed or persisted)
-- CREATE TABLE aggregated_marks (
--   agg_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   exam_id UUID NOT NULL REFERENCES exams(exam_id),
--   student_id UUID NOT NULL REFERENCES students(student_id),
--   total_marks NUMERIC(8,2) NOT NULL,
--   max_marks NUMERIC(8,2),
--   grade TEXT,
--   computed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   UNIQUE (exam_id, student_id)
-- );

-- -- AUDIT / LOGS for traceability
-- CREATE TABLE action_logs (
--   log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   actor_id UUID REFERENCES users(user_id),
--   action_type TEXT NOT NULL,
--   target_type TEXT,
--   target_id UUID,
--   details JSONB,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
-- );

-- CREATE TABLE IF NOT EXISTS exam_subjects (
--   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   exam_id UUID NOT NULL REFERENCES exams(exam_id) ON DELETE CASCADE,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   UNIQUE (exam_id)
-- );

-- ALTER TABLE questions
--   ADD COLUMN IF NOT EXISTS ideal_answer TEXT;


-- -- Index examples
-- CREATE INDEX idx_student_class ON students(class_id);
-- CREATE INDEX idx_student_section ON students(section_id);
-- CREATE INDEX idx_questions_exam ON questions(exam_id);
-- CREATE INDEX idx_student_answers_student ON student_answers(student_id);



-- -- 2. Recreate it with UUID columns
-- CREATE TABLE teacher_answers (
--   teacher_answer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   exam_id UUID NOT NULL,
--   section_id UUID NOT NULL,
--   subject_id UUID NOT NULL,
--   uploader_id UUID,                    -- who saved the teacher answers
--   total_marks INTEGER,
--   answers JSONB NOT NULL,             -- stores the entire JSON payload with questions/rubrics
--   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
-- );

-- ALTER TABLE subjects
-- ADD COLUMN answer_teacher_id UUID;



-- migrations/2025_create_student_answers.sql
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CREATE TABLE IF NOT EXISTS student_answers (
--   student_answer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   exam_id UUID NOT NULL,
--   section_id UUID NOT NULL,
--   subject_id UUID NOT NULL,
--   student_id UUID NOT NULL,
--   submitted_by INTEGER,            -- optional: user who submitted (uploader), keep integer if your users are integer ids
--   answers JSONB NOT NULL,          -- stores student answers array (question_number + answer_text)
--   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
-- );

-- CREATE INDEX IF NOT EXISTS idx_student_answers_exam ON student_answers(exam_id);
-- CREATE INDEX IF NOT EXISTS idx_student_answers_section ON student_answers(section_id);
-- CREATE INDEX IF NOT EXISTS idx_student_answers_subject ON student_answers(subject_id);
-- CREATE INDEX IF NOT EXISTS idx_student_answers_student ON student_answers(student_id);


-- -- migrations/2025_create_evaluation_results.sql
-- CREATE TABLE IF NOT EXISTS evaluation_results (
--   result_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   exam_id UUID NOT NULL,
--   section_id UUID NOT NULL,
--   subject_id UUID NOT NULL,
--   student_id UUID NOT NULL,
--   evaluated_by UUID,                -- user who evaluated (could be NULL for AI evaluation)
--   questions JSONB NOT NULL,         -- stores evaluation details for each question
--   total_marks DECIMAL(10, 2) NOT NULL DEFAULT 0,
--   max_total_marks DECIMAL(10, 2) NOT NULL DEFAULT 0,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
--   updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
--   UNIQUE(exam_id, section_id, subject_id, student_id)  -- One result per student per exam/subject
-- );

-- -- Indexes for performance
-- CREATE INDEX IF NOT EXISTS idx_evaluation_results_exam ON evaluation_results(exam_id);
-- CREATE INDEX IF NOT EXISTS idx_evaluation_results_section ON evaluation_results(section_id);
-- CREATE INDEX IF NOT EXISTS idx_evaluation_results_subject ON evaluation_results(subject_id);
-- CREATE INDEX IF NOT EXISTS idx_evaluation_results_student ON evaluation_results(student_id);
-- CREATE INDEX IF NOT EXISTS idx_evaluation_results_exam_section_subject ON evaluation_results(exam_id, section_id, subject_id);


-- CREATE TABLE IF NOT EXISTS student_image_answers (
--   image_answer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   exam_id UUID NOT NULL,
--   section_id UUID NOT NULL,
--   subject_id UUID NOT NULL,
--   student_id UUID NOT NULL,
--   image_urls JSONB NOT NULL, -- array of image URLs/paths
--   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
-- );

-- CREATE INDEX IF NOT EXISTS idx_student_image_answers_exam ON student_image_answers(exam_id);
-- CREATE INDEX IF NOT EXISTS idx_student_image_answers_section ON student_image_answers(section_id);
-- CREATE INDEX IF NOT EXISTS idx_student_image_answers_subject ON student_image_answers(subject_id);
-- CREATE INDEX IF NOT EXISTS idx_student_image_answers_student ON student_image_answers(student_id);


-- Student Image Answers Table
-- This table stores student answers submitted as images for exam questions

-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CREATE TABLE student_image_answers (
--   answer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   section_id UUID NOT NULL,
--   exam_id UUID NOT NULL,
--   subject_id UUID NOT NULL,
--   student_id UUID NOT NULL,
--   question_id UUID,  -- optional, can be null if not question-specific
--   image_paths TEXT[] NOT NULL,  -- array of image file paths
--   original_filenames TEXT[] NOT NULL,  -- array of original file names
--   file_sizes INTEGER[] NOT NULL,  -- array of file sizes in bytes
--   mime_types TEXT[] NOT NULL,  -- array of MIME types
--   upload_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded', 'reviewed')),
--   marks_obtained NUMERIC(6,2) DEFAULT 0,
--   teacher_feedback TEXT,
--   graded_by UUID,  -- references users(user_id) - teacher who graded
--   graded_at TIMESTAMP WITH TIME ZONE,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
--   -- Foreign key constraints (assuming these tables exist)
--   CONSTRAINT fk_student_image_answers_section 
--     FOREIGN KEY (section_id) REFERENCES sections(section_id) ON DELETE CASCADE,
--   CONSTRAINT fk_student_image_answers_exam 
--     FOREIGN KEY (exam_id) REFERENCES exams(exam_id) ON DELETE CASCADE,
--   CONSTRAINT fk_student_image_answers_subject 
--     FOREIGN KEY (subject_id) REFERENCES subjects(subject_id) ON DELETE CASCADE,
--   CONSTRAINT fk_student_image_answers_student 
--     FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
--   CONSTRAINT fk_student_image_answers_question 
--     FOREIGN KEY (question_id) REFERENCES questions(question_id) ON DELETE SET NULL,
--   CONSTRAINT fk_student_image_answers_grader 
--     FOREIGN KEY (graded_by) REFERENCES users(user_id) ON DELETE SET NULL
-- );

-- -- Indexes for better query performance
-- CREATE INDEX idx_student_image_answers_section_exam ON student_image_answers(section_id, exam_id);
-- CREATE INDEX idx_student_image_answers_student ON student_image_answers(student_id);
-- CREATE INDEX idx_student_image_answers_exam ON student_image_answers(exam_id);
-- CREATE INDEX idx_student_image_answers_subject ON student_image_answers(subject_id);
-- CREATE INDEX idx_student_image_answers_status ON student_image_answers(status);
-- CREATE INDEX idx_student_image_answers_upload_timestamp ON student_image_answers(upload_timestamp);

-- -- Add trigger to update updated_at timestamp
-- CREATE OR REPLACE FUNCTION update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     NEW.updated_at = now();
--     RETURN NEW;
-- END;
-- $$ language 'plpgsql';

-- CREATE TRIGGER update_student_image_answers_updated_at 
--     BEFORE UPDATE ON student_image_answers 
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Student Image Answers Table
-- This table stores student answers submitted as images for exam questions


CREATE TABLE student_image_answers (
  image_answer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id UUID NOT NULL,
  exam_id UUID NOT NULL,
  subject_id UUID NOT NULL,
  student_id UUID NOT NULL,
  question_id UUID,  -- optional, can be null if not question-specific
  image_paths TEXT[] NOT NULL,  -- array of image file paths
  original_filenames TEXT[] NOT NULL,  -- array of original file names
  file_sizes INTEGER[] NOT NULL,  -- array of file sizes in bytes
  mime_types TEXT[] NOT NULL,  -- array of MIME types
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded', 'reviewed')),
  marks_obtained NUMERIC(6,2) DEFAULT 0,
  teacher_feedback TEXT,
  graded_by UUID,  -- references users(user_id) - teacher who graded
  graded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

  image_urls JSONB NOT NULL, -- array of image URLs/paths
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_image_answers_exam ON student_image_answers(exam_id);
CREATE INDEX IF NOT EXISTS idx_student_image_answers_section ON student_image_answers(section_id);
CREATE INDEX IF NOT EXISTS idx_student_image_answers_subject ON student_image_answers(subject_id);
CREATE INDEX IF NOT EXISTS idx_student_image_answers_student ON student_image_answers(student_id);


-- Create teacher_answers table
CREATE TABLE IF NOT EXISTS teacher_answers (
  teacher_answer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL,
  section_id UUID NOT NULL,
  subject_id UUID NOT NULL,
  uploader_id UUID,
  total_marks INTEGER,
  answers JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Verify table was created
SELECT 'teacher_answers table created successfully' as status;