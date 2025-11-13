// functions/src/orders.ts
import * as functions from "firebase-functions/v1";
import {db, FieldValue} from "./index";
import axios from "axios";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

interface LimitOrder {
  id: string;
  userId: string;
  asset_code: string;
  type: "buy" | "sell";
  limit_price: number;
  quantity: number;
  status: "open" | "filled" | "cancelled";
}

// ... (placeLimitOrder and cancelLimitOrder functions)

// [신규] 지정가 주문 처리 엔진 (1분마다 실행)
export const processLimitOrders = functions
  .region("asia-northeast3")
  .pubsub.schedule("every 1 minutes").onRun(async (context) => {
    console.log("지정가 주문 처리 엔진을 시작합니다.");

    const openOrdersQuery = db.collection("limit_orders").where("status", "==", "open");
    const snapshot = await openOrdersQuery.get();

    if (snapshot.empty) {
      console.log("처리할 지정가 주문이 없습니다.");
      return null;
    }

    const processingPromises = snapshot.docs.map(async (doc) => {
      const order = {id: doc.id, ...doc.data()} as LimitOrder;

      try {
        // 1. 현재가 조회
        const response = await axios.get(`https://finnhub.io/api/v1/quote?symbol=${order.asset_code}&token=${FINNHUB_API_KEY}`);
        const currentPrice = response.data.c;

        if (!currentPrice || currentPrice <= 0) return;

        const shouldExecute = (order.type === "buy" && currentPrice <= order.limit_price) ||
                              (order.type === "sell" && currentPrice >= order.limit_price);

        if (shouldExecute) {
          // 2. 조건 만족 시 거래 실행
          const orderRef = db.collection("limit_orders").doc(order.id);
          const userRef = db.collection("users").doc(order.userId);
          const holdingRef = userRef.collection("holdings").doc(order.asset_code);

          await db.runTransaction(async (transaction) => {
            const holdingDoc = await transaction.get(holdingRef);

            if (order.type === "buy") {
              const newQuantity = (holdingDoc.exists ? holdingDoc.data()?.quantity : 0) + order.quantity;
              transaction.set(holdingRef, {asset_code: order.asset_code, quantity: newQuantity}, {merge: true});
            } else { // sell
              const saleValue = currentPrice * order.quantity;
              transaction.update(userRef, {virtual_asset: FieldValue.increment(saleValue)});
            }
            transaction.update(orderRef, {status: "filled", filled_price: currentPrice});
          });
          console.log(`주문 체결: ${order.id}`);
        }
      } catch (error) {
        console.error(`주문 처리 실패 (ID: ${order.id}):`, error);
      }
    });

    await Promise.all(processingPromises);
    console.log("지정가 주문 처리 엔진을 종료합니다.");
    return null;
  });
