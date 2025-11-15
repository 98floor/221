// client/src/components/TransactionHistory.js
import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { Box, Typography } from '@mui/material';

// 헬퍼 함수: Firestore Timestamp 객체를 날짜 문자열로 변환
const formatDate = (timestamp) => {
  if (timestamp) {
    return timestamp.toDate().toLocaleString('ko-KR');
  }
  return '날짜 정보 없음';
};

// 헬퍼 함수: 숫자 포맷
const formatNumber = (num, type = 'krw') => {
  if (type === 'krw') {
    return `${Math.round(num).toLocaleString('ko-KR')}원`;
  }
  return `${num.toLocaleString('ko-KR')}주`;
};

// MarketPage로부터 'symbol'을 props로 받음
function TransactionHistory({ symbol }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 1. 로그인 안 했거나 symbol이 없으면 실행 안 함
    if (!auth.currentUser || !symbol) {
      setTransactions([]); // 목록 비우기
      return;
    }

    setLoading(true);
    setError(null);

    // 2. 'transactions' 하위 컬렉션에서
    const txCollectionRef = collection(db, "users", auth.currentUser.uid, "transactions");
    
    // 3. 'asset_code'가 현재 symbol과 일치하고, 'trade_dt' (거래시간) 기준으로 내림차순 정렬
    const q = query(
      txCollectionRef, 
      where("asset_code", "==", symbol),
      orderBy("trade_dt", "desc")
    );

    // 4. 실시간 리스너 연결
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
      // 오류 처리
      console.error("거래 내역 조회 실패:", err);
      setError(err.message);
      setLoading(false);
    });

    // 5. 컴포넌트가 사라지거나 symbol이 바뀌면 리스너 정리
    return () => unsubscribe();

  }, [symbol]); // symbol이 바뀔 때마다 쿼리 다시 실행

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" gutterBottom>
        나의 거래 내역 ({symbol || '...'})
      </Typography>
      {loading && <p>거래 내역을 불러오는 중...</p>}
      {error && <p style={{ color: 'red' }}>오류: {error}</p>}
      
      {!loading && !error && transactions.length === 0 && (
        <p>이 종목에 대한 거래 내역이 없습니다.</p>
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