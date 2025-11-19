import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getExamsForCourse, getQuestionsForExam, submitExamAttempt, getAttemptsForStudent } from '@/lib/cbtService';

export default function CBTTab() {
  const { user } = useAuth();
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExam, setSelectedExam] = useState<any | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [started, setStarted] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const timerRef = useRef<number | null>(null as any);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      if (!user) return;
      try {
        // For demo: fetch all exams (better: filter by enrolled courses)
        const list = await getExamsForCourse('');
        setExams(list || []);
        const hist = await getAttemptsForStudent(user.id);
        setHistory(hist || []);
      } catch (error) {
        console.error('Error loading CBT data:', error);
        setExams([]);
        setHistory([]);
      }
    }
    load();
  }, [user]);

  useEffect(() => {
    if (!started) return;
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    timerRef.current = window.setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [started, timeLeft]);

  const openInstructions = (exam: any) => {
    setSelectedExam(exam);
    setShowInstructions(true);
  };

  const beginExam = async () => {
    if (!selectedExam) return;
    try {
      setShowInstructions(false);
      setStarted(true);
      setTimeLeft((selectedExam.duration || 10) * 60);
      // load questions for course
      const qs = await getQuestionsForExam(selectedExam.courseId || selectedExam.course);
      setQuestions(qs || []);
      setCurrentIndex(0);
      setAnswers({});
    } catch (error) {
      console.error('Error beginning exam:', error);
      alert('Failed to load exam questions. Please try again.');
      setStarted(false);
    }
  };

  const handleSelect = (idx: number, option: string) => {
    setAnswers(a => ({ ...a, [idx]: option }));
  };

  const handleSubmit = async () => {
    try {
      // auto-grade simple multiple choice
      let correct = 0;
      questions.forEach((q, idx) => {
        const ans = answers[idx];
        if (ans && q.correctAnswer && ans === q.correctAnswer) correct++;
      });
      const score = correct;
      const attempt = {
        examId: selectedExam?.id || null,
        studentId: user?.id,
        courseId: selectedExam?.courseId || selectedExam?.course,
        answers,
        score,
        totalQuestions: questions.length,
        percentage: questions.length ? Math.round((score / questions.length) * 100) : 0,
        passed: true,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      };
      await submitExamAttempt(attempt);
      setStarted(false);
      setSelectedExam(null);
      // refresh history
      const hist = await getAttemptsForStudent(user!.id);
      setHistory(hist || []);
      alert('Exam submitted. Score: ' + score + '/' + questions.length);
    } catch (error) {
      console.error('Error submitting exam:', error);
      alert('Failed to submit exam. Please try again.');
    }
  };

  return (
    <div>
      <h2>Available CBT Exams</h2>
      <div>
        {exams.length === 0 && <div>No exams available</div>}
        {exams.map((ex) => (
          <div key={ex.id} style={{ border: '1px solid #ddd', padding: 8, marginBottom: 8 }}>
            <div><strong>{ex.title}</strong></div>
            <div>Course: {ex.courseId || ex.course}</div>
            <div>Duration: {ex.duration} minutes</div>
            <div>Questions: {ex.totalQuestions || 'N/A'}</div>
            <button onClick={() => openInstructions(ex)}>Start Exam</button>
          </div>
        ))}
      </div>

      {showInstructions && selectedExam && (
        <div style={{ marginTop: 12, border: '1px solid #ccc', padding: 12 }}>
          <h3>Instructions for {selectedExam.title}</h3>
          <p>Duration: {selectedExam.duration} minutes</p>
          <p>Please read instructions carefully. The exam will auto-submit when time ends.</p>
          <button onClick={beginExam}>Begin Test</button>
          <button onClick={() => setShowInstructions(false)} style={{ marginLeft: 8 }}>Cancel</button>
        </div>
      )}

      {started && (
        <div style={{ marginTop: 12 }}>
          <h3>Exam: {selectedExam?.title}</h3>
          <div>Time left: {Math.floor(timeLeft / 60)}:{('0' + (timeLeft % 60)).slice(-2)}</div>
          {questions.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <div>Question {currentIndex + 1} / {questions.length}</div>
              <div style={{ marginTop: 8 }}>{questions[currentIndex].questionText}</div>
              <div style={{ marginTop: 8 }}>
                {['A', 'B', 'C', 'D'].map((opt) => (
                  <div key={opt} style={{ marginTop: 6 }}>
                    <label>
                      <input type="radio" name={`q-${currentIndex}`} checked={answers[currentIndex] === opt} onChange={() => handleSelect(currentIndex, opt)} /> {opt}. {questions[currentIndex][`option${opt}`] || '---'}
                    </label>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                <button onClick={() => setCurrentIndex(i => Math.max(0, i - 1))} disabled={currentIndex === 0}>Previous</button>
                <button onClick={() => setCurrentIndex(i => Math.min(questions.length - 1, i + 1))} style={{ marginLeft: 8 }}>Next</button>
                <button onClick={handleSubmit} style={{ marginLeft: 8 }}>Submit</button>
              </div>
            </div>
          ) : (
            <div>Loading questions...</div>
          )}
        </div>
      )}

      <h3 style={{ marginTop: 16 }}>History</h3>
      <div>
        {history.length === 0 && <div>No past attempts</div>}
        {history.map(h => (
          <div key={h.id} style={{ border: '1px solid #eee', padding: 8, marginBottom: 6 }}>
            <div>Exam: {h.examId}</div>
            <div>Score: {h.score} / {h.totalQuestions}</div>
            <div>Date: {h.completedAt}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
