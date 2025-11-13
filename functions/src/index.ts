import "dotenv/config";
// functions/src/index.ts
// (이 파일은 Firebase를 초기화하고, 다른 모든 함수 파일들을 불러오는 '허브' 역할을 합니다.)

import {initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";

// Firebase Admin 초기화
initializeApp();

// ---------------------------------------------------------------- //
// [중요] db와 FieldValue를 export하여 다른 파일(market.ts, user.ts 등)에서
// import { db, FieldValue } from "./index"; 로 참조할 수 있게 합니다.
// ---------------------------------------------------------------- //
export const db = getFirestore();
export {FieldValue};
// ---------------------------------------------------------------- //


// (참고: axios, Gemini API 키, Finnhub API 키 등의 모든 상수와
//       개별 함수 로직은 각 파일로 이동되었습니다.)


// --- 모든 함수 파일들을 불러와서 export ---
export * from "./market";
export * from "./portfolio";
export * from "./user";
export * from "./community";
export * from "./admin";
export * from "./notice";
export * from "./quiz";
export * from "./debate";
export * from "./orders";
