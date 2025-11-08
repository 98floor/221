// client/src/pages/LoginPage.js
import React, { useState } from 'react';
import { auth, db, functions } from '../firebase';
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from 'firebase/functions';
import { signInWithEmailAndPassword } from "firebase/auth";
import { Link, useNavigate } from 'react-router-dom'; 

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate(); 

  const handleLogin = async () => {
    try {
      // 1. Firebase Auth 로그인 시도
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. 이메일 인증 여부 확인
      if (!user.emailVerified) {
        alert("이메일 인증이 완료되지 않았습니다. 메일함에서 인증 링크를 클릭해주세요.");
        await auth.signOut(); 
        return;
      }

      // 3. Firestore 'users' DB에서 프로필 상태 확인
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        throw new Error("데이터베이스에 사용자 프로필이 없습니다. 회원가입을 다시 진행해주세요.");
      }

      const userData = userDoc.data();

      // 4. 'pending_verification' (인증 대기) 상태인지 확인
      if (userData.status === "pending_verification") {
        // 4-1. 계정 활성화 Cloud Function 호출
        // alert("이메일 인증이 확인되었습니다. 계정을 활성화하고 초기 자본 1,000만원을 지급합니다.");

        const activateAccount = httpsCallable(functions, 'activateAccount');
        const result = await activateAccount();

        // 서버의 최종 결과 알림(2번째)만 남김
        alert(result.data.message); // "계정이 활성화되었습니다..."

      } else {
        // 4-2. (이미 'active' 상태)
        alert("로그인 성공!");
      }

      // 5. 모든 과정 완료 후, 홈 페이지로 이동
      navigate('/');

    } catch (error) {
      console.error("로그인 실패:", error);
      alert("로그인 실패: " + error.message);
    }
  };

  return (
    <div>
      <h2>로그인 (UC-2)</h2>
      <input
        type="email"
        placeholder="이메일"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <br />
      <input
        type="password"
        placeholder="비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <br />
      <button onClick={handleLogin}>로그인</button>
      <Link to="/register">
        <button>회원가입</button>
      </Link>
    </div>
  );
}

export default LoginPage;