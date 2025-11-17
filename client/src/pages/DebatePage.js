import React, { useState, useEffect, useCallback } from 'react';
import { db, functions } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../hooks/useAuth';
import './DebatePage.css';

const DebateTopic = ({ debate, user, onVote }) => {
  const userVote = user && debate.voters ? debate.voters[user.uid] : null;

  return (
    <div className="debate-topic-card">
      <div className="debate-topic-header">
        <h3>{debate.topic}</h3>
      </div>
      <div className="debate-voting-section">
        <div className="vote-option">
          <button 
            onClick={() => onVote(debate.id, 'O')} 
            disabled={!!userVote || debate.status === 'closed'} 
            className={`vote-button vote-button-o ${userVote === 'O' ? 'voted-o' : ''}`}
          >
             O
          </button>
          <p className="vote-count">{debate.o_votes}</p>
        </div>
        <div className="vote-option">
          <button 
            onClick={() => onVote(debate.id, 'X')} 
            disabled={!!userVote || debate.status === 'closed'} 
            className={`vote-button vote-button-x ${userVote === 'X' ? 'voted-x' : ''}`}
          >
             X
          </button>
          <p className="vote-count">{debate.x_votes}</p>
        </div>
      </div>
      {userVote && <p className="debate-status-message user-vote-message">당신은 '{userVote}'에 투표했습니다.</p>}
      {debate.status === 'closed' && (
        <div className="debate-status-message closed-debate-message">
          <p>마감된 예측입니다. (정답: {debate.correctAnswer})</p>
        </div>
      )}
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
      fetchAllDebates();
    } catch (err) {
      setVoteMessage(`투표 실패: ${err.message}`);
    }
  };

  if (loading) return <div>토론 주제를 불러오는 중...</div>;
  if (error) return <div className="error-message">오류: {error}</div>;

  return (
    <div className="debate-container">
      <div className="debate-header">
        <h2>O/X 예측</h2>
      </div>
      {voteMessage && <p className="vote-message">{voteMessage}</p>}

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