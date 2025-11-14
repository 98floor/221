// client/src/components/TradingViewWidget.js
import React, { useEffect, useRef, memo } from 'react';

function TradingViewWidget({ symbol }) {
  const container = useRef(null);

  useEffect(() => {
    // 컴포넌트가 화면에 마운트되어 있는지 추적하는 변수
    let isMounted = true;

    const createWidget = () => {
      // 컴포넌트가 언마운트되었거나, 컨테이너 ref가 없거나, TradingView 스크립트가 로드되지 않았으면 실행 중단
      if (!isMounted || !container.current || typeof window.TradingView === 'undefined') {
        return;
      }
      
      // 이전 위젯이 있다면 내용 비우기
      container.current.innerHTML = '';
      
      // 새 위젯 생성
      new window.TradingView.widget({
        autosize: true,
        symbol: symbol,
        interval: "D",
        timezone: "Etc/UTC",
        theme: "light",
        style: "1",
        locale: "kr",
        enable_publishing: false,
        allow_symbol_change: true,
        // 위젯을 삽입할 컨테이너의 DOM ID를 지정
        container_id: container.current.id 
      });
    };

    // TradingView 스크립트가 이미 페이지에 로드되어 있고, window.TradingView 객체가 사용 가능하다면 바로 위젯 생성
    if (document.getElementById('tradingview-widget-script') && typeof window.TradingView !== 'undefined') {
      createWidget();
    } else {
      // 스크립트가 없다면 새로 생성하여 페이지에 추가
      const script = document.createElement("script");
      script.id = 'tradingview-widget-script';
      script.src = "https://s3.tradingview.com/tv.js";
      script.type = "text/javascript";
      script.async = true;
      // 스크립트 로드가 완료되면 위젯 생성 함수 호출
      script.onload = createWidget; 
      document.body.appendChild(script);
    }

    // cleanup 함수: 컴포넌트가 언마운트되거나, symbol이 바뀌어 useEffect가 다시 실행되기 직전에 호출됨
    return () => {
      isMounted = false;
      // 컨테이너의 내용을 비워 위젯을 정리
      if (container.current) {
        container.current.innerHTML = '';
      }
    };
  }, [symbol]); // symbol prop이 변경될 때마다 이 로직을 다시 실행

  // 위젯 컨테이너의 ID를 동적으로 설정하여 여러 위젯 간 충돌 방지
  const widgetContainerId = `tradingview-widget-container-${symbol || 'default'}`;

  return (
    <div 
      ref={container} 
      id={widgetContainerId} // 동적 ID 할당
      style={{ height: "500px", width: "100%" }} 
    />
  );
}

export default memo(TradingViewWidget);