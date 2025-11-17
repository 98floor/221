// functions/src/market.ts
// (이 파일은 'getMarketData', 'buyAsset', 'sellAsset' 3개의 함수만 담당합니다)

import * as functions from "firebase-functions/v1";
import axios from "axios"; // market 함수들이 사용하는 import

// index.ts에 있는 db, FieldValue를 가져옵니다. (중요)
import {db, FieldValue} from "./index";

const TRADE_FEE_RATE = 0.0025; // 0.25% 거래 수수료

// 이 함수들이 사용하는 상수
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

// [수정됨] API 키 확인 로직을 각 함수 내부로 이동 (배포 오류 수정)

const EXCHANGE_RATE_USD_TO_KRW = 1445; // 고정 환율

// [UC-3] 주식/코인 시세 조회 (수정본: Alpha Vantage 캔들 차트 + 검색 기능)
export const getMarketData = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    // [수정됨] API 키 확인 로직을 함수 내부로 이동
    if (!ALPHA_VANTAGE_API_KEY) {
      throw new functions.https.HttpsError("internal", "ALPHA_VANTAGE_API_KEY가 설정되지 않았습니다.");
    }

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

// [UC-4] 원하는 주식/코인 매수 (수정본: 환율 적용 + 시즌 ID 추가)
export const buyAsset = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    // ... (기존 코드와 동일)
    if (!FINNHUB_API_KEY) {
      throw new functions.https.HttpsError("internal", "FINNHUB_API_KEY가 설정되지 않았습니다.");
    }
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "인증된 사용자만 호출할 수 있습니다.");
    }

    const uid = context.auth.uid;
    const {symbol, quantity, amount} = data;

    try {
      // --- 현재 시즌 ID 가져오기 ---
      const seasonRef = db.collection("seasons").doc("current");
      const seasonDoc = await seasonRef.get();
      const currentSeasonId = seasonDoc.exists ? seasonDoc.data()?.seasonId : 1;
      // --- 시즌 ID 가져오기 끝 ---

      const apiResponse = await axios.get(
        `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
      );
      let currentPrice = apiResponse.data.c;

      // ... (가격 계산 로직은 기존과 동일)
      if (currentPrice === 0) {
        throw new functions.https.HttpsError("not-found", "시세 정보를 찾을 수 없습니다.");
      }
      if (!symbol.toUpperCase().endsWith(".KS")) {
        currentPrice *= EXCHANGE_RATE_USD_TO_KRW;
      }
      let quantityToTrade: number;
      let totalCost: number;
      if (amount) {
        if (amount < 10000) {
          throw new functions.https.HttpsError("invalid-argument", "최소 주문 금액은 10,000원입니다.");
        }
        totalCost = amount;
        quantityToTrade = amount / currentPrice;
      } else if (quantity) {
        if (quantity <= 0) {
          throw new functions.https.HttpsError("invalid-argument", "수량은 0보다 커야 합니다.");
        }
        quantityToTrade = quantity;
        totalCost = currentPrice * quantityToTrade;
      } else {
        throw new functions.https.HttpsError("invalid-argument", "수량 또는 금액을 입력해야 합니다.");
      }

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

        const fee = totalCost * TRADE_FEE_RATE;
        const totalDeduction = totalCost + fee;

        if (userCash < totalDeduction) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `보유 현금이 부족합니다. (필요: ${totalDeduction.toLocaleString()} / 보유: ${userCash.toLocaleString()})`
          );
        }

        const holdingRef = userRef.collection("holdings").doc(symbol);
        const holdingDoc = await transaction.get(holdingRef);

        if (holdingDoc.exists) {
          const holdingData = holdingDoc.data();
          if (!holdingData) {
            throw new functions.https.HttpsError("internal", "보유 자산 데이터를 읽을 수 없습니다.");
          }
          const oldQuantity = holdingData["quantity"] || 0;
          const oldAvgPrice = holdingData["avg_buy_price"] || 0;

          const newTotalQuantity = oldQuantity + quantityToTrade;
          const newAvgPrice =
            (oldAvgPrice * oldQuantity + currentPrice * quantityToTrade) /
            newTotalQuantity;

          transaction.update(holdingRef, {
            quantity: parseFloat(newTotalQuantity.toFixed(8)),
            avg_buy_price: parseFloat(newAvgPrice.toFixed(4)),
          });
        } else {
          transaction.set(holdingRef, {
            asset_code: symbol,
            quantity: parseFloat(quantityToTrade.toFixed(8)),
            avg_buy_price: parseFloat(currentPrice.toFixed(4)),
          });
        }

        const transactionData = {
          type: "buy",
          asset_code: symbol,
          quantity: quantityToTrade,
          trade_price: currentPrice,
          trade_dt: FieldValue.serverTimestamp(),
          seasonId: currentSeasonId,
          fee: fee,
        };

        const txRef = userRef.collection("transactions").doc();
        transaction.set(txRef, transactionData);
        const allTimeTxRef = userRef.collection("all_time_transactions").doc();
        transaction.set(allTimeTxRef, transactionData);

        transaction.update(userRef, {
          virtual_asset: FieldValue.increment(Math.round(-totalDeduction * 10000) / 10000),
        });
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

// [UC-5] 보유한 주식/코인 매도 (수정본: 환율 적용 + 시즌 ID 추가)
export const sellAsset = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    // ... (기존 코드와 동일)
    if (!FINNHUB_API_KEY) {
      throw new functions.https.HttpsError("internal", "FINNHUB_API_KEY가 설정되지 않았습니다.");
    }
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "인증된 사용자만 호출할 수 있습니다.");
    }

    const uid = context.auth.uid;
    const {symbol, quantity, amount} = data;

    try {
      // --- 현재 시즌 ID 가져오기 ---
      const seasonRef = db.collection("seasons").doc("current");
      const seasonDoc = await seasonRef.get();
      const currentSeasonId = seasonDoc.exists ? seasonDoc.data()?.seasonId : 1;
      // --- 시즌 ID 가져오기 끝 ---

      const apiResponse = await axios.get(
        `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
      );
      let currentPrice = apiResponse.data.c;

      // ... (가격 계산 로직은 기존과 동일)
      if (currentPrice === 0) {
        throw new functions.https.HttpsError("not-found", "시세 정보를 찾을 수 없습니다.");
      }
      if (!symbol.toUpperCase().endsWith(".KS")) {
        currentPrice *= EXCHANGE_RATE_USD_TO_KRW;
      }
      let quantityToTrade: number;
      let totalSaleValue: number;
      if (amount) {
        if (amount < 10000) {
          throw new functions.https.HttpsError("invalid-argument", "최소 주문 금액은 10,000원입니다.");
        }
        totalSaleValue = amount;
        quantityToTrade = amount / currentPrice;
      } else if (quantity) {
        if (quantity <= 0) {
          throw new functions.https.HttpsError("invalid-argument", "수량은 0보다 커야 합니다.");
        }
        quantityToTrade = quantity;
        totalSaleValue = currentPrice * quantityToTrade;
      } else {
        throw new functions.https.HttpsError("invalid-argument", "수량 또는 금액을 입력해야 합니다.");
      }

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
        const heldQuantity = holdingData["quantity"] || 0;

        if (heldQuantity < quantityToTrade) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `보유 수량이 부족합니다. (보유: ${heldQuantity.toFixed(
              8
            )} / 요청: ${quantityToTrade.toFixed(8)})`
          );
        }

        const newHeldQuantity = heldQuantity - quantityToTrade;
        if (newHeldQuantity < 1e-8) { // Use epsilon for float comparison
          transaction.delete(holdingRef);
        } else {
          transaction.update(holdingRef, {
            quantity: parseFloat(newHeldQuantity.toFixed(8)),
          });
        }

        const fee = totalSaleValue * TRADE_FEE_RATE;
        const totalAddition = totalSaleValue - fee;

        const transactionData = {
          type: "sell",
          asset_code: symbol,
          quantity: quantityToTrade,
          trade_price: currentPrice,
          trade_dt: FieldValue.serverTimestamp(),
          seasonId: currentSeasonId,
          fee: fee,
        };

        const txRef = userRef.collection("transactions").doc();
        transaction.set(txRef, transactionData);
        const allTimeTxRef = userRef.collection("all_time_transactions").doc();
        transaction.set(allTimeTxRef, transactionData);

        transaction.update(userRef, {
          virtual_asset: FieldValue.increment(Math.round(totalAddition * 10000) / 10000),
        });
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


// [신규 추가] 종목명, 현재가 조회 함수
export const getStockQuote = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    // API 키 확인
    if (!FINNHUB_API_KEY) {
      throw new functions.https.HttpsError("internal", "FINNHUB_API_KEY가 설정되지 않았습니다.");
    }
    // 인증 확인
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "인증된 사용자만 호출할 수 있습니다.");
    }

    const symbol = data.symbol;
    if (!symbol) {
      throw new functions.https.HttpsError("invalid-argument", "종목 코드(symbol)가 필요합니다.");
    }

    try {
      // 1. 현재가 조회 (기존 buy/sell 로직과 동일)
      const quotePromise = axios.get(
        `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
      );

      // 2. 회사 프로필(이름) 조회
      const profilePromise = axios.get(
        `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_API_KEY}`
      );

      // 3. 두 API를 동시에 호출
      const [quoteResponse, profileResponse] = await Promise.all([
        quotePromise,
        profilePromise,
      ]);

      const usdPrice = quoteResponse.data.c; // 원본 USD 가격
      const stockName = profileResponse.data.name || "이름 정보 없음";
      const isKrwStock = symbol.toUpperCase().endsWith(".KS"); // 국내 주식 여부

      let krwPrice = usdPrice; // 기본값

      // 4. 환율 적용 (국내 주식이 아닐 때만)
      if (usdPrice > 0 && !isKrwStock) {
        krwPrice = usdPrice * EXCHANGE_RATE_USD_TO_KRW; // 원화 계산
      }

      return {
        success: true,
        name: stockName,
        price: krwPrice, // 기존 호환성을 위해 유지 (원화)
        price_krw: krwPrice, // 명시적인 원화 가격
        price_usd: usdPrice, // 명시적인 USD 가격
        is_krw_stock: isKrwStock, // 국내 주식 여부 플래그
        change: quoteResponse.data.d, // 금일 변동
        changePercent: quoteResponse.data.dp, // 금일 변동률 (%)
        open: quoteResponse.data.o, // 시가
        high: quoteResponse.data.h, // 고가
        low: quoteResponse.data.l, // 저가
      };
    } catch (error) {
      console.error("Finnhub API (quote/profile) 호출 오류:", error);
      throw new functions.https.HttpsError("internal", "종목 정보 조회에 실패했습니다.");
    }
  });
