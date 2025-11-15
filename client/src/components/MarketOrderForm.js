// client/src/components/MarketOrderForm.js
import React, { useState, useEffect } from 'react';
import { functions, auth, db } from '../firebase'; 
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from "firebase/firestore"; 

// 👈 [수정됨] MUI 컴포넌트 사용 (ButtonGroup 추가)
import { Box, Typography, TextField, Button, CircularProgress, Tabs, Tab, ButtonGroup } from '@mui/material';

// [신규] 소수점 4자리까지 자르는 헬퍼 함수
const truncateQuantity = (num) => {
  if (isNaN(num) || !isFinite(num) || num === 0) return ''; // 0, NaN, Infinity는 빈 문자열로
  const truncated = Math.floor(num * 10000) / 10000;
  return truncated.toString();
};

// [신규] 금액 포맷 헬퍼 함수
const formatAmount = (num) => {
  if (isNaN(num) || !isFinite(num) || num === 0) return '';
  return Math.floor(num).toString();
}

// [수정됨] stockInfo prop (가격 정보) 추가
function OrderForm({ symbol, stockInfo }) {
  const [tabIndex, setTabIndex] = useState(0); 
  
  const [quantity, setQuantity] = useState(''); // 수량 주문 state
  const [orderAmount, setOrderAmount] = useState(''); // 금액 주문 state

  // [신규] 사용자의 마지막 입력을 추적 (qty | amt)
  const [orderMode, setOrderMode] = useState('amt'); 

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [availableCash, setAvailableCash] = useState(0);
  const [cashLoading, setCashLoading] = useState(true);
  const [heldQuantity, setHeldQuantity] = useState(0);

  // [신규] 부모로부터 받은 현재가
  const currentPrice = stockInfo ? stockInfo.price : 0;
  const percentages = [0.1, 0.25, 0.5, 1.0]; // 비율 버튼

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
    setOrderMode('amt'); // 탭 변경 시 기본 모드 '금액'으로
  };

  // --- [신규] 연동 핸들러 ---
  // [수정됨] 수량 입력 시, 금액 자동 계산
  const handleQuantityChange = (value) => {
    setQuantity(value);
    setOrderMode('qty'); // 마지막 입력: 수량
    if (currentPrice > 0) {
      const numValue = parseFloat(value) || 0;
      setOrderAmount(formatAmount(numValue * currentPrice));
    } else {
      setOrderAmount(''); // 가격 없으면 비우기
    }
  };

  // [수정됨] 금액 입력 시, 수량 자동 계산
  const handleAmountChange = (value) => {
    setOrderAmount(value);
    setOrderMode('amt'); // 마지막 입력: 금액
    if (currentPrice > 0) {
      const numValue = parseFloat(value) || 0;
      setQuantity(truncateQuantity(numValue / currentPrice));
    } else {
      setQuantity(''); // 가격 없으면 비우기
    }
  };

  // [신규] 비율 버튼 클릭 핸들러
  const handlePercentClick = (percent) => {
    let newAmount = 0;
    if (tabIndex === 0) {
      // '매수' 탭: 보유 현금 기준
      newAmount = availableCash * percent;
    } else {
      // '매도' 탭: 총 평가액 (보유수량 * 현재가) 기준
      const maxAmount = heldQuantity * currentPrice;
      newAmount = maxAmount * percent;
    }
    // 금액 입력을 기준으로 수량까지 자동 변경
    handleAmountChange(formatAmount(newAmount)); 
  };
  // --- 핸들러 끝 ---

  // [신규] 매수/매도 로직 통합
  const handleSubmit = async (tradeType) => { // 'buy' 또는 'sell'
    setLoading(true);
    setMessage('');

    try {
      const func = (tradeType === 'buy') ? 
        httpsCallable(functions, 'buyAsset') : 
        httpsCallable(functions, 'sellAsset');
      
      const payload = { symbol: symbol };
      
      // [수정됨] 마지막 입력(orderMode)을 기준으로 payload 구성
      if (orderMode === 'amt') {
        const amountNum = parseFloat(orderAmount) || 0;
        if (amountNum < 10000) throw new Error('최소 주문 금액은 10,000원입니다.');
        payload.amount = amountNum;
      } else { // orderMode === 'qty'
        const quantityNum = parseFloat(quantity) || 0;
        if (quantityNum <= 0) throw new Error('주문 수량은 0보다 커야 합니다.');
        payload.quantity = quantityNum;
      }
      
      const result = await func(payload);
      setMessage(result.data.message);
      setQuantity('');
      setOrderAmount('');

    } catch (err) {
      console.error(`${tradeType} 실패:`, err);
      setMessage(`${tradeType === 'buy' ? '매수' : '매도'} 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };


  return (
    // [수정됨] 상위 Box의 padding, border 등 제거 (MarketPage.js로 이동)
    <Box> 
      {/* [수정됨] H6 제목 제거 (MarketPage.js의 "주문" 탭이 제목 역할) */}
      {/* <Typography variant="h6" gutterBottom>
      </Typography> 
      */}

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
            {parseFloat(heldQuantity.toFixed(4)).toLocaleString('ko-KR')}
          </Typography>
        </Box>
      </Box>

      {/* --- 종목 코드 (부모로부터 받음) --- */}
      <TextField
        label="종목 코드"
        value={symbol}
        disabled 
        fullWidth
        sx={{ mt: 1, mb: 2 }}
        InputLabelProps={{ shrink: !!symbol }} 
      />

      {/* --- '매수' / '매도' 탭 UI --- */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabIndex} onChange={handleTabChange} variant="fullWidth">
          {/* [수정됨] sx 속성 (color) 제거 */}
          <Tab label="매수" />
          <Tab label="매도" />
        </Tabs>
      </Box>

      {/* --- 탭 패널 공통 (입력창) --- */}
      <Box sx={{ pt: 2 }}>
        <TextField
          label="수량"
          type="number"
          value={quantity}
          onChange={(e) => handleQuantityChange(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
        />
        <TextField
          label="주문 금액 (KRW)"
          type="number"
          value={orderAmount}
          onChange={(e) => handleAmountChange(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
          helperText="최소 주문 금액: 10,000 KRW"
        />
      </Box>

      {/* --- [신규] 비율 버튼 (탭에 따라 기능 변경) --- */}
      <Box sx={{ mb: 2 }}>
        {/* [수정됨] variant="outlined" -> variant="text" */}
        <ButtonGroup size="small" variant="text" fullWidth>
          {percentages.map((p) => {
            // 탭에 따라 버튼 비활성화 로직 결정
            const isDisabled = (tabIndex === 0) ? // 매수 탭
              (availableCash < 10000 || !stockInfo) : // 매도 탭
              (heldQuantity <= 0 || currentPrice <= 0 || !stockInfo);

            return (
              <Button
                key={p}
                onClick={() => handlePercentClick(p)}
                disabled={isDisabled}
              >
                {p * 100}%
              </Button>
            );
          })}
        </ButtonGroup>
      </Box>

      {/* --- 탭 패널 0: 매수 버튼 --- */}
      <Box 
        role="tabpanel"
        hidden={tabIndex !== 0}
        id="buy-tabpanel"
      >
        <Button 
          variant="contained" 
          color="error" // '매수' 버튼
          onClick={() => handleSubmit('buy')} 
          disabled={loading || !symbol}
          fullWidth
          size="large"
          sx={{ mt: 2.5 }} 
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : '매수'}
        </Button>
      </Box>

      {/* --- 탭 패널 1: 매도 버튼 --- */}
      <Box 
        role="tabpanel"
        hidden={tabIndex !== 1}
        id="sell-tabpanel"
      >
        <Button 
          variant="contained" 
          color="primary" // '매도' 버튼
          onClick={() => handleSubmit('sell')} 
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