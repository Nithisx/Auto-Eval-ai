-- Fix exam_subjects table structure
-- Add missing subject_id column and fix constraints

-- First, drop the existing table
DROP TABLE IF EXISTS exam_subjects;

-- Recreate with proper structure
CREATE TABLE exam_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL REFERENCES exams(exam_id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (exam_id, subject_id)
);