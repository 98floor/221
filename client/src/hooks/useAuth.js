// client/src/hooks/useAuth.js
import { useState, useEffect } from 'react';
import { auth, db } from '../firebase'; // db 임포트
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore'; // getDoc, doc 임포트

export function useAuth() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        // Firestore에서 사용자 문서 가져오기
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          // 문서에서 role 필드 읽기
          setRole(userDoc.data().role || 'user');
        } else {
          // 문서가 없으면 기본 'user' 역할 부여
          setRole('user');
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, role, loading };
}
