import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Play, Square, Upload, AlertCircle, CheckCircle, Award, Volume2 } from 'lucide-react';

const API_BASE_URL = 'http://localhost:7000';

export default function Oral() {
  const [question, setQuestion] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioURL, setAudioURL] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const fetchQuestion = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setAudioBlob(null);
    setAudioURL(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/question/random`);
      if (!response.ok) throw new Error('Failed to fetch question');
      const data = await response.json();
      setQuestion(data);
    } catch (err) {
      setError('Failed to load question. Make sure the backend is running on port 7000.');
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioURL(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      setError('Failed to access microphone. Please grant permission.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const submitAnswer = async () => {
    if (!audioBlob || !question) return;

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('answer_audio', audioBlob, 'answer.webm');
      formData.append('question_id', question.question_id);

      const response = await fetch(`${API_BASE_URL}/evaluate`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Evaluation failed');
      }

      const data = await response.json();
      setResult(data);
      setAudioBlob(null);
      setAudioURL(null);
    } catch (err) {
      setError(err.message || 'Failed to evaluate answer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreColor = (score, maxMarks) => {
    const percentage = (score / maxMarks) * 100;
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-blue-600';
    if (percentage >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Oral Exam Evaluator
          </h1>
          <p className="text-gray-600">
            AI-powered assessment for your oral examination
          </p>
        </div>

        {/* Start Button */}
        {!question && (
          <div className="text-center">
            <button
              onClick={fetchQuestion}
              disabled={isLoading}
              className="px-8 py-4 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-lg"
            >
              {isLoading ? 'Loading...' : 'Start Exam'}
            </button>
          </div>
        )}

        {/* Question Card */}
        {question && !result && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Question</h2>
              <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                Max: {question.max_marks} marks
              </span>
            </div>
            <p className="text-gray-800 text-lg leading-relaxed mb-6">
              {question.question}
            </p>

            {/* Recording Controls */}
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-4">
                {!isRecording && !audioBlob && (
                  <button
                    onClick={startRecording}
                    className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                  >
                    <Mic className="w-5 h-5" />
                    Start Recording
                  </button>
                )}

                {isRecording && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-3 px-6 py-3 bg-red-50 border-2 border-red-600 rounded-lg">
                      <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
                      <span className="text-red-600 font-mono font-bold">
                        {formatTime(recordingTime)}
                      </span>
                    </div>
                    <button
                      onClick={stopRecording}
                      className="flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900 transition-colors"
                    >
                      <Square className="w-5 h-5" />
                      Stop Recording
                    </button>
                  </div>
                )}

                {audioBlob && (
                  <div className="w-full space-y-4">
                    <div className="flex items-center justify-center gap-4">
                      <audio src={audioURL} controls className="w-full max-w-md" />
                    </div>
                    <div className="flex items-center justify-center gap-4">
                      <button
                        onClick={() => {
                          setAudioBlob(null);
                          setAudioURL(null);
                        }}
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                      >
                        Re-record
                      </button>
                      <button
                        onClick={submitAnswer}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                      >
                        <Upload className="w-5 h-5" />
                        {isLoading ? 'Evaluating...' : 'Submit Answer'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Error</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Score Card */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl shadow-lg p-8 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Your Score</h2>
                  <p className="text-indigo-100">
                    Out of {result.max_marks} marks
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-5xl font-bold">
                    {result.evaluation.overall_score}
                  </div>
                  <Award className="w-12 h-12 mx-auto mt-2" />
                </div>
              </div>
            </div>

            {/* Transcription */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-3">
                <Volume2 className="w-5 h-5 text-indigo-600" />
                Your Answer (Transcribed)
              </h3>
              <p className="text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg">
                {result.transcription}
              </p>
            </div>

            {/* Breakdown */}
            {result.evaluation.breakdown && result.evaluation.breakdown.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Detailed Breakdown
                </h3>
                <div className="space-y-4">
                  {result.evaluation.breakdown.map((item, idx) => (
                    <div key={idx} className="border-l-4 border-indigo-600 pl-4 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold text-gray-900">
                          {item.criterion}
                        </h4>
                        <span className="text-sm font-bold text-indigo-600">
                          {(item.score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm">
                        {item.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Verdict */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Examiner's Verdict
              </h3>
              <p className="text-gray-700 leading-relaxed">
                {result.evaluation.verdict}
              </p>
            </div>

            {/* Try Again Button */}
            <div className="text-center">
              <button
                onClick={() => {
                  setResult(null);
                  setQuestion(null);
                  fetchQuestion();
                }}
                className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-lg"
              >
                Try Another Question
              </button>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 text-center">
              <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-700 font-medium">
                {audioBlob ? 'Evaluating your answer...' : 'Loading question...'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}