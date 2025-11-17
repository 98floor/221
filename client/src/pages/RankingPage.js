import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import './RankingPage.css';

function RankingPage() {
  const [personalRanking, setPersonalRanking] = useState([]);
  const [schoolRanking, setSchoolRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('personal'); // 'personal' or 'school'

  const formatNumber = (num, type = 'asset') => {
    if (type === 'asset') return `${Math.round(num).toLocaleString('ko-KR')}원`;
    if (type === 'percent') return `${num.toFixed(2)}%`;
    return num;
  };

  useEffect(() => {
    const fetchRankingData = async () => {
      try {
        const rankingDocRef = doc(db, 'ranking', 'current_season');
        const rankingDoc = await getDoc(rankingDocRef);
        if (rankingDoc.exists()) {
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
  }, []);

  if (loading) return <div>랭킹을 불러오는 중...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="ranking-container">
      <div className="ranking-header">
        <h2>현재 시즌 랭킹</h2>
      </div>
      <div className="ranking-tabs">
        <button className={`ranking-tab ${activeTab === 'personal' ? 'ranking-tab-active' : ''}`} onClick={() => setActiveTab('personal')}>개인 랭킹</button>
        <button className={`ranking-tab ${activeTab === 'school' ? 'ranking-tab-active' : ''}`} onClick={() => setActiveTab('school')}>학교 랭킹</button>
      </div>

      <div className="ranking-table-container">
        {activeTab === 'personal' ? (
          <table className="ranking-table">
            <thead>
              <tr><th>순위</th><th>닉네임</th><th>소속 학교</th><th>총 자산</th><th>수익률</th></tr>
            </thead>
            <tbody>
              {personalRanking.length > 0 ? personalRanking.map((user, index) => (
                <tr key={user.uid}>
                  <td>{index + 1}</td><td>{user.nickname}</td><td>{user.school_name}</td><td>{formatNumber(user.total_asset, 'asset')}</td><td className={user.profit_rate >= 0 ? 'positive' : 'negative'}>{formatNumber(user.profit_rate, 'percent')}</td>
                </tr>
              )) : <tr><td colSpan="5">데이터가 없습니다.</td></tr>}
            </tbody>
          </table>
        ) : (
          <table className="ranking-table">
            <thead>
              <tr><th>순위</th><th>학교명</th><th>평균 수익률</th><th>참여 인원</th></tr>
            </thead>
            <tbody>
              {schoolRanking.length > 0 ? schoolRanking.map((school, index) => (
                <tr key={school.school_name}>
                  <td>{index + 1}</td><td>{school.school_name}</td><td className={school.avg_profit_rate >= 0 ? 'positive' : 'negative'}>{formatNumber(school.avg_profit_rate, 'percent')}</td><td>{school.member_count}명</td>
                </tr>
              )) : <tr><td colSpan="4">데이터가 없습니다.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default RankingPage;