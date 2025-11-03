-- Student Image Answers Table
-- This table stores student answers submitted as images for exam questions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Foreign key constraints (assuming these tables exist)
  CONSTRAINT fk_student_image_answers_section 
    FOREIGN KEY (section_id) REFERENCES sections(section_id) ON DELETE CASCADE,
  CONSTRAINT fk_student_image_answers_exam 
    FOREIGN KEY (exam_id) REFERENCES exams(exam_id) ON DELETE CASCADE,
  CONSTRAINT fk_student_image_answers_subject 
    FOREIGN KEY (subject_id) REFERENCES subjects(subject_id) ON DELETE CASCADE,
  CONSTRAINT fk_student_image_answers_student 
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  CONSTRAINT fk_student_image_answers_question 
    FOREIGN KEY (question_id) REFERENCES questions(question_id) ON DELETE SET NULL,
  CONSTRAINT fk_student_image_answers_grader 
    FOREIGN KEY (graded_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Indexes for better query performance
CREATE INDEX idx_student_image_answers_section_exam ON student_image_answers(section_id, exam_id);
CREATE INDEX idx_student_image_answers_student ON student_image_answers(student_id);
CREATE INDEX idx_student_image_answers_exam ON student_image_answers(exam_id);
CREATE INDEX idx_student_image_answers_subject ON student_image_answers(subject_id);
CREATE INDEX idx_student_image_answers_status ON student_image_answers(status);
CREATE INDEX idx_student_image_answers_created_at ON student_image_answers(created_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_student_image_answers_updated_at 
    BEFORE UPDATE ON student_image_answers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();