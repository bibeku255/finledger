// src/hooks/useAuth.js - IMPROVED VERSION

import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

/**
 * Custom hook to access Auth context
 * 
 * @returns {Object} Auth context value containing:
 *   - user: Firebase user object or null
 *   - loading: Boolean indicating auth state is loading
 *   - isAdmin: Boolean flag for admin access
 *   - dbData: User profile from Firestore
 *   - baseCurrency: User's selected currency
 *   - formatGlobalDate: Date formatter function
 *   - logout: Function to sign out user
 *   ... and more
 * 
 * @throws {Error} If hook is used outside AuthProvider
 * 
 * @example
 * function MyComponent() {
 *   const { user, logout, baseCurrency } = useAuth();
 *   
 *   if (!user) return <Login />;
 *   
 *   return (
 *     <div>
 *       <p>Currency: {baseCurrency}</p>
 *       <button onClick={logout}>Sign Out</button>
 *     </div>
 *   );
 * }
 */
export const useAuth = () => {
  const context = useContext(AuthContext);

  // ✅ Better error message with helpful debugging info
  if (!context) {
    // Development warning
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[useAuth] ⚠️ Hook called outside of <AuthProvider>\n' +
        'Make sure your component tree is wrapped with AuthProvider:\n' +
        '\n' +
        '<AuthProvider>\n' +
        '  <App />\n' +
        '</AuthProvider>'
      );
    }
    
    throw new Error(
      'useAuth must be used within an <AuthProvider> component. ' +
      'Wrap your app with AuthProvider in main.jsx or the root component.'
    );
  }

  // ✅ Ensure all expected properties exist (safety for refactoring)
  const {
    user = null,
    dbData = null,
    loading = true,
    isAdmin = false,
    avatar = null,
    displayName = 'User',
    baseCurrency = 'USD',
    selectedCryptos = [],
    selectedFiats = [],
    formatGlobalDate,
    getCalendarMonthKey,
    // ... all other properties with safe defaults
    ...rest
  } = context;

  return {
    user,
    dbData,
    loading,
    isAdmin,
    avatar,
    displayName,
    baseCurrency,
    selectedCryptos,
    selectedFiats,
    formatGlobalDate,
    getCalendarMonthKey,
    ...rest
  };
};

// ✅ Add display name for React DevTools
useAuth.displayName = 'useAuth';