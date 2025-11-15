// functions/src/news.ts
import * as functions from "firebase-functions/v1";
import axios from "axios";

// Finnhub API 키
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

// Helper: 날짜를 YYYY-MM-DD 형식으로 변환
const formatDate = (date: Date): string => {
  return date.toISOString().split("T")[0];
};

export const getStockNews = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    if (!FINNHUB_API_KEY) {
      throw new functions.https.HttpsError("internal", "FINNHUB_API_KEY가 설정되지 않았습니다.");
    }

    const {symbol} = data;
    if (!symbol) {
      throw new functions.https.HttpsError("invalid-argument", "종목 코드(symbol)가 필요합니다.");
    }

    try {
      const today = new Date();
      // 최근 7일간의 뉴스를 조회
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const to = formatDate(today);
      const from = formatDate(sevenDaysAgo);

      const response = await axios.get(
        "https" +
                `://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`
      );

      // 상위 5개의 헤드라인만 반환
      const news = response.data.slice(0, 5);
      return {success: true, news};
    } catch (error) {
      console.error("Finnhub News API 호출 오류:", error);
      throw new functions.https.HttpsError("internal", "뉴스 조회에 실패했습니다.");
    }
  });
