// functions/src/quiz.ts
import * as functions from "firebase-functions/v1";
import {db, FieldValue} from "./index";

// [신규] 퀴즈 생성 함수
export const createQuiz = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    const callerDoc = await db.collection("users").doc(context.auth.uid).get();
    if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "관리자 권한이 없습니다.");
    }

    const {question, options, answerIndex} = data;
    if (!question || !options || options.length !== 4 || answerIndex === undefined) {
      throw new functions.https.HttpsError("invalid-argument", "퀴즈 데이터 형식이 올바르지 않습니다.");
    }

    try {
      await db.collection("quizzes").add({
        question,
        options,
        answer_index: answerIndex,
        createdAt: new Date(),
      });
      return {success: true, message: "퀴즈가 성공적으로 등록되었습니다."};
    } catch (error) {
      console.error("퀴즈 생성 오류:", error);
      throw new functions.https.HttpsError("internal", "퀴즈 생성 중 오류가 발생했습니다.");
    }
  });

// [신규] 퀴즈 삭제 함수
export const deleteQuiz = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    const callerDoc = await db.collection("users").doc(context.auth.uid).get();
    if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "관리자 권한이 없습니다.");
    }

    const {quizId} = data;
    if (!quizId) {
      throw new functions.https.HttpsError("invalid-argument", "퀴즈 ID가 필요합니다.");
    }

    try {
      await db.collection("quizzes").doc(quizId).delete();
      return {success: true, message: "퀴즈가 삭제되었습니다."};
    } catch (error) {
      console.error("퀴즈 삭제 오류:", error);
      throw new functions.https.HttpsError("internal", "퀴즈 삭제 중 오류가 발생했습니다.");
    }
  });

// [신규] 모든 퀴즈 정답 제출 및 보상 지급 함수
export const submitAllQuizAnswers = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const {answers} = data; // answers: [{ quizId, answerIndex }]
    const uid = context.auth.uid;

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      throw new functions.https.HttpsError("invalid-argument", "답변 데이터가 올바르지 않습니다.");
    }

    const userRef = db.collection("users").doc(uid);

    try {
      return await db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new functions.https.HttpsError("not-found", "사용자 정보를 찾을 수 없습니다.");
        }

        const userData = userDoc.data();
        if (!userData) {
          throw new functions.https.HttpsError("internal", "사용자 데이터를 읽을 수 없습니다.");
        }

        if (userData.quiz_try_cnt >= 2) {
          throw new functions.https.HttpsError("failed-precondition", "이미 2회 보상을 받으셨습니다.");
        }

        const quizIds = answers.map((a) => a.quizId);
        const quizRefs = quizIds.map((id) => db.collection("quizzes").doc(id));
        const quizDocs = await transaction.getAll(...quizRefs);

        let correctCount = 0;
        for (let i = 0; i < quizDocs.length; i++) {
          const quizDoc = quizDocs[i];
          const userAnswer = answers.find((a) => a.quizId === quizDoc.id);

          if (quizDoc.exists && userAnswer && quizDoc.data()?.answer_index === userAnswer.answerIndex) {
            correctCount++;
          }
        }

        if (correctCount === quizDocs.length) {
          const reward = 2000000; // 200만원
          transaction.update(userRef, {
            virtual_asset: FieldValue.increment(reward),
            quiz_try_cnt: FieldValue.increment(1),
          });
          return {success: true, message: `축하합니다! 모든 문제를 맞혀 ${reward.toLocaleString()}원이 지급되었습니다.`};
        } else {
          return {success: false, message: `오답이 있습니다. 총 ${quizDocs.length}문제 중 ${correctCount}문제를 맞혔습니다. 다시 도전해보세요.`};
        }
      });
    } catch (error) {
      console.error("퀴즈 제출 오류:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "퀴즈 제출 중 오류가 발생했습니다.");
    }
  });
