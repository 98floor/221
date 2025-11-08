// client/src/firebase.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyB5txsw4e1tBUw0Ps6wIEUFA5efLPlR6oY",
  authDomain: "univest-challenge-test.firebaseapp.com",
  projectId: "univest-challenge-test",
  storageBucket: "univest-challenge-test.firebasestorage.app",
  messagingSenderId: "898164073965",
  appId: "1:898164073965:web:8cdc084c06aa862050f3e4",
  measurementId: "G-YBS1LJPP0D"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "asia-northeast3"); // 서울 리전 명시
