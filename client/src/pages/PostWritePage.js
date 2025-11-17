import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import './Form.css';

function PostWritePage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleWritePost = async (e) => {
    e.preventDefault();
    if (title.trim() === '' || content.trim() === '') {
      setMessage('제목과 내용을 모두 입력해주세요.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const createPost = httpsCallable(functions, 'createPost');
      await createPost({ title, content });
      navigate('/community');
    } catch (err) {
      console.error("게시글 작성 실패:", err);
      setMessage(`작성 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <div className="form-header">
        <h2>새 글 작성</h2>
      </div>
      <form onSubmit={handleWritePost}>
        <div className="form-group">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" />
        </div>
        <div className="form-group">
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="내용" />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? '등록 중...' : '글 등록'}
        </button>
        {message && <p className={message.includes('실패') ? 'error-message' : 'success-message'}>{message}</p>}
      </form>
    </div>
  );
}

export default PostWritePage;
