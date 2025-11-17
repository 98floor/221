import React, { useState } from 'react';
import { auth, db, functions } from '../firebase';
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from 'firebase/functions';
import { signInWithEmailAndPassword } from "firebase/auth";
import { Link, useNavigate } from 'react-router-dom';
import './Form.css';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (!user.emailVerified) {
        setError("이메일 인증이 완료되지 않았습니다. 메일함에서 인증 링크를 클릭해주세요.");
        await auth.signOut();
        return;
      }

      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        throw new Error("데이터베이스에 사용자 프로필이 없습니다.");
      }

      const userData = userDoc.data();

      if (userData.status === "pending_verification") {
        const activateAccount = httpsCallable(functions, 'activateAccount');
        const result = await activateAccount();
        alert(result.data.message);
      } else {
        alert("로그인 성공!");
      }

      navigate('/');

    } catch (error) {
      console.error("로그인 실패:", error);
      setError("로그인에 실패했습니다. 이메일 또는 비밀번호를 확인해주세요.");
    }
  };

  return (
    <div className="form-container">
      <form onSubmit={handleLogin}>
        <h2>로그인</h2>
        {error && <p className="error-message">{error}</p>}
        <div className="form-group">
          <label htmlFor="email">이메일</label>
          <input
            type="email"
            id="email"
            placeholder="이메일을 입력하세요"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">비밀번호</label>
          <input
            type="password"
            id="password"
            placeholder="비밀번호를 입력하세요"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="form-button">로그인</button>
        <Link to="/password-reset" className="form-link">비밀번호 찾기</Link>
        <Link to="/register" className="form-link">회원가입</Link>
      </form>
    </div>
  );
}

export default LoginPage;