import requests
import google.generativeai as genai
import json
import os
from PIL import Image
import io
import base64


class EvaluationEngine:
    def __init__(self, api_key):
        """
        Initialize the evaluation engine with Gemini API
        
        Args:
            api_key: Google Gemini API key
        """
        print(f"Initializing Gemini API...")
        genai.configure(api_key=api_key)
        
        # List available models for debugging
        try:
            available_models = list(genai.list_models())
            print(f"Available models: {[m.name for m in available_models[:5]]}")  # Show first 5
        except Exception as e:
            print(f"Could not list models: {e}")
        
        # Try different model names in order of preference
        model_names = [
            'gemini-2.0-flash-exp',
            'gemini-1.5-flash-latest', 
            'gemini-pro-vision',
            'gemini-pro',
            'models/gemini-1.5-flash',
            'models/gemini-pro-vision'
        ]
        
        self.model = None
        for model_name in model_names:
            try:
                self.model = genai.GenerativeModel(model_name)
                print(f"✓ Successfully initialized model: {model_name}")
                break
            except Exception as e:
                print(f"✗ Failed to initialize {model_name}: {e}")
                continue
        
        if not self.model:
            raise Exception("Could not initialize any Gemini model")
        
        print("Gemini API initialized successfully!")
    
    
    def fetch_students_list(self, section_id, token, backend_url):
        """Fetch all students in a section"""
        url = f"{backend_url}/api/sections/{section_id}/students"
        headers = {'Authorization': f'Bearer {token}'}
        print(f"Fetching students from: {url}")
        
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            students = data.get('students', [])
            print(f"✓ Found {len(students)} students")
            return students
        except Exception as e:
            print(f"✗ Error fetching students: {str(e)}")
            return []
    
    
    def fetch_student_answer(self, section_id, exam_id, subject_id, student_id, token, backend_url):
        """Fetch a student's image answers"""
        # Use the new student image answers API
        params = {
            'section_id': section_id,
            'exam_id': exam_id,
            'subject_id': subject_id,
            'student_id': student_id
        }
        
        url = f"{backend_url}/api/student-image-answers"
        headers = {'Authorization': f'Bearer {token}'}
        
        try:
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()
            print(f"  📥 Fetched image answer data structure: {list(data.keys())}")
            print(f"  📊 Found {data.get('count', 0)} image submissions")
            return data
        except Exception as e:
            print(f"✗ Error fetching student {student_id} image answers: {str(e)}")
            return None
    
    
    def extract_and_evaluate_from_image(self, image_data):
        """
        Extract all questions from the exam paper image and evaluate answers
        
        Args:
            image_data: Base64 encoded image or PIL Image
            
        Returns:
            List of evaluated questions with marks and feedback
        """
        try:
            # Convert base64 to PIL Image if needed
            if isinstance(image_data, str):
                # Remove data URI prefix if present
                if ',' in image_data and 'base64' in image_data:
                    image_data = image_data.split(',')[1]
                image_bytes = base64.b64decode(image_data)
                image = Image.open(io.BytesIO(image_bytes))
            else:
                image = image_data
            
            prompt = """Analyze this exam paper image carefully and extract ALL questions with their answers.

For EACH question on the paper:
1. Identify the question number
2. Read the question text
3. Check if the student has answered it
4. Evaluate if the answer is CORRECT or WRONG
5. Provide detailed feedback explaining why

Rules for evaluation:
- Award 1 mark if the answer is CORRECT
- Award 0 marks if the answer is WRONG or BLANK/UNANSWERED
- Be strict and accurate in your evaluation

Feedback guidelines:
- If CORRECT: Write "Good answer! This is correct." or similar positive feedback
- If WRONG: Explain specifically what was wrong and what the correct answer should be
- If BLANK: Write "No answer provided."

Return your response in this EXACT JSON format:
{
  "questions": [
    {
      "question_number": 1,
      "question_text": "question text here",
      "student_answer": "student's answer or 'No answer'",
      "is_correct": true,
      "marks": 1,
      "feedback": "Good answer! This is correct because..."
    },
    {
      "question_number": 2,
      "question_text": "question text here", 
      "student_answer": "student's answer or 'No answer'",
      "is_correct": false,
      "marks": 0,
      "feedback": "Incorrect. The correct answer should be... because..."
    }
  ]
}

IMPORTANT: Return ONLY valid JSON, no additional text before or after."""

            response = self.model.generate_content([prompt, image])
            response_text = response.text.strip()
            
            # Clean up response - remove markdown code blocks if present
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            
            # Parse JSON
            result = json.loads(response_text)
            return result.get('questions', [])
            
        except json.JSONDecodeError as e:
            print(f"  ✗ Error parsing JSON response: {str(e)}")
            print(f"  Response text: {response_text[:500]}...")
            return []
        except Exception as e:
            print(f"  ✗ Error extracting questions from image: {str(e)}")
            return []
    
    
    def evaluate_student(self, student, section_id, exam_id, subject_id, token, backend_url):
        """Evaluate all answers for a single student from their exam paper image"""
        student_id = student['student_id']
        student_name = student['full_name']
        roll_number = student['roll_number']
        
        print(f"\n{'='*80}")
        print(f"📝 Evaluating: {student_name} (Roll: {roll_number})")
        print(f"{'='*80}")
        
        # Fetch student's answers
        student_answer_data = self.fetch_student_answer(
            section_id, exam_id, subject_id, student_id, token, backend_url
        )
        
        if not student_answer_data:
            print(f"✗ No answers found for {student_name}")
            return None
        
        # Debug: Print the structure
        print(f"  🔍 Response structure: {json.dumps(student_answer_data, indent=2)[:500]}...")
        
        # Extract image submissions from the new API format
        image_submissions = []
        
        if 'data' in student_answer_data:
            submissions = student_answer_data['data']
            if isinstance(submissions, list) and len(submissions) > 0:
                print(f"  ✓ Found {len(submissions)} image submission(s)")
                
                for submission in submissions:
                    if 'image_paths' in submission and submission['image_paths']:
                        for image_path in submission['image_paths']:
                            # Construct full image URL
                            image_url = f"{backend_url}/uploads/{image_path}"
                            image_submissions.append({
                                'url': image_url,
                                'path': image_path,
                                'submission_id': submission.get('image_answer_id'),
                                'status': submission.get('status', 'submitted')
                            })
                        print(f"  ✓ Found {len(submission['image_paths'])} image(s) in submission {submission.get('image_answer_id', 'unknown')}")
        
        if not image_submissions:
            print(f"✗ No exam paper images found for {student_name}")
            print(f"  Available keys: {list(student_answer_data.keys())}")
            if 'data' in student_answer_data:
                print(f"  Data array length: {len(student_answer_data['data'])}")
            return None
        
        print(f"📄 Analyzing {len(image_submissions)} exam paper image(s) with Gemini AI...")
        
        # Process all images and combine results
        all_evaluated_questions = []
        
        for idx, image_submission in enumerate(image_submissions, 1):
            print(f"  📄 Processing image {idx}/{len(image_submissions)}: {image_submission['path']}")
            
            try:
                # Download the image from the server
                image_url = image_submission['url']
                headers = {'Authorization': f'Bearer {token}'}
                
                try:
                    # Try with authentication first
                    image_response = requests.get(image_url, headers=headers)
                    image_response.raise_for_status()
                except requests.exceptions.HTTPError as e:
                    if e.response.status_code == 401:
                        # Try without authentication (images might be publicly accessible)
                        print(f"    🔄 Retrying without authentication...")
                        image_response = requests.get(image_url)
                        image_response.raise_for_status()
                    else:
                        raise
                
                # Convert to PIL Image
                image = Image.open(io.BytesIO(image_response.content))
                
                # Extract and evaluate questions from this image
                evaluated_questions = self.extract_and_evaluate_from_image(image)
                
                if evaluated_questions:
                    print(f"    ✓ Extracted {len(evaluated_questions)} questions from image {idx}")
                    # Add image info to each question
                    for q in evaluated_questions:
                        q['source_image'] = image_submission['path']
                        q['submission_id'] = image_submission['submission_id']
                    all_evaluated_questions.extend(evaluated_questions)
                else:
                    print(f"    ✗ Could not extract questions from image {idx}")
                    
            except Exception as e:
                print(f"    ✗ Error processing image {idx}: {str(e)}")
                continue
        
        if not all_evaluated_questions:
            print(f"✗ Could not extract questions from any exam paper images")
            return None
        
        # Calculate totals
        total_awarded_marks = sum(q.get('marks', 0) for q in all_evaluated_questions)
        total_questions = len(all_evaluated_questions)
        total_images = len(image_submissions)
        percentage = (total_awarded_marks / total_questions * 100) if total_questions > 0 else 0
        
        # Display results
        print(f"\n{'Q#':<6} {'Marks':<8} {'Status':<10} {'Image':<15} {'Feedback'}")  
        print(f"{'-'*100}")
        
        for q in all_evaluated_questions:
            q_num = q.get('question_number', '?')
            marks = q.get('marks', 0)
            is_correct = q.get('is_correct', False)
            feedback = q.get('feedback', 'No feedback')[:40]
            source_img = q.get('source_image', 'unknown')[:14]
            status = "✓ Correct" if is_correct else "✗ Wrong"
            
            print(f"Q{q_num:<5} {marks:<8} {status:<10} {source_img:<15} {feedback}...")
        
        print(f"{'-'*100}")
        print(f"{'TOTAL':<6} {total_awarded_marks}/{total_questions:<6} ({percentage:.1f}%) from {total_images} image(s)")
        print(f"{'='*100}\n")
        
        return {
            'student_id': student_id,
            'student_name': student_name,
            'roll_number': roll_number,
            'questions': all_evaluated_questions,
            'total_marks': total_awarded_marks,
            'max_total_marks': total_questions,
            'percentage': round(percentage, 2),
            'total_images_processed': total_images
        }
    
    
    def evaluate_all_students(self, section_id, exam_id, subject_id, token, backend_url):
        """Main function to evaluate all students"""
        print(f"\n{'='*80}")
        print(f"🚀 STARTING EVALUATION PROCESS")
        print(f"{'='*80}")
        print(f"📌 Section: {section_id}")
        print(f"📌 Exam: {exam_id}")
        print(f"📌 Subject: {subject_id}")
        print(f"{'='*80}\n")
        
        # Fetch all students
        students = self.fetch_students_list(section_id, token, backend_url)
        
        if not students:
            return {
                'status': 'error',
                'message': 'No students found in the section'
            }
        
        # Evaluate each student
        evaluation_results = []
        
        for idx, student in enumerate(students, 1):
            print(f"\n[{idx}/{len(students)}] Processing student...")
            result = self.evaluate_student(
                student, section_id, exam_id, subject_id, token, backend_url
            )
            
            if result:
                evaluation_results.append(result)
        
        # Print summary
        print(f"\n{'='*80}")
        print(f"📊 EVALUATION SUMMARY")
        print(f"{'='*80}")
        print(f"Total Students Evaluated: {len(evaluation_results)}")
        
        if evaluation_results:
            avg_score = sum(r['total_marks'] for r in evaluation_results) / len(evaluation_results)
            avg_percentage = sum(r['percentage'] for r in evaluation_results) / len(evaluation_results)
            max_possible = evaluation_results[0]['max_total_marks']
            
            print(f"Average Score: {avg_score:.2f}/{max_possible} ({avg_percentage:.1f}%)")
            print(f"Highest Score: {max(r['total_marks'] for r in evaluation_results)}")
            print(f"Lowest Score: {min(r['total_marks'] for r in evaluation_results)}")
            
            print(f"\n{'Student':<30} {'Roll No':<12} {'Score':<12} {'%'}")
            print(f"{'-'*70}")
            for r in evaluation_results:
                name = r['student_name'][:29]
                roll = r['roll_number']
                score = f"{r['total_marks']}/{r['max_total_marks']}"
                pct = r['percentage']
                print(f"{name:<30} {roll:<12} {score:<12} {pct:.1f}%")
        
        print(f"{'='*80}\n")
        
        return {
            'status': 'success',
            'evaluation_results': evaluation_results,
            'summary': {
                'total_students': len(evaluation_results),
                'average_score': round(avg_score, 2) if evaluation_results else 0,
                'average_percentage': round(avg_percentage, 2) if evaluation_results else 0,
                'max_possible_score': max_possible if evaluation_results else 0
            }
        }
    
    
    def store_results_to_backend(self, results, exam_id, section_id, subject_id, token, backend_url):
        """Store evaluation results to backend database"""
        url = f"{backend_url}/api/results/bulk"
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
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
                'max_total_marks': result['max_total_marks'],
                'percentage': result['percentage']
            })
        
        print(f"\n💾 Storing {len(bulk_data['results'])} results to backend...")
        
        try:
            response = requests.post(url, json=bulk_data, headers=headers)
            response.raise_for_status()
            data = response.json()
            print(f"✓ Successfully stored {data.get('stored', 0)} results")
            if data.get('errors', 0) > 0:
                print(f"⚠ {data.get('errors', 0)} results failed to store")
            return True
        except Exception as e:
            print(f"✗ Error storing results: {str(e)}")
            return False