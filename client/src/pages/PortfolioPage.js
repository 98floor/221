// client/src/pages/PortfolioPage.js
import React, { useState, useEffect } from 'react';
import { functions } from '../firebase'; // firebase.js에서 functions 임포트
import { httpsCallable } from 'firebase/functions'; // httpsCallable 임포트

function PortfolioPage() {
  const [portfolio, setPortfolio] = useState(null); // 포트폴리오 데이터
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 페이지가 로드될 때 'getPortfolio' Cloud Function을 호출
    const fetchPortfolio = async () => {
      try {
        // 1. 'getPortfolio' 함수를 준비
        const getPortfolio = httpsCallable(functions, 'getPortfolio');

        // 2. 함수를 호출 (인증된 사용자만 가능)
        const result = await getPortfolio();

        // 3. 반환된 데이터(result.data)를 state에 저장
        setPortfolio(result.data); 

      } catch (err) {
        console.error("포트폴리오 조회 실패:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, []); // []는 페이지가 처음 렌더링될 때 한 번만 실행하라는 의미

  // 로딩 중일 때
  if (loading) {
    return <div>포트폴리오를 불러오는 중...</div>;
  }

  // 에러 발생 시
  if (error) {
    return <div>오류: {error} (로그인이 필요할 수 있습니다.)</div>;
  }

  // 헬퍼 함수: 숫자를 원화(KRW) 또는 퍼센트(%)로 포맷
  const formatNumber = (num, type = 'krw') => {
    if (type === 'krw') {
      return `${Math.round(num).toLocaleString('ko-KR')}원`;
    } else if (type === 'percent') {
      return `${num.toFixed(2)}%`;
    }
    return num;
  };

  // 성공적으로 데이터를 가져왔을 때
  return (
    <div>
      <h2>내 포트폴리오 (UC-6)</h2>

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
                    <td>{stock.quantity}</td>
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
    </div>
  );
}

export default PortfolioPage;