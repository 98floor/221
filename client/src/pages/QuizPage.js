// client/src/pages/QuizPage.js
import React, { useState, useEffect } from 'react';
import { db, functions } from '../firebase'; // db와 functions 모두 임포트
import { httpsCallable } from 'firebase/functions'; // Cloud Function 호출 도구
import { doc, getDoc } from 'firebase/firestore'; // Firestore 읽기 도구

function QuizPage() {
  // 1: 자격검사, 2: 퀴즈풀기, 3: 결과확인
  const [step, setStep] = useState(1); 

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(''); // 각종 알림 메시지

  // 퀴즈 데이터용 state
  const [quiz, setQuiz] = useState(null); // 퀴즈 문제 객체 { id, question, options }
  const [selectedAnswer, setSelectedAnswer] = useState(null); // 사용자가 선택한 답 (index)

  // [1단계] 퀴즈 자격 검사 (페이지 로드 시 1회 실행)
  useEffect(() => {
    const checkEligibility = async () => {
      try {
        const checkQuizEligibility = httpsCallable(functions, 'checkQuizEligibility');
        const result = await checkQuizEligibility();

        if (result.data.eligible) {
          // [성공] 2단계(퀴즈풀기)로 이동
          setStep(2);
          // [2단계] 퀴즈 문제 로드 함수 호출
          fetchQuiz(); 
        } else {
          // [실패] 1단계(자격검사)에 머무르며 실패 메시지 표시
          setMessage(result.data.reason || "퀴즈 참여 자격이 없습니다.");
          setLoading(false);
        }
      } catch (err) {
        console.error("자격 검사 실패:", err);
        setMessage(`오류: ${err.message}`);
        setLoading(false);
      }
    };

    checkEligibility();
  }, []); // []는 페이지가 처음 렌더링될 때 한 번만 실행

  // [2단계] 퀴즈 문제 로드 함수 (자격 검사 성공 시 호출됨)
  const fetchQuiz = async () => {
    setLoading(true);
    try {
      // 10주차 1단계에서 수동으로 생성한 'quiz_1' 문제를 가져옵니다.
      const quizDocRef = doc(db, 'quizzes', 'quiz_1'); 
      const quizDoc = await getDoc(quizDocRef);

      if (quizDoc.exists()) {
        setQuiz({
          id: quizDoc.id,
          ...quizDoc.data()
        });
      } else {
        setMessage("퀴즈 문제를 불러오는 데 실패했습니다.");
      }
    } catch (err) {
      setMessage(`오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // [3단계] 정답 제출 함수 (버튼 클릭 시 호출)
  const handleSubmitAnswer = async () => {
    if (selectedAnswer === null) {
      setMessage("답안을 선택해주세요.");
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const submitQuizAnswer = httpsCallable(functions, 'submitQuizAnswer');
      const result = await submitQuizAnswer({
        quizId: quiz.id,
        answerIndex: selectedAnswer // 사용자가 선택한 답안 인덱스
      });

      // [성공] 3단계(결과확인)로 이동
      setMessage(result.data.message); // "정답입니다!" 또는 "오답입니다."
      setStep(3);

    } catch (err) {
      console.error("정답 제출 실패:", err);
      setMessage(`오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- UI 렌더링 ---

  // 로딩 중일 때 (공통)
  if (loading && step === 1) {
    return <div>퀴즈 참여 자격을 검사하는 중...</div>;
  }

  // 1단계: 자격 검사 실패 시
  if (step === 1 && !loading) {
    return (
      <div>
        <h2>패자부활전 퀴즈 (UC-11)</h2>
        <p style={{ color: 'red', fontWeight: 'bold' }}>{message}</p>
      </div>
    );
  }

  // 2단계: 퀴즈 풀기
  if (step === 2) {
    return (
      <div>
        <h2>패자부활전 퀴즈 (UC-11)</h2>
        {loading ? (
          <p>퀴즈 문제를 불러오는 중...</p>
        ) : quiz ? (
          <div>
            <h3>Q. {quiz.question}</h3>
            {quiz.options.map((option, index) => (
              <div key={index}>
                <input 
                  type="radio" 
                  id={`option-${index}`} 
                  name="quizAnswer" 
                  value={index}
                  onChange={() => setSelectedAnswer(index)} // 선택한 답의 index 저장
                />
                <label htmlFor={`option-${index}`} style={{ marginLeft: '5px' }}>
                  {option}
                </label>
              </div>
            ))}
            <button onClick={handleSubmitAnswer} style={{ marginTop: '20px' }}>
              정답 제출
            </button>
            {message && <p style={{ color: 'red' }}>{message}</p>}
          </div>
        ) : (
          <p style={{ color: 'red' }}>{message || "퀴즈가 없습니다."}</p>
        )}
      </div>
    );
  }

  // 3단계: 결과 확인
  if (step === 3) {
    return (
      <div>
        <h2>퀴즈 참여 결과</h2>
        <p style={{ fontWeight: 'bold', fontSize: '1.2em' }}>
          {message}
        </p>
      </div>
    );
  }

  return null; // 기본값
}

export default QuizPage;