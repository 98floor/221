// client/src/components/ProtectedRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ProtectedRoute = ({ children, adminOnly }) => {
  const { user, role, loading } = useAuth();

  if (loading) {
    // 인증 상태를 확인하는 동안 로딩 인디케이터를 보여줄 수 있습니다.
    return <div>Loading...</div>;
  }

  if (!user) {
    // 로그인하지 않은 사용자는 로그인 페이지로 리디렉션합니다.
    return <Navigate to="/login" />;
  }

  if (adminOnly && role !== 'admin') {
    // 관리자 전용 페이지에 접근하려는 일반 사용자는 홈페이지로 리디렉션합니다.
    return <Navigate to="/" />;
  }

  return children;
};

export default ProtectedRoute;
