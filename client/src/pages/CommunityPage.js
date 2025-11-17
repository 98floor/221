import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import './CommunityPage.css';

const Badge = ({ badge }) => {
  if (!badge) return null;

  // 한글 뱃지 이름을 영문 클래스 이름으로 매핑
  const getBadgeClass = (badgeName) => {
    switch (badgeName) {
      case "실버":
        return "badge-silver";
      case "골드":
        return "badge-gold";
      case "마스터":
        return "badge-master";
      default:
        return "";
    }
  };

  const badgeClass = `badge ${getBadgeClass(badge)}`;
  
  // 뱃지 텍스트는 영문으로 표시
  const getBadgeText = (badgeName) => {
    switch (badgeName) {
      case "실버": return "Silver";
      case "골드": return "Gold";
      case "마스터": return "Master";
      default: return badgeName;
    }
  }

  return <span className={badgeClass}>{getBadgeText(badge)}</span>;
};

function CommunityPage() {
  const [posts, setPosts] = useState([]);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [loadingRead, setLoadingRead] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 10;

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

  const handleRowClick = (postId) => {
    setSelectedPostId(selectedPostId === postId ? null : postId);
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  // Pagination logic
  const indexOfLastPost = currentPage * postsPerPage;
  const indexOfFirstPost = indexOfLastPost - postsPerPage;
  const currentPosts = posts.slice(indexOfFirstPost, indexOfLastPost);
  const totalPages = Math.ceil(posts.length / postsPerPage);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className="community-container">
      <div className="community-header">
        <h2>게시글 목록</h2>
        <Link to="/write-post" className="write-post-link">글 작성</Link>
      </div>

      <div className="posts-list-container">
        {loadingRead ? <p>글 목록을 불러오는 중...</p> : error ? <p className="error-message">오류: {error}</p> : posts.length > 0 ? (
          <>
            <table className="posts-table">
              <thead>
                <tr>
                  <th className="col-title">제목</th>
                  <th className="col-author">작성자</th>
                  <th className="col-date">작성 시간</th>
                </tr>
              </thead>
              <tbody>
                {currentPosts.map((post) => (
                  <React.Fragment key={post.id}>
                    <tr 
                      onClick={() => handleRowClick(post.id)} 
                      className={selectedPostId === post.id ? 'active-post-row' : ''}
                    >
                      <td className="col-title">{post.title}</td>
                      <td className="col-author">{post.nickname || '알 수 없음'}<Badge badge={post.badge} /></td>
                      <td className="col-date">{formatDate(post.created_at)}</td>
                    </tr>
                    {selectedPostId === post.id && (
                      <tr>
                        <td colSpan="3" className="post-content">
                          {post.content}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            <div className="pagination-container">
              <button onClick={handlePrevPage} disabled={currentPage === 1}>
                이전
              </button>
              <span>{currentPage} / {totalPages}</span>
              <button onClick={handleNextPage} disabled={currentPage === totalPages}>
                다음
              </button>
            </div>
          </>
        ) : (
          <p>작성된 게시글이 없습니다.</p>
        )}
      </div>
    </div>
  );
}

export default CommunityPage;