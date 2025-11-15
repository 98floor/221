// client/src/components/FavoritesList.js
import React, { useState, useEffect, useCallback } from 'react';
import { functions, auth } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { Box, Typography, Table, TableContainer, TableBody, TableCell, TableHead, TableRow, Skeleton } from '@mui/material';
import { onAuthStateChanged } from 'firebase/auth';

// 헬퍼 함수
const getColor = (num) => (num > 0 ? 'green' : num < 0 ? 'red' : 'black');
const formatPercent = (num) => (num || num === 0 ? `${num.toFixed(2)}%` : '-');
const formatPrice = (num) => (num || num === 0 ? `${Math.round(num).toLocaleString('ko-KR')}` : '-');

// 1단계에서 만든 Cloud Functions
const getFavoritesList = httpsCallable(functions, 'getFavoritesList');
// MarketPage가 이미 사용 중인 함수 재사용
const getStockQuote = httpsCallable(functions, 'getStockQuote');

/**
 * 즐겨찾기 목록 컴포넌트
 * Props:
 * - onFavoriteClick(symbol): 목록의 항목을 클릭했을 때 호출될 함수
 * - refreshTrigger: 즐겨찾기 추가/삭제 시 부모가 이 값을 변경하여 목록 새로고침
 */
function FavoritesList({ onFavoriteClick, refreshTrigger }) {
  const [list, setList] = useState([]); // [{symbol, name, price, changePercent}]
  const [loading, setLoading] = useState(true);

  // 즐겨찾기 목록과 가격 정보를 모두 가져오는 함수
  const fetchFavoritesData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. 즐겨찾기 목록(심볼, 이름) 가져오기
      const result = await getFavoritesList(); // {success, favorites: [{symbol, name}]}
      if (!result.data.success) throw new Error("Failed to get favorites list");
      const favs = result.data.favorites; 

      if (favs.length === 0) {
        setList([]);
        setLoading(false);
        return;
      }

      // 2. 목록의 모든 종목에 대해 현재가/변동률 병렬 조회
      const pricePromises = favs.map(fav => 
        getStockQuote({ symbol: fav.symbol })
          .catch(err => ({ data: { success: false, symbol: fav.symbol } })) // 개별 오류 처리
      );
      const priceResults = await Promise.all(pricePromises);

      // 3. (이름 + 가격) 데이터 합치기
      const combinedList = favs.map((fav, index) => {
        const priceData = priceResults[index].data;
        return {
          symbol: fav.symbol,
          name: fav.name,
          price: priceData.success ? priceData.price : null,
          changePercent: priceData.success ? priceData.changePercent : null,
        };
      });
      
      setList(combinedList);
    } catch (err) {
      console.error("Error fetching favorites data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 1. 인증 상태 변경(로그인/로그아웃) 시 목록 새로고침
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchFavoritesData();
      } else {
        setList([]); // 로그아웃 시 목록 비우기
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [fetchFavoritesData]);

  // 2. 부모(MarketPage)가 refreshTrigger를 변경(즐겨찾기 추가/삭제) 시 목록 새로고침
  useEffect(() => {
    if (auth.currentUser) {
      fetchFavoritesData();
    }
  }, [refreshTrigger, fetchFavoritesData]);

  return (
    <Box sx={{ border: '1px solid #eee', borderRadius: 1, mt: 2 }}>
      <Typography variant="h6" sx={{ p: 2, borderBottom: '1px solid #eee' }}>
        관심 종목
      </Typography>
      <TableContainer sx={{ maxHeight: 400, overflowY: 'auto' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{backgroundColor: '#f9f9f9'}}>종목명</TableCell>
              <TableCell align="right" sx={{backgroundColor: '#f9f9f9'}}>현재가</TableCell>
              <TableCell align="right" sx={{backgroundColor: '#f9f9f9'}}>전일대비</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              // 로딩 스켈레톤
              [...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={3}>
                    <Skeleton variant="rounded" height={20} />
                  </TableCell>
                </TableRow>
              ))
            )}
            {!loading && list.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  즐겨찾는 종목이 없습니다.
                </TableCell>
              </TableRow>
            )}
            {!loading && list.map((item) => (
              <TableRow 
                key={item.symbol} 
                onClick={() => onFavoriteClick(item.symbol)} // 클릭 시 부모 함수 호출
                sx={{ '&:hover': { backgroundColor: '#f5f5f5' }, cursor: 'pointer' }}
              >
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{item.name}</Typography>
                  <Typography variant="caption" color="textSecondary">{item.symbol}</Typography>
                </TableCell>
                <TableCell align="right" sx={{ color: getColor(item.changePercent) }}>
                  {formatPrice(item.price)}
                </TableCell>
                <TableCell align="right" sx={{ color: getColor(item.changePercent) }}>
                  {formatPercent(item.changePercent)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default FavoritesList;