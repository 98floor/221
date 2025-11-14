// client/src/pages/MarketPage.js
import React, { useState } from 'react';
import { Grid, Box, Typography } from '@mui/material';
import MarketOrderForm from '../components/MarketOrderForm';
import TradingViewWidget from '../components/TradingViewWidget'; // TradingViewWidget 임포트

function MarketPage() {
  const [searchInput, setSearchInput] = useState('AAPL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeSymbol, setActiveSymbol] = useState('');

  const handleSearch = () => {
    if (searchInput.trim() === '') {
      setError("종목 코드를 입력해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    // Simply set the active symbol. The TradingView widget will handle the rest.
    setActiveSymbol(searchInput.toUpperCase());
    setLoading(false);
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
            <MarketOrderForm symbol={activeSymbol} />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

export default MarketPage;