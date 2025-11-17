// functions/src/quests.ts
import * as functions from "firebase-functions/v1";
import {db} from "./index";

export const getQuestStatus = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "인증된 사용자만 호출할 수 있습니다.");
    }
    const uid = context.auth.uid;

    try {
      const userRef = db.collection("users").doc(uid);
      const questRef = userRef.collection("quest_progress").doc("summary");

      const userDoc = await userRef.get();
      const questDoc = await questRef.get();

      if (!userDoc.exists) {
        throw new functions.https.HttpsError("not-found", "사용자 정보를 찾을 수 없습니다.");
      }

      const badge = userDoc.data()?.badge || null;
      let questProgress;

      if (questDoc.exists) {
        questProgress = questDoc.data();
      } else {
        // 퀘스트 진행 상황이 없으면, 기본 초기 상태를 반환
        questProgress = {
          beginner_status: "in_progress",
          intermediate_status: "locked",
          advanced_status: "locked",
          ox_correct_answers: 0,
          profit_rate_achieved: false,
        };
      }

      // "포트폴리오 3개 이상 보유" 퀘스트 현황 표시를 위해 현재 보유 종목 수 조회
      const holdingsSnapshot = await userRef.collection("holdings").get();
      const portfolioDiversity = holdingsSnapshot.size;

      return {
        success: true,
        badge,
        progress: {
          ...questProgress,
          portfolio_diversity: portfolioDiversity,
        },
      };
    } catch (error) {
      console.error("퀘스트 상태 조회 오류:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "퀘스트 상태 조회에 실패했습니다.");
    }
  });
