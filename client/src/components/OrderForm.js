// client/src/components/OrderForm.js
import React, { useState, useEffect } from 'react';
import { functions, auth, db } from '../firebase'; // 👈 db, auth 임포트
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from "firebase/firestore"; // 👈 실시간 조회를 위한 onSnapshot

// 👈 [수정됨] MUI 컴포넌트 사용
import { Box, Typography, TextField, Button, CircularProgress } from '@mui/material';

// 이 컴포넌트는 부모(MarketPage)로부터 현재 'symbol'을 props로 받습니다.
function OrderForm({ symbol }) {
  const [quantity, setQuantity] = useState(''); // 👈 0 대신 '' (빈칸)으로 초기화
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // 🚨 [신규] 보유 현금을 실시간으로 표시하기 위한 state
  const [availableCash, setAvailableCash] = useState(0);
  const [cashLoading, setCashLoading] = useState(true);

  // 🚨 [신규] 보유 현금을 실시간으로 가져오는 로직 (onSnapshot)
  useEffect(() => {
    if (auth.currentUser) {
      const userDocRef = doc(db, "users", auth.currentUser.uid);

      // onSnapshot은 DB가 변경될 때마다 (예: 매수/매도 시) 자동으로 다시 실행됩니다.
      const unsubscribe = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
          setAvailableCash(doc.data().virtual_asset);
        } else {
          setAvailableCash(0);
        }
        setCashLoading(false);
      });

      return () => unsubscribe(); // 컴포넌트가 사라질 때 리스너 정리
    } else {
      setCashLoading(false);
    }
  }, []); // [] : 컴포넌트가 처음 렌더링될 때 1회만 실행


  // [UC-4] 매수 함수 (기존 TradePage.js 로직과 동일)
  const handleBuy = async () => {
    if (quantity <= 0) {
      setMessage('수량은 1 이상이어야 합니다.');
      return;
    }
    setLoading(true);
    setMessage('');

    try {
      const buyAsset = httpsCallable(functions, 'buyAsset');
      const result = await buyAsset({ 
        symbol: symbol, // 👈 부모로부터 받은 symbol 사용
        quantity: Number(quantity)
      }); 
      setMessage(result.data.message);
      setQuantity(''); // 👈 입력창 초기화

    } catch (err) {
      console.error("매수 실패:", err);
      setMessage(`매수 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // [UC-5] 매도 함수 (기존 TradePage.js 로직과 동일)
  const handleSell = async () => {
    if (quantity <= 0) {
      setMessage('수량은 1 이상이어야 합니다.');
      return;
    }
    setLoading(true);
    setMessage('');

    try {
      const sellAsset = httpsCallable(functions, 'sellAsset');
      const result = await sellAsset({ 
        symbol: symbol, // 👈 부모로부터 받은 symbol 사용
        quantity: Number(quantity) 
      });
      setMessage(result.data.message);
      setQuantity(''); // 👈 입력창 초기화

    } catch (err) {
      console.error("매도 실패:", err);
      setMessage(`매도 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    // 빗썸의 "주문" 폼과 유사한 UI
    <Box sx={{ border: '1px solid #ddd', padding: 2, borderRadius: 1 }}>
      <Typography variant="h6" gutterBottom>
        주문 (UC-4, 5)
      </Typography>

      {/* --- 보유 현금 표시 --- */}
      <Box sx={{ mt: 2, mb: 1 }}>
        <Typography variant="body2" color="textSecondary">
          주문 가능
        </Typography>
        {cashLoading ? (
          <CircularProgress size={20} />
        ) : (
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            {availableCash.toLocaleString('ko-KR')} KRW
          </Typography>
        )}
      </Box>

      {/* --- 종목 코드 (부모로부터 받음) --- */}
      <TextField
        label="종목 코드"
        value={symbol || '종목을 검색하세요'} // 👈 symbol prop
        disabled // 👈 이 폼에서는 직접 수정 불가
        fullWidth
        sx={{ mt: 1, mb: 2 }}
      />

      {/* --- 수량 입력 --- */}
      <TextField
        label="수량"
        type="number"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        fullWidth
        sx={{ mb: 2 }}
      />

      {/* --- 매수/매도 버튼 --- */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button 
          variant="contained" 
          color="error" 
          onClick={handleBuy} 
          disabled={loading || !symbol} // 👈 로딩 중이거나 심볼이 없으면 비활성화
          fullWidth
          size="large"
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : '매수'}
        </Button>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleSell} 
          disabled={loading || !symbol}
          fullWidth
          size="large"
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : '매도'}
        </Button>
      </Box>

      {/* --- 결과 메시지 --- */}
      {message && (
        <Typography sx={{ 
          mt: 2, 
          color: message.includes('실패') ? 'red' : 'blue',
          textAlign: 'center'
        }}>
          {message}
        </Typography>
      )}
    </Box>
  );
}

export default OrderForm;