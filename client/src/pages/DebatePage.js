// client/src/pages/DebatePage.js
import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; //  db 임포트
import { collection, getDocs, query, where } from 'firebase/firestore'; //  Firestore 읽기 도구

function DebatePage() {
  const [currentTopic, setCurrentTopic] = useState(null); //  현재 진행 중인 주제
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. 현재 진행 중인 토론 주제를 조회
  const fetchCurrentDebate = async () => {
    try {
      // 'debates' 컬렉션에서 'status'가 'progressing'인 문서를 찾습니다.
      const q = query(
        collection(db, 'debates'), 
        where('status', '==', 'progressing')
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // 1-1. 진행 중인 주제가 있으면 첫 번째 주제를 가져옵니다.
        const topicDoc = querySnapshot.docs[0];
        setCurrentTopic({
          id: topicDoc.id,
          ...topicDoc.data()
        });
      } else {
        // 1-2. 진행 중인 주제가 없는 경우
        setCurrentTopic(null);
      }
    } catch (err) {
      console.error("토론 주제 조회 실패:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. 페이지가 처음 렌더링될 때 주제를 1회 조회
  useEffect(() => {
    fetchCurrentDebate();
  }, []);

  // 3. (미구현) 찬성/반대 투표 로직
  // TODO: 10주차 이후 기능 고도화 시, Firestore 업데이트 로직 추가
  const handleVote = (voteType) => {
    if (!currentTopic) return;
    alert(`[미구현] '${currentTopic.subject}' 주제에 '${voteType}' 투표!\n(UC-12 상세 로직 필요)`);
  };

  if (loading) {
    return <div>토론 주제를 불러오는 중...</div>;
  }

  if (error) {
    return <div>오류: {error}</div>;
  }

  return (
    <div>
      <h2>투자 토론 배틀 (UC-12)</h2>

      {currentTopic ? (
        <div>
          <h3>금주의 토론 주제</h3>
          <div style={{ padding: '20px', border: '1px solid black', fontSize: '1.2em' }}>
            <strong>{currentTopic.subject}</strong>
          </div>
          <div style={{ marginTop: '20px' }}>
            <button 
              onClick={() => handleVote('찬성')}
              style={{ marginRight: '10px', fontSize: '1.5em', padding: '10px 20px' }}
            >
               찬성
            </button>
            <button 
              onClick={() => handleVote('반대')}
              style={{ fontSize: '1.5em', padding: '10px 20px' }}
            >
               반대
            </button>
          </div>
          {/* TODO: 10주차 이후, 학교별 투표 현황 및 의견 목록(하위 컬렉션) UI 추가 */}
        </div>
      ) : (
        <p>현재 진행 중인 토론 주제가 없습니다.</p>
      )}
    </div>
  );
}

export default DebatePage;