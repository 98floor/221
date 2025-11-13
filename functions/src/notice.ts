// functions/src/notice.ts
import * as functions from "firebase-functions/v1";
import {db} from "./index";

export const createNotice = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    // 1. 호출자가 인증되었는지, 관리자인지 확인
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "이 기능을 실행하려면 로그인이 필요합니다."
      );
    }
    const callerUid = context.auth.uid;
    const callerRef = db.collection("users").doc(callerUid);
    const callerDoc = await callerRef.get();

    if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "공지사항을 작성할 관리자 권한이 없습니다."
      );
    }

    // 2. 데이터 유효성 검사
    const {title, content} = data;
    if (!title || !content) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "제목과 내용을 모두 입력해야 합니다."
      );
    }

    // 3. Firestore에 공지사항 저장
    try {
      const noticeData = {
        title,
        content,
        author: callerDoc.data()?.nickname || "관리자",
        authorId: callerUid,
        createdAt: new Date(),
      };

      await db.collection("notices").add(noticeData);

      return {success: true, message: "공지사항이 성공적으로 등록되었습니다."};
    } catch (error) {
      console.error("공지사항 작성 오류:", error);
      throw new functions.https.HttpsError("internal", "공지사항 작성 중 오류가 발생했습니다.");
    }
  });
