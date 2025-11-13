// client/src/pages/QuizPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';

function QuizPage() {
  const [step, setStep] = useState(1); // 1: 자격검사, 2: 퀴즈풀기, 3: 결과확인
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const [quizzes, setQuizzes] = useState([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({}); // { quizId: answerIndex }

  // 1. 자격 검사
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

  // 2. 모든 퀴즈 가져오기
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

  // 3. 답변 선택 핸들러
  const handleSelectAnswer = (quizId, answerIndex) => {
    setUserAnswers(prev => ({ ...prev, [quizId]: answerIndex }));
  };

  // 4. 다음 문제로 이동 또는 최종 제출
  const handleNextOrSubmit = async () => {
    const currentQuiz = quizzes[currentQuizIndex];
    if (userAnswers[currentQuiz.id] === undefined) {
      setMessage("답을 선택해주세요.");
      return;
    }
    setMessage('');

    const isLastQuiz = currentQuizIndex === quizzes.length - 1;

    if (isLastQuiz) {
      // 최종 제출 로직
      setLoading(true);
      try {
        const answersToSubmit = Object.keys(userAnswers).map(quizId => ({
          quizId,
          answerIndex: userAnswers[quizId],
        }));
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
      // 다음 문제로
      setCurrentQuizIndex(prev => prev + 1);
    }
  };

  // --- UI 렌더링 ---
  const renderContent = () => {
    if (loading) return <div>로딩 중...</div>;

    switch (step) {
      case 1:
        return <p style={{ color: 'red', fontWeight: 'bold' }}>{message}</p>;
      
      case 2:
        if (quizzes.length === 0) return <p style={{ color: 'red' }}>{message}</p>;
        const currentQuiz = quizzes[currentQuizIndex];
        const isLastQuiz = currentQuizIndex === quizzes.length - 1;
        return (
          <div>
            <h3>Q {currentQuizIndex + 1}. {currentQuiz.question}</h3>
            <p>({currentQuizIndex + 1}/{quizzes.length})</p>
            {currentQuiz.options.map((option, index) => (
              <div key={index}>
                <input
                  type="radio"
                  id={`option-${index}`}
                  name={`quiz-${currentQuiz.id}`}
                  value={index}
                  onChange={() => handleSelectAnswer(currentQuiz.id, index)}
                  checked={userAnswers[currentQuiz.id] === index}
                />
                <label htmlFor={`option-${index}`}>{option}</label>
              </div>
            ))}
            <button onClick={handleNextOrSubmit} style={{ marginTop: '20px' }}>
              {isLastQuiz ? '최종 정답 제출' : '다음 문제'}
            </button>
            {message && <p style={{ color: 'red' }}>{message}</p>}
          </div>
        );

      case 3:
        return <p style={{ fontWeight: 'bold', fontSize: '1.2em' }}>{message}</p>;

      default:
        return null;
    }
  };

  return (
    <div>
      <h2>패자부활전 퀴즈</h2>
      {renderContent()}
    </div>
  );
}

export default QuizPage;