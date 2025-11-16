// client/src/pages/PortfolioPage.js
import React, { useState, useEffect } from 'react';
import { functions, db, auth } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import PortfolioChart from '../components/PortfolioChart'; // [신규] 차트 컴포넌트 임포트

// [신규] 헬퍼 함수: Firestore Timestamp 객체를 날짜 문자열로 변환
const formatDate = (timestamp) => {
  if (timestamp) {
    return timestamp.toDate().toLocaleString('ko-KR');
  }
  return '날짜 정보 없음';
};

// [신규] 헬퍼 함수: 숫자를 원화(KRW) 또는 퍼센트(%)로 포맷
const formatNumber = (num, type = 'krw') => {
  if (type === 'krw') {
    return `${Math.round(num).toLocaleString('ko-KR')}원`;
  } else if (type === 'percent') {
    return `${num.toFixed(2)}%`;
  } else if (type === 'qty') {
    // [신규] 소수점 4자리까지 수량 표시
    return `${parseFloat(num.toFixed(4)).toLocaleString('ko-KR')}주`;
  }
  return num;
};

function PortfolioPage() {
  const [portfolio, setPortfolio] = useState(null);
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);
  const [errorPortfolio, setErrorPortfolio] = useState(null);

  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [errorTx, setErrorTx] = useState(null);

  // [신규] 차트 데이터 state
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [errorHistory, setErrorHistory] = useState(null);

  useEffect(() => {
    // 1. 포트폴리오(보유 자산) 조회
    const fetchPortfolio = async () => {
      try {
        const getPortfolio = httpsCallable(functions, 'getPortfolio');
        const result = await getPortfolio();
        setPortfolio(result.data);
      } catch (err) {
        console.error("포트폴리오 조회 실패:", err);
        setErrorPortfolio(err.message);
      } finally {
        setLoadingPortfolio(false);
      }
    };

    // [신규] 2. 자산 변동 내역 조회
    const fetchHistory = async () => {
      try {
        const getPortfolioHistory = httpsCallable(functions, 'getPortfolioHistory');
        const result = await getPortfolioHistory();
        if (result.data.success) {
          setHistoryData(result.data.history);
        } else {
          throw new Error("History data fetching failed.");
        }
      } catch (err) {
        console.error("자산 변동 내역 조회 실패:", err);
        setErrorHistory(err.message);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchPortfolio();
    fetchHistory();

    // 3. 전체 거래 내역 (all_time_transactions) 실시간 조회
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        setLoadingTx(true);
        const txCollectionRef = collection(db, "users", user.uid, "all_time_transactions");
        const q = query(txCollectionRef, orderBy("trade_dt", "desc"));

        const unsubscribeSnapshot = onSnapshot(q, (querySnapshot) => {
          const txData = [];
          querySnapshot.forEach((doc) => {
            txData.push({ id: doc.id, ...doc.data() });
          });
          setTransactions(txData);
          setLoadingTx(false);
        }, (err) => {
          console.error("전체 거래 내역 조회 실패:", err);
          setErrorTx(err.message);
          setLoadingTx(false);
        });
        
        return () => unsubscribeSnapshot();
      } else {
        setLoadingTx(false);
        setTransactions([]);
      }
    });

    return () => unsubscribe();

  }, []);

  // 로딩 중일 때
  if (loadingPortfolio || loadingHistory) {
    return <div>포트폴리오를 불러오는 중...</div>;
  }

  // 에러 발생 시
  if (errorPortfolio || errorHistory) {
    return <div>오류: {errorPortfolio || errorHistory} (로그인이 필요할 수 있습니다.)</div>;
  }

  return (
    <div>
      <h2>내 포트폴리오 (UC-6)</h2>

      {/* --- [신규] 자산 변동 그래프 --- */}
      <h3>자산 변동 그래프</h3>
      <PortfolioChart data={historyData} />
      <hr style={{marginTop: '40px'}} />
      {/* --- 그래프 끝 --- */}

      {portfolio ? (
        <div>
          <h3>요약</h3>
          <p>
            <strong>총 자산: </strong> 
            {formatNumber(portfolio.total_asset)}
          </p>
          <p>
            <strong>총 손익: </strong> 
            <span style={{ color: portfolio.profit_loss >= 0 ? 'green' : 'red' }}>
              {formatNumber(portfolio.profit_loss)}
            </span>
          </p>
          <p>
            <strong>총 수익률: </strong> 
            <span style={{ color: portfolio.profit_rate >= 0 ? 'green' : 'red' }}>
              {formatNumber(portfolio.profit_rate, 'percent')}
            </span>
          </p>
          <p>
            <strong>보유 현금: </strong> 
            {formatNumber(portfolio.cash)}
          </p>

          <hr />

          <h3>보유 자산 목록</h3>
          {portfolio.holdings.length > 0 ? (
            <table border="1" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>종목</th>
                  <th>보유 수량</th>
                  <th>평단가</th>
                  <th>현재가</th>
                  <th>평가 금액</th>
                  <th>손익</th>
                  <th>수익률</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.holdings.map((stock) => (
                  <tr key={stock.symbol}>
                    <td>{stock.symbol}</td>
                    <td>{formatNumber(stock.quantity, 'qty')}</td>
                    <td>{formatNumber(stock.avg_buy_price)}</td>
                    <td>{formatNumber(stock.current_price)}</td>
                    <td>{formatNumber(stock.current_value)}</td>
                    <td style={{ color: stock.profit_loss >= 0 ? 'green' : 'red' }}>
                      {formatNumber(stock.profit_loss)}
                    </td>
                    <td style={{ color: stock.profit_rate >= 0 ? 'green' : 'red' }}>
                      {formatNumber(stock.profit_rate, 'percent')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>보유 중인 자산이 없습니다.</p>
          )}
        </div>
      ) : (
        <p>데이터를 불러오지 못했습니다.</p>
      )}

      <hr style={{marginTop: '40px'}} />
      <h3>전체 거래 내역 (영구 보관)</h3>
      {loadingTx && <p>전체 거래 내역을 불러오는 중...</p>}
      {errorTx && <p style={{ color: 'red' }}>오류: {errorTx}</p>}
      
      {!loadingTx && !errorTx && transactions.length === 0 && (
        <p>거래 내역이 없습니다.</p>
      )}

      {transactions.length > 0 && (
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <table border="1" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>거래 시간</th>
                <th>종목</th>
                <th>구분</th>
                <th>수량</th>
                <th>거래 단가</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td>{formatDate(tx.trade_dt)}</td>
                  <td>{tx.asset_code}</td>
                  <td style={{ color: tx.type === 'buy' ? 'red' : 'blue' }}>
                    {tx.type === 'buy' ? '매수' : '매도'}
                  </td>
                  <td>{formatNumber(tx.quantity, 'qty')}</td>
                  <td>{formatNumber(tx.trade_price, 'krw')}</td>
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