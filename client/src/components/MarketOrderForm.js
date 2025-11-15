// client/src/components/MarketOrderForm.js
import React, { useState, useEffect } from 'react';
import { functions, auth, db } from '../firebase'; 
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from "firebase/firestore"; 

// 👈 [수정됨] MUI 컴포넌트 사용 (InputAdornment, Tabs, Tab 등)
import { Box, Typography, TextField, Button, CircularProgress, Tabs, Tab, InputAdornment } from '@mui/material';

// [수정됨] stockInfo prop (가격 정보) 추가
function OrderForm({ symbol, stockInfo }) {
  const [tabIndex, setTabIndex] = useState(0); 
  
  const [quantity, setQuantity] = useState(''); // 수량 주문 state
  const [orderAmount, setOrderAmount] = useState(''); // 금액 주문 state

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [availableCash, setAvailableCash] = useState(0);
  const [cashLoading, setCashLoading] = useState(true);
  const [heldQuantity, setHeldQuantity] = useState(0);

  // [신규] 부모로부터 받은 현재가
  const currentPrice = stockInfo ? stockInfo.price : 0;

  // 보유 현금 실시간 로드
  useEffect(() => {
    if (!auth.currentUser) {
      setCashLoading(false);
      return;
    }
    setCashLoading(true);
    const userDocRef = doc(db, "users", auth.currentUser.uid);
    const unsubscribeCash = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        setAvailableCash(doc.data().virtual_asset);
      } else {
        setAvailableCash(0);
      }
      setCashLoading(false);
    });
    return () => unsubscribeCash();
  }, []);

  // 보유 수량 실시간 로드
  useEffect(() => {
    if (!auth.currentUser || !symbol) {
      setHeldQuantity(0);
      return;
    }
    const holdingDocRef = doc(db, "users", auth.currentUser.uid, "holdings", symbol);
    const unsubscribeHolding = onSnapshot(holdingDocRef, (doc) => {
      if (doc.exists()) {
        setHeldQuantity(doc.data().quantity);
      } else {
        setHeldQuantity(0);
      }
    });
    return () => unsubscribeHolding();
  }, [symbol]);

  // '매수' / '매도' 탭 변경 핸들러
  const handleTabChange = (event, newValue) => {
    setTabIndex(newValue);
    setQuantity('');
    setOrderAmount('');
    setMessage('');
  };

  // 수량 입력 시, 금액 입력 초기화
  const handleQuantityChange = (value) => {
    setQuantity(value);
    setOrderAmount(''); 
  };

  // 금액 입력 시, 수량 입력 초기화
  const handleAmountChange = (value) => {
    setOrderAmount(value);
    setQuantity(''); 
  };

  // --- [신규] '최대' 버튼 핸들러 4개 ---
  
  // 1. 매수 탭 - 수량 '최대' (현금 / 현재가)
  const handleMaxBuyQuantity = () => {
    if (currentPrice > 0 && availableCash >= 10000) {
      const maxQty = availableCash / currentPrice;
      // 소수점 4자리까지 내림
      setQuantity(Math.floor(maxQty * 10000) / 10000); 
      setOrderAmount(''); 
    }
  };

  // 2. 매수 탭 - 금액 '최대' (현금)
  const handleMaxBuyAmount = () => {
    if (availableCash >= 10000) {
      setOrderAmount(Math.floor(availableCash)); // 정수로 내림
      setQuantity(''); 
    }
  };

  // 3. 매도 탭 - 수량 '최대' (보유 수량)
  const handleMaxSellQuantity = () => {
    if (heldQuantity > 0) {
      setQuantity(heldQuantity); 
      setOrderAmount(''); 
    }
  };
  
  // 4. 매도 탭 - 금액 '최대' (보유 수량 * 현재가)
  const handleMaxSellAmount = () => {
    if (currentPrice > 0 && heldQuantity > 0) {
      const maxAmount = heldQuantity * currentPrice;
      setOrderAmount(Math.floor(maxAmount)); // 정수로 내림
      setQuantity('');
    }
  };
  // --- 핸들러 끝 ---

  // [UC-4] 매수 함수
  const handleBuy = async () => {
    setLoading(true);
    setMessage('');
    try {
      const buyAsset = httpsCallable(functions, 'buyAsset');
      const payload = { symbol: symbol };
      
      if (quantity > 0) {
        payload.quantity = Number(quantity);
      } else if (orderAmount > 0) {
        if (orderAmount < 10000) throw new Error('최소 주문 금액은 10,000원입니다.');
        payload.amount = Number(orderAmount);
      } else {
        throw new Error('주문 수량 또는 금액을 입력하세요.');
      }
      
      const result = await buyAsset(payload);
      setMessage(result.data.message);
      setQuantity('');
      setOrderAmount('');
    } catch (err) {
      console.error("매수 실패:", err);
      setMessage(`매수 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // [UC-5] 매도 함수
  const handleSell = async () => {
    setLoading(true);
    setMessage('');
    try {
      const sellAsset = httpsCallable(functions, 'sellAsset');
      const payload = { symbol: symbol };

      if (quantity > 0) {
        payload.quantity = Number(quantity);
      } else if (orderAmount > 0) {
        if (orderAmount < 10000) throw new Error('최소 주문 금액은 10,000원입니다.');
        payload.amount = Number(orderAmount);
      } else {
        throw new Error('주문 수량 또는 금액을 입력하세요.');
      }
      
      const result = await sellAsset(payload);
      setMessage(result.data.message);
      setQuantity('');
      setOrderAmount('');
    } catch (err) {
      console.error("매도 실패:", err);
      setMessage(`매도 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ border: '1px solid #ddd', padding: 2, borderRadius: 1 }}>
      <Typography variant="h6" gutterBottom>
        주문 (UC-4, 5)
      </Typography>

      {/* --- 보유 현금 / 보유 수량 표시 --- */}
      <Box sx={{ mt: 2, mb: 1, display: 'flex', justifyContent: 'space-between' }}>
        <Box>
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
        <Box sx={{textAlign: 'right'}}>
          <Typography variant="body2" color="textSecondary">
            보유 수량 ({symbol || '...'})
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            {parseFloat(heldQuantity.toFixed(4)).toLocaleString('ko-KR')} 주
          </Typography>
        </Box>
      </Box>

      {/* --- 종목 코드 (부모로부터 받음) --- */}
      <TextField
        label="종목 코드"
        value={symbol || '종목을 검색하세요'}
        disabled 
        fullWidth
        sx={{ mt: 1, mb: 2 }}
        InputLabelProps={{ shrink: !!symbol }} 
      />

      {/* --- '매수' / '매도' 탭 UI --- */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabIndex} onChange={handleTabChange} variant="fullWidth">
          <Tab label="매수" sx={{ color: 'red' }} />
          <Tab label="매도" sx={{ color: 'blue' }} />
        </Tabs>
      </Box>

      {/* --- 탭 패널 0: 매수 탭 --- */}
      <Box 
        role="tabpanel"
        hidden={tabIndex !== 0}
        id="buy-tabpanel"
        sx={{ pt: 2 }}
      >
        <TextField
          label="수량"
          type="number"
          value={quantity}
          onChange={(e) => handleQuantityChange(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
          // [수정됨] 매수 - 수량 - '최대' 버튼
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Button
                  size="small"
                  onClick={handleMaxBuyQuantity}
                  disabled={availableCash < 10000 || currentPrice <= 0 || !stockInfo}
                >
                  최대
                </Button>
              </InputAdornment>
            ),
          }}
        />
        <TextField
          label="주문 금액 (KRW)"
          type="number"
          value={orderAmount}
          onChange={(e) => handleAmountChange(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
          helperText="최소 주문 금액: 10,000 KRW"
          // [수정됨] 매수 - 금액 - '최대' 버튼
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Button
                  size="small"
                  onClick={handleMaxBuyAmount}
                  disabled={availableCash < 10000}
                >
                  최대
                </Button>
              </InputAdornment>
            ),
          }}
        />
        <Button 
          variant="contained" 
          color="error" // '매수' 버튼
          onClick={handleBuy} 
          disabled={loading || !symbol}
          fullWidth
          size="large"
          sx={{ mt: 2.5 }} 
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : '매수'}
        </Button>
      </Box>

      {/* --- 탭 패널 1: 매도 탭 --- */}
      <Box 
        role="tabpanel"
        hidden={tabIndex !== 1}
        id="sell-tabpanel"
        sx={{ pt: 2 }}
      >
        <TextField
          label="수량"
          type="number"
          value={quantity}
          onChange={(e) => handleQuantityChange(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
          // [수정됨] 매도 - 수량 - '최대' 버튼
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Button
                  size="small"
                  onClick={handleMaxSellQuantity}
                  disabled={heldQuantity <= 0}
                >
                  최대
                </Button>
              </InputAdornment>
            ),
          }}
        />
        <TextField
          label="주문 금액 (KRW)"
          type="number"
          value={orderAmount}
          onChange={(e) => handleAmountChange(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
          helperText="최소 주문 금액: 10,000 KRW"
          // [수정됨] 매도 - 금액 - '최대' 버튼
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Button
                  size="small"
                  onClick={handleMaxSellAmount}
                  disabled={heldQuantity <= 0 || currentPrice <= 0 || !stockInfo}
                >
                  최대
                </Button>
              </InputAdornment>
            ),
          }}
        />
        <Button 
          variant="contained" 
          color="primary" // '매도' 버튼
          onClick={handleSell} 
          disabled={loading || !symbol}
          fullWidth
          size="large"
          sx={{ mt: 2.5 }} 
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