// client/src/pages/CommunityPage.js
import React, { useState, useEffect } from 'react';
import { db, functions } from '../firebase'; // db와 functions 모두 임포트
import { httpsCallable } from 'firebase/functions'; //  Cloud Function 호출 도구
import { collection, getDocs, orderBy, query } from 'firebase/firestore'; //  Firestore 읽기 도구

// [신규] 배지를 스타일링하여 보여주는 헬퍼 컴포넌트
const Badge = ({ badge }) => {
  if (!badge) return null;

  const style = {
    marginLeft: '8px',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '0.75em',
    fontWeight: 'bold',
    color: 'black',
    border: '1px solid #ccc',
  };

  if (badge === '실버') {
    style.backgroundColor = '#E0E0E0';
    style.borderColor = '#BDBDBD';
  } else if (badge === '골드') {
    style.backgroundColor = '#FFD700';
    style.borderColor = '#FFA000';
  } else if (badge === '마스터') {
    style.backgroundColor = '#E1BEE7';
    style.borderColor = '#9C27B0';
    style.color = '#6A1B9A';
  }

  return <span style={style}>{badge}</span>;
};


function CommunityPage() {
  // 글 작성용 state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  // 글 목록용 state
  const [posts, setPosts] = useState([]);

  // 로딩 및 메시지 state
  const [loadingWrite, setLoadingWrite] = useState(false); // 글 작성 로딩
  const [loadingRead, setLoadingRead] = useState(true);  // 글 목록 로딩
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);

  // 헬퍼 함수: Firestore Timestamp 객체를 날짜 문자열로 변환
  const formatDate = (timestamp) => {
    if (timestamp) {
      // Firestore Timestamp를 JavaScript Date 객체로 변환
      return timestamp.toDate().toLocaleString('ko-KR');
    }
    return '날짜 정보 없음';
  };

  // 1. 글 목록 조회 함수 (Read)
  const fetchPosts = async () => {
    setLoadingRead(true);
    try {
      // 'posts' 컬렉션에서 'created_at' 필드를 기준으로 내림차순 정렬하여 조회
      const q = query(collection(db, 'posts'), orderBy('created_at', 'desc'));
      const querySnapshot = await getDocs(q);

      const postsData = [];
      querySnapshot.forEach((doc) => {
        postsData.push({
          id: doc.id,
          ...doc.data()
        });
      });

      setPosts(postsData);

    } catch (err) {
      console.error("게시글 목록 조회 실패:", err);
      setError(err.message);
    } finally {
      setLoadingRead(false);
    }
  };

  // 2. 글 작성 함수 (Write - Cloud Function 호출)
  const handleWritePost = async () => {
    if (title.trim() === '' || content.trim() === '') {
      setMessage('제목과 내용을 모두 입력해주세요.');
      return;
    }

    setLoadingWrite(true);
    setMessage('');

    try {
      // 'createPost' Cloud Function을 준비
      const createPost = httpsCallable(functions, 'createPost');

      // 함수를 호출하며 데이터 전달
      const result = await createPost({ 
        title: title, 
        content: content
      });

      setMessage(result.data.message); // 성공 메시지 표시
      setTitle(''); // 입력창 초기화
      setContent('');

      // [중요] 새 글 작성 성공 시, 목록을 새로고침
      fetchPosts(); 

    } catch (err) {
      console.error("게시글 작성 실패:", err);
      setMessage(`작성 실패: ${err.message}`); // 서버 오류 메시지 표시
    } finally {
      setLoadingWrite(false);
    }
  };

  // 3. 페이지가 처음 렌더링될 때 글 목록을 1회 조회
  useEffect(() => {
    fetchPosts();
  }, []); // []는 페이지가 처음 렌더링될 때 한 번만 실행

  return (
    <div>
      <h2>매매 전략 게시판 (UC-9)</h2>

      {/* --- 글 작성 UI --- */}
      <div style={{ border: '1px solid #ccc', padding: '10px', marginBottom: '20px' }}>
        <h3>새 글 작성</h3>
        <div>
          <input 
            type="text" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목"
            style={{ width: '80%' }}
          />
        </div>
        <div style={{ marginTop: '10px' }}>
          <textarea 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용"
            rows="5"
            style={{ width: '80%' }}
          />
        </div>
        <button onClick={handleWritePost} disabled={loadingWrite}>
          {loadingWrite ? '등록 중...' : '글 등록 (UC-9)'}
        </button>
        {/* 작성 결과 메시지 */}
        {message && (
          <p style={{ color: message.includes('실패') ? 'red' : 'blue' }}>
            {message}
          </p>
        )}
      </div>

      {/* --- 글 목록 UI --- */}
      <h3>게시글 목록</h3>
      {loadingRead ? (
        <p>글 목록을 불러오는 중...</p>
      ) : error ? (
        <p>오류: {error}</p>
      ) : posts.length > 0 ? (
        <table border="1" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{width: '60%'}}>제목</th>
              <th>작성자</th>
              <th>내용</th>
              <th>작성 시간</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id}>
                <td>{post.title}</td>
                {/* [수정] 닉네임과 배지를 함께 표시 */}
                <td>
                  {post.nickname || '알 수 없음'}
                  <Badge badge={post.badge} />
                </td>
                <td>{post.content}</td>
                {/* Firestore Timestamp 객체를 변환 */}
                <td>{formatDate(post.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>작성된 게시글이 없습니다.</p>
      )}
    </div>
  );
}

export default CommunityPage;