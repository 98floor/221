// client/src/pages/RegisterPage.js
import React, { useState } from 'react';
// 1. useNavigate 훅 임포트
import { useNavigate } from 'react-router-dom'; 
import { auth, db } from '../firebase'; 
import { doc, setDoc } from "firebase/firestore"; 
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from "firebase/auth";
import { Checkbox, FormControlLabel } from '@mui/material';

function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [isStudentChecked, setIsStudentChecked] = useState(false);

  // 2. navigate 함수 초기화
  const navigate = useNavigate(); 

  const handleRegister = async () => {

    if (!isStudentChecked) {
      alert("대학생(대학원생) 확인 항목에 체크해야 합니다.");
      return;
    }

    if (!email.endsWith('.ac.kr')) {
      alert("대학교 웹메일(.ac.kr)만 가입할 수 있습니다.");
      return;
    }

    try {
      // 1. Auth 계정 생성
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Firestore '인증 대기' 프로필 생성
      const userProfileData = {
        email: user.email,
        nickname: nickname,
        school_name: schoolName,
        status: "pending_verification", 
        virtual_asset: 0, 
        quiz_try_cnt: 0,
        role: "user",
      };
      await setDoc(doc(db, "users", user.uid), userProfileData);

      // 3. 이메일 인증 발송
      await sendEmailVerification(user);

      // 4. 사용자에게 알림
      alert(
        "회원가입 요청이 완료되었습니다.\n" +
        "입력하신 이메일 주소에서 인증 링크를 클릭해주세요.\n" +
        "인증 후 로그인하시면 1,000만원이 지급됩니다."
      );

      // 5. 강제 로그아웃
      await signOut(auth);

      // 6. [신규] 알림 확인 후, 로그인 페이지로 이동
      navigate('/login');

    } catch (error) {
      console.error("회원가입 실패:", error);
      alert("회원가입 실패: " + error.message);
    }
  };

  return (
    <div>
      <h2>회원가입 (UC-1)</h2>
      <input
        type="email"
        placeholder="학교 웹메일 (.ac.kr)"
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
      <input
        type="text"
        placeholder="닉네임"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
      />
      <br />
      <input
        type="text"
        placeholder="소속 대학"
        value={schoolName}
        onChange={(e) => setSchoolName(e.target.value)}
      />
      <br />

      <FormControlLabel
        control={
          <Checkbox 
            checked={isStudentChecked} 
            onChange={(e) => setIsStudentChecked(e.target.checked)} 
          />
        }
        label="본인은 현재 재학 중인 대학생/대학원생이 맞습니다."
      />
      <br />

      <button onClick={handleRegister}>
        인증메일 발송 (회원가입)
      </button>
    </div>
  );
}

export default RegisterPage;