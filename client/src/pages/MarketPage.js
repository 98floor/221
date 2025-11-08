// client/src/pages/MarketPage.js
import React, { useState } from 'react';
// functions, httpsCallable을 다시 임포트
import { functions } from '../firebase'; 
import { httpsCallable } from 'firebase/functions';
import Chart from 'react-apexcharts'; // ApexCharts 임포트

// Grid, Box, Typography 임포트
import { Grid, Box, Typography } from '@mui/material';
import OrderForm from '../components/OrderForm'; 

function MarketPage() {
  const [searchInput, setSearchInput] = useState('AAPL'); 

  const [chartOptions, setChartOptions] = useState({});
  const [chartSeries, setChartSeries] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSearched, setIsSearched] = useState(false); 

  const [activeSymbol, setActiveSymbol] = useState(''); 

  // [수정됨] handleSearch (Alpha Vantage API 호출)
  const handleSearch = async () => {
    if (searchInput.trim() === '') {
      setError("종목 코드를 입력해주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    setChartSeries([]); 
    setIsSearched(true); 
    setActiveSymbol(''); 

    try {
      // 'getMarketData' 함수를 다시 호출
      const getMarketData = httpsCallable(functions, 'getMarketData');

      const result = await getMarketData({ 
        symbol: searchInput.toUpperCase() 
      }); 

      // --- 1. Alpha Vantage 데이터 구조 파싱 ---
      const apiData = result.data.data;
      const timeSeries = apiData["Time Series (Daily)"]; 
      const fetchedSymbol = result.data.symbol;

      if (!timeSeries) {
        throw new Error(apiData["Note"] || `[${fetchedSymbol}] 종목의 데이터를 찾을 수 없습니다.`);
      }

      setActiveSymbol(fetchedSymbol);

      // --- 2. 차트 데이터 가공 ---
      const chartData = Object.keys(timeSeries).map(date => {
        const dailyData = timeSeries[date];
        return {
          x: new Date(date), 
          y: [
            parseFloat(dailyData["1. open"]),
            parseFloat(dailyData["2. high"]),
            parseFloat(dailyData["3. low"]),
            parseFloat(dailyData["4. close"])
          ]
        };
      });
      chartData.sort((a, b) => a.x.getTime() - b.x.getTime());

      // 3. 차트 시리즈(데이터) 설정
      setChartSeries([
        {
          name: 'Candle',
          data: chartData,
        },
      ]);

      // 4. 차트 옵션 설정
      setChartOptions({
        chart: {
          type: 'candlestick',
          height: 450
        },
        title: {
          text: `${fetchedSymbol} 100일 일봉 차트 (Alpha Vantage)`,
          align: 'left'
        },
        xaxis: {
          type: 'datetime' 
        },
        yaxis: {
          tooltip: {
            enabled: true
          },
          labels: {
            formatter: function (val) {
              return "$" + val.toFixed(2); // USD로 표시
            }
          }
        }
      });

    } catch (err) {
      console.error("시세 조회 실패:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box> 
      <h2>시장 현황판 (UC-3)</h2>

      {/* --- 검색 UI --- */}
      <div style={{ display: 'flex', marginBottom: '20px' }}>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !loading && handleSearch()}
          placeholder="종목 코드 입력 (예: AAPL, MSFT, 005930.KS)"
          style={{ flexGrow: 1, padding: '10px' }}
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          style={{ padding: '10px 15px' }}
        >
          {loading ? '검색 중...' : '검색'}
        </button>
      </div>

      {error && (
        <div style={{ color: 'red', marginBottom: '10px' }}>
          오류: {error}
        </div>
      )}

      {/* --- 2단 레이아웃 (Grid) --- */}
      <Grid container spacing={2}>

        {/* --- 1. 왼쪽 컨텐츠 (ApexCharts) --- */}
        <Grid item xs={12} md={8}>
          {loading && (
            <div>차트 데이터를 불러오는 중...</div>
          )}
          {error && (
            <div style={{ color: 'red' }}>오류: {error}</div>
          )}
          {!loading && !error && isSearched && chartSeries.length === 0 && (
            <div>검색 결과가 없습니다.</div>
          )}
          {!loading && !error && chartSeries.length > 0 ? (
            <div id="chart">
              <Chart 
                options={chartOptions} 
                series={chartSeries} 
                type="candlestick" 
                height={450} 
              />
            </div>
          ) : (
            !loading && !error && !isSearched && (
              <Box sx={{ height: 450, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f4f4', borderRadius: 1 }}>
                <Typography color="textSecondary">
                  종목 코드를 검색하면 차트가 표시됩니다.
                </Typography>
              </Box>
            )
          )}
        </Grid>

        {/* --- 2. 오른쪽 컨텐츠 (주문 폼) --- */}
        <Grid item xs={12} md={4}>
          <OrderForm symbol={activeSymbol} />
        </Grid>

      </Grid>
    </Box>
  );
}

export default MarketPage;