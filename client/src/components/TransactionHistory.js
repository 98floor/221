// client/src/components/TransactionHistory.js
import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { Box, Typography } from '@mui/material';

// 헬퍼 함수 (기존과 동일)
const formatDate = (timestamp) => {
  if (timestamp) {
    return timestamp.toDate().toLocaleString('ko-KR');
  }
  return '날짜 정보 없음';
};

const formatNumber = (num, type = 'krw') => {
  if (type === 'krw') {
    return `${Math.round(num).toLocaleString('ko-KR')}원`;
  }
  return `${num.toLocaleString('ko-KR')}주`;
};

function TransactionHistory({ symbol }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentSeasonId, setCurrentSeasonId] = useState(null); // [신규] 현재 시즌 ID state

  // [신규] 컴포넌트 마운트 시 현재 시즌 ID를 가져옴
  useEffect(() => {
    const fetchCurrentSeason = async () => {
      const seasonDocRef = doc(db, "seasons", "current");
      try {
        const seasonDoc = await getDoc(seasonDocRef);
        if (seasonDoc.exists()) {
          setCurrentSeasonId(seasonDoc.data().seasonId);
        } else {
          setCurrentSeasonId(1); // 문서가 없으면 기본값 1
        }
      } catch (err) {
        console.error("현재 시즌 ID 조회 실패:", err);
        setCurrentSeasonId(1); // 에러 시 기본값
      }
    };
    fetchCurrentSeason();
  }, []);

  useEffect(() => {
    // [수정] 로그인 안 했거나, symbol 또는 currentSeasonId가 없으면 실행 안 함
    if (!auth.currentUser || !symbol || currentSeasonId === null) {
      setTransactions([]);
      return;
    }

    setLoading(true);
    setError(null);

    const txCollectionRef = collection(db, "users", auth.currentUser.uid, "transactions");
    
    // [수정] 쿼리에 seasonId 필터 추가
    const q = query(
      txCollectionRef, 
      where("asset_code", "==", symbol),
      where("seasonId", "==", currentSeasonId), // 현재 시즌 필터
      orderBy("trade_dt", "desc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const txData = [];
      querySnapshot.forEach((doc) => {
        txData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      setTransactions(txData);
      setLoading(false);
    }, (err) => {
      console.error("거래 내역 조회 실패:", err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();

  }, [symbol, currentSeasonId]); // currentSeasonId가 변경될 때도 쿼리 재실행

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" gutterBottom>
        나의 거래 내역 (현재 시즌)
      </Typography>
      {loading && <p>거래 내역을 불러오는 중...</p>}
      {error && <p style={{ color: 'red' }}>오류: {error}</p>}
      
      {!loading && !error && transactions.length === 0 && (
        <p>현재 시즌의 거래 내역이 없습니다.</p>
      )}

      {transactions.length > 0 && (
        <Box sx={{ maxHeight: '300px', overflowY: 'auto' }}>
          <table border="1" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
            <thead>
              <tr>
                <th>거래 시간</th>
                <th>구분</th>
                <th>수량</th>
                <th>거래 단가</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td>{formatDate(tx.trade_dt)}</td>
                  <td style={{ color: tx.type === 'buy' ? 'red' : 'blue' }}>
                    {tx.type === 'buy' ? '매수' : '매도'}
                  </td>
                  <td>{formatNumber(tx.quantity, 'qty')}</td>
                  <td>{formatNumber(tx.trade_price, 'krw')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      )}
    </Box>
  );
}

export default TransactionHistory;
