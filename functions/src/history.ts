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
      // --- 현재 시즌 ID 가져오기 ---
      const seasonRef = db.collection("seasons").doc("current");
      const seasonDoc = await seasonRef.get();
      const currentSeasonId = seasonDoc.exists ? seasonDoc.data()?.seasonId : 1;
      // --- 시즌 ID 가져오기 끝 ---

      const userCash = afterData.virtual_asset;
      const holdingsSnapshot = await db
        .collection("users")
        .doc(userId)
        .collection("holdings")
        .get();

      // [신규] 시즌 마감으로 인한 자산 초기화 이벤트는 기록하지 않도록 처리
      // (초기 자본금과 정확히 일치하고, 보유 주식이 없는 경우)
      if (userCash === INITIAL_CAPITAL && holdingsSnapshot.empty) {
        console.log(`Season reset detected for user ${userId}. Skipping portfolio history record.`);
        return null; // 이 이벤트 기록을 건너뜀
      }

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
        seasonId: currentSeasonId, // [수정됨] 실제 시즌 ID 사용
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
    const {seasonId} = data;

    // [수정됨] seasonId가 유효한 숫자인지 확인
    if (typeof seasonId !== "number") {
      throw new functions.https.HttpsError("invalid-argument", "A valid seasonId number must be provided.");
    }

    try {
      const historySnapshot = await db
        .collection("users")
        .doc(uid)
        .collection("portfolio_history")
        .where("seasonId", "==", seasonId) // [수정됨] 전달받은 seasonId를 바로 사용
        .orderBy("date", "asc")
        .get();

      if (historySnapshot.empty) {
        return {success: true, history: []};
      }

      const history = historySnapshot.docs.map((doc) => {
        const docData = doc.data();
        if (docData.date && typeof docData.date.toDate === "function") {
          return {
            date: docData.date.toDate().toISOString(),
            totalAsset: docData.totalAsset,
            profitRate: docData.profitRate,
          };
        }
        console.warn(`Invalid data in portfolio_history for user ${uid}:`, doc.id);
        return null;
      }).filter((item) => item !== null);

      return {success: true, history};
    } catch (error) {
      console.error(`Error fetching portfolio history for user ${uid}:`, error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      throw new functions.https.HttpsError("internal", `Failed to fetch portfolio history: ${errorMessage}`);
    }
  });

/**
 * [신규] 클라이언트에서 거래 내역을 조회하기 위한 함수
 */
export const getTransactionHistory = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication is required.");
    }
    const uid = context.auth.uid;
    const {seasonId} = data;

    if (typeof seasonId !== "number") {
      throw new functions.https.HttpsError("invalid-argument", "A valid seasonId number must be provided.");
    }

    try {
      const transSnapshot = await db
        .collection("users")
        .doc(uid)
        .collection("transactions")
        .where("seasonId", "==", seasonId)
        .orderBy("trade_dt", "desc")
        .get();

      if (transSnapshot.empty) {
        return {success: true, transactions: []};
      }

      const transactions = transSnapshot.docs.map((doc) => {
        const docData = doc.data();
        return {
          id: doc.id,
          ...docData,
          trade_dt: docData.trade_dt.toDate().toISOString(),
        };
      });

      return {success: true, transactions};
    } catch (error) {
      console.error(`Error fetching transaction history for user ${uid}:`, error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      throw new functions.https.HttpsError("internal", `Failed to fetch transaction history: ${errorMessage}`);
    }
  });
