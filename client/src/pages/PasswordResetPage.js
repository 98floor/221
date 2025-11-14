import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';

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
      // Check if email exists in Firestore
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
    <div>
      <h2>비밀번호 찾기</h2>
      <form onSubmit={handleSubmit}>
        <p>가입 시 사용한 이메일 주소를 입력하시면, 비밀번호 재설정 링크를 보내드립니다.</p>
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <br />
        <button type="submit">재설정 이메일 보내기</button>
      </form>
      {message && <p style={{ color: 'green' }}>{message}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <br />
      <Link to="/login">로그인 페이지로 돌아가기</Link>
    </div>
  );
};

export default PasswordResetPage;
