// functions/src/community.ts
// (이 파일은 'createPost', 'askChatbot' 2개 함수를 담당합니다)

import * as functions from "firebase-functions/v1";
import {db, FieldValue} from "./index"; // index.ts에서 db, FieldValue 가져오기
import {GoogleGenerativeAI} from "@google/generative-ai"; // 챗봇용 라이브러리

// --- Gemini API 설정 ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 🔽 [수정됨] 파일 로드 시 즉시 실행되던 API 키 확인 로직 제거
// if (!GEMINI_API_KEY) {
//   throw new Error("GEMINI_API_KEY가 .env 파일에 설정되지 않았습니다.");
// }

// 🔽 [수정됨] genAI와 model을 즉시 초기화하지 않고, 필요할 때 초기화하도록 변경
// const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// const model = genAI.getGenerativeModel({model: "gemini-2.0-flash-lite"});

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

// [신규] 관리자 게시물 삭제 함수
export const deletePost = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    // 1. 관리자 확인
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    const callerDoc = await db.collection("users").doc(context.auth.uid).get();
    if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "관리자 권한이 없습니다.");
    }

    // 2. 데이터 유효성 검사
    const {postId} = data;
    if (!postId) {
      throw new functions.https.HttpsError("invalid-argument", "게시물 ID가 필요합니다.");
    }

    // 3. Firestore에서 게시물 삭제
    try {
      await db.collection("posts").doc(postId).delete();
      return {success: true, message: "게시물이 삭제되었습니다."};
    } catch (error) {
      console.error("게시물 삭제 오류:", error);
      throw new functions.https.HttpsError("internal", "게시물 삭제 중 오류가 발생했습니다.");
    }
  });

// [UC-10] AI 챗봇에게 투자 관련 질문
export const askChatbot = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    // 🔽 [수정됨] API 키 확인 및 Gemini 클라이언트 초기화를 함수 내부로 이동
    if (!GEMINI_API_KEY) {
      throw new functions.https.HttpsError("internal", "GEMINI_API_KEY가 설정되지 않았습니다.");
    }

    // 🔽 [수정됨] API 키가 있을 때만 genAI와 model을 초기화
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({model: "gemini-2.0-flash-lite"});

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
        4. 항상 한 문장으로 간단히 말해.

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
