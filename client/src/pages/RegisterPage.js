import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, functions } from '../firebase';
import { doc, setDoc } from "firebase/firestore";
import { httpsCallable } from 'firebase/functions';
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from "firebase/auth";
import './Form.css';

function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [isStudentChecked, setIsStudentChecked] = useState(false);
  const [nicknameMessage, setNicknameMessage] = useState('');
  const [isNicknameAvailable, setIsNicknameAvailable] = useState(false);
  const [error, setError] = useState('');
  const [universities, setUniversities] = useState({});

  const navigate = useNavigate();

  useEffect(() => {
    const fetchUniversities = async () => {
      try {
        const getUniversitiesFunc = httpsCallable(functions, 'getUniversities');
        const result = await getUniversitiesFunc();
        if (result.data.success) {
          setUniversities(result.data.universities);
        }
      } catch (err) {
        console.error("대학교 목록 로딩 실패:", err);
        setError("대학교 목록을 불러오는 데 실패했습니다.");
      }
    };
    fetchUniversities();
  }, []);

  const handleNicknameCheck = async () => {
    if (!nickname) {
      setNicknameMessage("닉네임을 입력해주세요.");
      return;
    }
    try {
      const checkNicknameFunc = httpsCallable(functions, 'checkNickname');
      const result = await checkNicknameFunc({ nickname });
      setNicknameMessage(result.data.message);
      setIsNicknameAvailable(result.data.isAvailable);
    } catch (err) {
      setNicknameMessage("닉네임 확인 중 오류가 발생했습니다.");
      setIsNicknameAvailable(false);
    }
  };

  const handleNicknameChange = (e) => {
    setNickname(e.target.value);
    setIsNicknameAvailable(false);
    setNicknameMessage('');
  };

  const handleRegionChange = (e) => {
    setSelectedRegion(e.target.value);
    setSchoolName('');
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== passwordConfirm) return setError("비밀번호가 일치하지 않습니다.");
    if (!isNicknameAvailable) return setError("닉네임 중복 확인을 해주세요.");
    if (!isStudentChecked) return setError("대학생(대학원생) 확인 항목에 체크해야 합니다.");
    if (!email.endsWith('.ac.kr')) return setError("대학교 웹메일(.ac.kr)만 가입할 수 있습니다.");
    if (!email || !password || !nickname || !schoolName) return setError("모든 항목을 입력해주세요.");

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

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
      await sendEmailVerification(user);

      alert("회원가입 요청이 완료되었습니다.\n입력하신 이메일 주소에서 인증 링크를 클릭해주세요.");
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error("회원가입 실패:", error);
      setError("회원가입 실패: " + error.message);
    }
  };

  return (
    <div className="form-page-wrapper">
      <div className="form-container">
        <form onSubmit={handleRegister}>
          <h2>회원가입</h2>
          {error && <p className="error-message">{error}</p>}
          
          <div className="form-group">
            <label htmlFor="email">학교 웹메일 (.ac.kr)</label>
            <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="form-group">
            <label htmlFor="password">비밀번호</label>
            <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <div className="form-group">
            <label htmlFor="passwordConfirm">비밀번호 확인</label>
            <input type="password" id="passwordConfirm" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} required />
          </div>

          <div className="form-group">
            <label htmlFor="nickname">닉네임</label>
            <div style={{ display: 'flex' }}>
              <input type="text" id="nickname" value={nickname} onChange={handleNicknameChange} required />
              <button type="button" onClick={handleNicknameCheck} style={{ marginLeft: '10px', whiteSpace: 'nowrap' }}>중복 확인</button>
            </div>
            {nicknameMessage && <p style={{ color: isNicknameAvailable ? 'green' : 'red', marginTop: '5px' }}>{nicknameMessage}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="region">지역</label>
            <select id="region" value={selectedRegion} onChange={handleRegionChange} required>
              <option value="" disabled>지역을 선택하세요</option>
              {Object.keys(universities).filter(region => region !== 'default').map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="schoolName">소속 대학</label>
            <select id="schoolName" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required disabled={!selectedRegion}>
              <option value="" disabled>대학을 선택하세요</option>
              {selectedRegion && universities[selectedRegion] && universities[selectedRegion].map(uni => (
                <option key={uni} value={uni}>{uni}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center' }}>
            <input type="checkbox" id="isStudentChecked" checked={isStudentChecked} onChange={(e) => setIsStudentChecked(e.target.checked)} style={{ width: 'auto', marginRight: '10px' }} />
            <label htmlFor="isStudentChecked" style={{ marginBottom: 0, fontSize: '14px', whiteSpace: 'nowrap' }}>본인은 현재 재학 중인 대학생/대학원생이 맞습니다.</label>
          </div>

          <button type="submit" className="form-button">인증메일 발송 (회원가입)</button>
        </form>
      </div>
    </div>
  );
}

export default RegisterPage;