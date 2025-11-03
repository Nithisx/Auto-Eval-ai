import requests
from llama_cpp import Llama
import json
import os


class EvaluationEngine:
    def __init__(self, model_path):
        """
        Initialize the evaluation engine with Mistral model
        
        Args:
            model_path: Path to the mistral-7b-instruct-v0.2.Q4_K_M.gguf model
        """
        print(f"Loading Mistral model from: {model_path}")
        
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found at: {model_path}")
        
        # Initialize Llama model
        self.llm = Llama(
            model_path=model_path,
            n_ctx=4096,  # Context window
            n_threads=4,  # Number of CPU threads to use
            n_gpu_layers=0  # Set to 0 for CPU-only, increase if GPU available
        )
        
        print("Mistral model loaded successfully!")
    
    
    def fetch_students_list(self, section_id, token, backend_url):
        """
        Fetch all students in a section
        
        Args:
            section_id: UUID of the section
            token: Bearer token for authentication
            backend_url: Base URL of the backend API
            
        Returns:
            List of student objects
        """
        url = f"{backend_url}/api/sections/{section_id}/students"
        headers = {
            'Authorization': f'Bearer {token}'
        }
        print(f"Fetching students from: {url}")
        
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            students = data.get('students', [])
            print(f"Found {len(students)} students")
            return students
        except Exception as e:
            print(f"Error fetching students: {str(e)}")
            return []
    
    
    def fetch_teacher_answer(self, section_id, exam_id, subject_id, token, backend_url):
        """
        Fetch teacher's answer with rubrics
        
        Args:
            section_id: UUID of the section
            exam_id: UUID of the exam
            subject_id: UUID of the subject
            token: Bearer token for authentication
            backend_url: Base URL of the backend API
            
        Returns:
            Teacher answer object with questions, ideal answers, and rubrics
        """
        url = f"{backend_url}/api/teacheranswers/sections/{section_id}/exams/{exam_id}/subjects/{subject_id}/teacher-answers"
        headers = {
            'Authorization': f'Bearer {token}'
        }
        print(f"Fetching teacher answers from: {url}")
        
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            print("Teacher answers fetched successfully")
            
            # Check if the response has teacher_answer wrapper
            if 'teacher_answer' in data:
                return data['teacher_answer']
            elif 'teacher_answers' in data and len(data['teacher_answers']) > 0:
                return data['teacher_answers'][0]
            else:
                return data
                
        except Exception as e:
            print(f"Error fetching teacher answers: {str(e)}")
            return None
    
    
    def fetch_student_answer(self, section_id, exam_id, subject_id, student_id, token, backend_url):
        """
        Fetch a student's answer
        
        Args:
            section_id: UUID of the section
            exam_id: UUID of the exam
            subject_id: UUID of the subject
            student_id: UUID of the student
            token: Bearer token for authentication
            backend_url: Base URL of the backend API
            
        Returns:
            Student answer object
        """
        url = f"{backend_url}/api/studentanswers/sections/{section_id}/exams/{exam_id}/subjects/{subject_id}/students/{student_id}/answers"
        headers = {
            'Authorization': f'Bearer {token}'
        }
        
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data
        except Exception as e:
            print(f"Error fetching student {student_id} answers: {str(e)}")
            return None
    
    
    def evaluate_answer(self, question_number, question_text, student_answer, ideal_answer, rubrics, max_marks):
        """
        Evaluate a single answer using the Mistral model
        
        Args:
            question_number: Number of the question
            question_text: The question text
            student_answer: Student's answer
            ideal_answer: Teacher's ideal answer
            rubrics: Evaluation rubrics
            max_marks: Maximum marks for the question
            
        Returns:
            Dictionary with awarded_marks and feedback
        """
        # Create the evaluation prompt
        prompt = f"""[INST] You are an expert teacher evaluating student answers. Evaluate the following answer strictly according to the provided rubrics.

Question {question_number}: {question_text}

Ideal Answer:
{ideal_answer}

Student's Answer:
{student_answer}

Rubrics:
{rubrics}

Maximum Marks: {max_marks}

Please evaluate the student's answer and provide:
1. Marks awarded (as a number out of {max_marks})
2. Detailed feedback explaining why you awarded those marks, referencing the rubrics

Format your response EXACTLY as:
MARKS: [number]
FEEDBACK: [your detailed feedback]
[/INST]"""

        print(f"Evaluating Question {question_number}...")
        
        try:
            # Generate evaluation using Mistral
            output = self.llm(
                prompt,
                max_tokens=512,
                temperature=0.3,  # Lower temperature for more consistent grading
                top_p=0.95,
                stop=["[INST]", "</s>"],
                echo=False
            )
            
            response_text = output['choices'][0]['text'].strip()
            
            # Parse the response
            awarded_marks = 0
            feedback = response_text
            
            # Try to extract marks
            if "MARKS:" in response_text:
                lines = response_text.split('\n')
                for line in lines:
                    if line.strip().startswith("MARKS:"):
                        try:
                            marks_str = line.replace("MARKS:", "").strip()
                            # Extract just the number
                            marks_str = ''.join(filter(lambda x: x.isdigit() or x == '.', marks_str))
                            awarded_marks = float(marks_str)
                            awarded_marks = min(awarded_marks, max_marks)  # Cap at max marks
                        except:
                            awarded_marks = 0
                    elif line.strip().startswith("FEEDBACK:"):
                        feedback_idx = response_text.index("FEEDBACK:")
                        feedback = response_text[feedback_idx + 9:].strip()
                        break
            
            print(f"Question {question_number}: Awarded {awarded_marks}/{max_marks} marks")
            
            return {
                'awarded_marks': awarded_marks,
                'feedback': feedback
            }
            
        except Exception as e:
            print(f"Error evaluating question {question_number}: {str(e)}")
            return {
                'awarded_marks': 0,
                'feedback': f"Error during evaluation: {str(e)}"
            }
    
    
    def evaluate_student(self, student, teacher_answer_data, section_id, exam_id, subject_id, token, backend_url):
        """
        Evaluate all answers for a single student
        
        Args:
            student: Student object with details
            teacher_answer_data: Teacher's answers with rubrics
            section_id: UUID of the section
            exam_id: UUID of the exam
            subject_id: UUID of the subject
            token: Bearer token for authentication
            backend_url: Base URL of the backend API
            
        Returns:
            Evaluation result for the student
        """
        student_id = student['student_id']
        student_name = student['full_name']
        roll_number = student['roll_number']
        
        print(f"\n{'-'*80}")
        print(f"Evaluating Student: {student_name} (Roll: {roll_number})")
        print(f"{'-'*80}")
        
        # Fetch student's answers
        student_answer_data = self.fetch_student_answer(
            section_id, exam_id, subject_id, student_id, token, backend_url
        )
        
        if not student_answer_data:
            print(f"No answers found for student {student_name}")
            return None
        
        # Extract teacher's questions and rubrics
        teacher_questions = teacher_answer_data.get('answers', {}).get('questions', [])
        
        if not teacher_questions:
            print(f"Warning: No teacher questions found. Teacher data structure: {list(teacher_answer_data.keys())}")
        else:
            print(f"Found {len(teacher_questions)} questions to evaluate")
        
        # Extract student's answers - handle the response structure correctly
        # The API returns {"student_answers": [{"answers": [...]}]}
        student_answers_wrapper = student_answer_data.get('student_answers', [])
        if student_answers_wrapper and len(student_answers_wrapper) > 0:
            student_answers_list = student_answers_wrapper[0].get('answers', [])
            print(f"Found {len(student_answers_list)} student answers")
        else:
            student_answers_list = []
            print(f"Warning: No answers found in response for student {student_name}")
        
        # Create a mapping of question_number to student_answer
        student_answers_map = {
            ans['question_number']: ans['answer_text'] 
            for ans in student_answers_list
        }
        
        # Evaluate each question
        evaluated_questions = []
        total_awarded_marks = 0
        total_max_marks = teacher_answer_data.get('total_marks', 0)
        
        for teacher_q in teacher_questions:
            q_num = teacher_q['question_number']
            q_text = teacher_q['question_text']
            ideal_ans = teacher_q['ideal_answer']
            rubrics = teacher_q['rubrics']
            max_marks = teacher_q['max_marks']
            
            student_ans = student_answers_map.get(q_num, "No answer provided")
            
            # Evaluate the answer
            evaluation = self.evaluate_answer(
                q_num, q_text, student_ans, ideal_ans, rubrics, max_marks
            )
            
            evaluated_questions.append({
                'question_number': q_num,
                'question_text': q_text,
                'student_answer': student_ans,
                'ideal_answer': ideal_ans,
                'rubrics': rubrics,
                'max_marks': max_marks,
                'awarded_marks': evaluation['awarded_marks'],
                'feedback': evaluation['feedback']
            })
            
            total_awarded_marks += evaluation['awarded_marks']
        
        result = {
            'student_id': student_id,
            'student_name': student_name,
            'roll_number': roll_number,
            'questions': evaluated_questions,
            'total_marks': round(total_awarded_marks, 2),
            'max_total_marks': total_max_marks
        }
        
        print(f"\nTotal Score: {result['total_marks']}/{total_max_marks}")
        print(f"{'-'*80}\n")
        
        return result
    
    
    def evaluate_all_students(self, section_id, exam_id, subject_id, token, backend_url):
        """
        Main function to evaluate all students in a section for a specific exam and subject
        
        Args:
            section_id: UUID of the section
            exam_id: UUID of the exam
            subject_id: UUID of the subject
            token: Bearer token for authentication
            backend_url: Base URL of the backend API
            
        Returns:
            Dictionary with evaluation results for all students
        """
        print("\n" + "="*80)
        print("Starting Evaluation Process")
        print("="*80)
        
        # Step 1: Fetch teacher's answer with rubrics
        teacher_answer_data = self.fetch_teacher_answer(
            section_id, exam_id, subject_id, token, backend_url
        )
        
        if not teacher_answer_data:
            return {
                'status': 'error',
                'message': 'Failed to fetch teacher answers'
            }
        
        # Step 2: Fetch all students in the section
        students = self.fetch_students_list(section_id, token, backend_url)
        
        if not students:
            return {
                'status': 'error',
                'message': 'No students found in the section'
            }
        
        # Step 3: Evaluate each student
        evaluation_results = []
        
        for student in students:
            result = self.evaluate_student(
                student, teacher_answer_data, 
                section_id, exam_id, subject_id, token, backend_url
            )
            
            if result:
                evaluation_results.append(result)
                
                # Print individual result
                print(f"\nStudent: {result['student_name']} (Roll: {result['roll_number']})")
                print(f"Total Score: {result['total_marks']}/{result['max_total_marks']}")
                for q in result['questions']:
                    print(f"  Q{q['question_number']}: {q['awarded_marks']}/{q['max_marks']} marks")
                    print(f"    Feedback: {q['feedback'][:100]}...")
                print()
        
        # Print summary
        print("\n" + "="*80)
        print("EVALUATION SUMMARY")
        print("="*80)
        print(f"Total Students Evaluated: {len(evaluation_results)}")
        
        if evaluation_results:
            avg_score = sum(r['total_marks'] for r in evaluation_results) / len(evaluation_results)
            max_possible = evaluation_results[0]['max_total_marks']
            print(f"Average Score: {round(avg_score, 2)}/{max_possible}")
            print(f"Highest Score: {max(r['total_marks'] for r in evaluation_results)}")
            print(f"Lowest Score: {min(r['total_marks'] for r in evaluation_results)}")
        
        print("="*80 + "\n")
        
        return {
            'status': 'success',
            'evaluation_results': evaluation_results,
            'summary': {
                'total_students': len(evaluation_results),
                'average_score': round(avg_score, 2) if evaluation_results else 0,
                'max_possible_score': evaluation_results[0]['max_total_marks'] if evaluation_results else 0
            }
        }
    
    
    def store_results_to_backend(self, results, exam_id, section_id, subject_id, token, backend_url):
        """
        Store evaluation results to backend database
        
        Args:
            results: List of evaluation results
            exam_id: UUID of the exam
            section_id: UUID of the section
            subject_id: UUID of the subject
            token: Bearer token for authentication
            backend_url: Base URL of the backend API
            
        Returns:
            Boolean indicating success
        """
        url = f"{backend_url}/api/results/bulk"
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        # Prepare data for bulk insert
        bulk_data = {
            'results': []
        }
        
        for result in results:
            bulk_data['results'].append({
                'exam_id': exam_id,
                'section_id': section_id,
                'subject_id': subject_id,
                'student_id': result['student_id'],
                'questions': result['questions'],
                'total_marks': result['total_marks'],
                'max_total_marks': result['max_total_marks']
            })
        
        print(f"Storing {len(bulk_data['results'])} results to: {url}")
        
        try:
            response = requests.post(url, json=bulk_data, headers=headers)
            response.raise_for_status()
            data = response.json()
            print(f"✓ Successfully stored {data.get('stored', 0)} results")
            if data.get('errors', 0) > 0:
                print(f"⚠ {data.get('errors', 0)} results failed to store")
                print(f"Failed items: {data.get('failed', [])}")
            return True
        except Exception as e:
            print(f"✗ Error storing results to backend: {str(e)}")
            return False

