// functions/src/admin.ts
// (이 파일은 'endSeason' 및 향후 추가될 관리자 함수들을 담당합니다)

import * as functions from "firebase-functions/v1";
import axios from "axios";
import {db} from "./index"; // index.ts에서 db, FieldValue 가져오기
import {getAuth} from "firebase-admin/auth";

// 이 함수들이 사용하는 상수
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

// [수정됨] API 키 확인 로직을 각 함수 내부로 이동 (배포 오류 수정)
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


// [UC-15] 시즌 마감 (관리자 기능) (수정본: 시즌 관리 기능 추가)
export const endSeason = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    if (!FINNHUB_API_KEY) {
      throw new functions.https.HttpsError("internal", "FINNHUB_API_KEY가 설정되지 않았습니다.");
    }
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "관리자 권한이 필요합니다.");
    }

    // 1. 관리자 여부 확인
    const callerRef = db.collection("users").doc(context.auth.uid);
    const callerDoc = await callerRef.get();
    if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "시즌을 마감할 관리자 권한이 없습니다.");
    }

    console.log("시즌 마감 로직 실행 시작...");

    const initialCapital = 10000000;
    const seasonRef = db.collection("seasons").doc("current");

    try {
      // --- 1. 현재 시즌 정보 가져오기 ---
      const seasonDoc = await seasonRef.get();
      let currentSeasonId = 1;
      if (seasonDoc.exists) {
        const data = seasonDoc.data();
        if (data && data.seasonId) {
          currentSeasonId = data.seasonId;
        }
      }

      // 문서가 없거나 필드가 유효하지 않으면 새로 생성
      if (!seasonDoc.exists || !seasonDoc.data()?.seasonId) {
        await seasonRef.set({seasonId: currentSeasonId, startDate: new Date()});
      }

      const newSeasonId = currentSeasonId + 1;

      // --- 2. 모든 사용자의 최종 랭킹 집계 및 자산 초기화 ---
      const usersSnapshot = await db.collection("users").get();
      const rankingData = [];

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        if (!userData) continue;

        const uid = userDoc.id;
        const userCash = userData.virtual_asset;

        // (A) 최종 자산 가치 계산
        const holdingsRef = userDoc.ref.collection("holdings");
        const holdingsSnapshot = await holdingsRef.get();
        let totalAssetValue = 0;

        if (!holdingsSnapshot.empty) {
          for (const holdingDoc of holdingsSnapshot.docs) {
            const holdingData = holdingDoc.data();
            const symbol = holdingData.asset_code;
            const quantity = holdingData.quantity;
            try {
              const apiResponse = await axios.get(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`);
              let currentPrice = apiResponse.data.c;
              if (!symbol.toUpperCase().endsWith(".KS")) {
                currentPrice *= EXCHANGE_RATE_USD_TO_KRW;
              }
              if (currentPrice > 0) {
                totalAssetValue += currentPrice * quantity;
              }
            } catch (apiError) {
              console.error(`API 오류 (사용자: ${uid}, 종목: ${symbol}):`, apiError);
            }
          }
        }
        const totalPortfolioValue = userCash + totalAssetValue;
        const profitLoss = totalPortfolioValue - initialCapital;
        const profitRate = ((totalPortfolioValue - initialCapital) / initialCapital) * 100;

        // [신규] 최종 보유 자산 목록 생성
        const finalHoldings = [];
        if (!holdingsSnapshot.empty) {
          for (const holdingDoc of holdingsSnapshot.docs) {
            const holdingData = holdingDoc.data();
            // ... (API 호출로 현재가 계산) ...
            // 이 예시에서는 단순화를 위해 저장된 데이터를 사용한다고 가정
            finalHoldings.push({
              symbol: holdingData.asset_code,
              quantity: holdingData.quantity,
              avg_buy_price: holdingData.avg_buy_price,
              // 'current_price' 등 최종 상태 정보 추가 필요
            });
          }
        }

        rankingData.push({
          uid: uid,
          nickname: userData.nickname,
          total_asset: totalPortfolioValue,
          profit_loss: profitLoss,
          profit_rate: profitRate,
          cash: userCash,
          holdings: finalHoldings,
        });

        // (B) 데이터 보존 및 초기화
        const batch = db.batch();

        // 사용자 거래내역(transactions)에 seasonId 추가
        const transRef = userDoc.ref.collection("transactions");
        const transSnapshot = await transRef.where("seasonId", "==", null).get(); // 시즌 ID가 없는 것만
        transSnapshot.forEach((doc) => {
          batch.update(doc.ref, {seasonId: currentSeasonId});
        });

        // 사용자 포트폴리오 기록(portfolio_history)에 seasonId 추가
        const portfolioRef = userDoc.ref.collection("portfolio_history");
        const portfolioSnapshot = await portfolioRef.where("seasonId", "==", null).get();
        portfolioSnapshot.forEach((doc) => {
          batch.update(doc.ref, {seasonId: currentSeasonId});
        });

        // 보유 주식(holdings) 삭제
        holdingsSnapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });

        // 유저 자산 및 퀴즈 상태 초기화
        batch.update(userDoc.ref, {
          virtual_asset: initialCapital,
          quiz_try_cnt: 0,
        });

        await batch.commit();
      }

      // --- 3. 명예의 전당(hall_of_fame)에 저장 ---
      // [수정] user_records에 모든 사용자 정보 저장
      const userRecords = rankingData.map((data) => ({
        uid: data.uid,
        nickname: data.nickname,
        final_asset: data.total_asset,
        profit_loss: data.profit_loss,
        profit_rate: data.profit_rate,
        final_cash: data.cash,
        final_holdings: data.holdings,
      }));

      userRecords.sort((a, b) => b.profit_rate - a.profit_rate);
      const topRankers = userRecords.slice(0, 10).map((user) => ({
        uid: user.uid,
        nickname: user.nickname,
        profit_rate: user.profit_rate,
      }));

      const hallOfFameRef = db.collection("hall_of_fame").doc(`season_${currentSeasonId}`);
      await hallOfFameRef.set({
        season_name: `시즌 ${currentSeasonId} (마감: ${new Date().toLocaleDateString("ko-KR")})`,
        top_rankers: topRankers,
        user_records: userRecords, // 모든 사용자 기록 저장
        endDate: new Date(),
      });

      // --- 4. 새 시즌 시작 ---
      await seasonRef.update({
        seasonId: newSeasonId,
        startDate: new Date(),
      });

      console.log(`시즌 ${currentSeasonId} 마감 완료. 새 시즌 ${newSeasonId} 시작.`);
      return {success: true, message: `시즌 ${currentSeasonId}이(가) 마감되었습니다.`};
    } catch (error) {
      console.error("시즌 마감 처리 오류:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "시즌 마감 처리에 실패했습니다.");
    }
  });

// [복원] 시즌 삭제 함수
export const deleteSeason = functions
  .runWith({timeoutSeconds: 540, memory: "1GB"})
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "관리자 권한이 필요합니다.");
    }
    const callerRef = db.collection("users").doc(context.auth.uid);
    const callerDoc = await callerRef.get();
    if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "시즌을 삭제할 관리자 권한이 없습니다.");
    }

    const {seasonIdToDelete} = data;
    if (typeof seasonIdToDelete !== "number" || seasonIdToDelete <= 0) {
      throw new functions.https.HttpsError("invalid-argument", "유효한 시즌 ID를 입력해야 합니다.");
    }

    console.log(`[v3] 시즌 ${seasonIdToDelete} 삭제 및 재정렬 작업 시작...`);

    try {
      const seasonRef = db.collection("seasons").doc("current");
      const currentSeasonDoc = await seasonRef.get();
      const currentSeasonId = currentSeasonDoc.exists ? currentSeasonDoc.data()?.seasonId : 1;

      if (seasonIdToDelete >= currentSeasonId) {
        throw new functions.https.HttpsError("failed-precondition", "현재 진행 중이거나 미래의 시즌은 삭제할 수 없습니다.");
      }

      const usersSnapshot = await db.collection("users").get();
      const collectionsToProcess = ["transactions", "portfolio_history"];

      // --- 1. 삭제할 시즌 데이터 정리 ---
      console.log(`명예의 전당 season_${seasonIdToDelete} 문서 삭제 중...`);
      await db.collection("hall_of_fame").doc(`season_${seasonIdToDelete}`).delete();

      for (const userDoc of usersSnapshot.docs) {
        for (const collectionName of collectionsToProcess) {
          const snapshot = await userDoc.ref.collection(collectionName).where("seasonId", "==", seasonIdToDelete).get();
          for (const doc of snapshot.docs) {
            await doc.ref.delete();
          }
        }
      }

      // --- 2. 후속 시즌들 재정렬 ---
      for (let oldSeasonId = seasonIdToDelete + 1; oldSeasonId < currentSeasonId; oldSeasonId++) {
        const newSeasonId = oldSeasonId - 1;
        console.log(`시즌 ${oldSeasonId} -> 시즌 ${newSeasonId} 재정렬 중...`);

        const oldHoFDocRef = db.collection("hall_of_fame").doc(`season_${oldSeasonId}`);
        const oldHoFDoc = await oldHoFDocRef.get();
        if (oldHoFDoc.exists) {
          const hofData = oldHoFDoc.data();
          if (hofData) {
            hofData.season_name = `시즌 ${newSeasonId} (마감: ${hofData.endDate.toDate().toLocaleDateString("ko-KR")})`;
            await db.collection("hall_of_fame").doc(`season_${newSeasonId}`).set(hofData);
            await oldHoFDocRef.delete();
          }
        }

        for (const userDoc of usersSnapshot.docs) {
          for (const collectionName of collectionsToProcess) {
            const snapshot = await userDoc.ref.collection(collectionName).where("seasonId", "==", oldSeasonId).get();
            for (const doc of snapshot.docs) {
              await doc.ref.update({seasonId: newSeasonId});
            }
          }
        }
      }

      // --- 3. 현재 시즌 ID 업데이트 ---
      console.log("현재 시즌 ID 업데이트 중...");
      const newCurrentSeasonId = currentSeasonId - 1;
      await seasonRef.update({seasonId: newCurrentSeasonId});

      // [추가] 모든 과거 시즌이 삭제되었는지 확인 후, 필요시 ID를 1로 초기화
      const allHoFSnapshot = await db.collection("hall_of_fame").get();
      if (allHoFSnapshot.empty) {
        console.log("모든 과거 시즌이 삭제되어, 시즌 ID를 1로 초기화합니다.");
        await seasonRef.set({seasonId: 1});
      }

      console.log(`시즌 ${seasonIdToDelete} 삭제 및 재정렬 작업 완료.`);
      return {success: true, message: `시즌 ${seasonIdToDelete}이(가) 성공적으로 삭제 및 재정렬되었습니다.`};
    } catch (error) {
      console.error(`시즌 ${seasonIdToDelete} 삭제 오류:`, error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError("internal", "시즌 삭제 작업에 실패했습니다.");
    }
  });
