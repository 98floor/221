import React, { useState, useEffect } from 'react';
import { db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import './CommunityPage.css';

const Badge = ({ badge }) => {
  if (!badge) return null;
  const badgeClass = `badge badge-${badge.toLowerCase()}`;
  return <span className={badgeClass}>{badge}</span>;
};

function CommunityPage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [posts, setPosts] = useState([]);
  const [loadingWrite, setLoadingWrite] = useState(false);
  const [loadingRead, setLoadingRead] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);

  const formatDate = (timestamp) => {
    if (timestamp) return timestamp.toDate().toLocaleString('ko-KR');
    return '날짜 정보 없음';
  };

  const fetchPosts = async () => {
    setLoadingRead(true);
    try {
      const q = query(collection(db, 'posts'), orderBy('created_at', 'desc'));
      const querySnapshot = await getDocs(q);
      const postsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(postsData);
    } catch (err) {
      console.error("게시글 목록 조회 실패:", err);
      setError(err.message);
    } finally {
      setLoadingRead(false);
    }
  };

  const handleWritePost = async (e) => {
    e.preventDefault();
    if (title.trim() === '' || content.trim() === '') {
      setMessage('제목과 내용을 모두 입력해주세요.');
      return;
    }
    setLoadingWrite(true);
    setMessage('');
    try {
      const createPost = httpsCallable(functions, 'createPost');
      const result = await createPost({ title, content });
      setMessage(result.data.message);
      setTitle('');
      setContent('');
      fetchPosts();
    } catch (err) {
      console.error("게시글 작성 실패:", err);
      setMessage(`작성 실패: ${err.message}`);
    } finally {
      setLoadingWrite(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  return (
    <div className="community-container">
      <div className="community-header">
        <h2>매매 전략 게시판</h2>
      </div>

      <div className="post-form-container">
        <h3>새 글 작성</h3>
        <form onSubmit={handleWritePost}>
          <div className="form-group">
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" />
          </div>
          <div className="form-group">
            <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="내용" />
          </div>
          <button type="submit" disabled={loadingWrite}>
            {loadingWrite ? '등록 중...' : '글 등록'}
          </button>
          {message && <p className={message.includes('실패') ? 'error-message' : 'success-message'}>{message}</p>}
        </form>
      </div>

      <div className="posts-list-container">
        <h3>게시글 목록</h3>
        {loadingRead ? <p>글 목록을 불러오는 중...</p> : error ? <p className="error-message">오류: {error}</p> : posts.length > 0 ? (
          <table className="posts-table">
            <thead>
              <tr>
                <th style={{ width: '50%' }}>제목</th>
                <th>작성자</th>
                <th style={{ width: '20%' }}>작성 시간</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id}>
                  <td>{post.title}</td>
                  <td>{post.nickname || '알 수 없음'}<Badge badge={post.badge} /></td>
                  <td>{formatDate(post.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>작성된 게시글이 없습니다.</p>
        )}
      </div>
    </div>
  );
}

export default CommunityPage;