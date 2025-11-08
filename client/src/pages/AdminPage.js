// client/src/pages/AdminPage.js
import React, { useState } from 'react';
import { functions } from '../firebase'; // functions 임포트
import { httpsCallable } from 'firebase/functions'; // httpsCallable 임포트

function AdminPage() {
  const [loadingSeason, setLoadingSeason] = useState(false);
  const [message, setMessage] = useState('');

  // [UC-15] 시즌 마감 함수 호출
  const handleEndSeason = async () => {
    //  (중요) 실제 서비스에서는 이 함수를 호출하기 전에 사용자가 '관리자(admin)' 권한이 있는지 먼저 확인
    //  (지금은 테스트를 위해 누구나 호출 가능하게 둡니다)

    // 1. 관리자에게 위험한 작업임을 재확인
    if (!window.confirm(
        '정말로 이번 시즌을 마감하시겠습니까?\n' + 
        '모든 사용자의 자산이 초기화되며, 되돌릴 수 없습니다.'
    )) {
      return; // '취소'를 누르면 함수 종료
    }

    setLoadingSeason(true);
    setMessage('');

    try {
      // 2. 'endSeason' Cloud Function 호출
      const endSeason = httpsCallable(functions, 'endSeason');
      const result = await endSeason();

      // 3. 성공 메시지 표시
      setMessage(result.data.message);

    } catch (err) {
      console.error("시즌 마감(UC-15) 실패:", err);
      setMessage(`시즌 마감 실패: ${err.message}`);
    } finally {
      setLoadingSeason(false);
    }
  };

  return (
    <div>
      <h2>관리자 페이지 (UC-13 ~ UC-18)</h2>

      <div style={{ border: '2px solid red', padding: '10px' }}>
        <h3>시즌 관리 (UC-15)</h3>
        <p style={{ color: 'red' }}>
          [주의!] 이 버튼을 누르면 즉시 현재 시즌이 마감되고, 
          모든 사용자의 자산이 1,000만원으로 초기화됩니다.
        </p>

        <button 
          onClick={handleEndSeason} 
          disabled={loadingSeason}
          style={{ backgroundColor: 'red', color: 'white', padding: '10px 20px' }}
        >
          {loadingSeason ? '마감 처리 중...' : '시즌 마감 실행 (UC-15)'}
        </button>

        {message && (
          <p style={{ 
            marginTop: '15px', 
            color: message.includes('실패') ? 'red' : 'blue',
            fontWeight: 'bold'
          }}>
            {message}
          </p>
        )}
      </div>

      {/* TODO: 여기에 UC-13(사용자 관리), UC-14(게시물 관리) 등 다른 관리자 기능 UI 추가 */}
    </div>
  );
}

export default AdminPage;