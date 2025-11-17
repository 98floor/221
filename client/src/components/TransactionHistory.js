// client/src/components/TransactionHistory.js
import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { Box, Typography, Table, TableContainer, TableBody, TableCell, TableHead, TableRow, Skeleton } from '@mui/material';

// 헬퍼 함수 (기존과 동일)
const formatDate = (timestamp) => {
  if (timestamp) {
    return timestamp.toDate().toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  }
  return '날짜 정보 없음';
};

const formatNumber = (num, type = 'krw') => {
  if (type === 'krw') {
    return `${Math.round(num).toLocaleString('ko-KR')}원`;
  }
  return `${parseFloat(num.toFixed(4)).toLocaleString('ko-KR')}주`;
};

function TransactionHistory({ symbol }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentSeasonId, setCurrentSeasonId] = useState(null);

  useEffect(() => {
    const fetchCurrentSeason = async () => {
      const seasonDocRef = doc(db, "seasons", "current");
      try {
        const seasonDoc = await getDoc(seasonDocRef);
        setCurrentSeasonId(seasonDoc.exists() ? seasonDoc.data().seasonId : 1);
      } catch (err) {
        console.error("현재 시즌 ID 조회 실패:", err);
        setCurrentSeasonId(1);
      }
    };
    fetchCurrentSeason();
  }, []);

  useEffect(() => {
    if (!auth.currentUser || !symbol || currentSeasonId === null) {
      setTransactions([]);
      return;
    }

    setLoading(true);
    setError(null);

    const txCollectionRef = collection(db, "users", auth.currentUser.uid, "transactions");
    const q = query(
      txCollectionRef,
      where("asset_code", "==", symbol),
      where("seasonId", "==", currentSeasonId),
      orderBy("trade_dt", "desc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const txData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(txData);
      setLoading(false);
    }, (err) => {
      console.error("거래 내역 조회 실패:", err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [symbol, currentSeasonId]);

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'text.primary', mb: 2 }}>
        나의 거래 내역 (현재 시즌)
      </Typography>
      <TableContainer sx={{ maxHeight: 350, border: '1px solid #eee', borderRadius: 1 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{backgroundColor: '#f9f9f9'}}>시간</TableCell>
              <TableCell sx={{backgroundColor: '#f9f9f9'}}>구분</TableCell>
              <TableCell align="right" sx={{backgroundColor: '#f9f9f9'}}>수량</TableCell>
              <TableCell align="right" sx={{backgroundColor: '#f9f9f9'}}>거래단가</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              [...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}><Skeleton variant="text" /></TableCell>
                </TableRow>
              ))
            )}
            {!loading && error && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ color: 'red' }}>
                  오류: {error}
                </TableCell>
              </TableRow>
            )}
            {!loading && !error && transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  현재 시즌의 거래 내역이 없습니다.
                </TableCell>
              </TableRow>
            )}
            {!loading && !error && transactions.map((tx) => (
              <TableRow key={tx.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                <TableCell sx={{ fontSize: '0.8rem' }}>{formatDate(tx.trade_dt)}</TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ color: tx.type === 'buy' ? 'error.main' : 'primary.main', fontWeight: 'bold' }}>
                    {tx.type === 'buy' ? '매수' : '매도'}
                  </Typography>
                </TableCell>
                <TableCell align="right">{formatNumber(tx.quantity, 'qty')}</TableCell>
                <TableCell align="right">{formatNumber(tx.trade_price, 'krw')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default TransactionHistory;
