import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { storage, auth, db } from "./firebaseConfig";

export const uploadAvatar = async (file) => {
  if (!auth.currentUser) throw new Error("Not authenticated");

  const uid = auth.currentUser.uid;
  const avatarRef = ref(storage, `avatars/${uid}.jpg`);

  // Upload
  await uploadBytes(avatarRef, file);

  // Get URL
  const photoURL = await getDownloadURL(avatarRef);

  // Update Auth
  await updateProfile(auth.currentUser, { photoURL });

  // Update Firestore
  await updateDoc(doc(db, "users", uid), { photoURL });

  return photoURL;
};

export const removeAvatar = async () => {
  if (!auth.currentUser) return;

  const uid = auth.currentUser.uid;
  const avatarRef = ref(storage, `avatars/${uid}.jpg`);

  await deleteObject(avatarRef).catch(() => {});
  await updateProfile(auth.currentUser, { photoURL: null });
  await updateDoc(doc(db, "users", uid), { photoURL: null });
};