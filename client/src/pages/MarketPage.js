// client/src/pages/MarketPage.js
import React, { useState, useEffect } from 'react';
import { Grid, Box, Typography, IconButton } from '@mui/material';
import { Star, StarBorder } from '@mui/icons-material';
import { functions, auth } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { onAuthStateChanged } from 'firebase/auth';

// 컴포넌트 임포트
import MarketOrderForm from '../components/MarketOrderForm';
import TradingViewWidget from '../components/TradingViewWidget';
import TransactionHistory from '../components/TransactionHistory';
import FavoritesList from '../components/FavoritesList';
import NewsList from '../components/NewsList';

// Cloud Functions
const getStockQuote = httpsCallable(functions, 'getStockQuote');
const addFavorite = httpsCallable(functions, 'addFavorite');
const removeFavorite = httpsCallable(functions, 'removeFavorite');
const getFavoritesList = httpsCallable(functions, 'getFavoritesList');

// 헬퍼 함수: 숫자 포맷
const formatNumber = (num, type = 'krw') => {
  if (num === undefined || num === null) return '-';
  if (type === 'krw') {
    return `${Math.round(num).toLocaleString('ko-KR')} KRW`;
  }
  if (type === 'usd') {
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
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
  const [stockInfo, setStockInfo] = useState(null);

  // 즐겨찾기 State
  const [favorites, setFavorites] = useState(new Set());
  const [refreshFavsTrigger, setRefreshFavsTrigger] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);

  // 로그인 시 즐겨찾기 목록 로딩
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        getFavoritesList()
          .then(result => {
            if (result.data.success) {
              const symbols = result.data.favorites.map(fav => fav.symbol);
              setFavorites(new Set(symbols));
            }
          })
          .catch(err => console.error("Failed to load favorites symbols", err));
      } else {
        setFavorites(new Set());
      }
    });
    return () => unsubscribe();
  }, []);

  // 현재 종목이 즐겨찾기인지 체크
  useEffect(() => {
    setIsFavorite(favorites.has(activeSymbol));
  }, [activeSymbol, favorites]);

  // 종목 검색 처리
  const handleSearch = async (symbolToSearch) => {
    if (!symbolToSearch || symbolToSearch.trim() === '') {
      setError("종목 코드를 입력해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setStockInfo(null);

    const upperSymbol = symbolToSearch.toUpperCase();

    try {
      const result = await getStockQuote({ symbol: upperSymbol });
      if (result.data.success) {
        setStockInfo(result.data);
      } else {
        throw new Error(result.data.message || "정보 조회 실패");
      }
      setActiveSymbol(upperSymbol);
      setSearchInput(upperSymbol);
    } catch (err) {
      console.error("종목 정보 조회 실패:", err);
      setError(`[${upperSymbol}] ${err.message}`);
      setActiveSymbol('');
    } finally {
      setLoading(false);
    }
  };

  // 즐겨찾기 토글
  const toggleFavorite = async () => {
    if (!activeSymbol || !stockInfo || !auth.currentUser) return;

    const currentName = stockInfo.name;
    try {
      if (isFavorite) {
        await removeFavorite({ symbol: activeSymbol });
        setFavorites(prev => {
          const newSet = new Set(prev);
          newSet.delete(activeSymbol);
          return newSet;
        });
      } else {
        await addFavorite({ symbol: activeSymbol, name: currentName });
        setFavorites(prev => new Set(prev).add(activeSymbol));
      }
      setRefreshFavsTrigger(c => c + 1);
    } catch (err) {
      console.error("Favorite toggle failed:", err);
      setError("즐겨찾기 변경에 실패했습니다.");
    }
  };

  // 즐겨찾기 클릭
  const handleFavoriteClick = (symbol) => {
    handleSearch(symbol);
  };

  return (
    <Box>

      {/* 전체 레이아웃 */}
      <Grid container spacing={2}>

        {/* 1. 좌측: 차트 + 주문/거래내역 */}
        <Grid
          item
          xs={12}
          md={9}
          lg={9}
          sx={{
            minWidth: 0,
            width: '65%',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* 차트 */}
          {activeSymbol ? (
            <TradingViewWidget symbol={activeSymbol} />
          ) : (
            <Box sx={{
              height: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f4f4f4'
            }}>
              <Typography color="textSecondary">
                종목 코드를 검색하면 차트가 표시됩니다. (예: AAPL, GOOGL)
              </Typography>
            </Box>
          )}

          {/* 주문 + 거래내역 나란히 배치 */}
          <Box
            sx={{
              border: '1px solid #ddd',
              borderRadius: 1,
              mt: 2,
              p: 2
            }}
          >
            <Grid container spacing={2}>
              {/* 주문폼 */}
              <Grid item xs={12} md={6}>
                <MarketOrderForm symbol={activeSymbol} stockInfo={stockInfo} />
              </Grid>

              {/* 거래내역 */}
              <Grid item xs={12} md={6}>
                <TransactionHistory symbol={activeSymbol} />
              </Grid>
            </Grid>
          </Box>
        </Grid>

        {/* 2. 우측: 검색창 + 종목 정보 + 즐겨찾기 + 뉴스 */}
        <Grid item xs={12} md={3} lg={3} sx={{ minWidth: 0 }}>

          {/* 검색창 */}
          <div style={{ display: 'flex', marginBottom: '10px' }}>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !loading && handleSearch(searchInput)}
              placeholder="종목 코드 검색 (예: AAPL)"
              style={{ flexGrow: 1, padding: '10px', border: '1px solid #ccc' }}
            />
            <button
              onClick={() => handleSearch(searchInput)}
              disabled={loading}
              style={{ padding: '10px 15px', border: '1px solid #ccc', borderLeft: 'none' }}
            >
              {loading ? '...' : '검색'}
            </button>
          </div>
          {error && <div style={{ color: 'red', marginBottom: '10px' }}>오류: {error}</div>}

          {/* 종목 정보 */}
          <Box sx={{ mb: 2, p: 2, border: '1px solid #eee', borderRadius: 1 }}>
            {stockInfo ? (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
                    {stockInfo.name} ({activeSymbol})
                  </Typography>
                  <IconButton onClick={toggleFavorite} size="small" disabled={!auth.currentUser}>
                    {isFavorite ? <Star sx={{ color: '#fbc02d' }} /> : <StarBorder />}
                  </IconButton>
                </Box>

                <Box sx={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 1,
                  mt: 1,
                  flexWrap: 'wrap'
                }}>
                  <Typography variant="h4" sx={{ color: getColor(stockInfo.change) }}>
                    {formatNumber(stockInfo.price_krw, 'krw')}
                  </Typography>

                  {!stockInfo.is_krw_stock && (
                    <Typography variant="h6" color="textSecondary">
                      ({formatNumber(stockInfo.price_usd, 'usd')})
                    </Typography>
                  )}

                  <Typography variant="h6" sx={{ color: getColor(stockInfo.change) }}>
                    {formatNumber(stockInfo.changePercent, 'percent')}
                  </Typography>
                </Box>
              </>
            ) : (
              <Box sx={{ color: '#888' }}>
                <Typography variant="h5">종목을 검색하세요</Typography>
                <Typography variant="h4">-</Typography>
              </Box>
            )}
          </Box>

          {/* 즐겨찾기 */}
          <FavoritesList
            onFavoriteClick={handleFavoriteClick}
            refreshTrigger={refreshFavsTrigger}
          />

          {/* 뉴스 */}
          <NewsList symbol={activeSymbol} />

        </Grid>

      </Grid>
    </Box>
  );
}

export default MarketPage;
