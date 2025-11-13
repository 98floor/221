// functions/src/market.ts
// (이 파일은 'getMarketData', 'buyAsset', 'sellAsset' 3개의 함수만 담당합니다)

import * as functions from "firebase-functions/v1";
import axios from "axios"; // market 함수들이 사용하는 import

// index.ts에 있는 db, FieldValue를 가져옵니다. (중요)
import {db, FieldValue} from "./index";

// 이 함수들이 사용하는 상수
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

if (!ALPHA_VANTAGE_API_KEY || !FINNHUB_API_KEY) {
  throw new Error("ALPHA_VANTAGE_API_KEY 또는 FINNHUB_API_KEY가 .env 파일에 설정되지 않았습니다.");
}

const EXCHANGE_RATE_USD_TO_KRW = 1445; // 고정 환율

// [UC-3] 주식/코인 시세 조회 (수정본: Alpha Vantage 캔들 차트 + 검색 기능)
export const getMarketData = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "인증된 사용자만 호출할 수 있습니다."
      );
    }

    const symbol = data.symbol;

    if (!symbol || typeof symbol !== "string" || symbol.trim() === "") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "종목 코드(symbol)가 문자열 형태로 전달되어야 합니다."
      );
    }

    try {
      const response = await axios.get(
        `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${ALPHA_VANTAGE_API_KEY}`
      );

      if (response.data["Note"]) {
        throw new functions.https.HttpsError(
          "resource-exhausted",
          "무료 API 호출 한도를 초과했습니다. 1분 후에 다시 시도하세요."
        );
      }
      if (response.data["Error Message"]) {
        throw new functions.https.HttpsError(
          "internal",
          `API 오류: ${response.data["Error Message"]} (잘못된 종목 코드일 수 있습니다)`
        );
      }

      return {success: true, data: response.data, symbol: symbol};
    } catch (error) {
      console.error("Alpha Vantage API 호출 오류:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "API 조회에 실패했습니다.");
    }
  });

// [UC-4] 원하는 주식/코인 매수 (수정본: 환율 적용)
export const buyAsset = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "인증된 사용자만 호출할 수 있습니다.");
    }

    const uid = context.auth.uid;
    const {symbol, quantity} = data;

    if (quantity <= 0) {
      throw new functions.https.HttpsError("invalid-argument", "수량은 0보다 커야 합니다.");
    }

    try {
      const apiResponse = await axios.get(
        `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
      );
      let currentPrice = apiResponse.data.c;

      if (currentPrice === 0) {
        throw new functions.https.HttpsError("not-found", "시세 정보를 찾을 수 없습니다.");
      }

      if (!symbol.toUpperCase().endsWith(".KS")) {
        currentPrice *= EXCHANGE_RATE_USD_TO_KRW;
      }

      const totalCost = currentPrice * quantity;

      const userRef = db.collection("users").doc(uid);

      await db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new functions.https.HttpsError("not-found", "사용자 정보를 찾을 수 없습니다.");
        }

        const userData = userDoc.data();
        if (!userData) {
          throw new functions.https.HttpsError("internal", "사용자 데이터를 읽을 수 없습니다.");
        }

        const userCash = userData["virtual_asset"];

        if (userCash < totalCost) {
          throw new functions.https.HttpsError("failed-precondition", "보유 현금이 부족합니다.");
        }

        const newCash = userCash - totalCost;

        const holdingRef = userRef.collection("holdings").doc(symbol);
        const holdingDoc = await transaction.get(holdingRef);

        if (holdingDoc.exists) {
          const holdingData = holdingDoc.data();
          if (!holdingData) {
            throw new functions.https.HttpsError("internal", "보유 자산 데이터를 읽을 수 없습니다.");
          }

          const oldQuantity = holdingData["quantity"];
          const oldAvgPrice = holdingData["avg_buy_price"];

          const newTotalQuantity = oldQuantity + quantity;
          const newAvgPrice = ((oldAvgPrice * oldQuantity) + (currentPrice * quantity)) / newTotalQuantity;

          transaction.update(holdingRef, {
            quantity: newTotalQuantity,
            avg_buy_price: newAvgPrice,
          });
        } else {
          transaction.set(holdingRef, {
            asset_code: symbol,
            quantity: quantity,
            avg_buy_price: currentPrice,
          });
        }

        const txRef = userRef.collection("transactions").doc();
        transaction.set(txRef, {
          type: "buy",
          asset_code: symbol,
          quantity: quantity,
          trade_price: currentPrice,
          trade_dt: FieldValue.serverTimestamp(),
        });

        transaction.update(userRef, {virtual_asset: newCash});
      });

      return {success: true, message: "매수 처리가 완료되었습니다."};
    } catch (error) {
      console.error("매수 처리 오류:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "매수 처리에 실패했습니다.");
    }
  });

// [UC-5] 보유한 주식/코인 매도 (수정본: 환율 적용)
export const sellAsset = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "인증된 사용자만 호출할 수 있습니다.");
    }

    const uid = context.auth.uid;
    const {symbol, quantity} = data;

    if (quantity <= 0) {
      throw new functions.https.HttpsError("invalid-argument", "수량은 0보다 커야 합니다.");
    }

    try {
      const apiResponse = await axios.get(
        `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
      );
      let currentPrice = apiResponse.data.c;

      if (currentPrice === 0) {
        throw new functions.https.HttpsError("not-found", "시세 정보를 찾을 수 없습니다.");
      }

      if (!symbol.toUpperCase().endsWith(".KS")) {
        currentPrice *= EXCHANGE_RATE_USD_TO_KRW;
      }

      const totalSaleValue = currentPrice * quantity;

      const userRef = db.collection("users").doc(uid);

      await db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new functions.https.HttpsError("not-found", "사용자 정보를 찾을 수 없습니다.");
        }

        const userData = userDoc.data();
        if (!userData) {
          throw new functions.https.HttpsError("internal", "사용자 데이터를 읽을 수 없습니다.");
        }

        const holdingRef = userRef.collection("holdings").doc(symbol);
        const holdingDoc = await transaction.get(holdingRef);

        if (!holdingDoc.exists) {
          throw new functions.https.HttpsError("failed-precondition", "보유하지 않은 자산입니다.");
        }

        const holdingData = holdingDoc.data();
        if (!holdingData) {
          throw new functions.https.HttpsError("internal", "보유 자산 데이터를 읽을 수 없습니다.");
        }

        const heldQuantity = holdingData["quantity"];
        if (heldQuantity < quantity) {
          throw new functions.https.HttpsError("failed-precondition", "보유 수량이 매도 수량보다 적습니다.");
        }

        const newHeldQuantity = heldQuantity - quantity;

        if (newHeldQuantity === 0) {
          transaction.delete(holdingRef);
        } else {
          transaction.update(holdingRef, {quantity: newHeldQuantity});
        }

        const txRef = userRef.collection("transactions").doc();
        transaction.set(txRef, {
          type: "sell",
          asset_code: symbol,
          quantity: quantity,
          trade_price: currentPrice,
          trade_dt: FieldValue.serverTimestamp(),
        });

        const userCash = userData["virtual_asset"];
        const newCash = userCash + totalSaleValue;
        transaction.update(userRef, {virtual_asset: newCash});
      });

      return {success: true, message: "매도 처리가 완료되었습니다."};
    } catch (error) {
      console.error("매도 처리 오류:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "매도 처리에 실패했습니다.");
    }
  });
