-- Fix for student_image_answers table column naming
-- Run this if you're getting "column answer_id does not exist" errors

-- Option 1: If table exists with answer_id, rename it to image_answer_id
ALTER TABLE student_image_answers RENAME COLUMN answer_id TO image_answer_id;

-- Option 2: If table doesn't exist, create it with the correct structure
-- (Comment out the ALTER statement above and uncomment the CREATE statement below)

/*
CREATE TABLE IF NOT EXISTS student_image_answers (
  image_answer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id UUID NOT NULL,
  exam_id UUID NOT NULL,
  subject_id UUID NOT NULL,
  student_id UUID NOT NULL,
  question_id UUID,
  image_paths TEXT[] NOT NULL,
  original_filenames TEXT[] NOT NULL,
  file_sizes INTEGER[] NOT NULL,
  mime_types TEXT[] NOT NULL,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded', 'reviewed')),
  marks_obtained NUMERIC(6,2) DEFAULT 0,
  teacher_feedback TEXT,
  graded_by UUID,
  graded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_student_image_answers_section_exam ON student_image_answers(section_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_student_image_answers_student ON student_image_answers(student_id);
CREATE INDEX IF NOT EXISTS idx_student_image_answers_exam ON student_image_answers(exam_id);
CREATE INDEX IF NOT EXISTS idx_student_image_answers_subject ON student_image_answers(subject_id);
CREATE INDEX IF NOT EXISTS idx_student_image_answers_status ON student_image_answers(status);
CREATE INDEX IF NOT EXISTS idx_student_image_answers_created_at ON student_image_answers(created_at);
*/