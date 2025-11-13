// client/src/pages/DebatePage.js
import React, { useState, useEffect, useCallback } from 'react';
import { db, functions } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../hooks/useAuth';

const DebateTopic = ({ debate, user, onVote }) => {
  const userVote = user && debate.voters ? debate.voters[user.uid] : null;

  return (
    <div style={{ border: '1px solid #ccc', padding: '16px', marginBottom: '20px' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid #eee', fontSize: '1.2em', textAlign: 'center' }}>
        <strong>{debate.topic}</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '20px 0' }}>
        <div style={{ textAlign: 'center', marginRight: '50px' }}>
          <button onClick={() => onVote(debate.id, 'pros')} disabled={!!userVote} style={{ fontSize: '1.5em', padding: '10px 20px', backgroundColor: userVote === 'pros' ? 'lightblue' : '' }}>
             찬성
          </button>
          <p style={{ fontSize: '2em', fontWeight: 'bold' }}>{debate.pros}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <button onClick={() => onVote(debate.id, 'cons')} disabled={!!userVote} style={{ fontSize: '1.5em', padding: '10px 20px', backgroundColor: userVote === 'cons' ? 'lightcoral' : '' }}>
             반대
          </button>
          <p style={{ fontSize: '2em', fontWeight: 'bold' }}>{debate.cons}</p>
        </div>
      </div>
      {userVote && <p style={{ textAlign: 'center' }}>당신은 '{userVote === 'pros' ? '찬성' : '반대'}'에 투표했습니다.</p>}
    </div>
  );
};

function DebatePage() {
  const { user } = useAuth();
  const [debates, setDebates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [voteMessage, setVoteMessage] = useState('');

  const fetchAllDebates = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'debates'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      setDebates(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error("토론 주제 조회 실패:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllDebates();
  }, [fetchAllDebates]);

  const handleVote = async (debateId, voteType) => {
    if (!user) {
      setVoteMessage("투표하려면 로그인이 필요합니다.");
      return;
    }
    setVoteMessage("투표 처리 중...");
    try {
      const voteOnDebateFunc = httpsCallable(functions, 'voteOnDebate');
      const result = await voteOnDebateFunc({ debateId, vote: voteType });
      setVoteMessage(result.data.message);
      fetchAllDebates(); // Re-fetch all debates to update UI
    } catch (err) {
      setVoteMessage(`투표 실패: ${err.message}`);
    }
  };

  if (loading) return <div>토론 주제를 불러오는 중...</div>;
  if (error) return <div>오류: {error}</div>;

  return (
    <div>
      <h2>투자 토론 배틀 (UC-12)</h2>
      {voteMessage && <p style={{ fontWeight: 'bold' }}>{voteMessage}</p>}

      {debates.length > 0 ? (
        debates.map(debate => (
          <DebateTopic key={debate.id} debate={debate} user={user} onVote={handleVote} />
        ))
      ) : (
        <p>현재 진행 중인 토론 주제가 없습니다.</p>
      )}
    </div>
  );
}

export default DebatePage;