import React, { useState, useEffect, useCallback } from 'react';
import { db, functions } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../hooks/useAuth';
import './NoticePage.css';

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
      if (onPostCreated) onPostCreated();
    } catch (err) {
      setMessage(`오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="notice-form-container">
      <h3>새 공지사항 작성</h3>
      <form onSubmit={handleCreatePost}>
        <div className="form-group">
          <input type="text" placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="form-group">
          <textarea placeholder="내용" value={content} onChange={(e) => setContent(e.target.value)} />
        </div>
        <button type="submit" disabled={loading}>{loading ? '등록 중...' : '등록하기'}</button>
      </form>
      {message && <p className={message.includes('오류') ? 'error-message' : 'success-message'}>{message}</p>}
    </div>
  );
};

const NoticeItem = ({ notice, role, onDelete }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation(); // Prevent the accordion from toggling
    if (!window.confirm(`'${notice.title}' 공지를 정말로 삭제하시겠습니까?`)) {
      return;
    }
    try {
      const deleteNoticeFunc = httpsCallable(functions, 'deleteNotice');
      await deleteNoticeFunc({ noticeId: notice.id });
      onDelete(); // Refresh the list
    } catch (err) {
      console.error("Error deleting notice:", err);
      alert(`삭제 실패: ${err.message}`);
    }
  };

  return (
    <div className="notice-item">
      <div className="notice-item-header" onClick={() => setIsOpen(!isOpen)}>
        <h4>{notice.title}</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="notice-item-meta">작성일: {notice.createdAt}</span>
          {role === 'admin' && (
            <button onClick={handleDelete} className="btn-danger">삭제</button>
          )}
        </div>
      </div>
      {isOpen && (
        <div className="notice-item-content">
          <p>{notice.content}</p>
          <small>작성자: {notice.author}</small>
        </div>
      )}
    </div>
  );
};

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
    <div className="notice-container">
      <div className="notice-header">
        <h2>공지사항</h2>
      </div>
      {role === 'admin' && <NoticeForm onPostCreated={fetchNotices} />}
      {loading && <p>공지사항을 불러오는 중...</p>}
      {error && <p className="error-message">{error}</p>}
      {!loading && notices.length === 0 && <p>등록된 공지사항이 없습니다.</p>}
      <div className="notice-list">
        {notices.map(notice => <NoticeItem key={notice.id} notice={notice} role={role} onDelete={fetchNotices} />)}
      </div>
    </div>
  );
}

export default NoticePage;

