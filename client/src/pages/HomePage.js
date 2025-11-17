import React from 'react';
import { Link } from 'react-router-dom';
import './HomePage.css';

function HomePage({ currentUser }) {
  return (
    <div className="home-container">
      <div className="home-content">
        <h1>
          대학생 커뮤니티형<br />
          <span className="highlight">모의 투자 챌린지</span>
        </h1>
        <p>
          실제 투자 시장의 위험 없이, 대학생들과 안전한 환경에서<br />
          실전 투자 경험을 쌓고 금융 지식을 학습하세요.
        </p>
        <div className="home-buttons">
          <Link to="/market" className="btn primary-btn">
            거래소 둘러보기
          </Link>
          {!currentUser && (
            <Link to="/login" className="btn secondary-btn">
              로그인
            </Link>
          )}
        </div>
      </div>
      <div className="home-banner">
        <img src="/images/home-banner.png" alt="Univest Challenge Banner" />
      </div>
    </div>
  );
}

export default HomePage;