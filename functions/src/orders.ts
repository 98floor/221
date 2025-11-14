// functions/src/orders.ts
import * as functions from "firebase-functions/v1";
import {db, FieldValue} from "./index";
import axios from "axios";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

// [UC-4] 시장가 매수/매도
export const placeMarketOrder = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "인증된 사용자만 주문할 수 있습니다.");
    }

    // [수정됨] asset_code -> assetCode 로 변수명 변경 (camelcase 룰)
    const {asset_code: assetCode, quantity, type} = data;
    const uid = context.auth.uid;

    // [수정됨] assetCode 변수 사용
    if (!assetCode || !quantity || quantity <= 0 || !["buy", "sell"].includes(type)) {
      throw new functions.https.HttpsError("invalid-argument", "주문 정보가 올바르지 않습니다.");
    }

    const userRef = db.collection("users").doc(uid);
    // [수정됨] assetCode 변수 사용
    const holdingRef = userRef.collection("holdings").doc(assetCode);

    try {
      // 1. 현재가 조회
      // [수정됨] assetCode 변수 사용
      const response = await axios.get(`https://finnhub.io/api/v1/quote?symbol=${assetCode}&token=${FINNHUB_API_KEY}`);
      const currentPrice = response.data.c;

      if (!currentPrice || currentPrice <= 0) {
        throw new functions.https.HttpsError("not-found", "현재가를 조회할 수 없습니다.");
      }

      // 2. 트랜잭션으로 매수/매도 처리
      await db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        const holdingDoc = await transaction.get(holdingRef);

        if (!userDoc.exists) {
          throw new functions.https.HttpsError("not-found", "사용자 정보를 찾을 수 없습니다.");
        }

        const userData = userDoc.data();
        if (!userData) {
          throw new functions.https.HttpsError("internal", "사용자 데이터를 읽을 수 없습니다.");
        }

        if (type === "buy") {
          const cost = currentPrice * quantity;
          if (userData.virtual_asset < cost) {
            throw new functions.https.HttpsError("failed-precondition", "가상 자산이 부족합니다.");
          }
          transaction.update(userRef, {virtual_asset: FieldValue.increment(-cost)});
          const newQuantity = (holdingDoc.exists ? holdingDoc.data()?.quantity : 0) + quantity;
          // [수정됨] DB 필드명은 asset_code, 변수명은 assetCode
          transaction.set(holdingRef, {asset_code: assetCode, quantity: newQuantity}, {merge: true});
        } else { // sell
          if (!holdingDoc.exists || holdingDoc.data()?.quantity < quantity) {
            throw new functions.https.HttpsError("failed-precondition", "보유 수량이 부족합니다.");
          }
          const saleValue = currentPrice * quantity;
          transaction.update(userRef, {virtual_asset: FieldValue.increment(saleValue)});
          const newQuantity = holdingDoc.data()?.quantity - quantity;
          if (newQuantity > 0) {
            transaction.update(holdingRef, {quantity: newQuantity});
          } else {
            transaction.delete(holdingRef);
          }
        }
      });

      return {success: true, message: `시장가 ${type === "buy" ? "매수" : "매도"} 주문이 체결되었습니다.`};
    } catch (error) {
      console.error("시장가 주문(UC-4) 오류:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "시장가 주문 처리에 실패했습니다.");
    }
  });
