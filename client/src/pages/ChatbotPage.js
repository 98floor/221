// client/src/pages/ChatbotPage.js
import React, { useState } from 'react';
import { functions } from '../firebase'; // functions 임포트
import { httpsCallable } from 'firebase/functions'; // httpsCallable 임포트

function ChatbotPage() {
  const [prompt, setPrompt] = useState(''); // 사용자가 입력한 질문

  // 채팅 내역을 저장할 배열 state
  // (예: { role: 'user', content: '안녕?' }, { role: 'bot', content: '안녕하세요!' })
  const [messages, setMessages] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // [UC-10] 질문 제출 함수
  const handleSubmitPrompt = async () => {
    if (prompt.trim() === '') return; // 빈 질문은 무시

    setLoading(true);
    setError(null);

    // 1. 사용자 질문을 채팅 내역에 먼저 추가
    const userMessage = { role: 'user', content: prompt };
    setMessages(prevMessages => [...prevMessages, userMessage]);

    const currentPrompt = prompt; // 현재 질문 저장 (state 초기화 전)
    setPrompt(''); // 입력창 비우기

    try {
      // 2. 'askChatbot' Cloud Function 호출
      const askChatbot = httpsCallable(functions, 'askChatbot');
      const result = await askChatbot({ prompt: currentPrompt });

      // 3. 챗봇의 답변을 채팅 내역에 추가
      const botMessage = { role: 'bot', content: result.data.answer };
      setMessages(prevMessages => [...prevMessages, botMessage]);

    } catch (err) {
      console.error("챗봇 응답 실패:", err);
      setError(err.message);
      // 4. 에러 발생 시 에러 메시지를 채팅 내역에 추가
      const errorMessage = { role: 'bot', content: `오류: ${err.message}` };
      setMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>AI 챗봇에게 질문 (UC-10)</h2>

      {/* --- 채팅 내역 표시 --- */}
      <div style={{ 
        height: '400px', 
        border: '1px solid #ccc', 
        padding: '10px', 
        overflowY: 'auto', // 스크롤 가능하게
        marginBottom: '10px' 
      }}>
        {messages.length === 0 ? (
          <p style={{ color: '#888' }}>
            궁금한 투자 용어를 질문해보세요. (예: PBR이 뭐야?)
          </p>
        ) : (
          messages.map((msg, index) => (
            <div key={index} style={{ 
              textAlign: msg.role === 'user' ? 'right' : 'left', // 사용자/봇 정렬
              marginBottom: '10px' 
            }}>
              <span style={{
                background: msg.role === 'user' ? '#DCF8C6' : '#F0F0F0',
                padding: '8px 12px',
                borderRadius: '10px',
                display: 'inline-block'
              }}>
                {msg.content}
              </span>
            </div>
          ))
        )}
        {/* 로딩 중일 때 "입력 중..." 표시 */}
        {loading && (
          <div style={{ textAlign: 'left', marginBottom: '10px' }}>
            <span style={{
              background: '#F0F0F0',
              padding: '8px 12px',
              borderRadius: '10px',
              display: 'inline-block',
              color: '#888'
            }}>
              AI 챗봇이 입력 중...
            </span>
          </div>
        )}
      </div>

      {/* --- 질문 입력 UI --- */}
      <div style={{ display: 'flex' }}>
        <input 
          type="text" 
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !loading && handleSubmitPrompt()} // Enter 키로 전송
          placeholder="질문을 입력하세요..."
          style={{ flexGrow: 1, padding: '10px' }}
          disabled={loading} // 로딩 중 비활성화
        />
        <button 
          onClick={handleSubmitPrompt} 
          disabled={loading} // 로딩 중 비활성화
          style={{ padding: '10px 15px' }}
        >
          전송
        </button>
      </div>

      {error && (
        <p style={{ color: 'red', marginTop: '10px' }}>
          오류가 발생했습니다. (자세한 내용은 채팅창 확인)
        </p>
      )}
    </div>
  );
}

export default ChatbotPage;