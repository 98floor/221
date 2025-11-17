import React, { useState, useEffect, useRef } from 'react';
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import './ChatbotPage.css';

function ChatbotPage() {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const chatWindowRef = useRef(null);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSubmitPrompt = async (e) => {
    e.preventDefault();
    if (prompt.trim() === '') return;

    setLoading(true);
    const userMessage = { role: 'user', content: prompt };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    const currentPrompt = prompt;
    setPrompt('');

    try {
      const askChatbot = httpsCallable(functions, 'askChatbot');
      const result = await askChatbot({ prompt: currentPrompt });
      const botMessage = { role: 'bot', content: result.data.answer };
      setMessages(prevMessages => [...prevMessages, botMessage]);
    } catch (err) {
      console.error("챗봇 응답 실패:", err);
      const errorMessage = { role: 'bot', content: `오류: ${err.message}` };
      setMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chatbot-container">
      <div className="chatbot-header">
        <h2>AI 챗봇에게 질문</h2>
      </div>
      <div className="chat-window" ref={chatWindowRef}>
        {messages.length === 0 && !loading ? (
          <div className="message-bubble message-bot">
            <p className="message-content">궁금한 투자 용어를 질문해보세요. (예: PBR이 뭐야?)</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`message-bubble ${msg.role === 'user' ? 'message-user' : 'message-bot'}`}>
              <p className="message-content">{msg.content}</p>
            </div>
          ))
        )}
        {loading && (
          <div className="message-bubble message-bot">
            <p className="message-content">AI 챗봇이 입력 중...</p>
          </div>
        )}
      </div>
      <form onSubmit={handleSubmitPrompt} className="chat-input-form">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !loading && handleSubmitPrompt(e)}
          placeholder="질문을 입력하세요..."
          disabled={loading}
        />
        <button type="submit" disabled={loading}>전송</button>
      </form>
    </div>
  );
}

export default ChatbotPage;