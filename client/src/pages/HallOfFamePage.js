import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import './HallOfFamePage.css';

function HallOfFamePage() {
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const formatNumber = (num) => {
    if (typeof num !== 'number') return 'N/A';
    return `${num.toFixed(2)}%`;
  };

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'hall_of_fame'), orderBy('endDate', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const seasonsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSeasons(seasonsData);
      setLoading(false);
    }, (err) => {
      console.error("명예의 전당 실시간 조회 실패:", err);
      setError(err.message);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div>데이터를 불러오는 중...</div>;
  if (error) return <div className="error-message">오류: {error}</div>;

  return (
    <div className="hall-of-fame-container">
      <div className="hall-of-fame-header">
        <h2>명예의 전당</h2>
      </div>

      {seasons.length > 0 ? (
        seasons.map((season) => (
          <div key={season.id} className="season-card">
            <div className="season-header">
              <h3>{season.season_name}</h3>
            </div>
            <table className="ranking-table">
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
                    <td className="ranker-nickname">{ranker.nickname}</td>
                    <td className={ranker.profit_rate >= 0 ? 'profit-rate-positive' : 'profit-rate-negative'}>
                      {formatNumber(ranker.profit_rate)}
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

