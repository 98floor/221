// functions/src/portfolio.ts
// (이 파일은 'getPortfolio', 'calculateRankings' 2개의 함수를 담당합니다)

import * as functions from "firebase-functions/v1";
import axios from "axios";
import {db, FieldValue} from "./index"; // index.ts에서 db, FieldValue 가져오기

// 이 함수들이 사용하는 상수
const FINNHUB_API_KEY = "KEY"; // Finnhub API 키
const EXCHANGE_RATE_USD_TO_KRW = 1445;

// [UC-6] 자신의 포트폴리오(자산, 수익률) 확인 (수정본: 환율 적용)
export const getPortfolio = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
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
      const holdingsRef = userRef.collection("holdings");
      const holdingsSnapshot = await holdingsRef.get();

      if (holdingsSnapshot.empty) {
        const profitLoss = userCash - initialCapital;
        const profitRate = ((userCash - initialCapital) / initialCapital) * 100;
        return {
          total_asset: userCash,
          profit_loss: profitLoss,
          profit_rate: profitRate,
          cash: userCash,
          holdings: [],
        };
      }

      const holdings: any[] = [];
      let totalAssetValue = 0;

      const holdingPromises = holdingsSnapshot.docs.map(async (doc) => {
        const holdingData = doc.data();
        if (!holdingData) return;

        const symbol = holdingData["asset_code"];
        const quantity = holdingData["quantity"];
        const avgBuyPrice = holdingData["avg_buy_price"];

        const apiResponse = await axios.get(
          `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
        );
        let currentPrice = apiResponse.data.c;

        if (!symbol.toUpperCase().endsWith(".KS")) {
          currentPrice *= EXCHANGE_RATE_USD_TO_KRW;
        }

        const currentValue = currentPrice * quantity;
        const profitLoss = (currentPrice - avgBuyPrice) * quantity;
        const profitRate = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;

        totalAssetValue += currentValue;

        holdings.push({
          symbol: symbol,
          quantity: quantity,
          avg_buy_price: avgBuyPrice,
          current_price: currentPrice,
          current_value: currentValue,
          profit_loss: profitLoss,
          profit_rate: profitRate,
        });
      });

      await Promise.all(holdingPromises);

      const totalPortfolioValue = userCash + totalAssetValue;
      const totalProfitLoss = totalPortfolioValue - initialCapital;
      const totalProfitRate = ((totalPortfolioValue - initialCapital) / initialCapital) * 100;

      return {
        total_asset: totalPortfolioValue,
        profit_loss: totalProfitLoss,
        profit_rate: totalProfitRate,
        cash: userCash,
        holdings: holdings,
      };
    } catch (error) {
      console.error("포트폴리오 조회 오류:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "포트폴리오 조회에 실패했습니다.");
    }
  });

// [UC-7] 랭킹 집계 (스케줄링 함수) (수정본: 환율 적용)
export const calculateRankings = functions
  .region("asia-northeast3")
  .pubsub.schedule("every 5 minutes")
  .timeZone("Asia/Seoul")
  .onRun(async (context) => {
    console.log("랭킹 집계 스케줄러(UC-7) 실행 시작...");

    const initialCapital = 10000000;

    try {
      const usersSnapshot = await db.collection("users").get();

      const personalRankings: any[] = [];
      const schoolStats: any = {};

      const calculationPromises = usersSnapshot.docs.map(async (userDoc) => {
        const userData = userDoc.data();
        if (!userData) return;

        const uid = userDoc.id;
        const userCash = userData["virtual_asset"];

        const holdingsSnapshot = await db.collection("users").doc(uid).collection("holdings").get();
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
              let errorMessage = "알 수 없는 API 오류";
              if (apiError instanceof Error) {
                errorMessage = apiError.message;
              }
              console.error(`API 조회 실패 (Symbol: ${symbol}):`, errorMessage);
            }
          });
          await Promise.all(holdingPromises);
        }

        const totalPortfolioValue = userCash + totalAssetValue;
        const profitRate = ((totalPortfolioValue - initialCapital) / initialCapital) * 100;

        personalRankings.push({
          uid: uid,
          nickname: userData["nickname"],
          school_name: userData["school_name"],
          total_asset: totalPortfolioValue,
          profit_rate: profitRate,
        });

        const schoolName = userData["school_name"] || "기타";
        if (!schoolStats[schoolName]) {
          schoolStats[schoolName] = {totalProfitRate: 0, memberCount: 0};
        }
        schoolStats[schoolName].totalProfitRate += profitRate;
        schoolStats[schoolName].memberCount += 1;
      });

      await Promise.all(calculationPromises);

      personalRankings.sort((a, b) => b.profit_rate - a.profit_rate);

      const schoolRankings: any[] = Object.keys(schoolStats).map((schoolName) => {
        const stats = schoolStats[schoolName];
        const avgProfitRate = stats.totalProfitRate / stats.memberCount;
        return {
          school_name: schoolName,
          avg_profit_rate: avgProfitRate,
          member_count: stats.memberCount,
        };
      });
      schoolRankings.sort((a, b) => b.avg_profit_rate - a.avg_profit_rate);

      const rankingRef = db.collection("ranking").doc("current_season");
      await rankingRef.set({
        personal_ranking: personalRankings.slice(0, 100),
        school_ranking: schoolRankings.slice(0, 100),
        last_updated: FieldValue.serverTimestamp(),
      });

      console.log("랭킹 집계(UC-7) 성공적으로 완료.");
    } catch (error) {
      console.error("랭킹 집계(UC-7) 스케줄러 실행 중 오류 발생:", error);
    }
  });
