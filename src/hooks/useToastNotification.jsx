/**
 * TOAST NOTIFICATION SYSTEM
 * 
 * Features:
 * - Multiple toast types (success, error, warning, info)
 * - Auto-dismiss with configurable duration
 * - Unique ID generation (prevents race conditions)
 * - Timer cleanup (prevents memory leaks)
 * - Manual dismiss capability
 * - Dark mode support
 * - Smooth animations
 * 
 * FIXES APPLIED:
 * ✅ Issue #7: Fixed timer memory leak - timers stored and cleaned up
 * ✅ Issue #8: Fixed race condition in ID generation - UUID-like generation
 * 
 * @example
 * // In App.jsx or root component
 * import { ToastProvider } from './hooks/useToastNotification';
 * 
 * function App() {
 *   return (
 *     <ToastProvider>
 *       <YourApp />
 *     </ToastProvider>
 *   );
 * }
 * 
 * // In any component
 * import { useToast } from './hooks/useToastNotification';
 * 
 * function MyComponent() {
 *   const { addToast } = useToast();
 *   
 *   const handleClick = () => {
 *     addToast('Success!', 'success', 3000);
 *   };
 *   
 *   return <button onClick={handleClick}>Show Toast</button>;
 * }
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { HiOutlineX, HiOutlineCheckCircle, HiOutlineExclamationCircle, HiOutlineInformationCircle } from 'react-icons/hi';

const ToastContext = createContext(null);

/**
 * Generate unique toast ID using timestamp + multiple random sources
 * 
 * Why this approach?
 * - Timestamp alone can collide in rapid-fire situations
 * - Adding multiple random sources makes collision virtually impossible
 * - More reliable than Date.now() + Math.random()
 * 
 * Collision probability: < 1 in 1 trillion (with 3 random sources)
 * 
 * @returns {string} Unique ID in format: "timestamp-random1-random2-random3"
 * 
 * @example
 * generateToastId() // "1234567890123-456789-789456-123654"
 * generateToastId() // "1234567890123-456789-789456-123655" (different)
 */
const generateToastId = () => {
  // Use high-resolution timestamp
  const timestamp = Date.now();
  
  // Generate 3 independent random sources for collision prevention
  const random1 = Math.floor(Math.random() * 1_000_000);
  const random2 = Math.floor(Math.random() * 1_000_000);
  const random3 = Math.floor(Math.random() * 1_000_000);
  
  return `${timestamp}-${random1}-${random2}-${random3}`;
};

/**
 * Alternative: Using crypto API for even better randomness
 * (Uncomment if you want maximum security)
 * 
 * const generateToastIdCrypto = () => {
 *   const timestamp = Date.now();
 *   const array = new Uint8Array(12);
 *   crypto.getRandomValues(array);
 *   const randomHex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
 *   return `${timestamp}-${randomHex}`;
 * };
 */

/**
 * Toast Provider Component
 * 
 * Manages toast state and provides API to add/remove toasts
 * Handles automatic cleanup of timers on unmount
 * 
 * ✅ FIXED: Stores timer IDs in ref for cleanup (Issue #7)
 * ✅ FIXED: Uses UUID-like ID generation (Issue #8)
 */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  
  // ✅ FIX #7: Store timer IDs for cleanup
  const timerRefsRef = useRef(new Map());

  /**
   * Add a new toast notification
   * 
   * @param {string} message - Toast message text
   * @param {string} [type='info'] - Toast type: 'success', 'error', 'warning', 'info'
   * @param {number} [duration=4000] - Auto-dismiss duration in milliseconds
   * 
   * @example
   * addToast('Transaction successful!', 'success', 3000);
   * addToast('Something went wrong', 'error', 5000);
   * addToast('Are you sure?', 'warning', 4000);
   * addToast('Information message', 'info', 3000);
   */
  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    // ✅ FIX #8: Use UUID-like ID generation
    const id = generateToastId();
    
    // Add toast to state
    setToasts(prev => [...prev, { id, message, type, duration }]);
    
    // ✅ FIX #7: Store timer ID for cleanup
    const timerId = setTimeout(() => {
      // Remove toast from state
      setToasts(prev => prev.filter(t => t.id !== id));
      // Clean up timer reference
      timerRefsRef.current.delete(id);
    }, duration);
    
    // Store timer ID for cleanup on unmount or manual removal
    timerRefsRef.current.set(id, timerId);
  }, []);

  /**
   * Manually remove a toast
   * 
   * @param {string} id - Toast ID to remove
   * 
   * @example
   * removeToast(toastId);
   */
  const removeToast = useCallback((id) => {
    // ✅ FIX #7: Clear timer when manually removing
    if (timerRefsRef.current.has(id)) {
      clearTimeout(timerRefsRef.current.get(id));
      timerRefsRef.current.delete(id);
    }
    
    // Remove from state
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ✅ FIX #7: Cleanup all timers on provider unmount
  useEffect(() => {
    return () => {
      // Clear all pending timeouts
      timerRefsRef.current.forEach(timerId => {
        clearTimeout(timerId);
      });
      timerRefsRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastNotificationContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

/**
 * Toast Notification Container
 * 
 * Renders all active toasts in a fixed position
 * Handles stacking and animations
 */
const ToastNotificationContainer = ({ toasts, removeToast }) => (
  <div 
    className="fixed top-24 right-4 z-[10000] space-y-2 max-w-sm w-full pointer-events-none px-4 md:px-0"
    role="region"
    aria-label="Toast notifications"
    aria-live="polite"
    aria-atomic="true"
  >
    {toasts.map(toast => (
      <ToastItem 
        key={toast.id} 
        toast={toast} 
        onRemove={removeToast} 
      />
    ))}
  </div>
);

/**
 * Individual Toast Item Component
 * 
 * Displays a single toast with appropriate styling and icon
 * Supports manual dismissal via X button
 */
const ToastItem = ({ toast, onRemove }) => {
  // Map toast type to background color classes
  const bgColor = {
    success: 'bg-green-50/95 dark:bg-green-900/90 border-green-200 dark:border-green-700',
    error: 'bg-red-50/95 dark:bg-red-900/90 border-red-200 dark:border-red-700',
    warning: 'bg-amber-50/95 dark:bg-amber-900/90 border-amber-200 dark:border-amber-700',
    info: 'bg-blue-50/95 dark:bg-blue-900/90 border-blue-200 dark:border-blue-700',
  }[toast.type] || 'bg-blue-50/95 dark:bg-blue-900/90 border-blue-200 dark:border-blue-700';

  // Map toast type to icon component
  const IconMap = {
    success: (
      <HiOutlineCheckCircle className="text-green-600 dark:text-green-400 w-5 h-5 flex-shrink-0" />
    ),
    error: (
      <HiOutlineExclamationCircle className="text-red-600 dark:text-red-400 w-5 h-5 flex-shrink-0" />
    ),
    warning: (
      <HiOutlineExclamationCircle className="text-amber-600 dark:text-amber-400 w-5 h-5 flex-shrink-0" />
    ),
    info: (
      <HiOutlineInformationCircle className="text-blue-600 dark:text-blue-400 w-5 h-5 flex-shrink-0" />
    ),
  };

  // Map toast type to accessible label
  const ariaLabel = {
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Information',
  }[toast.type] || 'Notification';

  return (
    <div 
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-2xl backdrop-blur-xl border animate-in slide-in-from-right-4 fade-in duration-300 ${bgColor}`}
      role="alert"
      aria-label={ariaLabel}
    >
      {/* Icon */}
      {IconMap[toast.type]}
      
      {/* Message */}
      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 flex-1">
        {toast.message}
      </p>
      
      {/* Close Button */}
      <button
        onClick={() => onRemove(toast.id)}
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0"
        aria-label="Dismiss notification"
        type="button"
      >
        <HiOutlineX size={16} />
      </button>
    </div>
  );
};

/**
 * Hook to use toast notifications in any component
 * 
 * Must be used within a ToastProvider
 * 
 * @returns {Object} { addToast, removeToast }
 * @throws {Error} If used outside ToastProvider
 * 
 * @example
 * const { addToast } = useToast();
 * 
 * const handleSuccess = () => {
 *   addToast('Changes saved!', 'success');
 * };
 * 
 * const handleError = () => {
 *   addToast('An error occurred', 'error', 5000);
 * };
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  
  return context;
};

export default ToastProvider;
