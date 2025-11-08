// functions/src/user.ts
import * as functions from "firebase-functions/v1";
import {db, FieldValue} from "./index"; // index.ts에서 db, FieldValue 가져오기

// [UC-1] 회원가입 (프로필 생성)
// (이 로직은 RegisterPage.js가 직접 setDoc을 호출하는 방식)

// 이메일 인증 완료 후 최초 로그인 시, 계정을 활성화하는 함수
export const activateAccount = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "인증된 사용자만 호출할 수 있습니다.");
    }

    // 1. 토큰에서 이메일 인증 여부 재확인
    if (!context.auth.token.email_verified) {
      throw new functions.https.HttpsError("failed-precondition", "이메일 인증이 완료되지 않았습니다.");
    }

    const uid = context.auth.uid;
    const userRef = db.collection("users").doc(uid);

    try {
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        throw new functions.https.HttpsError("not-found", "사용자 프로필을 찾을 수 없습니다.");
      }

      const userData = userDoc.data();
      if (!userData) {
        throw new functions.https.HttpsError("internal", "사용자 데이터를 읽을 수 없습니다.");
      }

      // 2. 이미 활성화되었는지(자본을 받았는지) 확인
      if (userData["status"] === "active") {
        return {success: true, message: "이미 활성화된 계정입니다."};
      }

      // 3. 'pending_verification' 상태를 'active'로 변경하고 초기 자본 지급
      await userRef.update({
        status: "active",
        virtual_asset: 10000000, // 초기 자본 1,000만원
        quiz_try_cnt: 0,
      });

      return {success: true, message: "계정이 활성화되었습니다. 1,000만원이 지급되었습니다."};
    } catch (error) {
      console.error("계정 활성화(UC-1) 오류:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "계정 활성화에 실패했습니다.");
    }
  });


// [UC-11] 패자부활전 퀴즈: 1단계 (자격 검사)
export const checkQuizEligibility = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    // ... (이하 퀴즈 로직은 동일) ...
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "인증된 사용자만 호출할 수 있습니다.");
    }
    const uid = context.auth.uid;
    const initialCapital = 10000000;
    try {
      const userRef = db.collection("users").doc(uid);
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        throw new functions.https.HttpsError("not-found", "사용자 정보를 찾을 수 없습니다.");
      }
      const userData = userDoc.data();
      if (!userData) {
        throw new functions.https.HttpsError("internal", "사용자 데이터를 읽을 수 없습니다.");
      }
      const userCash = userData["virtual_asset"];
      const tryCount = userData["quiz_try_cnt"];
      console.log("테스트용 임시 로그:", {userCash, initialCapital});
      const isEligibleAsset = true;
      const isEligibleCount = tryCount < 2;
      if (isEligibleAsset && isEligibleCount) {
        return {eligible: true};
      } else if (!isEligibleAsset) {
        return {eligible: false, reason: "자산이 10% 이상 남아있어 참여할 수 없습니다."};
      } else {
        return {eligible: false, reason: "이미 2회 보상을 받으셨습니다."};
      }
    } catch (error) {
      console.error("퀴즈 자격 검사(UC-11) 오류:", error);
      throw new functions.https.HttpsError("internal", "퀴즈 자격 검사에 실패했습니다.");
    }
  });

// [UC-11] 패자부활전 퀴즈: 2단계 (정답 제출)
export const submitQuizAnswer = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    // ... (이하 퀴즈 로직은 동일) ...
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "인증된 사용자만 호출할 수 있습니다.");
    }
    const {quizId, answerIndex} = data;
    const uid = context.auth.uid;
    try {
      const userRef = db.collection("users").doc(uid);
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        throw new functions.https.HttpsError("not-found", "사용자 정보를 찾을 수 없습니다.");
      }
      const userData = userDoc.data();
      if (!userData) {
        throw new functions.https.HttpsError("internal", "사용자 데이터를 읽을 수 없습니다.");
      }
      if (userData["quiz_try_cnt"] >= 2) {
        throw new functions.https.HttpsError("failed-precondition", "이미 2회 보상을 받으셨습니다.");
      }
      const quizRef = db.collection("quizzes").doc(quizId);
      const quizDoc = await quizRef.get();
      if (!quizDoc.exists) {
        throw new functions.https.HttpsError("not-found", "퀴즈 문제를 찾을 수 없습니다.");
      }
      const quizData = quizDoc.data();
      if (!quizData) {
        throw new functions.https.HttpsError("internal", "퀴즈 데이터를 읽을 수 없습니다.");
      }
      const correctAnswerIndex = quizData["answer_index"];
      if (answerIndex === correctAnswerIndex) {
        const reward = 10000000 * 0.2; // 200만원
        const newCash = userData["virtual_asset"] + reward;
        await userRef.update({
          virtual_asset: newCash,
          quiz_try_cnt: FieldValue.increment(1),
        });
        return {correct: true, message: "정답입니다! 200만원이 지급되었습니다."};
      } else {
        return {correct: false, message: "오답입니다. 정답을 맞출 때까지 다시 시도해보세요."};
      }
    } catch (error) {
      console.error("퀴즈 제출(UC-11) 오류:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "퀴즈 제출에 실패했습니다.");
    }
  });
