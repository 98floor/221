// client/src/pages/HallOfFamePage.js
import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; //  db 임포트
import { collection, getDocs } from 'firebase/firestore'; //  컬렉션 읽기 도구 임포트

function HallOfFamePage() {
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 헬퍼 함수
  const formatNumber = (num, type = 'percent') => {
    return `${num.toFixed(2)}%`;
  };

  useEffect(() => {
    const fetchHallOfFame = async () => {
      try {
        // 1. 'hall_of_fame' 컬렉션의 모든 문서를 조회 [cite: 222]
        const querySnapshot = await getDocs(collection(db, 'hall_of_fame'));

        const seasonsData = [];
        querySnapshot.forEach((doc) => {
          // 2. 각 시즌(문서)의 데이터를 배열에 추가
          seasonsData.push({
            id: doc.id,
            ...doc.data()
          });
        });

        setSeasons(seasonsData);

      } catch (err) {
        console.error("명예의 전당 조회 실패:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHallOfFame();
  }, []);

  if (loading) {
    return <div>데이터를 불러오는 중...</div>;
  }

  if (error) {
    return <div>오류: {error}</div>;
  }

  return (
    <div>
      <h2>명예의 전당 (UC-8)</h2>

      {seasons.length > 0 ? (
        seasons.map((season) => (
          <div key={season.id} style={{ marginBottom: 30 }}>
            <h3>{season.season_name} (시즌 ID: {season.id})</h3>
            <table border="1" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>순위</th>
                  <th>닉네임</th>
                  <th>수익률</th>
                </tr>
              </thead>
              <tbody>
                {season.top_rankers.map((ranker, index) => (
                  <tr key={ranker.uid}>
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