// client/src/pages/MarketPage.js
import React, { useState } from 'react';
import { Grid, Box, Typography } from '@mui/material';

// [신규] firebase functions 임포트
import { functions } from '../firebase'; 
import { httpsCallable } from 'firebase/functions';

// [신규] 하위 컴포넌트 임포트
import MarketOrderForm from '../components/MarketOrderForm';
import TradingViewWidget from '../components/TradingViewWidget';
import TransactionHistory from '../components/TransactionHistory'; // 👈 거래 내역 컴포넌트

// 헬퍼 함수: 숫자 포맷
const formatNumber = (num, type = 'krw') => {
  if (num === undefined || num === null) return '-';
  if (type === 'krw') {
    return `${Math.round(num).toLocaleString('ko-KR')} KRW`;
  }
  // 퍼센트
  return `${num.toFixed(2)}%`;
};

// 헬퍼 함수: 숫자 색상 (상승/하락)
const getColor = (num) => {
  if (num > 0) return 'green';
  if (num < 0) return 'red';
  return 'black';
};


function MarketPage() {
  const [searchInput, setSearchInput] = useState('AAPL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [activeSymbol, setActiveSymbol] = useState('');
  
  // [신규] 1단계에서 만든 getStockQuote 함수의 결과를 저장할 state
  const [stockInfo, setStockInfo] = useState(null); 

  const handleSearch = async () => {
    if (searchInput.trim() === '') {
      setError("종목 코드를 입력해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setStockInfo(null); // 이전 정보 초기화

    const symbolToSearch = searchInput.toUpperCase();
    
    try {
      // 1. [신규] 1단계에서 만든 Cloud Function 호출
      const getStockQuote = httpsCallable(functions, 'getStockQuote');
      const result = await getStockQuote({ symbol: symbolToSearch });

      if (result.data.success) {
        // 2. [신규] 성공 시, 종목 정보(이름, 가격) 저장
        setStockInfo(result.data);
      } else {
        throw new Error(result.data.message || "정보 조회 실패");
      }

      // 3. 차트 및 주문 폼에 심볼 전달
      setActiveSymbol(symbolToSearch);

    } catch (err) {
      console.error("종목 정보 조회 실패:", err);
      setError(`[${symbolToSearch}] ${err.message}`);
      setActiveSymbol(''); // 실패 시 심볼 초기화
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <h2>시장 현황판 (UC-3)</h2>
      <div style={{ display: 'flex', marginBottom: '20px' }}>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !loading && handleSearch()}
          placeholder="종목 코드 입력 (예: AAPL, 005930.KS)"
          style={{ flexGrow: 1, padding: '10px' }}
        />
        <button onClick={handleSearch} disabled={loading} style={{ padding: '10px 15px' }}>
          {loading ? '검색 중...' : '검색'}
        </button>
      </div>
      
      
      {/* --- [신규] 종목 정보 표시 UI --- */}
      {stockInfo ? (
        <Box sx={{ mb: 2, p: 2, border: '1px solid #eee', borderRadius: 1 }}>
          <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
            {stockInfo.name} ({activeSymbol})
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mt: 1 }}>
            <Typography variant="h3" sx={{ color: getColor(stockInfo.change) }}>
              {formatNumber(stockInfo.price, 'krw')}
            </Typography>
            <Typography variant="h5" sx={{ color: getColor(stockInfo.change) }}>
              {formatNumber(stockInfo.changePercent, 'percent')}
            </Typography>
          </Box>
        </Box>
      ) : (
        <Box sx={{ mb: 2, p: 2, border: '1px solid #eee', borderRadius: 1, color: '#888' }}>
          <Typography variant="h4">종목을 검색하세요</Typography>
          <Typography variant="h3">-</Typography>
        </Box>
      )}

      {error && <div style={{ color: 'red', marginBottom: '10px' }}>오류: {error}</div>}
      
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          {/* TradingView Widget Display Logic */}
          {activeSymbol ? (
            <TradingViewWidget symbol={activeSymbol} />
          ) : (
            <Box sx={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f4f4' }}>
              <Typography color="textSecondary">
                종목 코드를 검색하면 차트가 표시됩니다. (예: AAPL, GOOGL, 005930)
              </Typography>
            </Box>
          )}
        </Grid>
        <Grid item xs={12} md={4}>
          <Box sx={{ border: '1px solid #ddd', borderRadius: 1, p: 3 }}>
            <Typography variant="h6" gutterBottom>
              시장가 주문
            </Typography>
            
            {/* [수정됨] stockInfo prop 전달 */}
            <MarketOrderForm symbol={activeSymbol} stockInfo={stockInfo} />
            
            {/* --- [신규] 거래 내역 컴포넌트 렌더링 --- */}
            <TransactionHistory symbol={activeSymbol} />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

export default MarketPage;