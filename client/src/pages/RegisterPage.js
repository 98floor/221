// client/src/pages/RegisterPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, functions } from '../firebase';
import { doc, setDoc } from "firebase/firestore";
import { httpsCallable } from 'firebase/functions';
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from "firebase/auth";
import { Checkbox, FormControlLabel, Select, MenuItem, InputLabel, FormControl } from '@mui/material';

function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [userLevel, setUserLevel] = useState('초급');
  const [isStudentChecked, setIsStudentChecked] = useState(false);
  const [nicknameMessage, setNicknameMessage] = useState('');
  const [isNicknameAvailable, setIsNicknameAvailable] = useState(false);
  const [error, setError] = useState('');
  const [universities, setUniversities] = useState({}); // 대학교 데이터 상태

  const navigate = useNavigate();

  // 대학교 데이터 불러오기
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

  const handleRegister = async () => {
    setError('');
    if (password !== passwordConfirm) return setError("비밀번호가 일치하지 않습니다.");
    if (!isNicknameAvailable) return setError("닉네임 중복 확인을 해주세요.");
    if (!isStudentChecked) return setError("대학생(대학원생) 확인 항목에 체크해야 합니다.");
    if (!email.endsWith('.ac.kr')) return setError("대학교 웹메일(.ac.kr)만 가입할 수 있습니다.");
    if (!email || !password || !nickname || !schoolName || !userLevel) return setError("모든 항목을 입력해주세요.");

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userProfileData = {
        email: user.email,
        nickname: nickname,
        school_name: schoolName,
        user_level: userLevel,
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
    <div>
      <h2>회원가입 (UC-1)</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <input type="email" placeholder="학교 웹메일 (.ac.kr)" value={email} onChange={(e) => setEmail(e.target.value)} />
      <br />
      <input type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} />
      <br />
      <input type="password" placeholder="비밀번호 확인" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} />
      <br />
      <div>
        <input type="text" placeholder="닉네임" value={nickname} onChange={handleNicknameChange} />
        <button onClick={handleNicknameCheck}>중복 확인</button>
        {nicknameMessage && <p style={{ color: isNicknameAvailable ? 'green' : 'red', display: 'inline', marginLeft: '10px' }}>{nicknameMessage}</p>}
      </div>
      <br />
      <FormControl fullWidth style={{marginTop: '10px'}}>
        <InputLabel id="region-label">지역</InputLabel>
        <Select 
          labelId="region-label"
          value={selectedRegion} 
          label="지역" 
          onChange={handleRegionChange}
          // [수정됨] 1. displayEmpty 속성 제거
          // displayEmpty 
        >
          {/* [수정됨] 2. placeholder용 MenuItem 제거
          <MenuItem value="" disabled>
            <em>지역을 선택하세요</em>
          </MenuItem> 
          */}
          {Object.keys(universities)
            .filter(region => region !== 'default') 
            .map(region => (
              <MenuItem key={region} value={region}>{region}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <br />
      <FormControl fullWidth style={{marginTop: '10px'}} disabled={!selectedRegion}>
        <InputLabel id="school-label">소속 대학</InputLabel>
        <Select 
          labelId="school-label"
          value={schoolName} 
          label="소속 대학" 
          onChange={(e) => setSchoolName(e.target.value)}
          // [수정됨] 1. displayEmpty 속성 제거
          // displayEmpty 
        >
          {/* [수정됨] 2. placeholder용 MenuItem 제거
          <MenuItem value="" disabled>
            <em>대학을 선택하세요</em>
          </MenuItem> 
          */}
          {selectedRegion && universities[selectedRegion] && universities[selectedRegion].map(uni => (
            <MenuItem key={uni} value={uni}>{uni}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <br />
      <FormControl fullWidth style={{marginTop: '10px'}}>
        <InputLabel id="level-label">투자 숙련도</InputLabel>
        <Select 
          labelId="level-label"
          value={userLevel} 
          label="투자 숙련도" 
          onChange={(e) => setUserLevel(e.target.value)}
        >
          <MenuItem value="초급">초급</MenuItem>
          <MenuItem value="중급">중급</MenuItem>
          <MenuItem value="고급">고급</MenuItem>
        </Select>
      </FormControl>
      <br />
      <FormControlLabel
        control={<Checkbox checked={isStudentChecked} onChange={(e) => setIsStudentChecked(e.target.checked)} />}
        label="본인은 현재 재학 중인 대학생/대학원생이 맞습니다."
      />
      <br />
      <button onClick={handleRegister}>인증메일 발송 (회원가입)</button>
    </div>
  );
}

export default RegisterPage;