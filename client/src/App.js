// client/src/App.js
import React, { useState, useEffect } from 'react'; 
// [수정됨] Link as RouterLink, useLocation 임포트
import { BrowserRouter as Router, Routes, Route, Link as RouterLink, useLocation } from 'react-router-dom'; 

import { auth } from './firebase';
import { onAuthStateChanged, signOut } from "firebase/auth";

import { AppBar, Toolbar, Typography, Button, Container, Box } from '@mui/material';
import { useAuth } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';

// --- 페이지 임포트 ---
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MarketPage from './pages/MarketPage';
import PortfolioPage from './pages/PortfolioPage';
import RankingPage from './pages/RankingPage';
import HallOfFamePage from './pages/HallOfFamePage';
import CommunityPage from './pages/CommunityPage';
import DebatePage from './pages/DebatePage';
import QuizPage from './pages/QuizPage';
import ChatbotPage from './pages/ChatbotPage';
import AdminPage from './pages/AdminPage';
import NoticePage from './pages/NoticePage'; 
import PasswordResetPage from './pages/PasswordResetPage';

// [신규] App 컴포넌트의 내용을 분리 (useLocation 훅을 사용하기 위함)
function AppContent() {
  const navLinks = [
    { name: '공지사항', path: '/notice' }, 
    { name: '거래소', path: '/market' },
    { name: '자산', path: '/portfolio' },
    { name: '랭킹', path: '/ranking' },
    { name: '명예의 전당', path: '/hall-of-fame' },
    { name: '게시판', path: '/community' },
    { name: 'O/X 예측', path: '/debate' },
    { name: '퀴즈', path: '/quiz' },
    { name: 'AI 챗봇', path: '/chatbot' },
    { name: '관리자', path: '/admin', adminOnly: true }, 
  ];

  const { user, role, loading } = useAuth(); // useAuth 훅 사용
  
  // --- 로그아웃 핸들러 ---
  const handleLogout = async () => {
    if (!window.confirm("로그아웃 하시겠습니까?")) return;

    try {
      await signOut(auth); 
      window.location.href = '/'; // 홈으로 이동
    } catch (error) {
      console.error("로그아웃 실패:", error);
      alert("로그아웃에 실패했습니다.");
    }
  };

  return (
    <>
      {/* --- MUI AppBar (네비게이션) --- */}
      <AppBar position="static" color="default" elevation={1} sx={{ backgroundColor: 'white' }}>
        {/* [수정됨] Container의 maxWidth를 'xl'로 변경 */}
        <Container maxWidth="xl">
          <Toolbar disableGutters>

            {/* 1. 로고 (홈으로 이동) */}
            <Typography
              variant="h6"
              component={RouterLink}
              to="/"
              sx={{
                marginRight: 2, 
                fontWeight: 700,
                color: '#1976d2',
                textDecoration: 'none',
                flexShrink: 0, 
              }}
            >
              UNIVEST
            </Typography>

            {/* 2. 메인 메뉴 */}
            <Box sx={{
                display: 'flex',
                flexWrap: 'nowrap',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                '&::-webkit-scrollbar': { display: 'none' }, 
                scrollbarWidth: 'none', 
                '-ms-overflow-style': 'none', 
            }}>
              {navLinks.map((link) => {
                if (link.adminOnly && role !== 'admin') {
                  return null; 
                }
                return (
                  <Button
                    key={link.name}
                    component={RouterLink}
                    to={link.path}
                    sx={{ 
                      color: 'black', 
                      marginX: 0.5,
                      flexShrink: 0, 
                    }}
                  >
                    {link.name}
                  </Button>
                );
              })}
            </Box>

            {/* 3. 스페이서 */}
            <Box sx={{ flexGrow: 1 }} />

            {/* 4. 로그인/로그아웃 UI */}
            <Box sx={{ 
                flexShrink: 0, 
                marginLeft: 2, 
                borderLeft: '1px solid #ddd', 
                paddingLeft: 2,
                minWidth: '150px', 
            }}>

              {user ? (
                // --- 1. [로그인 됨] 상태 ---
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ marginRight: 2, whiteSpace: 'nowrap' }}>
                    {user.email}
                  </Typography>
                  <Button 
                    onClick={() => handleLogout(false)} 
                    variant="outlined" 
                    size="small"
                  >
                    로그아웃
                  </Button>
                </Box>

              ) : (
                // --- 2. [로그아웃 됨] 상태 ---
                <>
                  <Button
                    component={RouterLink}
                    to="/login"
                    variant="contained"
                    size="small"
                    sx={{ marginRight: 1 }}
                  >
                    로그인
                  </Button>
                  <Button
                    component={RouterLink}
                    to="/register"
                    variant="outlined"
                    size="small"
                  >
                    회원가입
                  </Button>
                </>
              )}
            </Box>

          </Toolbar>
        </Container>
      </AppBar>

      {/* --- [수정됨] 페이지 컨텐츠 영역 --- */}
      <Container 
        // [수정됨] 모든 페이지에 'xl' (1536px) 너비를 적용.
        maxWidth="xl" 
        sx={{ marginTop: 3 }}
      >
        <Routes>
          {/* HomePage에 user prop을 전달. */}
          <Route path="/" element={<HomePage user={user} />} /> 

          <Route path="/login" element={<LoginPage />} />
          <Route path="/password-reset" element={<PasswordResetPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/notice" element={<NoticePage />} />
          <Route path="/market" element={<MarketPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/ranking" element={<RankingPage />} />
          <Route path="/hall-of-fame" element={<HallOfFamePage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/debate" element={<DebatePage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/chatbot" element={<ChatbotPage />} />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute adminOnly={true}>
                <AdminPage />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </Container>
    </>
  );
}

// [신규] App 컴포넌트는 Router만 렌더링
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;