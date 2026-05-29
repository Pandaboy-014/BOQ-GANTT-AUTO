import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBD-pSfXBp1_Sjktkk4zTibH9Zo-OU72yk",
  authDomain: "bidea-construction.firebaseapp.com",
  projectId: "bidea-construction",
  storageBucket: "bidea-construction.firebasestorage.app",
  messagingSenderId: "59189600639",
  appId: "1:59189600639:web:93bb59811b7257c3753a4a",
  measurementId: "G-KX914F337R"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
