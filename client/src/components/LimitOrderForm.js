// client/src/components/LimitOrderForm.js
import React, { useState } from 'react';
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { Box, Typography, TextField, Button, CircularProgress } from '@mui/material';

function LimitOrderForm({ symbol }) {
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handlePlaceOrder = async (type) => {
    if (quantity <= 0 || limitPrice <= 0) {
      setMessage('수량과 가격은 0보다 커야 합니다.');
      return;
    }
    setLoading(true);
    setMessage('');

    try {
      const placeLimitOrderFunc = httpsCallable(functions, 'placeLimitOrder');
      const result = await placeLimitOrderFunc({
        assetCode: symbol,
        type,
        limitPrice: Number(limitPrice),
        quantity: Number(quantity)
      });
      setMessage(result.data.message);
      setQuantity('');
      setLimitPrice('');
    } catch (err) {
      console.error(`지정가 ${type} 주문 실패:`, err);
      setMessage(`주문 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        지정가 주문
      </Typography>
      <TextField label="종목 코드" value={symbol || '종목을 검색하세요'} disabled fullWidth sx={{ mt: 1, mb: 2 }} />
      <TextField label="주문 가격" type="number" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} fullWidth sx={{ mb: 2 }} />
      <TextField label="수량" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} fullWidth sx={{ mb: 2 }} />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button variant="contained" color="error" onClick={() => handlePlaceOrder('buy')} disabled={loading || !symbol} fullWidth size="large">
          {loading ? <CircularProgress size={24} /> : '지정가 매수'}
        </Button>
        <Button variant="contained" color="primary" onClick={() => handlePlaceOrder('sell')} disabled={loading || !symbol} fullWidth size="large">
          {loading ? <CircularProgress size={24} /> : '지정가 매도'}
        </Button>
      </Box>
      {message && <Typography sx={{ mt: 2, color: message.includes('실패') ? 'red' : 'blue', textAlign: 'center' }}>{message}</Typography>}
    </Box>
  );
}

export default LimitOrderForm;
