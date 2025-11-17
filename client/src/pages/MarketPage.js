import React, { useState, useEffect } from 'react';
import { functions, auth } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { onAuthStateChanged } from 'firebase/auth';
import { Star, StarBorder } from '@mui/icons-material'; // 아이콘은 유지

import MarketOrderForm from '../components/MarketOrderForm';
import TradingViewWidget from '../components/TradingViewWidget';
import TransactionHistory from '../components/TransactionHistory';
import FavoritesList from '../components/FavoritesList';
import NewsList from '../components/NewsList';
import './MarketPage.css';

const getStockQuote = httpsCallable(functions, 'getStockQuote');
const addFavorite = httpsCallable(functions, 'addFavorite');
const removeFavorite = httpsCallable(functions, 'removeFavorite');
const getFavoritesList = httpsCallable(functions, 'getFavoritesList');

const formatNumber = (num, type = 'krw') => {
  if (num === undefined || num === null) return '-';
  if (type === 'krw') return `${Math.round(num).toLocaleString('ko-KR')} KRW`;
  if (type === 'usd') return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${num.toFixed(2)}%`;
};

const getColorClass = (num) => {
  if (num > 0) return 'price-up';
  if (num < 0) return 'price-down';
  return 'price-even';
};

function MarketPage() {
  const [searchInput, setSearchInput] = useState('AAPL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeSymbol, setActiveSymbol] = useState('');
  const [stockInfo, setStockInfo] = useState(null);
  const [favorites, setFavorites] = useState(new Set());
  const [refreshFavsTrigger, setRefreshFavsTrigger] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);

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

  useEffect(() => {
    setIsFavorite(favorites.has(activeSymbol));
  }, [activeSymbol, favorites]);

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

  const handleFavoriteClick = (symbol) => {
    handleSearch(symbol);
  };

  return (
    <div className="market-container">
      <main className="market-main">
        <div className="chart-container">
          {activeSymbol ? (
            <TradingViewWidget symbol={activeSymbol} />
          ) : (
            <p>종목 코드를 검색하면 차트가 표시됩니다. (예: AAPL, GOOGL)</p>
          )}
        </div>
        <div className="order-history-container">
          <div className="order-form-container">
            <MarketOrderForm symbol={activeSymbol} stockInfo={stockInfo} />
          </div>
          <div className="transaction-history-container">
            <TransactionHistory symbol={activeSymbol} />
          </div>
        </div>
      </main>

      <aside className="market-sidebar">
        <div className="search-container">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !loading && handleSearch(searchInput)}
            placeholder="종목 코드 검색 (예: AAPL)"
          />
          <button onClick={() => handleSearch(searchInput)} disabled={loading}>
            {loading ? '...' : '검색'}
          </button>
        </div>
        {error && <div className="error-message">{error}</div>}

        <div className="stock-info-container">
          {stockInfo ? (
            <>
              <div className="stock-info-header">
                <h3>{stockInfo.name} ({activeSymbol})</h3>
                <button onClick={toggleFavorite} disabled={!auth.currentUser} className="icon-button">
                  {isFavorite ? <Star style={{ color: '#fbc02d' }} /> : <StarBorder />}
                </button>
              </div>
              <div className="stock-info-price">
                <span className={`price-krw ${getColorClass(stockInfo.change)}`}>
                  {formatNumber(stockInfo.price_krw, 'krw')}
                </span>
                {!stockInfo.is_krw_stock && (
                  <span className="price-usd">
                    ({formatNumber(stockInfo.price_usd, 'usd')})
                  </span>
                )}
                <span className={`price-change ${getColorClass(stockInfo.change)}`}>
                  {formatNumber(stockInfo.changePercent, 'percent')}
                </span>
              </div>
            </>
          ) : (
            <div>
              <h3>종목을 검색하세요</h3>
              <p>-</p>
            </div>
          )}
        </div>

        <div className="favorites-container">
          <FavoritesList onFavoriteClick={handleFavoriteClick} refreshTrigger={refreshFavsTrigger} />
        </div>
        <div className="news-container">
          <NewsList symbol={activeSymbol} />
        </div>
      </aside>
    </div>
  );
}

export default MarketPage;

