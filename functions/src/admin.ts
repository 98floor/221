// functions/src/admin.ts
// (이 파일은 'endSeason' 및 향후 추가될 관리자 함수들을 담당합니다)

import * as functions from "firebase-functions/v1";
import axios from "axios";
import {db} from "./index"; // index.ts에서 db, FieldValue 가져오기

// 이 함수들이 사용하는 상수
const FINNHUB_API_KEY = "KEY"; //Finnhub API 키
const EXCHANGE_RATE_USD_TO_KRW = 1445;

// [UC-15] 시즌 마감 (관리자 기능) (최종 수정본: 환율 적용 + 보유 종목 초기화 + 랭킹 초기화 + Null 검사)
export const endSeason = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
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
