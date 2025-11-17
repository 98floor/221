// client/src/pages/HomePage.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import './HomePage.css'; // 홈페이지 전용 CSS 임포트

// MUI 아이콘 임포트
import ShowChartIcon from '@mui/icons-material/ShowChart';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import ForumIcon from '@mui/icons-material/Forum';

const HomePage = () => {
  const { user } = useAuth();
  const [userData, setUserData] = useState(null);
  const [notices, setNotices] = useState([]); // [신규] 공지사항 상태
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHomePageData = async () => {
      setLoading(true);
      try {
        // 공지사항 가져오기 함수 호출
        const getRecentNotices = httpsCallable(functions, 'getRecentNotices');
        const noticesRes = await getRecentNotices();
        if (noticesRes.data.success) {
          setNotices(noticesRes.data.notices);
        }

        // 사용자 데이터 가져오기 (로그인 시)
        if (user) {
          const getPortfolio = httpsCallable(functions, 'getPortfolio');
          const getQuestStatus = httpsCallable(functions, 'getQuestStatus');
          
          const [portfolioRes, questRes] = await Promise.all([
            getPortfolio(),
            getQuestStatus()
          ]);

          setUserData({
            portfolio: portfolioRes.data.portfolioData,
            quest: questRes.data,
          });
        }
      } catch (error) {
        console.error("Error fetching home page data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHomePageData();
  }, [user]);

  if (loading) {
    return <div className="container">데이터를 불러오는 중입니다...</div>;
  }

  return (
    <div className="home-container">
      <header className="home-header">
        <div>
          <h1>안녕하세요, {user ? `${user.nickname || '사용자'}` : '방문자'}님!</h1>
          <p>UNIVEST에 오신 것을 환영합니다. 투자의 세계를 탐험해 보세요.</p>
        </div>
      </header>

      {user ? (
        <div className="home-grid">
          <div className="info-card">
            <h2>내 정보 요약</h2>
            <div className="info-item">
              <span>💰 보유 현금:</span>
              <span>{userData?.portfolio?.cash?.toLocaleString() || 0}원</span>
            </div>
            <div className="info-item">
              <span>📈 총 자산 가치:</span>
              <span>{userData?.portfolio?.total_asset?.toLocaleString() || 0}원</span>
            </div>
            <div className="info-item">
              <span>🏆 현재 랭킹:</span>
              <span>{userData?.portfolio?.rank ? `${userData.portfolio.rank}위` : 'N/A'}</span>
            </div>
            <div className="info-item">
              <span>🏅 내 배지:</span>
              <span className="badge-display">{userData?.quest?.badge || '없음'}</span>
            </div>
          </div>

          <div className="shortcut-card">
            <h2>바로가기</h2>
            <div className="shortcuts-container">
              <Link to="/market" className="shortcut-link">
                <ShowChartIcon fontSize="large" />
                <span>거래소</span>
              </Link>
              <Link to="/portfolio" className="shortcut-link">
                <AccountBalanceWalletIcon fontSize="large" />
                <span>포트폴리오</span>
              </Link>
              <Link to="/ranking" className="shortcut-link">
                <LeaderboardIcon fontSize="large" />
                <span>랭킹</span>
              </Link>
              <Link to="/community" className="shortcut-link">
                <ForumIcon fontSize="large" />
                <span>커뮤니티</span>
              </Link>
            </div>
          </div>
          
          <div className="notice-card">
            <h2>최신 공지</h2>
            <ul className="notice-list">
              {notices.length > 0 ? (
                notices.map(notice => (
                  <li key={notice.id}>
                    <Link to="/notice">
                      <span>{notice.title}</span>
                      <small>{new Date(notice.createdAt).toLocaleDateString()}</small>
                    </Link>
                  </li>
                ))
              ) : (
                <li>등록된 공지사항이 없습니다.</li>
              )}
            </ul>
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center' }}>
          <h2>서비스를 시작해보세요!</h2>
          <p>로그인하고 모의 투자를 통해 실전 감각을 키워보세요.</p>
          <Link to="/login" className="button" style={{ marginRight: '1rem' }}>로그인</Link>
          <Link to="/register" className="button" style={{ backgroundColor: 'var(--text-secondary)'}}>회원가입</Link>
        </div>
      )}
    </div>
  );
};

export default HomePage;
