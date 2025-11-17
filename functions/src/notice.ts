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

export const getRecentNotices = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    try {
      const noticesSnapshot = await db.collection("notices")
        .orderBy("createdAt", "desc")
        .limit(5)
        .get();

      if (noticesSnapshot.empty) {
        return { success: true, notices: [] };
      }

      const notices = noticesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Firestore Timestamp를 ISO 문자열로 변환
        createdAt: doc.data().createdAt.toDate().toISOString(),
      }));

      return { success: true, notices: notices };
    } catch (error) {
      console.error("최신 공지사항 조회 오류:", error);
      throw new functions.https.HttpsError("internal", "최신 공지사항을 불러오는 중 오류가 발생했습니다.");
    }
  });

export const deleteNotice = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    // 1. Check if user is an admin
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Authentication is required to perform this action."
      );
    }
    const callerDoc = await db.collection("users").doc(context.auth.uid).get();
    if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only admins can delete notices."
      );
    }

    // 2. Validate the input data
    const { noticeId } = data;
    if (!noticeId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "The function must be called with one argument 'noticeId'."
      );
    }

    // 3. Delete the notice document from Firestore
    try {
      await db.collection("notices").doc(noticeId).delete();
      return { success: true, message: "Notice deleted successfully." };
    } catch (error) {
      console.error("Error deleting notice:", error);
      throw new functions.https.HttpsError(
        "internal",
        "An error occurred while trying to delete the notice."
      );
    }
  });
