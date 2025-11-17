import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import './Form.css';

const PasswordResetPage = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (!email) {
      setError("이메일 주소를 입력해주세요.");
      return;
    }
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError("등록되지 않은 이메일입니다. 이메일 주소를 다시 확인해주세요.");
        return;
      }

      await sendPasswordResetEmail(auth, email);
      setMessage("비밀번호 재설정 이메일을 보냈습니다. 이메일함을 확인해주세요.");
    } catch (err) {
      console.error("비밀번호 재설정 실패:", err);
      setError("비밀번호 재설정 이메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  return (
    <div className="form-container">
      <form onSubmit={handleSubmit}>
        <h2>비밀번호 찾기</h2>
        <p style={{ marginBottom: '20px', fontSize: '15px', color: '#666' }}>
          가입 시 사용한 이메일 주소를 입력하시면, 비밀번호 재설정 링크를 보내드립니다.
        </p>
        {message && <p className="success-message">{message}</p>}
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
        <button type="submit" className="form-button">재설정 이메일 보내기</button>
        <Link to="/login" className="form-link">로그인 페이지로 돌아가기</Link>
      </form>
    </div>
  );
};

export default PasswordResetPage;

