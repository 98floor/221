// client/src/pages/RankingPage.js
import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; // [중요] functions가 아닌 db를 임포트
import { doc, getDoc } from 'firebase/firestore'; // Firestore 읽기 도구 임포트

function RankingPage() {
  const [personalRanking, setPersonalRanking] = useState([]);
  const [schoolRanking, setSchoolRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 헬퍼 함수: 숫자 포맷
  const formatNumber = (num, type = 'asset') => {
    if (type === 'asset') {
      return `${Math.round(num).toLocaleString('ko-KR')}원`;
    } else if (type === 'percent') {
      return `${num.toFixed(2)}%`;
    }
    return num;
  };

  useEffect(() => {
    const fetchRankingData = async () => {
      try {
        // 1. Firestore 'ranking' 컬렉션의 'current_season' 문서를 직접 조회 [cite: 215]
        const rankingDocRef = doc(db, 'ranking', 'current_season');
        const rankingDoc = await getDoc(rankingDocRef);

        if (rankingDoc.exists()) {
          // 2. 문서에서 personal_ranking과 school_ranking 배열을 가져옵니다.
          const data = rankingDoc.data();
          setPersonalRanking(data.personal_ranking || []);
          setSchoolRanking(data.school_ranking || []);
        } else {
          setError('아직 랭킹 데이터가 집계되지 않았습니다.');
        }
      } catch (err) {
        console.error("랭킹 조회 실패:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRankingData();
  }, []); // []는 페이지가 처음 렌더링될 때 한 번만 실행

  if (loading) {
    return <div>랭킹을 불러오는 중...</div>;
  }

  if (error) {
    return <div>오류: {error}</div>;
  }

  return (
    <div>
      <h2>현재 시즌 랭킹 (UC-7)</h2>

      {/* 개인 랭킹 테이블 */}
      <h3>개인 랭킹</h3>
      <table border="1" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>순위</th>
            <th>닉네임</th>
            <th>소속 학교</th>
            <th>총 자산</th>
            <th>수익률</th>
          </tr>
        </thead>
        <tbody>
          {personalRanking.length > 0 ? (
            personalRanking.map((user, index) => (
              <tr key={user.uid}>
                <td>{index + 1}</td>
                <td>{user.nickname}</td>
                <td>{user.school_name}</td>
                <td>{formatNumber(user.total_asset, 'asset')}</td>
                <td style={{ color: user.profit_rate >= 0 ? 'green' : 'red' }}>
                  {formatNumber(user.profit_rate, 'percent')}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5">데이터가 없습니다.</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* 학교 랭킹 테이블 */}
      <h3 style={{ marginTop: 30 }}>학교 랭킹</h3>
      <table border="1" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>순위</th>
            <th>학교명</th>
            <th>평균 수익률</th>
            <th>참여 인원</th>
          </tr>
        </thead>
        <tbody>
          {schoolRanking.length > 0 ? (
            schoolRanking.map((school, index) => (
              <tr key={school.school_name}>
                <td>{index + 1}</td>
                <td>{school.school_name}</td>
                <td style={{ color: school.avg_profit_rate >= 0 ? 'green' : 'red' }}>
                  {formatNumber(school.avg_profit_rate, 'percent')}
                </td>
                <td>{school.member_count}명</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="4">데이터가 없습니다.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default RankingPage;