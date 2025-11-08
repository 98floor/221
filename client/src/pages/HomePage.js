// client/src/pages/HomePage.js
import React from 'react';
import { Box, Grid, Typography, Button } from '@mui/material';
import { Link } from 'react-router-dom';

//  1. App.js로부터 currentUser prop을 받기
function HomePage({ currentUser }) {
  return (
    <Box sx={{ width: '100%', overflowX: 'hidden', padding: 3 }}>
      <Grid 
        container 
        spacing={2} 
        sx={{ 
          flexWrap: 'nowrap', 
          minWidth: '900px',
        }}
      >

        {/* --- 1. 왼쪽 컨텐츠 (소개 문구) --- */}
        <Grid item xs={5}> 
          <Box 
            sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'center', 
              height: '100%',
              minHeight: '300px',
              minWidth: '400px', 
            }}
          >
            <Typography variant="h3" component="h1" gutterBottom sx={{ 
              whiteSpace: 'nowrap' 
            }}>
              대학생 커뮤니티형
            </Typography>
            <Typography variant="h3" component="h1" gutterBottom sx={{ 
              fontWeight: 'bold', 
              color: '#1976d2', 
              whiteSpace: 'nowrap' 
            }}>
              모의 투자 챌린지
            </Typography>
            <Typography variant="body1" sx={{ 
              marginY: 2, 
              whiteSpace: 'nowrap' 
            }}>
              실제 투자 시장의 위험 없이, 대학생들과 안전한 환경에서 
              실전 투자 경험을 쌓고 금융 지식을 학습하세요.
            </Typography>
            <Box sx={{ marginTop: 2 }}>

              {/* --- '거래소 둘러보기' 버튼 --- */}
              <Button 
                component={Link} 
                to="/market" 
                variant="contained" 
                size="large" 
                sx={{ 
                  marginRight: 2,
                  backgroundColor: '#1E3A8A', 
                  color: 'white',
                  '&:hover': {
                     backgroundColor: '#1C3274',
                  }
                }}
              >
                거래소 둘러보기
              </Button>

              {/* ---  2. 로그아웃 상태일 때만 로그인 버튼 표시 --- */}
              {!currentUser && (
                <Button 
                  component={Link} 
                  to="/login" 
                  variant="contained" 
                  size="large"
                  color="primary"
                >
                  로그인
                </Button>
              )}

            </Box>
          </Box>
        </Grid>

        {/* --- 2. 오른쪽 컨텐츠 (이미지 크기 고정) --- */}
        <Grid item xs={7}> 
          <Box 
            component="img" 
            src="/images/home-banner.png"
            alt="Univest Challenge Banner"
            sx={{ 
              height: '400px', 
              minWidth: '500px', 
              width: '500px', 
              objectFit: 'contain', 
              objectPosition: 'right', 
              borderRadius: 2,
            }}
          />
        </Grid>

      </Grid>
    </Box>
  );
}

export default HomePage;