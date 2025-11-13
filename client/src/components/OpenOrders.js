// client/src/components/OpenOrders.js
import React, { useState, useEffect } from 'react';
import { db, functions, auth } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Box, Typography, Button, CircularProgress } from '@mui/material';

function OpenOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelMessage, setCancelMessage] = useState('');

  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'limit_orders'),
      where('userId', '==', auth.currentUser.uid),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const openOrders = [];
      querySnapshot.forEach((doc) => {
        openOrders.push({ id: doc.id, ...doc.data() });
      });
      setOrders(openOrders);
      setLoading(false);
    }, (err) => {
      console.error("미체결 주문 조회 오류:", err);
      setError("미체결 주문을 불러오는 데 실패했습니다.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCancelOrder = async (orderId) => {
    setCancelMessage('주문 취소 중...');
    try {
      const cancelLimitOrderFunc = httpsCallable(functions, 'cancelLimitOrder');
      const result = await cancelLimitOrderFunc({ orderId });
      setCancelMessage(result.data.message);
    } catch (err) {
      console.error("주문 취소 실패:", err);
      setCancelMessage(`취소 실패: ${err.message}`);
    }
  };

  if (loading) return <CircularProgress />;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Box>
      <Typography variant="h6">미체결 주문</Typography>
      {cancelMessage && <p>{cancelMessage}</p>}
      {orders.length === 0 ? (
        <p>미체결 주문이 없습니다.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {orders.map(order => (
            <li key={order.id} style={{ border: '1px solid #eee', padding: '10px', marginBottom: '10px' }}>
              <p><strong>종목:</strong> {order.asset_code}</p>
              <p><strong>종류:</strong> <span style={{ color: order.type === 'buy' ? 'red' : 'blue' }}>{order.type}</span></p>
              <p><strong>주문 가격:</strong> {order.limit_price.toLocaleString()} KRW</p>
              <p><strong>수량:</strong> {order.quantity}</p>
              <Button variant="outlined" size="small" onClick={() => handleCancelOrder(order.id)}>취소</Button>
            </li>
          ))}
        </ul>
      )}
    </Box>
  );
}

export default OpenOrders;
