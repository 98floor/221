import React, { useState, useEffect, useCallback } from 'react';
import { functions, db } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, query, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import PortfolioChart from '../components/PortfolioChart';
import './PortfolioPage.css';

const formatDate = (timestamp) => {
  if (timestamp && timestamp.toDate) return timestamp.toDate().toLocaleString('ko-KR');
  if (typeof timestamp === 'string') return new Date(timestamp).toLocaleString('ko-KR');
  return '날짜 정보 없음';
};

const formatNumber = (num, type = 'krw') => {
  if (typeof num !== 'number') return num;
  if (type === 'krw') return `${Math.round(num).toLocaleString('ko-KR')}원`;
  if (type === 'percent') return `${num.toFixed(2)}%`;
  if (type === 'qty') return `${parseFloat(num.toFixed(4)).toLocaleString('ko-KR')}주`;
  return num;
};

function PortfolioPage() {
  const [portfolio, setPortfolio] = useState(null);
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);
  const [errorPortfolio, setErrorPortfolio] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [errorTx, setErrorTx] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [errorHistory, setErrorHistory] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [loadingSeasons, setLoadingSeasons] = useState(true);
  const [currentSeasonId, setCurrentSeasonId] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [seasonSummary, setSeasonSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [errorSummary, setErrorSummary] = useState(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const seasonsQuery = query(collection(db, "hall_of_fame"), orderBy("endDate", "desc"));
        const seasonDocRef = doc(db, "seasons", "current");
        const [snapshot, currentSeasonDoc] = await Promise.all([getDocs(seasonsQuery), getDoc(seasonDocRef)]);
        const seasonData = snapshot.docs.map(doc => ({ id: parseInt(doc.id.split('_')[1]), name: doc.data().season_name }));
        setSeasons(seasonData);
        const currentId = currentSeasonDoc.exists() ? currentSeasonDoc.data().seasonId : 1;
        setCurrentSeasonId(currentId);
        setSelectedSeason(currentId);
      } catch (err) {
        console.error("시즌 정보 조회 실패:", err);
        setCurrentSeasonId(1);
        setSelectedSeason(1);
      } finally {
        setLoadingSeasons(false);
      }
      try {
        const getPortfolio = httpsCallable(functions, 'getPortfolio');
        const result = await getPortfolio();
        setPortfolio(result.data.portfolioData); // [수정] portfolioData 키를 통해 실제 데이터에 접근
      } catch (err) {
        setErrorPortfolio(err.message);
      } finally {
        setLoadingPortfolio(false);
      }
    };
    fetchInitialData();
  }, []);

  const fetchDataForSeason = useCallback(async (seasonId) => {
    if (seasonId === null) return;
    setLoadingHistory(true);
    setLoadingTx(true);
    setErrorHistory(null);
    setErrorTx(null);
    setLoadingSummary(true);
    setErrorSummary(null);
    if (seasonId !== currentSeasonId) {
      try {
        const getSeasonPortfolioSummary = httpsCallable(functions, 'getSeasonPortfolioSummary');
        const summaryResult = await getSeasonPortfolioSummary({ seasonId });
        setSeasonSummary(summaryResult.data);
      } catch (err) {
        console.error(`시즌 ${seasonId} 요약 정보 조회 실패:`, err);
        setErrorSummary(err.message);
        setSeasonSummary(null);
      } finally {
        setLoadingSummary(false);
      }
    } else {
      setSeasonSummary(null);
      setLoadingSummary(false);
    }
    try {
      const getPortfolioHistory = httpsCallable(functions, 'getPortfolioHistory');
      const getTransactionHistory = httpsCallable(functions, 'getTransactionHistory');
      const [historyResult, txResult] = await Promise.all([getPortfolioHistory({ seasonId }), getTransactionHistory({ seasonId })]);
      if (historyResult.data.success) setHistoryData(historyResult.data.history);
      else throw new Error(historyResult.data.error || "자산 변동 내역 조회 실패");
      if (txResult.data.success) setTransactions(txResult.data.transactions);
      else throw new Error(txResult.data.error || "거래 내역 조회 실패");
    } catch (err) {
      console.error("데이터 조회 실패 상세 정보:", err);
      const errorMessage = err.message || "알 수 없는 오류가 발생했습니다.";
      setErrorHistory(errorMessage);
      setErrorTx(errorMessage);
    } finally {
      setLoadingHistory(false);
      setLoadingTx(false);
    }
  }, [currentSeasonId]);

  useEffect(() => {
    fetchDataForSeason(selectedSeason);
  }, [selectedSeason, fetchDataForSeason]);

  const getSeasonName = (isTitle = false) => {
    if (selectedSeason === null) return '시즌 정보 로딩 중...';
    const season = seasons.find(s => s.id === selectedSeason);
    const seasonName = season ? season.name : `시즌 ${selectedSeason}`;
    if (selectedSeason === currentSeasonId) return isTitle ? '현재 시즌' : '현재 기준';
    return seasonName;
  };

  const displayPortfolio = selectedSeason === currentSeasonId ? portfolio : seasonSummary;
  const displayLoading = selectedSeason === currentSeasonId ? loadingPortfolio : loadingSummary;
  const displayError = selectedSeason === currentSeasonId ? errorPortfolio : errorSummary;

  if (loadingPortfolio || loadingSeasons) return <div>포트폴리오를 불러오는 중...</div>;
  if (errorPortfolio && selectedSeason === currentSeasonId) return <div>오류: {errorPortfolio} (로그인이 필요할 수 있습니다.)</div>;

  return (
    <div className="portfolio-container">
      <div className="portfolio-header">
        <h2>내 자산</h2>
        <div className="season-selector">
          <label htmlFor="season-select">기록 조회 시즌 선택:</label>
          <select id="season-select" value={selectedSeason ?? ''} onChange={(e) => setSelectedSeason(parseInt(e.target.value))} disabled={loadingSeasons || selectedSeason === null}>
            {currentSeasonId && <option value={currentSeasonId}>현재 시즌</option>}
            {seasons.map(season => (<option key={season.id} value={season.id}>{season.name}</option>))}
          </select>
        </div>
      </div>

      <div className="portfolio-section">
        <h3>{getSeasonName(true)} 자산 변동 그래프</h3>
        {loadingHistory ? <p>그래프 데이터 로딩 중...</p> : errorHistory ? <p className="error-message">{errorHistory}</p> : <PortfolioChart data={historyData} />}
      </div>

      {displayLoading ? <p>요약 정보를 불러오는 중...</p> : displayError ? <p className="error-message">{displayError}</p> : displayPortfolio && (
        <div className="portfolio-section">
          <h3>요약 ({getSeasonName()})</h3>
          <div className="summary-grid">
            <div className="summary-item"><p>총 자산</p><p className="value">{formatNumber(displayPortfolio.total_asset)}</p></div>
            <div className="summary-item"><p>총 손익</p><p className={`value ${displayPortfolio.profit_loss >= 0 ? 'positive' : 'negative'}`}>{formatNumber(displayPortfolio.profit_loss)}</p></div>
            <div className="summary-item"><p>총 수익률</p><p className={`value ${displayPortfolio.profit_rate >= 0 ? 'positive' : 'negative'}`}>{formatNumber(displayPortfolio.profit_rate, 'percent')}</p></div>
            <div className="summary-item"><p>보유 현금</p><p className="value">{formatNumber(displayPortfolio.cash)}</p></div>
          </div>
          {selectedSeason === currentSeasonId && (
            <>
              <h4>보유 자산 목록</h4>
              <div className="table-container">
                <table className="portfolio-table">
                  <thead><tr><th>종목</th><th>보유 수량</th><th>평단가</th><th>현재가</th><th>평가 금액</th><th>손익</th><th>수익률</th></tr></thead>
                  <tbody>
                    {displayPortfolio.holdings.filter(stock => stock.current_value >= 2).length > 0 ? (
                      displayPortfolio.holdings.filter(stock => stock.current_value >= 2).map((stock) => (
                        <tr key={stock.symbol}>
                          <td>{stock.symbol}</td><td>{formatNumber(stock.quantity, 'qty')}</td><td>{formatNumber(stock.avg_buy_price)}</td><td>{formatNumber(stock.current_price)}</td><td>{formatNumber(stock.current_value)}</td><td className={stock.profit_loss >= 0 ? 'positive' : 'negative'}>{formatNumber(stock.profit_loss)}</td><td className={stock.profit_rate >= 0 ? 'positive' : 'negative'}>{formatNumber(stock.profit_rate, 'percent')}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="7">보유 중인 자산이 없습니다.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      <div className="portfolio-section">
        <h3>{getSeasonName(true)} 거래 내역</h3>
        {loadingTx ? <p>거래 내역을 불러오는 중...</p> : errorTx ? <p className="error-message">{errorTx}</p> : transactions.length === 0 ? (<p>해당 시즌의 거래 내역이 없습니다.</p>) : (
          <div className="table-container">
            <table className="portfolio-table">
              <thead><tr><th>거래 시간</th><th>종목</th><th>구분</th><th>수량</th><th>거래 단가</th></tr></thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{formatDate(tx.trade_dt)}</td><td>{tx.asset_code}</td><td style={{ color: tx.type === 'buy' ? '#c0392b' : '#2980b9' }}>{tx.type === 'buy' ? '매수' : '매도'}</td><td>{formatNumber(tx.quantity, 'qty')}</td><td>{formatNumber(tx.trade_price, 'krw')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default PortfolioPage;

