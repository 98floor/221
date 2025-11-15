// functions/src/favorites.ts
import * as functions from "firebase-functions/v1";
import {db} from "./index";

// Helper to check auth
const checkAuth = (context: functions.https.CallableContext) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }
  return context.auth.uid;
};

/**
 * [신규] 즐겨찾기 추가 함수
 * (클라이언트에서 symbol과 name을 받아 저장)
 */
export const addFavorite = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    const uid = checkAuth(context);
    const {symbol, name} = data;
    if (!symbol || !name) {
      throw new functions.https.HttpsError("invalid-argument", "종목 코드와 이름이 필요합니다.");
    }

    // users/{uid}/favorites/{symbol} 문서 생성
    const favRef = db.collection("users").doc(uid).collection("favorites").doc(symbol);
    await favRef.set({
      symbol: symbol,
      name: name,
      addedAt: new Date(),
    });
    return {success: true, message: "즐겨찾기에 추가되었습니다."};
  });

/**
 * [신규] 즐겨찾기 제거 함수
 */
export const removeFavorite = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    const uid = checkAuth(context);
    const {symbol} = data;
    if (!symbol) {
      throw new functions.https.HttpsError("invalid-argument", "종목 코드가 필요합니다.");
    }

    const favRef = db.collection("users").doc(uid).collection("favorites").doc(symbol);
    await favRef.delete();
    return {success: true, message: "즐겨찾기에서 제거되었습니다."};
  });

/**
 * [신규] 즐겨찾기 목록 (심볼+이름) 가져오기 함수
 * (가격 정보는 클라이언트가 별도 요청)
 */
export const getFavoritesList = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    const uid = checkAuth(context);
    const favCollectionRef = db.collection("users").doc(uid).collection("favorites").orderBy("addedAt", "asc");
    const snapshot = await favCollectionRef.get();

    const list: {symbol: string, name: string}[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      list.push({symbol: data.symbol, name: data.name});
    });

    return {success: true, favorites: list};
  });
