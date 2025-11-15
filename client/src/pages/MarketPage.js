// client/src/pages/MarketPage.js
import React, { useState, useEffect } from 'react';
import { Grid, Box, Typography, Tabs, Tab, IconButton } from '@mui/material';
import { Star, StarBorder } from '@mui/icons-material';
import { functions, auth } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { onAuthStateChanged } from 'firebase/auth';

// 컴포넌트 임포트
import MarketOrderForm from '../components/MarketOrderForm';
import TradingViewWidget from '../components/TradingViewWidget';
import TransactionHistory from '../components/TransactionHistory';
import FavoritesList from '../components/FavoritesList';

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
    // USD는 보통 소수점 2자리
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  const [stockInfo, setStockInfo] = useState(null);
  const [mainTabIndex, setMainTabIndex] = useState(0); // "주문" / "거래내역" 탭

  // --- Favorites State ---
  const [favorites, setFavorites] = useState(new Set());
  const [refreshFavsTrigger, setRefreshFavsTrigger] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  // ---

  const handleMainTabChange = (event, newValue) => { setMainTabIndex(newValue); };

  // 로그인/로그아웃 시 즐겨찾기 목록 불러옴
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
        setFavorites(new Set()); // 로그아웃 시 초기화
      }
    });
    return () => unsubscribe();
  }, []);

  // '별' 아이콘 상태 업데이트
  useEffect(() => {
    setIsFavorite(favorites.has(activeSymbol));
  }, [activeSymbol, favorites]);

  // 검색 함수
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
      setSearchInput(upperSymbol); // 검색창 입력값도 동기화
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
        // --- 제거 ---
        await removeFavorite({ symbol: activeSymbol });
        setFavorites(prev => {
          const newSet = new Set(prev);
          newSet.delete(activeSymbol);
          return newSet;
        });
      } else {
        // --- 추가 ---
        await addFavorite({ symbol: activeSymbol, name: currentName });
        setFavorites(prev => new Set(prev).add(activeSymbol));
      }
      setRefreshFavsTrigger(c => c + 1);
    } catch (err) {
      console.error("Favorite toggle failed:", err);
      setError("즐겨찾기 변경에 실패했습니다.");
    }
  };

  // 즐겨찾기 목록 클릭
  const handleFavoriteClick = (symbol) => {
    handleSearch(symbol);
  };

  return (
    // App.js의 Container가 여백을 관리하므로 sx={{ p: 3 }} 제거
    <Box>

      {/* [수정됨] 
          1. justifyContent="center" 제거
          2. 비율 9:3으로 변경
      */}
      <Grid
        container
        spacing={2}
      // justifyContent="center" // 👈 제거
      >

        {/* --- 1. 좌측 패널 (차트, 주문) [수정됨: 9] --- */}
        <Grid
          item
          xs={12}
          md={9}
          lg={9}
          sx={{
            minWidth: 0,          // flexbox width 계산 안정화
            width: '70%',        // 좌측 패널 항상 꽉 채움
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* 1-1. 차트 */}
          {activeSymbol ? (
            <TradingViewWidget symbol={activeSymbol} />
          ) : (
            <Box sx={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f4f4' }}>
              <Typography color="textSecondary">
                종목 코드를 검색하면 차트가 표시됩니다. (예: AAPL, GOOGL)
              </Typography>
            </Box>
          )}

          {/* 1-2. 주문/거래내역 탭 */}
          <Box sx={{ border: '1px solid #ddd', borderRadius: 1, mt: 2 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={mainTabIndex} onChange={handleMainTabChange} variant="fullWidth">
                <Tab label="주문" />
                <Tab label="거래내역" />
              </Tabs>
            </Box>
            <Box hidden={mainTabIndex !== 0} sx={{ p: 3 }}>
              <MarketOrderForm symbol={activeSymbol} stockInfo={stockInfo} />
            </Box>
            <Box hidden={mainTabIndex !== 1} sx={{ p: 3 }}>
              <TransactionHistory symbol={activeSymbol} />
            </Box>
          </Box>
        </Grid>

        {/* --- 2. 우측 패널 (검색, 정보, 즐겨찾기) [수정됨: 3] --- */}
        <Grid
          item
          xs={12}
          md={3} // 👉 9:3 비율
          lg={3} // 👉 9:3 비율
        >
          {/* 2-1. 검색창 */}
          <div style={{ display: 'flex', marginBottom: '10px' }}>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !loading && handleSearch(searchInput)}
              placeholder="종목 코드 검색 (예: AAPL)"
              style={{ flexGrow: 1, padding: '10px', border: '1px solid #ccc' }}
            />
            <button onClick={() => handleSearch(searchInput)} disabled={loading} style={{ padding: '10px 15px', border: '1px solid #ccc', borderLeft: 'none' }}>
              {loading ? '...' : '검색'}
            </button>
          </div>
          {error && <div style={{ color: 'red', marginBottom: '10px' }}>오류: {error}</div>}

          {/* 2-2. 종목 정보 */}
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
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                  <Typography variant="h4" sx={{ color: getColor(stockInfo.change) }}>
                    {/* KRW 가격 표시 */}
                    {formatNumber(stockInfo.price_krw, 'krw')}
                  </Typography>

                  {/* [신규] 국내 주식(.KS)이 아닐 때만 USD 가격 표시 */}
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

          {/* 2-3. 즐겨찾기 목록 */}
          <FavoritesList
            onFavoriteClick={handleFavoriteClick}
            refreshTrigger={refreshFavsTrigger}
          />
        </Grid>

      </Grid>
    </Box>
  );
}

export default MarketPage;