// functions/src/debate.ts
import * as functions from "firebase-functions/v1";
import {db, FieldValue} from "./index";

// 토론 주제 생성 함수
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
        o_votes: 0,
        x_votes: 0,
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

// 토론 주제 삭제 함수
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

// 토론 투표 함수
export const voteOnDebate = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");

    const {debateId, vote} = data;
    const uid = context.auth.uid;

    if (!debateId || !["O", "X"].includes(vote)) {
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

        if (debateData.status === "closed") {
          throw new functions.https.HttpsError("failed-precondition", "이미 마감된 예측입니다.");
        }

        const voters = debateData.voters || {};

        if (voters[uid]) {
          throw new functions.https.HttpsError("already-exists", "이미 이 주제에 투표했습니다.");
        }

        const newVoters = {...voters, [uid]: vote};
        const newOVotes = vote === "O" ? (debateData.o_votes || 0) + 1 : debateData.o_votes;
        const newXVotes = vote === "X" ? (debateData.x_votes || 0) + 1 : debateData.x_votes;

        transaction.update(debateRef, {
          o_votes: newOVotes,
          x_votes: newXVotes,
          voters: newVoters,
        });
      });

      return {success: true, message: `투표가 성공적으로 반영되었습니다. 당신은 '${vote}'에 투표했습니다.`};
    } catch (error) {
      console.error("투표 처리 오류:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "투표 처리에 실패했습니다.");
    }
  });

// 토론 마감 및 보상 지급 함수
export const closeDebate = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    // 1. 관리자 권한 확인
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const callerDoc = await db.collection("users").doc(context.auth.uid).get();
    if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "관리자 권한이 없습니다.");
    }

    const {debateId, correctAnswer} = data;
    if (!debateId || !["O", "X"].includes(correctAnswer)) {
      throw new functions.https.HttpsError("invalid-argument", "필요한 데이터(debateId, correctAnswer)가 올바르지 않습니다.");
    }

    const debateRef = db.collection("debates").doc(debateId);
    const rewardAmount = 100000; // 보상금 10만원

    try {
      const debateDoc = await debateRef.get();
      if (!debateDoc.exists) {
        throw new functions.https.HttpsError("not-found", "해당 토론을 찾을 수 없습니다.");
      }
      const debateData = debateDoc.data();
      if (!debateData) {
        throw new functions.https.HttpsError("internal", "토론 데이터를 읽을 수 없습니다.");
      }
      if (debateData.status === "closed") {
        throw new functions.https.HttpsError("failed-precondition", "이미 마감된 토론입니다.");
      }

      // 2. 정답자와 참여자 목록 추출
      const voters = debateData.voters || {};
      const winnerUids: string[] = [];
      for (const uid in voters) {
        if (voters[uid] === correctAnswer) {
          winnerUids.push(uid);
        }
      }

      // 3. 보상 지급 (Batch Write 사용)
      if (winnerUids.length > 0) {
        const batch = db.batch();
        winnerUids.forEach((uid) => {
          const userRef = db.collection("users").doc(uid);
          batch.update(userRef, {virtual_asset: FieldValue.increment(rewardAmount)});
        });
        await batch.commit();
      }

      // 4. 토론 상태를 'closed'로 변경하고 정답 기록
      await debateRef.update({
        status: "closed",
        correctAnswer: correctAnswer,
      });

      return {success: true, message: `토론이 마감되었습니다. ${winnerUids.length}명에게 ${rewardAmount.toLocaleString()}원씩 지급되었습니다.`};
    } catch (error) {
      console.error("토론 마감 처리 오류:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "토론 마감 처리에 실패했습니다.");
    }
  });
