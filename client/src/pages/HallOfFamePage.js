// client/src/pages/HallOfFamePage.js
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'; // onSnapshot 추가

function HallOfFamePage() {
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const formatNumber = (num, type = 'percent') => {
    if (typeof num !== 'number') return 'N/A';
    return `${num.toFixed(2)}%`;
  };

  useEffect(() => {
    setLoading(true);
    
    // [수정] 'endDate' 필드를 기준으로 내림차순 정렬하여 최신 시즌이 위로 오게 함
    const q = query(collection(db, 'hall_of_fame'), orderBy('endDate', 'desc'));

    // [수정] onSnapshot을 사용하여 실시간으로 데이터 변경을 감지
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const seasonsData = [];
      querySnapshot.forEach((doc) => {
        seasonsData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      setSeasons(seasonsData);
      setLoading(false);
    }, (err) => {
      // 에러 처리
      console.error("명예의 전당 실시간 조회 실패:", err);
      setError(err.message);
      setLoading(false);
    });

    // 컴포넌트가 언마운트될 때 실시간 리스너를 정리
    return () => unsubscribe();
  }, []); // 의존성 배열은 비워두어 컴포넌트 마운트 시 한 번만 실행되도록 함

  if (loading) {
    return <div>데이터를 불러오는 중...</div>;
  }

  if (error) {
    return <div>오류: {error}</div>;
  }

  return (
    <div>
      <h2>명예의 전당</h2>

      {seasons.length > 0 ? (
        seasons.map((season) => (
          <div key={season.id} style={{ marginBottom: 30 }}>
            <h3>{season.season_name}</h3>
            <table border="1" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
              <thead>
                <tr>
                  <th>순위</th>
                  <th>닉네임</th>
                  <th>수익률</th>
                </tr>
              </thead>
              <tbody>
                {season.top_rankers && season.top_rankers.map((ranker, index) => (
                  <tr key={ranker.uid || index}>
                    <td>{index + 1}</td>
                    <td>{ranker.nickname}</td>
                    <td style={{ color: ranker.profit_rate >= 0 ? 'green' : 'red' }}>
                      {formatNumber(ranker.profit_rate, 'percent')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      ) : (
        <p>아직 역대 시즌 기록이 없습니다.</p>
      )}
    </div>
  );
}

export default HallOfFamePage;
