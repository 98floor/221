// client/src/pages/NoticePage.js
import React, { useState, useEffect, useCallback } from 'react';
import { db, functions } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../hooks/useAuth';

// 관리자용 공지 작성 폼
const NoticeForm = ({ onPostCreated }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!title || !content) {
      setMessage('제목과 내용을 모두 입력해주세요.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const createNoticeFunc = httpsCallable(functions, 'createNotice');
      await createNoticeFunc({ title, content });
      setTitle('');
      setContent('');
      setMessage('공지사항이 성공적으로 등록되었습니다.');
      if (onPostCreated) {
        onPostCreated(); // 부모 컴포넌트에 다시 로드하라고 알림
      }
    } catch (err) {
      setMessage(`오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: '2px solid #1976d2', padding: '16px', marginBottom: '32px' }}>
      <h3>새 공지사항 작성</h3>
      <form onSubmit={handleCreatePost}>
        <input
          type="text"
          placeholder="제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
        />
        <textarea
          placeholder="내용"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{ width: '100%', height: '150px', padding: '8px', marginBottom: '10px' }}
        />
        <button type="submit" disabled={loading}>
          {loading ? '등록 중...' : '등록하기'}
        </button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

// 공지사항 목록
function NoticePage() {
  const { role } = useAuth();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    try {
      const noticesRef = collection(db, 'notices');
      const q = query(noticesRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const noticesList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate().toLocaleString('ko-KR'),
      }));
      setNotices(noticesList);
    } catch (err) {
      setError('공지사항을 불러오는 데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  return (
    <div>
      <h2>공지사항</h2>
      
      {/* 관리자인 경우에만 작성 폼을 보여줌 */}
      {role === 'admin' && <NoticeForm onPostCreated={fetchNotices} />}

      {loading && <p>공지사항을 불러오는 중...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      
      {!loading && notices.length === 0 && <p>등록된 공지사항이 없습니다.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {notices.map(notice => (
          <div key={notice.id} style={{ border: '1px solid #ccc', padding: '16px', borderRadius: '4px' }}>
            <h3 style={{ marginTop: 0 }}>{notice.title}</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{notice.content}</p>
            <small>
              작성자: {notice.author} | 작성일: {notice.createdAt}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

export default NoticePage;
