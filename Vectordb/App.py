from flask import Flask, request, jsonify
from Files.Evualate import EvaluationEngine
import os

app = Flask(__name__)

# Initialize the evaluation engine
evaluator = EvaluationEngine(
    model_path=os.path.join(os.path.dirname(__file__), "mistral-7b-instruct-v0.2.Q4_K_M.gguf")
)

@app.route('/evaluate', methods=['POST'])
def evaluate_exam():
    """
    API endpoint to evaluate all students in a particular exam/section/subject
    
    Expected JSON body:
    {
        "section_id": "uuid",
        "exam_id": "uuid",
        "subject_id": "uuid",
        "token": "Bearer token for authentication",
        "backend_url": "http://localhost:4000"  # Optional, defaults to localhost:4000
    }
    
    Returns:
    {
        "status": "success",
        "evaluation_results": [
            {
                "student_id": "uuid",
                "student_name": "string",
                "roll_number": "string",
                "questions": [
                    {
                        "question_number": int,
                        "question_text": "string",
                        "student_answer": "string",
                        "ideal_answer": "string",
                        "rubrics": "string",
                        "max_marks": int,
                        "awarded_marks": float,
                        "feedback": "string"
                    }
                ],
                "total_marks": float,
                "max_total_marks": int
            }
        ]
    }
    """
    try:
        data = request.get_json()
        
        # Validate required parameters
        if not all(key in data for key in ['section_id', 'exam_id', 'subject_id', 'token']):
            return jsonify({
                'status': 'error',
                'message': 'Missing required parameters: section_id, exam_id, subject_id, token'
            }), 400
        
        section_id = data['section_id']
        exam_id = data['exam_id']
        subject_id = data['subject_id']
        token = data['token']
        backend_url = data.get('backend_url', 'http://localhost:4000')
        
        print(f"\n{'='*80}")
        print(f"Starting Evaluation Process")
        print(f"Section ID: {section_id}")
        print(f"Exam ID: {exam_id}")
        print(f"Subject ID: {subject_id}")
        print(f"{'='*80}\n")
        
        # Perform evaluation
        results = evaluator.evaluate_all_students(
            section_id=section_id,
            exam_id=exam_id,
            subject_id=subject_id,
            token=token,
            backend_url=backend_url
        )
        
        if results['status'] == 'error':
            return jsonify(results), 400
        
        # Print summary
        print(f"\n{'='*80}")
        print(f"Evaluation Complete")
        print(f"Total Students Evaluated: {len(results['evaluation_results'])}")
        print(f"{'='*80}\n")
        
        return jsonify(results), 200
        
    except Exception as e:
        print(f"Error in evaluate_exam: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Internal server error: {str(e)}'
        }), 500


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'Student Answer Evaluation Service',
        'model': 'mistral-7b-instruct-v0.2'
    }), 200


if __name__ == '__main__':
    print("\n" + "="*80)
    print("Starting Student Answer Evaluation Service")
    print("Model: mistral-7b-instruct-v0.2.Q4_K_M.gguf")
    print("="*80 + "\n")
    
    # Run the Flask app
    app.run(host='0.0.0.0', port=5000, debug=True)
