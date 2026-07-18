import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
} from "firebase/firestore";

// Estas claves son públicas por diseño en Firebase: la protección real
// de tus datos la dan las reglas de seguridad de Firestore (ver firestore.rules),
// no el hecho de ocultar estas claves.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export async function getDocData(col, id) {
  try {
    const snap = await getDoc(doc(db, col, id));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.error("getDocData error", col, id, e);
    return null;
  }
}

export async function setDocData(col, id, data) {
  try {
    await setDoc(doc(db, col, id), data);
    return true;
  } catch (e) {
    console.error("setDocData error", col, id, e);
    return false;
  }
}

export async function deleteDocData(col, id) {
  try {
    await deleteDoc(doc(db, col, id));
    return true;
  } catch (e) {
    console.error("deleteDocData error", col, id, e);
    return false;
  }
}

export async function listDocs(col) {
  try {
    const snap = await getDocs(collection(db, col));
    return snap.docs.map((d) => d.data());
  } catch (e) {
    console.error("listDocs error", col, e);
    return [];
  }
}
