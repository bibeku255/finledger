import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * ✅ PUBLIC ROUTE COMPONENT
 * Redirects authenticated users away from public pages
 * Use for: Login, Signup, Forgot Password, Home, Services, Blogs, etc.
 * 
 * If user is logged in → Redirects to Dashboard
 * If user is NOT logged in → Shows public content
 */
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  // ✅ While loading auth state, return nothing (prevents flash)
  if (loading) return null;

  // ✅ If user is already logged in, send them to Dashboard instead of Login/Signup page
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  // ✅ User is not logged in → Show public content
  return children;
};

export default PublicRoute;