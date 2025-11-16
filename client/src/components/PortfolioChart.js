// client/src/components/PortfolioChart.js
import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Box, Typography, Paper } from '@mui/material';

// 툴팁에 표시될 숫자 포맷
const formatNumber = (num, type = 'krw') => {
  if (type === 'krw') {
    return `${Math.round(num).toLocaleString('ko-KR')}원`;
  }
  return `${num.toFixed(2)}%`;
};

// 커스텀 툴팁 컴포넌트
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <Paper elevation={3} sx={{ padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.9)' }}>
        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
          {new Date(label).toLocaleString('ko-KR')}
        </Typography>
        <Typography variant="body2" sx={{ color: 'blue' }}>
          {`총 자산: ${formatNumber(data.totalAsset, 'krw')}`}
        </Typography>
        <Typography variant="body2" sx={{ color: data.profitRate >= 0 ? 'green' : 'red' }}>
          {`수익률: ${formatNumber(data.profitRate, 'percent')}`}
        </Typography>
      </Paper>
    );
  }
  return null;
};

function PortfolioChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <Box sx={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="textSecondary">자산 변동 기록이 없습니다.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: 400, width: '100%' }}>
      <ResponsiveContainer>
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(timeStr) => new Date(timeStr).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
          />
          <YAxis
            yAxisId="left"
            dataKey="totalAsset"
            tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
            stroke="#8884d8"
          />
          <YAxis
            yAxisId="right"
            dataKey="profitRate"
            orientation="right"
            tickFormatter={(value) => `${value.toFixed(0)}%`}
            stroke="#82ca9d"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="totalAsset"
            name="총 자산"
            stroke="#8884d8"
            activeDot={{ r: 8 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="profitRate"
            name="수익률"
            stroke="#82ca9d"
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}

export default PortfolioChart;
