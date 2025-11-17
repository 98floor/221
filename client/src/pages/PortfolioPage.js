// client/src/pages/PortfolioPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { functions, db } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, query, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import PortfolioChart from '../components/PortfolioChart';

const formatDate = (timestamp) => {
  if (timestamp && timestamp.toDate) {
    return timestamp.toDate().toLocaleString('ko-KR');
  }
  if (typeof timestamp === 'string') {
    return new Date(timestamp).toLocaleString('ko-KR');
  }
  return '날짜 정보 없음';
};

const formatNumber = (num, type = 'krw') => {
  if (typeof num !== 'number') return num;
  if (type === 'krw') {
    return `${Math.round(num).toLocaleString('ko-KR')}원`;
  } else if (type === 'percent') {
    return `${num.toFixed(2)}%`;
  } else if (type === 'qty') {
    return `${parseFloat(num.toFixed(4)).toLocaleString('ko-KR')}주`;
  }
  return num;
};

function PortfolioPage() {
  // State declarations
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

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const seasonsQuery = query(collection(db, "hall_of_fame"), orderBy("endDate", "desc"));
        const seasonDocRef = doc(db, "seasons", "current");
        
        const [snapshot, currentSeasonDoc] = await Promise.all([getDocs(seasonsQuery), getDoc(seasonDocRef)]);

        const seasonData = snapshot.docs.map(doc => ({
          id: parseInt(doc.id.split('_')[1]),
          name: doc.data().season_name,
        }));
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
        setPortfolio(result.data);
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

    try {
      // [수정] 두 함수를 동시에 호출하여 성능 개선
      const getPortfolioHistory = httpsCallable(functions, 'getPortfolioHistory');
      const getTransactionHistory = httpsCallable(functions, 'getTransactionHistory');

      const [historyResult, txResult] = await Promise.all([
        getPortfolioHistory({ seasonId }),
        getTransactionHistory({ seasonId })
      ]);

      if (historyResult.data.success) {
        setHistoryData(historyResult.data.history);
      } else {
        throw new Error(historyResult.data.error || "자산 변동 내역 조회 실패");
      }

      if (txResult.data.success) {
        setTransactions(txResult.data.transactions);
      } else {
        throw new Error(txResult.data.error || "거래 내역 조회 실패");
      }
    } catch (err) {
      // [수정] 상세 오류 로깅
      console.error("데이터 조회 실패 상세 정보:", err); 
      const errorMessage = err.message || "알 수 없는 오류가 발생했습니다.";
      setErrorHistory(errorMessage);
      setErrorTx(errorMessage);
    } finally {
      setLoadingHistory(false);
      setLoadingTx(false);
    }
  }, []);

  useEffect(() => {
    fetchDataForSeason(selectedSeason);
  }, [selectedSeason, fetchDataForSeason]);

  const getSeasonName = () => {
    if (selectedSeason === null) return '시즌 정보 로딩 중...';
    if (selectedSeason === currentSeasonId) return '현재 시즌';
    const season = seasons.find(s => s.id === selectedSeason);
    return season ? season.name : `시즌 ${selectedSeason}`;
  };

  if (loadingPortfolio || loadingSeasons) {
    return <div>포트폴리오를 불러오는 중...</div>;
  }
  if (errorPortfolio) {
    return <div>오류: {errorPortfolio} (로그인이 필요할 수 있습니다.)</div>;
  }

  return (
    <div>
      <h2>내 자산</h2>
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="season-select"><strong>기록 조회 시즌 선택: </strong></label>
        <select
          id="season-select"
          value={selectedSeason ?? ''}
          onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
          disabled={loadingSeasons || selectedSeason === null}
        >
          {currentSeasonId && <option value={currentSeasonId}>현재 시즌</option>}
          {seasons.map(season => (
            <option key={season.id} value={season.id}>{season.name}</option>
          ))}
        </select>
      </div>
      <hr />
      <h3>{getSeasonName()} 자산 변동 그래프</h3>
      {loadingHistory ? <p>그래프 데이터 로딩 중...</p> : errorHistory ? <p style={{color: 'red'}}>오류: {errorHistory}</p> : <PortfolioChart data={historyData} />}
      <hr style={{marginTop: '40px'}} />
      {portfolio && (
        <div>
          <h3>요약 (현재 기준)</h3>
          <p><strong>총 자산: </strong>{formatNumber(portfolio.total_asset)}</p>
          <p><strong>총 손익: </strong><span style={{ color: portfolio.profit_loss >= 0 ? 'green' : 'red' }}>{formatNumber(portfolio.profit_loss)}</span></p>
          <p><strong>총 수익률: </strong><span style={{ color: portfolio.profit_rate >= 0 ? 'green' : 'red' }}>{formatNumber(portfolio.profit_rate, 'percent')}</span></p>
          <p><strong>보유 현금: </strong>{formatNumber(portfolio.cash)}</p>
          <hr />
          <h3>보유 자산 목록 (현재 기준)</h3>
          {(() => {
            const filteredHoldings = portfolio.holdings.filter(stock => stock.current_value >= 2);
            return filteredHoldings.length > 0 ? (
              <table border="1" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                <thead><tr><th>종목</th><th>보유 수량</th><th>평단가</th><th>현재가</th><th>평가 금액</th><th>손익</th><th>수익률</th></tr></thead>
                <tbody>
                  {filteredHoldings.map((stock) => (
                    <tr key={stock.symbol}>
                      <td>{stock.symbol}</td><td>{formatNumber(stock.quantity, 'qty')}</td><td>{formatNumber(stock.avg_buy_price)}</td><td>{formatNumber(stock.current_price)}</td><td>{formatNumber(stock.current_value)}</td><td style={{ color: stock.profit_loss >= 0 ? 'green' : 'red' }}>{formatNumber(stock.profit_loss)}</td><td style={{ color: stock.profit_rate >= 0 ? 'green' : 'red' }}>{formatNumber(stock.profit_rate, 'percent')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (<p>보유 중인 자산이 없습니다.</p>);
          })()}
        </div>
      )}
      <hr style={{marginTop: '40px'}} />
      <h3>{getSeasonName()} 거래 내역</h3>
      {loadingTx ? <p>거래 내역을 불러오는 중...</p> : errorTx ? <p style={{ color: 'red' }}>오류: {errorTx}</p> : !loadingTx && transactions.length === 0 ? (<p>해당 시즌의 거래 내역이 없습니다.</p>) : (
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <table border="1" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
            <thead><tr><th>거래 시간</th><th>종목</th><th>구분</th><th>수량</th><th>거래 단가</th></tr></thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td>{formatDate(tx.trade_dt)}</td><td>{tx.asset_code}</td><td style={{ color: tx.type === 'buy' ? 'red' : 'blue' }}>{tx.type === 'buy' ? '매수' : '매도'}</td><td>{formatNumber(tx.quantity, 'qty')}</td><td>{formatNumber(tx.trade_price, 'krw')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default PortfolioPage;
