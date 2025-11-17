// functions/src/portfolio.ts
// (이 파일은 'getPortfolio', 'calculateRankings' 2개의 함수를 담당합니다)

import * as functions from "firebase-functions/v1";
import axios from "axios";
import {db, FieldValue} from "./index"; // index.ts에서 db, FieldValue 가져오기

// 이 함수들이 사용하는 상수
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

// 🔽 [수정됨] 파일 로드 시 즉시 실행되던 API 키 확인 로직 제거
// if (!FINNHUB_API_KEY) {
//   throw new Error("FINNHUB_API_KEY가 .env 파일에 설정되지 않았습니다.");
// }
const EXCHANGE_RATE_USD_TO_KRW = 1445;

// [신규] 'any' 타입 대신 사용할 인터페이스 정의
interface Holding {
  symbol: string;
  quantity: number;
  avg_buy_price: number;
  current_price: number;
  current_value: number;
  profit_loss: number;
  profit_rate: number;
}

interface PersonalRanking {
  uid: string;
  nickname: string;
  school_name: string;
  total_asset: number;
  profit_rate: number;
}

interface SchoolStat {
  totalProfitRate: number;
  memberCount: number;
}

interface SchoolRanking {
  school_name: string;
  avg_profit_rate: number;
  member_count: number;
}

/**
 * [신규] 중급 퀘스트 완료 여부를 확인하고 상태를 업데이트하는 헬퍼 함수
 * @param {FirebaseFirestore.DocumentReference} userRef 사용자 문서 참조
 */
const checkIntermediateQuestCompletion = async (
  userRef: FirebaseFirestore.DocumentReference
) => {
  const questRef = userRef.collection("quest_progress").doc("summary");
  const questDoc = await questRef.get();

  if (!questDoc.exists) return;
  const questData = questDoc.data();
  if (!questData) return;

  // 중급 퀘스트가 진행 중이고, 아직 완료되지 않았을 때만 확인
  if (questData.intermediate_status === "in_progress") {
    const profitRateAchieved = questData.profit_rate_achieved === true;
    const oxAnswersCorrect = questData.ox_correct_answers >= 5;

    // 두 조건이 모두 충족되면 퀘스트 완료 처리
    if (profitRateAchieved && oxAnswersCorrect) {
      await questRef.update({
        intermediate_status: "completed",
        advanced_status: "in_progress", // 고급 퀘스트 잠금 해제
      });
      await userRef.update({badge: "골드"}); // 골드 배지 지급
    }
  }
};


// [UC-6] 자신의 포트폴리오(자산, 수익률) 확인 (수정본: 환율 적용 및 랭킹 정보 추가)
export const getPortfolio = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    if (!FINNHUB_API_KEY) {
      throw new functions.https.HttpsError("internal", "FINNHUB_API_KEY가 설정되지 않았습니다.");
    }

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

      // [신규] 랭킹 정보 조회
      const rankingRef = db.collection("ranking").doc("current_season");
      const rankingDoc = await rankingRef.get();
      let userRank = null;
      if (rankingDoc.exists) {
        const rankingData = rankingDoc.data();
        // `personal_ranking` 배열에서 현재 사용자의 uid를 찾아 인덱스를 가져옴
        const userIndex = rankingData?.personal_ranking?.findIndex((p: any) => p.uid === uid);
        if (userIndex !== -1) {
          userRank = userIndex + 1; // 랭킹은 1부터 시작
        }
      }

      const userCash = userData["virtual_asset"];
      const holdingsRef = userRef.collection("holdings");
      const holdingsSnapshot = await holdingsRef.get();

      if (holdingsSnapshot.empty) {
        const profitLoss = userCash - initialCapital;
        const profitRate = ((userCash - initialCapital) / initialCapital) * 100;
        // [수정] 반환 형식을 { portfolioData: { ... } } 로 감쌈
        return {
          portfolioData: {
            total_asset: userCash,
            profit_loss: profitLoss,
            profit_rate: profitRate,
            cash: userCash,
            holdings: [],
            rank: userRank, // 랭킹 정보 추가
          },
        };
      }

      const holdings: Holding[] = [];
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

      // [수정] 반환 형식을 { portfolioData: { ... } } 로 감쌈
      return {
        portfolioData: {
          total_asset: totalPortfolioValue,
          profit_loss: totalProfitLoss,
          profit_rate: totalProfitRate,
          cash: userCash,
          holdings: holdings,
          rank: userRank, // 랭킹 정보 추가
        },
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
  // [수정됨] (context) -> (_context)
  .onRun(async (_context) => {
    // 🔽 [수정됨] API 키 확인 로직을 함수 내부로 이동
    if (!FINNHUB_API_KEY) {
      console.error("FINNHUB_API_KEY가 설정되지 않았습니다. 랭킹 집계를 중단합니다.");
      return; // HttpsError 대신 콘솔 로그 및 반환
    }

    console.log("랭킹 집계 스케줄러(UC-7) 실행 시작...");

    const initialCapital = 10000000;

    try {
      const usersSnapshot = await db.collection("users").get();

      // [수정됨] personalRankings: any[] -> PersonalRanking[]
      const personalRankings: PersonalRanking[] = [];
      // [수정됨] schoolStats: any -> {[key: string]: SchoolStat}
      const schoolStats: {[key: string]: SchoolStat} = {};

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

        // --- [신규] 퀘스트 진행 상황 업데이트 (수익률) ---
        const userRef = userDoc.ref;
        const questRef = userRef.collection("quest_progress").doc("summary");
        const questDoc = await questRef.get();

        if (questDoc.exists) {
          const questData = questDoc.data();
          if (questData &&
              questData.intermediate_status === "in_progress" &&
              !questData.profit_rate_achieved
          ) {
            if (profitRate >= 10) {
              await questRef.update({profit_rate_achieved: true});
              // 수익률 조건 달성 후, 중급 퀘스트 전체 완료 여부 확인
              await checkIntermediateQuestCompletion(userRef);
            }
          }
        }
        // --- 퀘스트 로직 끝 ---

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

      // [수정됨] schoolRankings: any[] -> SchoolRanking[]
      const schoolRankings: SchoolRanking[] = Object.keys(schoolStats).map((schoolName) => {
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

// [신규] 특정 시즌의 자산 요약 정보 조회
export const getSeasonPortfolioSummary = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "인증된 사용자만 호출할 수 있습니다.");
    }

    const uid = context.auth.uid;
    const seasonId = data.seasonId;

    if (!seasonId) {
      throw new functions.https.HttpsError("invalid-argument", "요청에 'seasonId'가 포함되어야 합니다.");
    }

    try {
      const seasonDocRef = db.collection("hall_of_fame").doc(`season_${seasonId}`);
      const seasonDoc = await seasonDocRef.get();

      if (!seasonDoc.exists) {
        throw new functions.https.HttpsError("not-found", "해당 시즌의 데이터를 찾을 수 없습니다.");
      }

      const seasonData = seasonDoc.data();
      const userRecord = seasonData?.user_records?.find((record: any) => record.uid === uid);

      if (!userRecord) {
        throw new functions.https.HttpsError("not-found", "해당 시즌에서 사용자의 기록을 찾을 수 없습니다.");
      }

      // `getPortfolio`와 동일한 형식으로 응답 반환
      return {
        total_asset: userRecord.final_asset,
        profit_loss: userRecord.profit_loss,
        profit_rate: userRecord.profit_rate,
        cash: userRecord.final_cash, // `final_cash` 필드가 있다고 가정
        holdings: userRecord.final_holdings || [], // `final_holdings` 필드가 있다고 가정
      };
    } catch (error) {
      console.error("시즌 포트폴리오 요약 조회 오류:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "시즌 포트폴리오 요약 조회에 실패했습니다.");
    }
  });
