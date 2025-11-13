// client/src/pages/MarketPage.js
import React, { useState } from 'react';
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import Chart from 'react-apexcharts';
import { Grid, Box, Typography, Tabs, Tab } from '@mui/material';
import MarketOrderForm from '../components/MarketOrderForm';
import LimitOrderForm from '../components/LimitOrderForm';
import OpenOrders from '../components/OpenOrders';

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function MarketPage() {
  const [searchInput, setSearchInput] = useState('AAPL');
  const [chartOptions, setChartOptions] = useState({});
  const [chartSeries, setChartSeries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSearched, setIsSearched] = useState(false);
  const [activeSymbol, setActiveSymbol] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [currentPrice, setCurrentPrice] = useState(null); // 현재가 상태 추가

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleSearch = async () => {
    if (searchInput.trim() === '') return setError("종목 코드를 입력해주세요.");
    setLoading(true);
    setError(null);
    setChartSeries([]);
    setIsSearched(true);
    setActiveSymbol('');
    setCurrentPrice(null); // 검색 시 현재가 초기화

    try {
      const getMarketData = httpsCallable(functions, 'getMarketData');
      const result = await getMarketData({ symbol: searchInput.toUpperCase() });
      const apiData = result.data.data;
      const timeSeries = apiData["Time Series (Daily)"];
      const fetchedSymbol = result.data.symbol;

      if (!timeSeries) throw new Error(apiData["Note"] || `[${fetchedSymbol}] 종목의 데이터를 찾을 수 없습니다.`);
      
      setActiveSymbol(fetchedSymbol);

      const chartData = Object.keys(timeSeries).map(date => ({
        x: new Date(date),
        y: [
          parseFloat(timeSeries[date]["1. open"]),
          parseFloat(timeSeries[date]["2. high"]),
          parseFloat(timeSeries[date]["3. low"]),
          parseFloat(timeSeries[date]["4. close"])
        ]
      })).sort((a, b) => a.x.getTime() - b.x.getTime());

      setChartSeries([{ name: 'Candle', data: chartData }]);
      setChartOptions({
        chart: { type: 'candlestick', height: 450 },
        title: { text: `${fetchedSymbol} 100일 일봉 차트`, align: 'left' },
        xaxis: { type: 'datetime' },
        yaxis: { tooltip: { enabled: true }, labels: { formatter: val => "$" + val.toFixed(2) } }
      });

      // 최신 종가 설정
      if (chartData.length > 0) {
        setCurrentPrice(chartData[chartData.length - 1].y[3]); // 마지막 데이터의 종가
      }

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
      {currentPrice !== null && (
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
          현재가: {currentPrice.toLocaleString()} $
        </Typography>
      )}
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
          {/* Chart Display Logic */}
          {!loading && chartSeries.length > 0 ? (
            <Chart options={chartOptions} series={chartSeries} type="candlestick" height={450} />
          ) : (
            <Box sx={{ height: 450, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f4f4' }}>
              <Typography color="textSecondary">
                {loading ? '차트 데이터를 불러오는 중...' : '종목 코드를 검색하면 차트가 표시됩니다.'}
              </Typography>
            </Box>
          )}
        </Grid>
        <Grid item xs={12} md={4}>
          <Box sx={{ border: '1px solid #ddd', borderRadius: 1 }}>
            <Tabs value={tabValue} onChange={handleTabChange} centered>
              <Tab label="시장가" />
              <Tab label="지정가" />
              <Tab label="미체결" />
            </Tabs>
            <TabPanel value={tabValue} index={0}>
              <MarketOrderForm symbol={activeSymbol} />
            </TabPanel>
            <TabPanel value={tabValue} index={1}>
              <LimitOrderForm symbol={activeSymbol} />
            </TabPanel>
            <TabPanel value={tabValue} index={2}>
              <OpenOrders />
            </TabPanel>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

export default MarketPage;