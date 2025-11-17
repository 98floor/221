import React, { useState, useEffect, useCallback } from 'react';
import { db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../hooks/useAuth';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import './AdminPage.css';

const AdminSection = ({ title, children, danger = false }) => {
  const [isOpen, setIsOpen] = useState(!danger);
  return (
    <div className={`admin-section ${danger ? 'danger-zone' : ''}`}>
      <div className="admin-section-header" onClick={() => setIsOpen(!isOpen)}>
        <h3>{title}</h3>
        <span>{isOpen ? '▲' : '▼'}</span>
      </div>
      {isOpen && <div className="admin-section-content">{children}</div>}
    </div>
  );
};

function AdminPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [message, setMessage] = useState('');
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userManagementMessage, setUserManagementMessage] = useState('');
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postMessage, setPostMessage] = useState('');
  const [quizzes, setQuizzes] = useState([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [quizMessage, setQuizMessage] = useState('');
  const [newQuiz, setNewQuiz] = useState({ question: '', options: ['', '', '', ''], answerIndex: 0 });
  const [debates, setDebates] = useState([]);
  const [loadingDebates, setLoadingDebates] = useState(false);
  const [debateMessage, setDebateMessage] = useState('');
  const [newDebateTopic, setNewDebateTopic] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [loadingSetAdmin, setLoadingSetAdmin] = useState(false);
  const [setAdminMessage, setSetAdminMessage] = useState('');
  const [loadingSeason, setLoadingSeason] = useState(false);
  const [pastSeasons, setPastSeasons] = useState([]);

  const fetchAllAdminData = useCallback(async () => {
    if (role !== 'admin') return;
    setLoadingUsers(true); setLoadingPosts(true); setLoadingQuizzes(true); setLoadingDebates(true); setLoadingSeason(true);
    try {
      const [usersResult, postsSnapshot, quizzesSnapshot, debatesSnapshot, seasonsSnapshot] = await Promise.all([
        httpsCallable(functions, 'listAllUsers')(),
        getDocs(query(collection(db, 'posts'), orderBy('created_at', 'desc'))),
        getDocs(query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'debates'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'hall_of_fame'), orderBy('endDate', 'desc')))
      ]);
      if (usersResult.data.success) setUsers(usersResult.data.users);
      setPosts(postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setQuizzes(quizzesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setDebates(debatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setPastSeasons(seasonsSnapshot.docs.map(doc => ({ id: parseInt(doc.id.split('_')[1]), name: doc.data().season_name })));
    } catch (err) {
      setMessage(`데이터 로딩 중 오류 발생: ${err.message}`);
    } finally {
      setLoadingUsers(false); setLoadingPosts(false); setLoadingQuizzes(false); setLoadingDebates(false); setLoadingSeason(false);
    }
  }, [role]);

  useEffect(() => { fetchAllAdminData(); }, [fetchAllAdminData]);

  const handleDeletePost = async (postId) => {
    if (!window.confirm('정말로 이 게시물을 삭제하시겠습니까?')) return;
    setPostMessage('게시물 삭제 중...');
    try {
      await httpsCallable(functions, 'deletePost')({ postId });
      setPostMessage('게시물이 삭제되었습니다.');
      fetchAllAdminData();
    } catch (err) { setPostMessage(`삭제 실패: ${err.message}`); }
  };

  const handleToggleSuspension = async (uid, suspend) => {
    const action = suspend ? '정지' : '활성화';
    if (!window.confirm(`정말로 이 사용자를 ${action}시키겠습니까?`)) return;
    setUserManagementMessage('처리 중...');
    try {
      await httpsCallable(functions, 'toggleUserSuspension')({ uid, suspend });
      setUserManagementMessage(`사용자가 ${action}되었습니다.`);
      fetchAllAdminData();
    } catch (err) { setUserManagementMessage(`작업 실패: ${err.message}`); }
  };

  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    setQuizMessage('퀴즈 생성 중...');
    try {
      await httpsCallable(functions, 'createQuiz')(newQuiz);
      setQuizMessage('퀴즈가 생성되었습니다.');
      setNewQuiz({ question: '', options: ['', '', '', ''], answerIndex: 0 });
      fetchAllAdminData();
    } catch (err) { setQuizMessage(`생성 실패: ${err.message}`); }
  };

  const handleDeleteQuiz = async (quizId) => {
    if (!window.confirm('정말로 이 퀴즈를 삭제하시겠습니까?')) return;
    setQuizMessage('퀴즈 삭제 중...');
    try {
      await httpsCallable(functions, 'deleteQuiz')({ quizId });
      setQuizMessage('퀴즈가 삭제되었습니다.');
      fetchAllAdminData();
    } catch (err) { setQuizMessage(`삭제 실패: ${err.message}`); }
  };

  const handleCreateDebate = async (e) => {
    e.preventDefault();
    setDebateMessage('토론 주제 생성 중...');
    try {
      await httpsCallable(functions, 'createDebate')({ topic: newDebateTopic });
      setDebateMessage('토론 주제가 생성되었습니다.');
      setNewDebateTopic('');
      fetchAllAdminData();
    } catch (err) { setDebateMessage(`생성 실패: ${err.message}`); }
  };

  const handleCloseDebate = async (debateId) => {
    const correctAnswer = window.prompt("정답을 입력하세요 (O 또는 X):");
    if (correctAnswer !== 'O' && correctAnswer !== 'X') { alert("정답은 반드시 'O' 또는 'X' 여야 합니다."); return; }
    setDebateMessage('토론 마감 처리 중...');
    try {
      const result = await httpsCallable(functions, 'closeDebate')({ debateId, correctAnswer });
      setDebateMessage(result.data.message);
      fetchAllAdminData();
    } catch (err) { setDebateMessage(`마감 실패: ${err.message}`); }
  };

  const handleDeleteDebate = async (debateId) => {
    if (!window.confirm('정말로 이 토론을 삭제하시겠습니까?')) return;
    setDebateMessage('토론 주제 삭제 중...');
    try {
      await httpsCallable(functions, 'deleteDebate')({ debateId });
      setDebateMessage('토론 주제가 삭제되었습니다.');
      fetchAllAdminData();
    } catch (err) { setDebateMessage(`삭제 실패: ${err.message}`); }
  };

  const handleSetAdmin = async () => {
    if (!adminEmail) return setSetAdminMessage('이메일을 입력해주세요.');
    setLoadingSetAdmin(true);
    try {
      const result = await httpsCallable(functions, 'setAdminRole')({ email: adminEmail });
      setSetAdminMessage(result.data.message);
      setAdminEmail('');
    } catch (err) { setSetAdminMessage(`지정 실패: ${err.message}`); }
    finally { setLoadingSetAdmin(false); }
  };

  const handleEndSeason = async () => {
    if (!window.confirm('정말로 이번 시즌을 마감하시겠습니까?\n모든 사용자의 자산이 초기화되며, 되돌릴 수 없습니다.')) return;
    setLoadingSeason(true); setMessage('');
    try {
      const result = await httpsCallable(functions, 'endSeason')();
      setMessage(result.data.message);
      fetchAllAdminData();
    } catch (err) { setMessage(`시즌 마감 실패: ${err.message}`); }
    finally { setLoadingSeason(false); }
  };

  const handleDeleteSeason = async (seasonId) => {
    if (!window.confirm(`[경고] 시즌 ${seasonId}을(를) 정말로 삭제하시겠습니까?\n\n이 작업은 해당 시즌의 모든 기록을 영구적으로 삭제하며, 되돌릴 수 없습니다!`)) return;
    setLoadingSeason(true); setMessage('');
    try {
      const result = await httpsCallable(functions, 'deleteSeason')({ seasonIdToDelete: seasonId });
      setMessage(result.data.message);
      fetchAllAdminData();
    } catch (err) { setMessage(`시즌 삭제 실패: ${err.message}`); }
    finally { setLoadingSeason(false); }
  };

  if (authLoading) return <div>관리자 정보 확인 중...</div>;
  if (role !== 'admin') return <div>관리자만 접근할 수 있는 페이지입니다.</div>;

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h2>관리자 페이지</h2>
        <p>현재 로그인된 사용자: {user ? user.email : '없음'}</p>
        <button onClick={fetchAllAdminData}>전체 데이터 새로고침</button>
        {message && <p className="message">{message}</p>}
      </div>

      <AdminSection title="사용자 계정 관리">
        {userManagementMessage && <p>{userManagementMessage}</p>}
        {loadingUsers ? <p>사용자 로딩 중...</p> : (
          <table className="admin-table">
            <thead><tr><th>Email</th><th>UID</th><th>상태</th><th>작업</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.uid}>
                  <td>{u.email}</td><td>{u.uid}</td><td style={{ color: u.disabled ? 'red' : 'green' }}>{u.disabled ? '정지됨' : '활성'}</td>
                  <td>{u.disabled ? <button onClick={() => handleToggleSuspension(u.uid, false)}>활성화</button> : <button onClick={() => handleToggleSuspension(u.uid, true)}>정지</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AdminSection>

      <AdminSection title="게시물 관리">
        {postMessage && <p>{postMessage}</p>}
        {loadingPosts ? <p>게시물 로딩 중...</p> : (
          <ul className="admin-list">{posts.map(p => (<li key={p.id}>"{p.title}" <button onClick={() => handleDeletePost(p.id)}>삭제</button></li>))}</ul>
        )}
      </AdminSection>

      <AdminSection title="퀴즈 관리">
        {quizMessage && <p>{quizMessage}</p>}
        <form onSubmit={handleCreateQuiz} className="admin-form">
          <input type="text" value={newQuiz.question} onChange={(e) => setNewQuiz({ ...newQuiz, question: e.target.value })} placeholder="퀴즈 질문" required />
          {newQuiz.options.map((opt, i) => (<input key={i} type="text" value={opt} onChange={(e) => { const opts = [...newQuiz.options]; opts[i] = e.target.value; setNewQuiz({ ...newQuiz, options: opts }); }} placeholder={`보기 ${i + 1}`} required />))}
          <select value={newQuiz.answerIndex} onChange={(e) => setNewQuiz({ ...newQuiz, answerIndex: Number(e.target.value) })}>
            {newQuiz.options.map((opt, i) => (<option key={i} value={i}>{`정답: 보기 ${i + 1}`}</option>))}
          </select>
          <button type="submit">퀴즈 생성</button>
        </form>
        {loadingQuizzes ? <p>퀴즈 로딩 중...</p> : (<ul className="admin-list">{quizzes.map(q => (<li key={q.id}>"{q.question}" <button onClick={() => handleDeleteQuiz(q.id)}>삭제</button></li>))}</ul>)}
      </AdminSection>

      <AdminSection title="O/X 예측 관리">
        {debateMessage && <p>{debateMessage}</p>}
        <form onSubmit={handleCreateDebate} className="admin-form">
          <input type="text" value={newDebateTopic} onChange={(e) => setNewDebateTopic(e.target.value)} placeholder="새 예측 주제" required />
          <button type="submit">예측 생성</button>
        </form>
        {loadingDebates ? <p>예측 로딩 중...</p> : (
          <ul className="admin-list">{debates.map(d => (<li key={d.id}>"{d.topic}" <span style={{ color: d.status === 'closed' ? 'blue' : 'green' }}>({d.status === 'closed' ? `마감됨 - 정답: ${d.correctAnswer}` : '진행중'})</span> {d.status !== 'closed' && (<button onClick={() => handleCloseDebate(d.id)}>마감</button>)} <button onClick={() => handleDeleteDebate(d.id)}>삭제</button></li>))}</ul>
        )}
      </AdminSection>

      <AdminSection title="관리자 권한 부여">
        <div className="admin-form">
          <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="사용자 이메일" />
          <button onClick={handleSetAdmin} disabled={loadingSetAdmin}>{loadingSetAdmin ? '지정 중...' : '관리자 지정'}</button>
          {setAdminMessage && <p>{setAdminMessage}</p>}
        </div>
      </AdminSection>

      <AdminSection title="시즌 관리" danger={true}>
        <p>[주의!] 아래 작업들은 되돌릴 수 없으며, 데이터 양에 따라 시간이 오래 걸릴 수 있습니다.</p>
        <button onClick={handleEndSeason} disabled={loadingSeason} className="danger-button"> {loadingSeason ? '처리 중...' : '시즌 마감 실행'} </button>
        <hr />
        <h4>과거 시즌 삭제</h4>
        {loadingSeason ? <p>시즌 목록 로딩 중...</p> : (
          <ul className="admin-list">{pastSeasons.map(season => (<li key={season.id}><span>{season.name}</span><button onClick={() => handleDeleteSeason(season.id)} disabled={loadingSeason} className="danger-button">{loadingSeason ? '처리 중...' : `시즌 ${season.id} 삭제`}</button></li>))}</ul>
        )}
      </AdminSection>
    </div>
  );
}

export default AdminPage;

