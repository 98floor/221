// functions/src/debate.ts
import * as functions from "firebase-functions/v1";
import {db} from "./index";

// [신규] 토론 주제 생성 함수
export const createDebate = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    const callerDoc = await db.collection("users").doc(context.auth.uid).get();
    if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "관리자 권한이 없습니다.");
    }

    const {topic} = data;
    if (!topic) throw new functions.https.HttpsError("invalid-argument", "토론 주제를 입력해야 합니다.");

    try {
      await db.collection("debates").add({
        topic,
        pros: 0,
        cons: 0,
        voters: {}, // 투표자 기록용 맵
        status: "progressing", // 진행 상태 추가
        createdAt: new Date(),
      });
      return {success: true, message: "토론 주제가 성공적으로 등록되었습니다."};
    } catch (error) {
      console.error("토론 주제 생성 오류:", error);
      throw new functions.https.HttpsError("internal", "토론 주제 생성 중 오류가 발생했습니다.");
    }
  });

// [신규] 토론 주제 삭제 함수
export const deleteDebate = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    const callerDoc = await db.collection("users").doc(context.auth.uid).get();
    if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "관리자 권한이 없습니다.");
    }

    const {debateId} = data;
    if (!debateId) throw new functions.https.HttpsError("invalid-argument", "토론 ID가 필요합니다.");

    try {
      await db.collection("debates").doc(debateId).delete();
      return {success: true, message: "토론 주제가 삭제되었습니다."};
    } catch (error) {
      console.error("토론 주제 삭제 오류:", error);
      throw new functions.https.HttpsError("internal", "토론 주제 삭제 중 오류가 발생했습니다.");
    }
  });

// [신규] 토론 투표 함수
export const voteOnDebate = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");

    const {debateId, vote} = data;
    const uid = context.auth.uid;

    if (!debateId || !["pros", "cons"].includes(vote)) {
      throw new functions.https.HttpsError("invalid-argument", "필요한 데이터가 올바르지 않습니다.");
    }

    const debateRef = db.collection("debates").doc(debateId);

    try {
      await db.runTransaction(async (transaction) => {
        const debateDoc = await transaction.get(debateRef);
        if (!debateDoc.exists) {
          throw new functions.https.HttpsError("not-found", "토론 주제를 찾을 수 없습니다.");
        }

        const debateData = debateDoc.data();
        if (!debateData) {
          throw new functions.https.HttpsError("internal", "토론 데이터를 읽을 수 없습니다.");
        }
        const voters = debateData.voters || {};

        if (voters[uid]) {
          throw new functions.https.HttpsError("already-exists", "이미 이 주제에 투표했습니다.");
        }

        const newVoters = {...voters, [uid]: vote};
        const newPros = vote === "pros" ? (debateData.pros || 0) + 1 : debateData.pros;
        const newCons = vote === "cons" ? (debateData.cons || 0) + 1 : debateData.cons;

        transaction.update(debateRef, {
          pros: newPros,
          cons: newCons,
          voters: newVoters,
        });
      });

      return {success: true, message: `투표가 성공적으로 반영되었습니다. 당신은 ${vote === "pros" ? "찬성" : "반대"}에 투표했습니다.`};
    } catch (error) {
      console.error("투표 처리 오류:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "투표 처리에 실패했습니다.");
    }
  });
