// client/src/components/NewsList.js
import React, { useState, useEffect } from 'react';
import { functions, auth } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { Box, Typography, Link, Skeleton, Divider } from '@mui/material';

// 1단계에서 만든 Cloud Function
const getStockNews = httpsCallable(functions, 'getStockNews');

function NewsList({ symbol }) {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // 1. 심볼이 없거나 로그인 상태가 아니면 실행 안 함
        if (!symbol || !auth.currentUser) {
            setNews([]);
            return;
        }

        setLoading(true);

        getStockNews({ symbol })
            .then(result => {
                if (result.data.success) {
                    setNews(result.data.news);
                }
            })
            .catch(err => {
                console.error("뉴스 로딩 실패:", err);
                setNews([]); // 오류 시 비우기
            })
            .finally(() => {
                setLoading(false);
            });

    }, [symbol]); // symbol이 바뀔 때마다 (새로 검색할 때마다) 새로 실행

    return (
        <Box sx={{ border: '1px solid #eee', borderRadius: 1, mt: 2 }}>
            <Typography variant="h6" sx={{ p: 2, borderBottom: '1px solid #eee' }}>
                주요 뉴스
            </Typography>
            <Box sx={{ p: 2, maxHeight: 300, overflowY: 'auto' }}>
                {loading && (
                    [...Array(3)].map((_, i) => <Skeleton key={i} variant="text" sx={{ mb: 1 }} />)
                )}

                {!loading && news.length === 0 && (
                    <Typography variant="body2" color="textSecondary" align="center">
                        이 종목에 대한 최신 뉴스가 없습니다.
                    </Typography>
                )}

                {!loading && news.map((item, index) => (
                    <React.Fragment key={item.id || index}>
                        <Box sx={{ mb: 1 }}>
                            <Link
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                variant="body2"
                                underline="hover"
                                sx={{
                                    fontWeight: 'bold',
                                    // CSS 방식 대신 JS 방식으로 텍스트를 자르므로
                                    // '...' 스타일 속성은 제거합니다.
                                }}
                            >
                                
                                {item.headline.length > 55
                                    ? `${item.headline.substring(0, 55)}...`
                                    : item.headline}
                            </Link>
                            <Typography variant="caption" display="block" color="textSecondary">
                                {item.source} - {new Date(item.datetime * 1000).toLocaleDateString('ko-KR')}
                            </Typography>
                        </Box>
                        {index < news.length - 1 && <Divider sx={{ my: 1 }} />}
                    </React.Fragment>
                ))}
            </Box>
        </Box>
    );
}

export default NewsList;