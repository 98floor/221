// functions/src/admin.ts
// (이 파일은 'endSeason' 및 향후 추가될 관리자 함수들을 담당합니다)

import * as functions from "firebase-functions/v1";
import axios from "axios";
import {db} from "./index"; // index.ts에서 db, FieldValue 가져오기
import {getAuth} from "firebase-admin/auth";

// 이 함수들이 사용하는 상수
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

// 🔽 [수정됨] 파일 로드 시 즉시 실행되던 API 키 확인 로직 제거
// if (!FINNHUB_API_KEY) {
//   throw new Error("FINNHUB_API_KEY가 .env 파일에 설정되지 않았습니다.");
// }
const EXCHANGE_RATE_USD_TO_KRW = 1445;

// [신규] 관리자 지정 함수
export const setAdminRole = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    // 1. 호출자가 인증되었는지 확인
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "이 기능을 실행하려면 로그인이 필요합니다."
      );
    }
    const callerUid = context.auth.uid;

    // 2. 호출자의 Firestore 문서를 읽어 관리자인지 확인
    const callerRef = db.collection("users").doc(callerUid);
    const callerDoc = await callerRef.get();
    if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "이 기능을 실행할 관리자 권한이 없습니다."
      );
    }

    const {email} = data;
    if (!email) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "관리자로 지정할 사용자의 이메일을 입력해야 합니다."
      );
    }

    try {
      // 3. 이메일로 사용자 조회
      const userRecord = await getAuth().getUserByEmail(email);
      const uid = userRecord.uid;

      // 4. Firestore 'users' 컬렉션에 역할 업데이트
      const userRef = db.collection("users").doc(uid);
      await userRef.update({role: "admin"});

      return {success: true, message: `${email} 사용자가 관리자로 지정되었습니다.`};
    } catch (error) {
      console.error("관리자 지정 오류:", error);
      // 'error'가 'code' 속성을 가진 객체인지 확인 (타입 가드)
      if (typeof error === "object" && error !== null && "code" in error && (error as {code: unknown}).code === "auth/user-not-found") {
        throw new functions.https.HttpsError("not-found", "해당 이메일을 가진 사용자를 찾을 수 없습니다.");
      }
      throw new functions.https.HttpsError("internal", "관리자 지정에 실패했습니다.");
    }
  });

// [신규] 모든 사용자 목록 가져오기
export const listAllUsers = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    // 1. 호출자가 관리자인지 확인
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const callerRef = db.collection("users").doc(context.auth.uid);
    const callerDoc = await callerRef.get();
    if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "관리자 권한이 없습니다.");
    }

    try {
      const listUsersResult = await getAuth().listUsers(1000); // 최대 1000명
      const users = listUsersResult.users.map((userRecord) => {
        return {
          uid: userRecord.uid,
          email: userRecord.email,
          disabled: userRecord.disabled,
          creationTime: userRecord.metadata.creationTime,
        };
      });
      return {success: true, users};
    } catch (error) {
      console.error("모든 사용자 목록 가져오기 오류:", error);
      throw new functions.https.HttpsError("internal", "사용자 목록을 가져오는 데 실패했습니다.");
    }
  });

// [신규] 사용자 계정 정지/활성화 토글
export const toggleUserSuspension = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    // 1. 호출자가 관리자인지 확인
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const callerRef = db.collection("users").doc(context.auth.uid);
    const callerDoc = await callerRef.get();
    if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "관리자 권한이 없습니다.");
    }

    const {uid, suspend} = data;
    if (!uid) {
      throw new functions.https.HttpsError("invalid-argument", "사용자 UID가 필요합니다.");
    }

    try {
      // 2. Firebase Auth에서 사용자 비활성화/활성화
      await getAuth().updateUser(uid, {disabled: suspend});

      // 3. Firestore 문서 상태 업데이트
      const userRef = db.collection("users").doc(uid);
      await userRef.update({status: suspend ? "suspended" : "active"});

      const action = suspend ? "정지" : "활성화";
      return {success: true, message: `사용자 계정이 ${action}되었습니다.`};
    } catch (error) {
      console.error("사용자 계정 정지/활성화 오류:", error);
      throw new functions.https.HttpsError("internal", "작업에 실패했습니다.");
    }
  });


// [UC-15] 시즌 마감 (관리자 기능) (최종 수정본: 환율 적용 + 보유 종목 초기화 + 랭킹 초기화 + Null 검사)
export const endSeason = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    // 🔽 [수정됨] API 키 확인 로직을 함수 내부로 이동
    if (!FINNHUB_API_KEY) {
      throw new functions.https.HttpsError("internal", "FINNHUB_API_KEY가 설정되지 않았습니다.");
    }

    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "관리자 권한이 필요합니다.");
    }

    console.log("시즌 마감(UC-15) 로직 실행 시작...");

    const initialCapital = 10000000;

    try {
      // --- 1. 모든 사용자의 최종 랭킹 집계 및 자산 초기화 (동시 진행) ---
      const usersSnapshot = await db.collection("users").get();

      const endSeasonPromises = usersSnapshot.docs.map(async (userDoc) => {
        const userData = userDoc.data();
        if (!userData) return null; // null 반환

        const uid = userDoc.id;
        const userCash = userData["virtual_asset"];

        // (A) 최종 랭킹 계산 (환율 적용)
        const holdingsRef = userDoc.ref.collection("holdings");
        const holdingsSnapshot = await holdingsRef.get();
        let totalAssetValue = 0;

        if (!holdingsSnapshot.empty) {
          const holdingPromises = holdingsSnapshot.docs.map(async (holdingDoc) => {
            const holdingData = holdingDoc.data();
            if (!holdingData) return;
            const symbol = holdingData["asset_code"];
            const quantity = holdingData["quantity"];
            try {
              const apiResponse = await axios.get(
                `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
              );
              let currentPrice = apiResponse.data.c;
              if (!symbol.toUpperCase().endsWith(".KS")) {
                currentPrice *= EXCHANGE_RATE_USD_TO_KRW;
              }
              if (currentPrice > 0) {
                totalAssetValue += currentPrice * quantity;
              }
            } catch (apiError) {
              // (API 오류는 무시)
            }
          });
          await Promise.all(holdingPromises);
        }
        const totalPortfolioValue = userCash + totalAssetValue;
        const profitRate = ((totalPortfolioValue - initialCapital) / initialCapital) * 100;

        // (B) 자산 초기화 ...
        const batch = db.batch();
        holdingsSnapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });
        batch.update(userDoc.ref, {
          virtual_asset: initialCapital,
          quiz_try_cnt: 0,
        });
        await batch.commit();

        // (C) 랭킹 데이터 반환
        return {
          uid: uid,
          nickname: userData["nickname"],
          profit_rate: profitRate,
        };
      });

      // --- 2. 명예의 전당(hall_of_fame)에 저장 ---
      const rankingData = (await Promise.all(endSeasonPromises));

      // 랭킹 정렬 (Null 안전 코드)
      rankingData.sort((a, b) => {
        if (!a) return 1;
        if (!b) return -1;
        return b.profit_rate - a.profit_rate;
      });

      const topRankers = rankingData.filter(Boolean).slice(0, 10);

      const seasonId = `season_${new Date().getTime()}`;
      const hallOfFameRef = db.collection("hall_of_fame").doc(seasonId);
      await hallOfFameRef.set({
        season_name: `시즌 (마감: ${new Date().toLocaleDateString("ko-KR")})`,
        top_rankers: topRankers,
      });

      // --- 3. 랭킹 페이지 초기화 ---
      const rankingRef = db.collection("ranking").doc("current_season");
      await rankingRef.delete();

      console.log("시즌 마감(UC-15) 성공적으로 완료.");
      return {success: true, message: `시즌이 마감되었습니다. (ID: ${seasonId})`};
    } catch (error) {
      console.error("시즌 마감(UC-15) 오류:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "시즌 마감 처리에 실패했습니다.");
    }
  });
