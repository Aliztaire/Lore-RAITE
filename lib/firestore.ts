import { collection, addDoc } from "firebase/firestore";
import { db } from './firebase';

export const addTestDocument = async () => {
    if (!db) return; // Firebase not configured (see lib/firebase.ts)
    try {
        const docRef = await addDoc(collection(db, "testCollection"), {
            message: "Hello, Firestore!",
            timestamp: new Date()
        });
        console.log("Document written with ID: ", docRef.id);
    } catch (e) {
        console.error("Error adding document: ", e);
    }
};