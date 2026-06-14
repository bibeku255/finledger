import React, { useState, useEffect, useCallback } from 'react';
import { 
  FaBitcoin, FaDog, FaApple, FaRocket, FaCloud, FaMoon, FaLeaf, FaGhost,
  FaAnchor, FaBicycle, FaBomb, FaBug, FaCar, FaCat, FaChessKnight,
  FaCoffee, FaCrow, FaDice, FaDragon, FaFish, FaGamepad, FaGift,
  FaGlassMartini, FaHammer, FaHeart, FaIceCream, FaKey, FaLightbulb,
  FaPlane, FaRobot, FaSpider, FaStar, FaUmbrella, FaWrench 
} from 'react-icons/fa';
import { HiRefresh } from 'react-icons/hi';

const IconCaptcha = ({ onVerify }) => {
  const [captchaIcons, setCaptchaIcons] = useState([]);
  const [targetIcon, setTargetIcon] = useState(null);
  const [status, setStatus] = useState({ type: '', message: '' }); // 'success', 'error', or ''

  // 30+ Icons List
  const allIcons = [
    { id: 'btc', icon: <FaBitcoin />, name: 'Bitcoin' },
    { id: 'dog', icon: <FaDog />, name: 'Dog' },
    { id: 'apple', icon: <FaApple />, name: 'Apple' },
    { id: 'rocket', icon: <FaRocket />, name: 'Rocket' },
    { id: 'cloud', icon: <FaCloud />, name: 'Cloud' },
    { id: 'moon', icon: <FaMoon />, name: 'Moon' },
    { id: 'leaf', icon: <FaLeaf />, name: 'Leaf' },
    { id: 'ghost', icon: <FaGhost />, name: 'Ghost' },
    { id: 'anchor', icon: <FaAnchor />, name: 'Anchor' },
    { id: 'bike', icon: <FaBicycle />, name: 'Bicycle' },
    { id: 'bomb', icon: <FaBomb />, name: 'Bomb' },
    { id: 'bug', icon: <FaBug />, name: 'Bug' },
    { id: 'car', icon: <FaCar />, name: 'Car' },
    { id: 'cat', icon: <FaCat />, name: 'Cat' },
    { id: 'knight', icon: <FaChessKnight />, name: 'Chess' },
    { id: 'coffee', icon: <FaCoffee />, name: 'Coffee' },
    { id: 'crow', icon: <FaCrow />, name: 'Crow' },
    { id: 'dice', icon: <FaDice />, name: 'Dice' },
    { id: 'dragon', icon: <FaDragon />, name: 'Dragon' },
    { id: 'fish', icon: <FaFish />, name: 'Fish' },
    { id: 'game', icon: <FaGamepad />, name: 'Gamepad' },
    { id: 'gift', icon: <FaGift />, name: 'Gift' },
    { id: 'glass', icon: <FaGlassMartini />, name: 'Glass' },
    { id: 'hammer', icon: <FaHammer />, name: 'Hammer' },
    { id: 'heart', icon: <FaHeart />, name: 'Heart' },
    { id: 'icecream', icon: <FaIceCream />, name: 'Ice Cream' },
    { id: 'key', icon: <FaKey />, name: 'Key' },
    { id: 'bulb', icon: <FaLightbulb />, name: 'Lightbulb' },
    { id: 'plane', icon: <FaPlane />, name: 'Plane' },
    { id: 'robot', icon: <FaRobot />, name: 'Robot' },
    { id: 'spider', icon: <FaSpider />, name: 'Spider' },
    { id: 'star', icon: <FaStar />, name: 'Star' },
    { id: 'umbrella', icon: <FaUmbrella />, name: 'Umbrella' },
    { id: 'wrench', icon: <FaWrench />, name: 'Wrench' },
  ];

  const refreshCaptcha = useCallback((isManual = true) => {
    // Shuffle all 34 icons and pick 6 random ones
    const shuffledPool = [...allIcons].sort(() => 0.5 - Math.random()).slice(0, 6);
    setCaptchaIcons(shuffledPool);
    
    // Pick one of those 6 as the target
    const randomTarget = shuffledPool[Math.floor(Math.random() * shuffledPool.length)];
    setTargetIcon(randomTarget);
    
    if (isManual) {
      setStatus({ type: '', message: '' });
      onVerify(false);
    }
  }, [onVerify]);

  useEffect(() => {
    refreshCaptcha(false);
  }, []);

  const handleIconClick = (id) => {
    if (status.type === 'success') return; // Already verified

    if (id === targetIcon.id) {
      setStatus({ type: 'success', message: 'Verified Successfully!' });
      onVerify(true);
    } else {
      setStatus({ type: 'error', message: 'Wrong! Refreshing...' });
      onVerify(false);
      
      // Wrong answer par 1.5 second baad auto-refresh
      setTimeout(() => {
        refreshCaptcha(false);
      }, 1200);
    }
  };

  if (!targetIcon) return null;

  return (
    <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm">
      {/* Header Area */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bot Protection</span>
          <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200">
            Select the <span className="text-blue-600 dark:text-blue-400 font-black px-1.5 py-0.5 bg-blue-50 dark:bg-blue-500/10 rounded-md">"{targetIcon.name}"</span>
          </p>
        </div>
        <button 
          type="button"
          onClick={() => refreshCaptcha(true)}
          className="p-2 hover:rotate-180 transition-transform duration-500 text-slate-400 hover:text-blue-500"
          title="Refresh Captcha"
        >
          <HiRefresh size={20} />
        </button>
      </div>

      {/* Icons Grid */}
      <div className="grid grid-cols-6 gap-2">
        {captchaIcons.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleIconClick(item.id)}
            disabled={status.type === 'success'}
            className={`
              aspect-square rounded-xl flex items-center justify-center text-xl transition-all duration-300
              ${status.type === 'success' && item.id === targetIcon.id 
                ? 'bg-emerald-500 text-white scale-110 shadow-lg shadow-emerald-500/20' 
                : 'bg-slate-50 dark:bg-white/5 text-slate-500 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-blue-500 active:scale-90 shadow-sm'
              }
              ${status.type === 'error' && item.id !== targetIcon.id ? 'opacity-50' : ''}
              ${status.type === 'success' && item.id !== targetIcon.id ? 'opacity-20 grayscale' : ''}
            `}
          >
            {item.icon}
          </button>
        ))}
      </div>

      {/* Status Messages */}
      {status.message && (
        <div className={`mt-4 text-center text-[11px] font-black uppercase tracking-wider animate-bounce
          ${status.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}
        >
          {status.message}
        </div>
      )}
    </div>
  );
};

export default IconCaptcha;