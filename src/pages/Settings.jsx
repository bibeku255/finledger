// src/pages/Settings.jsx
import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { 
  HiOutlineCamera, HiOutlineShieldCheck, HiOutlineLockClosed, 
  HiOutlineCalendar, HiOutlineGlobeAlt 
} from "react-icons/hi";
import { FaMountain, FaMoon } from 'react-icons/fa'; // 🚀 Added FaMoon for Hijri
import { auth, db } from "../firebase/firebaseConfig";
import { doc, setDoc } from "firebase/firestore"; 
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential, sendEmailVerification } from "firebase/auth";
import Cropper from "react-easy-crop";
import getCroppedImg from "../utils/cropImage";
import Avatar from "../components/ui/Avatar"; 

// 🚀 NAYA: Calendar Options Array for clean UI rendering
const calendarOptions = [
  { 
    id: 'gregorian', 
    name: 'English (AD)', 
    desc: 'Global Standard', 
    icon: <HiOutlineGlobeAlt size={20}/>, 
    activeBorder: 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10',
    activeIcon: 'bg-indigo-500 text-white',
    activeText: 'text-indigo-700 dark:text-indigo-400'
  },
  { 
    id: 'bikram_sambat', 
    name: 'Nepali (BS)', 
    desc: 'Bikram Sambat', 
    icon: <FaMountain size={16}/>, 
    activeBorder: 'border-rose-500 bg-rose-50 dark:bg-rose-500/10',
    activeIcon: 'bg-rose-500 text-white',
    activeText: 'text-rose-700 dark:text-rose-400'
  },
  { 
    id: 'hijri', 
    name: 'Islamic (Hijri)', 
    desc: 'Lunar Calendar', 
    icon: <FaMoon size={16}/>, 
    activeBorder: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
    activeIcon: 'bg-emerald-500 text-white',
    activeText: 'text-emerald-700 dark:text-emerald-400'
  },
  { 
    id: 'jalali', 
    name: 'Persian (Jalali)', 
    desc: 'Solar Calendar', 
    icon: <HiOutlineCalendar size={20}/>, 
    activeBorder: 'border-amber-500 bg-amber-50 dark:bg-amber-500/10',
    activeIcon: 'bg-amber-500 text-white',
    activeText: 'text-amber-700 dark:text-amber-400'
  }
];

const Settings = () => {
  const { user, dbData, avatar, displayName, refreshUser } = useAuth();
  const fileInputRef = useRef(null);

  // --- CROP STATES ---
  const [selectedFile, setSelectedFile] = useState(null);
  const [cropModal, setCropModal] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatar);

  useEffect(() => {
    if (avatar) {
      setCurrentAvatarUrl(`${avatar}?t=${new Date().getTime()}`);
    }
  }, [avatar]);

  // Security States
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordAuthPin, setPasswordAuthPin] = useState(""); 
  const [loading, setLoading] = useState(false);
  const [oldPin, setOldPin] = useState(""); 
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinAuthPassword, setPinAuthPassword] = useState(""); 
  const [pinLoading, setPinLoading] = useState(false);

  // 🚀 CALENDAR STATE
  const [calLoading, setCalLoading] = useState(false);
  const [baseCalendar, setBaseCalendar] = useState(dbData?.settings?.baseCalendar || 'gregorian');

  const isSocialUser = user?.providerData?.some(p => p.providerId === 'google.com' || p.providerId === 'github.com');
  const isEmailUser = user?.providerData?.some(p => p.providerId === 'password');
  const isPinSet = dbData?.security?.isPinSet;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file);
      setCropModal(true);
    }
  };

  const onCropComplete = (croppedArea, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  };

  const handleCropSave = async () => {
    if (!selectedFile || !croppedAreaPixels) return;
    setUploading(true);
    try {
      const croppedBlob = await getCroppedImg(URL.createObjectURL(selectedFile), croppedAreaPixels);
      const formData = new FormData();
      formData.append("image", croppedBlob);
      const IMGBB_API_KEY = "5ea0f524578cd108c888941178b2b3e9"; 

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
      const data = await response.json();
      
      if (!data.success) throw new Error("Upload Failed");

      const photoURL = data.data.url; 
      
      await updateProfile(auth.currentUser, { photoURL });
      await setDoc(doc(db, "users", user.uid), { photoURL }, { merge: true });
      
      setCurrentAvatarUrl(`${photoURL}?t=${new Date().getTime()}`);
      await refreshUser();
      
      alert("Profile picture updated! ✅");
      setCropModal(false);
    } catch (err) {
      alert("Error uploading image ❌");
    } finally {
      setUploading(false);
    }
  };

  // --- SECURITY LOGIC ---
  const hashPIN = async (pinCode) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pinCode);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handlePinSave = async (e) => {
    e.preventDefault();
    setPinLoading(true);
    try {
      await auth.currentUser.reload();
      if (!auth.currentUser.emailVerified && !isSocialUser) {
        await sendEmailVerification(auth.currentUser);
        alert("Please verify email first!");
        setPinLoading(false); return;
      }
      if (isEmailUser && !isSocialUser) {
        const credential = EmailAuthProvider.credential(user.email, pinAuthPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
      }
      if (isPinSet) {
        const hashedOldPin = await hashPIN(oldPin);
        if (hashedOldPin !== dbData.security.pinHash) throw new Error("Wrong Old PIN");
      }
      const hashedPin = await hashPIN(pin);
      await setDoc(doc(db, "users", user.uid), { 
        security: { pinHash: hashedPin, isPinSet: true }
      }, { merge: true });
      alert("Security PIN Activated! 🛡️");
      setOldPin(""); setPin(""); setConfirmPin(""); setPinAuthPassword("");
      await refreshUser();
    } catch (err) {
      alert("Verification Failed ❌");
    } finally {
      setPinLoading(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isPinSet) {
        const hashedAuthPin = await hashPIN(passwordAuthPin);
        if (hashedAuthPin !== dbData.security.pinHash) throw new Error("Wrong PIN");
      }
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      alert("Password Updated! ✅");
      setCurrentPassword(""); setNewPassword(""); setPasswordAuthPin("");
    } catch (err) {
      alert("Update Failed ❌");
    } finally {
      setLoading(false);
    }
  };

  // 🚀 SAVE CALENDAR SETTING
  const handleCalendarUpdate = async (selectedCode) => {
    if (!user) return;
    setCalLoading(true);
    setBaseCalendar(selectedCode);
    try {
      await setDoc(doc(db, "users", user.uid), {
        settings: { baseCalendar: selectedCode }
      }, { merge: true });
      await refreshUser();
    } catch (error) {
      alert("Failed to update calendar settings");
    } finally {
      setCalLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10 mt-20 space-y-10 mb-20">
      <h1 className="text-3xl font-black dark:text-white">Settings</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Profile Card & Calendar */}
        <div className="space-y-6">
          
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 text-center shadow-xl">
            <div className="relative inline-block">
              <div className={`relative ${uploading ? "animate-pulse" : ""}`}>
                <Avatar src={currentAvatarUrl} name={displayName} size={112} />
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
              <button onClick={() => fileInputRef.current.click()} className="absolute bottom-1 right-1 bg-blue-600 p-2.5 rounded-full text-white shadow-lg z-10 hover:scale-110 transition-transform">
                <HiOutlineCamera size={18} />
              </button>
            </div>
            <h3 className="mt-4 font-black dark:text-white truncate text-xl">{displayName}</h3>
            <div className="mt-4 flex justify-center">
              <span className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-inner ${isPinSet ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
                <HiOutlineShieldCheck size={16} /> {isPinSet ? '2FA Active' : 'Unsecured'}
              </span>
            </div>
          </div>

          {/* 🚀 UPGRADED: 4 Calendar Preference Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-xl">
            <h4 className="text-sm font-black uppercase flex items-center gap-2 text-indigo-500 mb-4">
              <HiOutlineCalendar size={20}/> Base Calendar
            </h4>
            
            {/* Displaying 4 Calendars in a 2x2 grid format for compactness */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-3">
              {calendarOptions.map((cal) => {
                const isSelected = baseCalendar === cal.id;
                return (
                  <button 
                    key={cal.id}
                    disabled={calLoading}
                    onClick={() => handleCalendarUpdate(cal.id)} 
                    className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left ${isSelected ? cal.activeBorder : 'border-transparent bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isSelected ? cal.activeIcon : 'bg-slate-200 dark:bg-slate-900 text-slate-500'}`}>
                       {cal.icon}
                    </div>
                    <div className="min-w-0">
                       <p className={`font-black text-[13px] truncate ${isSelected ? cal.activeText : 'text-slate-700 dark:text-white'}`}>{cal.name}</p>
                       <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest truncate">{cal.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          
        </div>

        {/* Forms */}
        <div className="md:col-span-2 space-y-6">
          <form onSubmit={handlePinSave} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 space-y-5 shadow-xl">
            <h4 className="text-sm font-black uppercase flex items-center gap-2 text-emerald-500"><HiOutlineShieldCheck size={20} /> Security Passcode</h4>
            <div className="space-y-3">
              {isEmailUser && <input type="password" placeholder="Verify Main Password" value={pinAuthPassword} onChange={(e) => setPinAuthPassword(e.target.value)} className="w-full p-4 rounded-2xl bg-slate-100 dark:bg-slate-950 outline-none dark:text-white font-black text-sm border border-transparent focus:border-emerald-500 transition-all" />}
              {isPinSet && <input type="password" placeholder="Current Passcode" value={oldPin} onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))} className="w-full p-4 rounded-2xl bg-slate-100 dark:bg-slate-950 outline-none dark:text-white font-black tracking-widest border border-transparent focus:border-emerald-500 transition-all" />}
              <div className="grid grid-cols-2 gap-4">
                <input type="password" placeholder="New PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-white/5 outline-none dark:text-white font-black tracking-widest border border-transparent focus:border-emerald-500 transition-all" />
                <input type="password" placeholder="Confirm PIN" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))} className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-white/5 outline-none dark:text-white font-black tracking-widest border border-transparent focus:border-emerald-500 transition-all" />
              </div>
            </div>
            <button disabled={pinLoading} className="w-full py-4 mt-2 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
              {pinLoading ? "Processing..." : "Save PIN Security"}
            </button>
          </form>

          {isEmailUser && (
            <form onSubmit={handlePasswordUpdate} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 space-y-5 shadow-xl">
              <h4 className="text-sm font-black uppercase flex items-center gap-2 text-rose-500"><HiOutlineLockClosed size={20}/> Master Password</h4>
              <div className="space-y-3">
                <input type="password" placeholder="Current Password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full p-4 rounded-2xl bg-slate-100 dark:bg-slate-950 outline-none dark:text-white text-sm font-black border border-transparent focus:border-rose-500 transition-all" />
                {isPinSet && <input type="password" placeholder="Verify 2FA Passcode" value={passwordAuthPin} onChange={(e) => setPasswordAuthPin(e.target.value.replace(/\D/g, ''))} className="w-full p-4 rounded-2xl bg-slate-100 dark:bg-slate-950 outline-none dark:text-white font-black tracking-widest border border-transparent focus:border-rose-500 transition-all" />}
                <input type="password" placeholder="New Master Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-white/5 outline-none dark:text-white text-sm font-black border border-transparent focus:border-rose-500 transition-all" />
              </div>
              <button disabled={loading} className="w-full py-4 bg-rose-500 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-rose-500/20 active:scale-95 transition-all">
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Crop Modal */}
      {cropModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[500] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-6 max-w-md w-full relative shadow-2xl">
            <div className="relative h-80 w-full rounded-2xl overflow-hidden mb-6 bg-slate-100 dark:bg-slate-800">
              <Cropper 
                image={selectedFile && URL.createObjectURL(selectedFile)} 
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
            <div className="flex justify-end gap-3">
              <button onClick={() => setCropModal(false)} className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white rounded-xl font-bold">Cancel</button>
              <button onClick={handleCropSave} disabled={uploading} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black shadow-lg shadow-blue-500/30 active:scale-95 transition-all">
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