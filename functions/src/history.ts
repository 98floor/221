// functions/src/history.ts
import * as functions from "firebase-functions/v1";
import {db, FieldValue} from "./index";
import axios from "axios";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const EXCHANGE_RATE_USD_TO_KRW = 1445;
const INITIAL_CAPITAL = 10000000;

/**
 * 사용자의 자산 변동을 감지하여 portfolio_history에 기록하는 Firestore 트리거
 */
export const recordPortfolioHistory = functions
  .region("asia-northeast3")
  .firestore.document("users/{userId}")
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const userId = context.params.userId;

    // virtual_asset (현금)이 변경되었을 때만 실행
    if (beforeData.virtual_asset === afterData.virtual_asset) {
      return null;
    }

    if (!FINNHUB_API_KEY) {
      console.error("FINNHUB_API_KEY is not set. Skipping history recording.");
      return null;
    }

    try {
      const userCash = afterData.virtual_asset;
      const holdingsSnapshot = await db
        .collection("users")
        .doc(userId)
        .collection("holdings")
        .get();

      let totalHoldingsValue = 0;
      if (!holdingsSnapshot.empty) {
        const holdingPromises = holdingsSnapshot.docs.map(async (doc) => {
          const holding = doc.data();
          const symbol = holding.asset_code;
          const quantity = holding.quantity;

          try {
            const response = await axios.get(
              `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
            );
            let currentPrice = response.data.c;
            if (!symbol.toUpperCase().endsWith(".KS")) {
              currentPrice *= EXCHANGE_RATE_USD_TO_KRW;
            }
            if (currentPrice > 0) {
              totalHoldingsValue += currentPrice * quantity;
            }
          } catch (apiError) {
            console.error(`Failed to fetch price for ${symbol}`, apiError);
            // API 실패 시, 해당 종목은 0으로 처리하고 계속 진행
          }
        });
        await Promise.all(holdingPromises);
      }

      const totalAsset = userCash + totalHoldingsValue;
      const profitRate = ((totalAsset - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;

      // portfolio_history 컬렉션에 기록
      const historyRef = db
        .collection("users")
        .doc(userId)
        .collection("portfolio_history")
        .doc();

      await historyRef.set({
        date: FieldValue.serverTimestamp(),
        totalAsset: totalAsset,
        profitRate: profitRate,
        seasonId: "current_season", // 시즌 ID 추가
      });

      console.log(`Successfully recorded portfolio history for user ${userId}`);
      return null;
    } catch (error) {
      console.error(`Error recording portfolio history for user ${userId}:`, error);
      return null;
    }
  });

/**
 * 클라이언트에서 포트폴리오 히스토리 데이터를 조회하기 위한 함수
 */
export const getPortfolioHistory = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication is required.");
    }
    const uid = context.auth.uid;

    try {
      const historySnapshot = await db
        .collection("users")
        .doc(uid)
        .collection("portfolio_history")
        .where("seasonId", "==", "current_season") // 현재 시즌 데이터만 조회
        .orderBy("date", "asc")
        .get();

      const history = historySnapshot.docs.map((doc) => {
        const docData = doc.data();
        // 데이터 유효성 검사: date 필드가 Timestamp 객체인지 확인
        if (docData.date && typeof docData.date.toDate === "function") {
          return {
            // Firestore Timestamp를 ISO 문자열로 변환하여 클라이언트에 전달
            date: docData.date.toDate().toISOString(),
            totalAsset: docData.totalAsset,
            profitRate: docData.profitRate,
          };
        }
        // 유효하지 않은 데이터는 로그를 남기고 null 반환
        console.warn(`Invalid data found in portfolio_history for user ${uid}:`, doc.id, docData);
        return null;
      }).filter(item => item !== null); // null 값 제거

      return {success: true, history};
    } catch (error) {
      console.error(`Error fetching portfolio history for user ${uid}:`, error);
      throw new functions.https.HttpsError("internal", "Failed to fetch portfolio history.");
    }
  });
