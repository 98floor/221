// functions/src/community.ts
// (이 파일은 'createPost', 'askChatbot' 2개 함수를 담당합니다)

import * as functions from "firebase-functions/v1";
import {db, FieldValue} from "./index"; // index.ts에서 db, FieldValue 가져오기
import {GoogleGenerativeAI} from "@google/generative-ai"; // 챗봇용 라이브러리

// --- Gemini API 설정 ---
const GEMINI_API_KEY = "KEY"; // 🚨 Gemini API 키
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({model: "gemini-2.5-flash"});

// [UC-9] 게시판 글 작성
export const createPost = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "인증된 사용자만 글을 작성할 수 있습니다.");
    }

    const {title, content} = data;
    const uid = context.auth.uid;

    if (!title || title.trim() === "") {
      throw new functions.https.HttpsError("invalid-argument", "제목을 입력해야 합니다.");
    }
    if (!content || content.trim() === "") {
      throw new functions.https.HttpsError("invalid-argument", "내용을 입력해야 합니다.");
    }

    try {
      const postData = {
        title: title,
        content: content,
        user_id: uid,
        created_at: FieldValue.serverTimestamp(),
      };

      await db.collection("posts").add(postData);

      return {success: true, message: "게시글이 성공적으로 등록되었습니다."};
    } catch (error) {
      console.error("게시글 작성(UC-9) 오류:", error);
      throw new functions.https.HttpsError("internal", "게시글 작성에 실패했습니다.");
    }
  });

// [UC-10] AI 챗봇에게 투자 관련 질문
export const askChatbot = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "인증된 사용자만 챗봇을 이용할 수 있습니다.");
    }

    const userPrompt = data.prompt;

    if (!userPrompt || userPrompt.trim() === "") {
      throw new functions.https.HttpsError("invalid-argument", "질문 내용을 입력해야 합니다.");
    }

    try {
      const fullPrompt = `
        당신은 "대학생 커뮤니티형 모의 투자 챌린지" 서비스의 AI 챗봇입니다. 
        당신의 역할은 대학생 초보 투자자에게 투자 용어, 시장 상황 등을 쉽고 친절하게 설명하는 것입니다.

        규칙:
        1. 항상 대학생에게 말하듯, 친절하고 이해하기 쉬운 말투를 사용하세요.
        2. 절대로 실제 금융 상품을 '추천'하거나 '매수/매도'를 권유하지 마세요.
        3. 답변은 항상 "모의 투자 학습"을 위한 참고용 정보임을 명시하세요.

        사용자 질문: ${userPrompt}
      `;

      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();

      return {success: true, answer: text};
    } catch (error) {
      console.error("Gemini API 호출(UC-10) 오류:", error);
      throw new functions.https.HttpsError("internal", "AI 챗봇 응답 생성에 실패했습니다.");
    }
  });
