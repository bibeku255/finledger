// src/pages/Settings.jsx

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  HiOutlineCamera, HiOutlineShieldCheck, HiOutlineLockClosed,
  HiOutlineCalendar, HiOutlineGlobeAlt
} from "react-icons/hi";
import { FaMountain, FaMoon } from 'react-icons/fa';
import { auth, db } from "../firebase/firebaseConfig";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import {
  updateProfile, updatePassword, EmailAuthProvider,
  reauthenticateWithCredential, sendEmailVerification
} from "firebase/auth";
import Cropper from "react-easy-crop";
import getCroppedImg from "../utils/cropImage";
import Avatar from "../components/ui/Avatar";
import { hashPINEnhanced, verifyPINEnhanced } from '../utils/securityUtils';
import { useToast } from '../hooks/useToastNotification'; // ✅ Toast instead of alert()

// ─────────────────────────────────────────────
// Calendar Options Config
// ─────────────────────────────────────────────
const calendarOptions = [
  {
    id: 'gregorian',
    name: 'English (AD)',
    desc: 'Global Standard',
    icon: <HiOutlineGlobeAlt size={20} />,
    activeBorder: 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10',
    activeIcon: 'bg-indigo-500 text-white',
    activeText: 'text-indigo-700 dark:text-indigo-400'
  },
  {
    id: 'bikram_sambat',
    name: 'Nepali (BS)',
    desc: 'Bikram Sambat',
    icon: <FaMountain size={16} />,
    activeBorder: 'border-rose-500 bg-rose-50 dark:bg-rose-500/10',
    activeIcon: 'bg-rose-500 text-white',
    activeText: 'text-rose-700 dark:text-rose-400'
  },
  {
    id: 'hijri',
    name: 'Islamic (Hijri)',
    desc: 'Lunar Calendar',
    icon: <FaMoon size={16} />,
    activeBorder: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
    activeIcon: 'bg-emerald-500 text-white',
    activeText: 'text-emerald-700 dark:text-emerald-400'
  },
  {
    id: 'jalali',
    name: 'Persian (Jalali)',
    desc: 'Solar Calendar',
    icon: <HiOutlineCalendar size={20} />,
    activeBorder: 'border-amber-500 bg-amber-50 dark:bg-amber-500/10',
    activeIcon: 'bg-amber-500 text-white',
    activeText: 'text-amber-700 dark:text-amber-400'
  }
];

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
const Settings = () => {
  const { user, dbData, avatar, displayName, refreshUser } = useAuth();
  const { addToast } = useToast(); // ✅ Toast hook
  const fileInputRef = useRef(null);

  // ── Crop States ──
  const [selectedFile, setSelectedFile] = useState(null);
  const [cropModal, setCropModal] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatar);

  // ✅ FIX 1: Sync avatar when it changes externally
  useEffect(() => {
    if (avatar) {
      setCurrentAvatarUrl(`${avatar}?t=${new Date().getTime()}`);
    }
  }, [avatar]);

  // ✅ FIX 2: Object URL for cropper — created once, revoked on cleanup (no memory leak)
  const previewUrl = useMemo(() => {
    if (!selectedFile) return null;
    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // ── Security States ──
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordAuthPin, setPasswordAuthPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinAuthPassword, setPinAuthPassword] = useState("");
  const [pinLoading, setPinLoading] = useState(false);

  // ── Calendar State ──
  const [calLoading, setCalLoading] = useState(false);

  // ✅ FIX 3: Sync baseCalendar from dbData (handles async load — dbData starts as null)
  const [baseCalendar, setBaseCalendar] = useState('gregorian');
  useEffect(() => {
    if (dbData?.settings?.baseCalendar) {
      setBaseCalendar(dbData.settings.baseCalendar);
    }
  }, [dbData]);

  // ── Derived flags ──
  const isSocialUser = user?.providerData?.some(
    p => p.providerId === 'google.com' || p.providerId === 'github.com'
  );
  const isEmailUser = user?.providerData?.some(p => p.providerId === 'password');
  const isPinSet = dbData?.security?.isPinSet;

  // ─────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file);
      setCropModal(true);
    }
  };

  const onCropComplete = (_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  };

  const handleCropSave = async () => {
    if (!selectedFile || !croppedAreaPixels) return;
    setUploading(true);
    try {
      const croppedBlob = await getCroppedImg(previewUrl, croppedAreaPixels);
      const formData = new FormData();
      formData.append("image", croppedBlob);
      const IMGBB_API_KEY = "5ea0f524578cd108c888941178b2b3e9";

      const response = await fetch(
        `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
        { method: "POST", body: formData }
      );
      const data = await response.json();
      if (!data.success) throw new Error("Upload Failed");

      const photoURL = data.data.url;
      await updateProfile(auth.currentUser, { photoURL });
      await setDoc(doc(db, "users", user.uid), { photoURL }, { merge: true });

      setCurrentAvatarUrl(`${photoURL}?t=${new Date().getTime()}`);
      await refreshUser();

      // ✅ FIX 4: Toast instead of alert()
      addToast("Profile picture updated! ✅", "success");
      setCropModal(false);
      setSelectedFile(null);
    } catch (err) {
      addToast("Error uploading image ❌", "error");
    } finally {
      setUploading(false);
    }
  };

  const handlePinSave = async (e) => {
    e.preventDefault();
    setPinLoading(true);
    try {
      await auth.currentUser.reload();
      if (!auth.currentUser.emailVerified && !isSocialUser) {
        await sendEmailVerification(auth.currentUser);
        addToast("Please verify your email first!", "warning");
        setPinLoading(false);
        return;
      }

      if (isEmailUser && !isSocialUser) {
        const credential = EmailAuthProvider.credential(user.email, pinAuthPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
      }

      if (isPinSet) {
        const { valid } = await verifyPINEnhanced(oldPin, dbData.security.pinHash, user.uid);
        if (!valid) throw new Error("Wrong Old PIN");
      }

      if (pin.length < 4 || pin.length > 6) {
        addToast("PIN must be 4 to 6 digits.", "error");
        setPinLoading(false);
        return;
      }
      if (pin !== confirmPin) {
        addToast("PINs do not match.", "error");
        setPinLoading(false);
        return;
      }

      const newHash = await hashPINEnhanced(pin, user.uid);
      await setDoc(doc(db, "users", user.uid), {
        security: { pinHash: newHash, isPinSet: true }
      }, { merge: true });

      addToast("Security PIN Activated! 🛡️", "success");
      setOldPin(""); setPin(""); setConfirmPin(""); setPinAuthPassword("");
      await refreshUser();
    } catch (err) {
      addToast(err.message || "Verification Failed ❌", "error");
    } finally {
      setPinLoading(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isPinSet) {
        const { valid } = await verifyPINEnhanced(passwordAuthPin, dbData.security.pinHash, user.uid);
        if (!valid) throw new Error("Wrong PIN");
      }
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);

      addToast("Password Updated! ✅", "success");
      setCurrentPassword(""); setNewPassword(""); setPasswordAuthPin("");
    } catch (err) {
      addToast(err.message || "Update Failed ❌", "error");
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIX 5: Calendar — optimistic UI update + dot-notation updateDoc (no overwrite)
  const handleCalendarUpdate = async (selectedCode) => {
    if (!user || calLoading) return;
    setCalLoading(true);
    setBaseCalendar(selectedCode); // Optimistic update
    try {
      await updateDoc(doc(db, "users", user.uid), {
        "settings.baseCalendar": selectedCode
      });
      await refreshUser();
      addToast(`Calendar set to ${calendarOptions.find(c => c.id === selectedCode)?.name}`, "success");
    } catch (error) {
      // ✅ Rollback on failure
      setBaseCalendar(dbData?.settings?.baseCalendar || 'gregorian');
      addToast("Failed to update calendar settings ❌", "error");
    } finally {
      setCalLoading(false);
    }
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10 mt-20 space-y-10 mb-20">
      <h1 className="text-3xl font-black dark:text-white">Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

        {/* ── Left Column: Profile + Calendar ── */}
        <div className="space-y-6">

          {/* Profile Card */}
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 text-center shadow-xl">
            <div className="relative inline-block">
              <div className={`relative ${uploading ? "animate-pulse" : ""}`}>
                <Avatar src={currentAvatarUrl} name={displayName} size={112} />
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*"
              />
              <button
                onClick={() => fileInputRef.current.click()}
                className="absolute bottom-1 right-1 bg-blue-600 p-2.5 rounded-full text-white shadow-lg z-10 hover:scale-110 transition-transform"
              >
                <HiOutlineCamera size={18} />
              </button>
            </div>
            <h3 className="mt-4 font-black dark:text-white truncate text-xl">{displayName}</h3>
            <div className="mt-4 flex justify-center">
              <span className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-inner ${isPinSet
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                }`}>
                <HiOutlineShieldCheck size={16} />
                {isPinSet ? '2FA Active' : 'Unsecured'}
              </span>
            </div>
          </div>

          {/* Calendar Preference Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-xl">
            <h4 className="text-sm font-black uppercase flex items-center gap-2 text-indigo-500 mb-4">
              <HiOutlineCalendar size={20} /> Base Calendar
            </h4>
            {calLoading && (
              <p className="text-[10px] font-black text-center text-indigo-400 uppercase tracking-widest mb-3 animate-pulse">
                Saving...
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-3">
              {calendarOptions.map((cal) => {
                const isSelected = baseCalendar === cal.id;
                return (
                  <button
                    key={cal.id}
                    disabled={calLoading}
                    onClick={() => handleCalendarUpdate(cal.id)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left disabled:opacity-60 ${isSelected
                        ? cal.activeBorder
                        : 'border-transparent bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isSelected ? cal.activeIcon : 'bg-slate-200 dark:bg-slate-900 text-slate-500'
                      }`}>
                      {cal.icon}
                    </div>
                    <div className="min-w-0">
                      <p className={`font-black text-[13px] truncate ${isSelected ? cal.activeText : 'text-slate-700 dark:text-white'}`}>
                        {cal.name}
                      </p>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest truncate">
                        {cal.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* ── Right Column: Forms ── */}
        <div className="md:col-span-2 space-y-6">

          {/* PIN Security Form */}
          <form
            onSubmit={handlePinSave}
            className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 space-y-5 shadow-xl"
          >
            <h4 className="text-sm font-black uppercase flex items-center gap-2 text-emerald-500">
              <HiOutlineShieldCheck size={20} /> Security Passcode
            </h4>
            <div className="space-y-3">
              {isEmailUser && (
                <input
                  type="password"
                  placeholder="Verify Main Password"
                  value={pinAuthPassword}
                  onChange={(e) => setPinAuthPassword(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-slate-100 dark:bg-slate-950 outline-none dark:text-white font-black text-sm border border-transparent focus:border-emerald-500 transition-all"
                />
              )}
              {isPinSet && (
                <input
                  type="password"
                  placeholder="Current Passcode"
                  value={oldPin}
                  onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full p-4 rounded-2xl bg-slate-100 dark:bg-slate-950 outline-none dark:text-white font-black tracking-widest border border-transparent focus:border-emerald-500 transition-all"
                />
              )}
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="password"
                  placeholder="New PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-white/5 outline-none dark:text-white font-black tracking-widest border border-transparent focus:border-emerald-500 transition-all"
                />
                <input
                  type="password"
                  placeholder="Confirm PIN"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-white/5 outline-none dark:text-white font-black tracking-widest border border-transparent focus:border-emerald-500 transition-all"
                />
              </div>
            </div>
            <button
              disabled={pinLoading}
              className="w-full py-4 mt-2 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-60"
            >
              {pinLoading ? "Processing..." : "Save PIN Security"}
            </button>
          </form>

          {/* Password Update Form — Email users only */}
          {isEmailUser && (
            <form
              onSubmit={handlePasswordUpdate}
              className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 space-y-5 shadow-xl"
            >
              <h4 className="text-sm font-black uppercase flex items-center gap-2 text-rose-500">
                <HiOutlineLockClosed size={20} /> Master Password
              </h4>
              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="Current Password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-slate-100 dark:bg-slate-950 outline-none dark:text-white text-sm font-black border border-transparent focus:border-rose-500 transition-all"
                />
                {isPinSet && (
                  <input
                    type="password"
                    placeholder="Verify 2FA Passcode"
                    value={passwordAuthPin}
                    onChange={(e) => setPasswordAuthPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full p-4 rounded-2xl bg-slate-100 dark:bg-slate-950 outline-none dark:text-white font-black tracking-widest border border-transparent focus:border-rose-500 transition-all"
                  />
                )}
                <input
                  type="password"
                  placeholder="New Master Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-white/5 outline-none dark:text-white text-sm font-black border border-transparent focus:border-rose-500 transition-all"
                />
              </div>
              <button
                disabled={loading}
                className="w-full py-4 bg-rose-500 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-rose-500/20 active:scale-95 transition-all disabled:opacity-60"
              >
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
          )}

        </div>
      </div>

      {/* ── Crop Modal ── */}
      {cropModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[500] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-6 max-w-md w-full relative shadow-2xl">
            <div className="relative h-80 w-full rounded-2xl overflow-hidden mb-6 bg-slate-100 dark:bg-slate-800">
              {/* ✅ FIX 2 applied: previewUrl from useMemo, no new object URL on each render */}
              <Cropper
                image={previewUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full mb-4 accent-blue-600"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setCropModal(false); setSelectedFile(null); }}
                className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white rounded-xl font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleCropSave}
                disabled={uploading}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black shadow-lg shadow-blue-500/30 active:scale-95 transition-all disabled:opacity-60"
              >
                {uploading ? "Saving..." : "Save Picture"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;