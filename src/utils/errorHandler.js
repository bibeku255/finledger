// src/utils/errorHandler.js
export const handleAsyncError = (error, context = 'Operation') => {
  // Categorize error
  if (error.code === 'PERMISSION_DENIED') {
    return `You don't have permission to perform this ${context}`;
  }
  if (error.code === 'NETWORK_ERROR' || error.message.includes('offline')) {
    return 'Network error. Check your internet connection.';
  }
  if (error.message.includes('timeout')) {
    return `${context} timed out. Please try again.`;
  }
  return error.message || `${context} failed. Please try again.`;
};

// Usage:
try {
  await deleteDoc(...);
} catch (error) {
  const msg = handleAsyncError(error, 'Deletion');
  addToast(msg, 'error');
  console.error('Delete error:', error);
}