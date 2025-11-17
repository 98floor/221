import React, { useState, useEffect, useCallback } from 'react';
import { db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import './QuizPage.css';

function QuizPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [quizzes, setQuizzes] = useState([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});

  useEffect(() => {
    const checkEligibility = async () => {
      setLoading(true);
      try {
        const checkQuizEligibility = httpsCallable(functions, 'checkQuizEligibility');
        const result = await checkQuizEligibility();
        if (result.data.eligible) {
          setStep(2);
          fetchAllQuizzes();
        } else {
          setMessage(result.data.reason || "퀴즈 참여 자격이 없습니다.");
          setLoading(false);
        }
      } catch (err) {
        setMessage(`오류: ${err.message}`);
        setLoading(false);
      }
    };
    checkEligibility();
  }, []);

  const fetchAllQuizzes = useCallback(async () => {
    try {
      const q = query(collection(db, 'quizzes'), orderBy('createdAt', 'asc'));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        setMessage("현재 등록된 퀴즈가 없습니다.");
      } else {
        setQuizzes(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    } catch (err) {
      setMessage(`퀴즈 목록 로딩 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectAnswer = (quizId, answerIndex) => {
    setUserAnswers(prev => ({ ...prev, [quizId]: answerIndex }));
  };

  const handleNextOrSubmit = async () => {
    const currentQuiz = quizzes[currentQuizIndex];
    if (userAnswers[currentQuiz.id] === undefined) {
      setMessage("답을 선택해주세요.");
      return;
    }
    setMessage('');
    const isLastQuiz = currentQuizIndex === quizzes.length - 1;
    if (isLastQuiz) {
      setLoading(true);
      try {
        const answersToSubmit = Object.keys(userAnswers).map(quizId => ({ quizId, answerIndex: userAnswers[quizId] }));
        const submitAllFunc = httpsCallable(functions, 'submitAllQuizAnswers');
        const result = await submitAllFunc({ answers: answersToSubmit });
        setMessage(result.data.message);
        setStep(3);
      } catch (err) {
        setMessage(`제출 실패: ${err.message}`);
      } finally {
        setLoading(false);
      }
    } else {
      setCurrentQuizIndex(prev => prev + 1);
    }
  };

  const renderContent = () => {
    if (loading) return <div className="loading-spinner"></div>;
    switch (step) {
      case 1:
        return <div className="alert alert-error">{message}</div>;
      case 2:
        if (quizzes.length === 0) return <div className="alert">{message}</div>;
        const currentQuiz = quizzes[currentQuizIndex];
        const isLastQuiz = currentQuizIndex === quizzes.length - 1;
        return (
          <div className="quiz-step-container">
            <div className="quiz-progress-bar">
              <div className="quiz-progress" style={{ width: `${((currentQuizIndex + 1) / quizzes.length) * 100}%` }}></div>
            </div>
            <p className="quiz-progress-text">{currentQuizIndex + 1} / {quizzes.length}</p>
            <div className="quiz-question">
              <h3>Q. {currentQuiz.question}</h3>
            </div>
            <div className="quiz-options">
              {currentQuiz.options.map((option, index) => (
                <label key={index} className={`quiz-option ${userAnswers[currentQuiz.id] === index ? 'quiz-option-selected' : ''}`}>
                  <input type="radio" name={`quiz-${currentQuiz.id}`} value={index} onChange={() => handleSelectAnswer(currentQuiz.id, index)} checked={userAnswers[currentQuiz.id] === index} />
                  {option}
                </label>
              ))}
            </div>
            <div className="quiz-navigation">
              <button onClick={handleNextOrSubmit}>{isLastQuiz ? '최종 정답 제출' : '다음 문제'}</button>
            </div>
            {message && <p className="error-message">{message}</p>}
          </div>
        );
      case 3:
        return <div className="quiz-result-container"><h3>{message}</h3></div>;
      default:
        return null;
    }
  };

  return (
    <div className="quiz-container">
      <div className="quiz-header">
        <h2>패자부활전 퀴즈</h2>
      </div>
      {renderContent()}
    </div>
  );
}

export default QuizPage;