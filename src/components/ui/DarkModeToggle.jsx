import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../hooks/useTheme'; 
import '../../styles/DarkModeToggle.css'; 

const DarkModeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';

  // --- DRAG AND DROP LOGIC ---
  const toggleRef = useRef(null);
  
  // Load saved position from Local Storage or set default bottom-right
  const [position, setPosition] = useState(() => {
    const savedPos = localStorage.getItem('darkModeTogglePosition');
    if (savedPos) {
      return JSON.parse(savedPos);
    }
    // Default position: roughly bottom right corner
    return { x: window.innerWidth - 140, y: window.innerHeight - 80 }; 
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false); // To distinguish click vs drag

  // Keep it within screen bounds on resize
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => {
        let newX = prev.x;
        let newY = prev.y;
        
        if (newX > window.innerWidth - 130) newX = window.innerWidth - 130;
        if (newY > window.innerHeight - 70) newY = window.innerHeight - 70;
        if (newX < 10) newX = 10;
        if (newY < 10) newY = 10;

        return { x: newX, y: newY };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleStart = (e) => {
    // Determine client coordinates (mouse or touch)
    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

    const rect = toggleRef.current.getBoundingClientRect();
    setIsDragging(true);
    setHasMoved(false);
    
    // Calculate where exactly inside the button the user clicked
    setDragOffset({
      x: clientX - rect.left,
      y: clientY - rect.top
    });

    // Prevent default touch behavior (scrolling) while dragging
    if (e.type.includes('touch')) {
       document.body.style.overflow = 'hidden';
    }
  };

  const handleMove = (e) => {
    if (!isDragging) return;

    setHasMoved(true); // User is moving, so it's a drag, not a click

    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

    let newX = clientX - dragOffset.x;
    let newY = clientY - dragOffset.y;

    // Boundaries
    const maxX = window.innerWidth - toggleRef.current.offsetWidth - 10;
    const maxY = window.innerHeight - toggleRef.current.offsetHeight - 10;

    if (newX < 10) newX = 10;
    if (newX > maxX) newX = maxX;
    if (newY < 10) newY = 10;
    if (newY > maxY) newY = maxY;

    setPosition({ x: newX, y: newY });
  };

  const handleEnd = (e) => {
    if (isDragging) {
      setIsDragging(false);
      localStorage.setItem('darkModeTogglePosition', JSON.stringify(position));
      document.body.style.overflow = ''; // Restore scrolling
    }
  };

  // Add global event listeners for smooth drag even if mouse leaves the button area
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMove, { passive: false });
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
    } else {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, dragOffset]);

  const handleClick = (e) => {
    // If the user was dragging, don't trigger the theme switch
    if (hasMoved) {
      e.preventDefault();
      return;
    }
    toggleTheme();
  };

  return (
    <div 
      ref={toggleRef}
      onMouseDown={handleStart}
      onTouchStart={handleStart}
      className={`fixed z-[9999] horizontal-dark-mode-container bg-transparent transform scale-[0.8] md:scale-100 origin-center transition-transform ${isDragging ? 'cursor-grabbing scale-105 opacity-90' : 'cursor-grab'}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: 'none' // Crucial for mobile dragging
      }}
    >
      <button
        className={`horizontal-dark-mode-toggle relative w-[120px] h-[60px] border-none rounded-full transition-colors duration-500 ease-in-out overflow-hidden pointer-events-none
          ${isDarkMode 
            ? 'bg-gradient-to-br from-gray-800 to-blue-800 shadow-lg shadow-blue-900/30' 
            : 'bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg shadow-purple-500/30'
          }`}
        onClick={handleClick} 
        style={{ pointerEvents: 'auto' }} // Allow clicks inside the wrapper
        aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {/* Toggle Track */}
        <div className="horizontal-toggle-track absolute top-0 left-0 w-full h-full transition-all duration-500 ease-in-out">
          
          {/* Day Scene */}
          <div className={`horizontal-scene day-scene-horizontal absolute top-0 w-full h-full transition-all duration-500 ease-in-out
            ${isDarkMode ? 'opacity-0 -translate-x-full' : 'opacity-100 translate-x-0'}`}>
            <div className="horizontal-sky day-sky-horizontal absolute w-full h-full bg-gradient-to-b from-sky-300 via-sky-200 to-blue-50" />
            <div className="sun-horizontal absolute top-2 left-4 w-6 h-6 rounded-full" />
            
            <div className="clouds-container absolute bottom-2 w-full h-8 z-10 pointer-events-none">
              <div className="real-cloud cloud-1-h absolute left-3 bottom-1">
                <div className="cloud-ball ball-1" /><div className="cloud-ball ball-2" /><div className="cloud-ball ball-3" /><div className="cloud-ball ball-4" />
              </div>
              <div className="real-cloud cloud-2-h absolute left-12 bottom-3">
                <div className="cloud-ball ball-1" /><div className="cloud-ball ball-2" /><div className="cloud-ball ball-3" />
              </div>
              <div className="real-cloud cloud-3-h absolute right-4 bottom-2">
                <div className="cloud-ball ball-1" /><div className="cloud-ball ball-2" /><div className="cloud-ball ball-3" /><div className="cloud-ball ball-4" /><div className="cloud-ball ball-5" />
              </div>
            </div>
          </div>
          
          {/* Night Scene */}
          <div className={`horizontal-scene night-scene-horizontal absolute top-0 w-full h-full transition-all duration-500 ease-in-out
            ${isDarkMode ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'}`}>
            <div className="horizontal-sky night-sky-horizontal absolute w-full h-full bg-gradient-to-b from-gray-900 via-gray-800 to-gray-700" />
            
            <div className="moon-horizontal absolute top-2 right-4 w-5 h-5 rounded-full">
              <div className="moon-crater-h crater-1-h absolute top-1 left-1 w-1 h-1 rounded-full" />
              <div className="moon-crater-h crater-2-h absolute top-3 right-1 w-[6px] h-[6px] rounded-full" />
              <div className="moon-crater-h crater-3-h absolute bottom-1 left-2 w-[10px] h-[10px] rounded-full" />
            </div>
            
            <div className="stars-container absolute top-0 left-0 w-full h-full pointer-events-none">
              <div className="star-h star-1-h absolute top-4 left-10" /><div className="star-h star-2-h absolute top-6 left-15" /><div className="star-h star-3-h absolute top-9 left-12" />
              <div className="star-h star-4-h absolute top-5 left-20" /><div className="star-h star-5-h absolute top-10 left-18" /><div className="star-h star-6-h absolute top-8 left-8" />
            </div>
          </div>
        </div>
        
        {/* Toggle Thumb */}
        <div className={`horizontal-toggle-thumb absolute top-1 left-1 w-[52px] h-[52px] bg-white rounded-full transition-all duration-500 ease-in-out flex items-center justify-center z-30 shadow-md
          ${isDarkMode ? 'translate-x-[58px] bg-gray-700' : ''}`}>
          <div className="horizontal-thumb-icon text-xl">
            {isDarkMode ? '🌙' : '☀️'}
          </div>
        </div>
      </button>
    </div>
  );
};

export default DarkModeToggle;