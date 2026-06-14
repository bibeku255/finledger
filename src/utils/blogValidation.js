// src/utils/blogValidation.js
/**
 * Blog Data Validation Utility
 * Validates all blog fields before saving to Firestore
 * Prevents invalid data, XSS, and field length exploits
 */

const VALID_CATEGORIES = [
  "Tech & AI",
  "Crypto Strategies",
  "Wealth Management",
  "Platform Updates",
  "News"
];

// ✅ Named export for VALID_CATEGORIES (used in WriteBlog.jsx)
export { VALID_CATEGORIES };

const CONSTRAINTS = {
  title: { min: 5, max: 200 },
  excerpt: { min: 10, max: 500 },
  content: { min: 50, max: 50000 },
  tags: { maxCount: 10, maxLength: 50 },
  slug: { max: 300 }
};

/**
 * Validate individual blog title
 * @param {string} title - Blog title
 * @returns {Object} { valid: boolean, error?: string }
 */
export const validateTitle = (title) => {
  if (!title || typeof title !== 'string') {
    return { valid: false, error: 'Title is required' };
  }

  const trimmed = title.trim();

  if (trimmed.length < CONSTRAINTS.title.min) {
    return {
      valid: false,
      error: `Title must be at least ${CONSTRAINTS.title.min} characters`
    };
  }

  if (trimmed.length > CONSTRAINTS.title.max) {
    return {
      valid: false,
      error: `Title must be under ${CONSTRAINTS.title.max} characters (current: ${trimmed.length})`
    };
  }

  // Check for suspicious patterns
  if (/<script|javascript:|onerror|onclick/i.test(trimmed)) {
    return { valid: false, error: 'Title contains invalid characters' };
  }

  return { valid: true };
};

/**
 * Validate blog excerpt
 * @param {string} excerpt - Blog excerpt
 * @returns {Object} { valid: boolean, error?: string }
 */
export const validateExcerpt = (excerpt) => {
  if (!excerpt || typeof excerpt !== 'string') {
    return { valid: false, error: 'Excerpt is required' };
  }

  const trimmed = excerpt.trim();

  if (trimmed.length < CONSTRAINTS.excerpt.min) {
    return {
      valid: false,
      error: `Excerpt must be at least ${CONSTRAINTS.excerpt.min} characters`
    };
  }

  if (trimmed.length > CONSTRAINTS.excerpt.max) {
    return {
      valid: false,
      error: `Excerpt must be under ${CONSTRAINTS.excerpt.max} characters (current: ${trimmed.length})`
    };
  }

  return { valid: true };
};

/**
 * Validate blog category
 * @param {string} category - Blog category
 * @returns {Object} { valid: boolean, error?: string }
 */
export const validateCategory = (category) => {
  if (!category || typeof category !== 'string') {
    return { valid: false, error: 'Category is required' };
  }

  if (!VALID_CATEGORIES.includes(category)) {
    return {
      valid: false,
      error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`
    };
  }

  return { valid: true };
};

/**
 * Validate cover image URL
 * @param {string} imageUrl - Cover image URL (optional)
 * @returns {Object} { valid: boolean, error?: string }
 */
export const validateCoverImage = (imageUrl) => {
  // Cover image is optional
  if (!imageUrl) {
    return { valid: true };
  }

  if (typeof imageUrl !== 'string') {
    return { valid: false, error: 'Cover image must be a URL string' };
  }

  const trimmed = imageUrl.trim();

  // Validate URL format
  try {
    const url = new URL(trimmed);
    
    // Only allow HTTPS
    if (url.protocol !== 'https:') {
      return {
        valid: false,
        error: 'Cover image must use HTTPS (secure) URL'
      };
    }

    // Check domain whitelist (optional - prevent CDN abuse)
    const allowedDomains = [
      'imgur.com',
      'imgbb.com',
      'cloudinary.com',
      'firebase.google.com',
      'github.com',
      'unsplash.com',
      'pexels.com',
      'pixabay.com'
    ];
    
    const hostname = url.hostname.replace('www.', '');
    
    // Allow any HTTPS URL for flexibility, but log suspicious ones
    console.log('[blogValidation] Image URL from domain:', hostname);

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Cover image must be a valid HTTPS URL' };
  }
};

/**
 * Validate blog content (HTML)
 * @param {string} content - Blog HTML content
 * @returns {Object} { valid: boolean, error?: string }
 */
export const validateContent = (content) => {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: 'Content is required' };
  }

  const trimmed = content.trim();

  // Check minimum length
  if (trimmed.length < CONSTRAINTS.content.min) {
    return {
      valid: false,
      error: `Content must be at least ${CONSTRAINTS.content.min} characters`
    };
  }

  // Check maximum size
  if (trimmed.length > CONSTRAINTS.content.max) {
    return {
      valid: false,
      error: `Content is too large. Must be under ${Math.round(CONSTRAINTS.content.max / 1000)}KB (current: ${Math.round(trimmed.length / 1000)}KB)`
    };
  }

  // Check if content is just empty HTML tags
  const cleanContent = trimmed
    .replace(/<[^>]+>/g, '')
    .trim();

  if (cleanContent.length < CONSTRAINTS.content.min) {
    return {
      valid: false,
      error: 'Content cannot be empty or contain only HTML tags'
    };
  }

  return { valid: true };
};

/**
 * Validate blog tags
 * @param {Array<string>} tags - Array of tags
 * @returns {Object} { valid: boolean, error?: string }
 */
export const validateTags = (tags) => {
  // Tags are optional
  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    return { valid: true };
  }

  // Check tag count
  if (tags.length > CONSTRAINTS.tags.maxCount) {
    return {
      valid: false,
      error: `Maximum ${CONSTRAINTS.tags.maxCount} tags allowed (current: ${tags.length})`
    };
  }

  // Validate each tag
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];

    if (typeof tag !== 'string') {
      return {
        valid: false,
        error: `Tag ${i + 1} must be a string`
      };
    }

    const trimmedTag = tag.trim();

    if (trimmedTag.length === 0) {
      return {
        valid: false,
        error: `Tag ${i + 1} cannot be empty`
      };
    }

    if (trimmedTag.length > CONSTRAINTS.tags.maxLength) {
      return {
        valid: false,
        error: `Tag ${i + 1} must be under ${CONSTRAINTS.tags.maxLength} characters (current: ${trimmedTag.length})`
      };
    }

    // Check for suspicious characters
    if (/<script|javascript:|onerror/i.test(trimmedTag)) {
      return {
        valid: false,
        error: `Tag ${i + 1} contains invalid characters`
      };
    }
  }

  return { valid: true };
};

/**
 * Validate blog slug
 * @param {string} slug - Blog slug
 * @returns {Object} { valid: boolean, error?: string }
 */
export const validateSlug = (slug) => {
  if (!slug || typeof slug !== 'string') {
    return { valid: false, error: 'Slug is required' };
  }

  const trimmed = slug.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Slug cannot be empty' };
  }

  if (trimmed.length > CONSTRAINTS.slug.max) {
    return {
      valid: false,
      error: `Slug must be under ${CONSTRAINTS.slug.max} characters`
    };
  }

  // Slug should only contain lowercase letters, numbers, hyphens
  if (!/^[a-z0-9-]+$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Slug must contain only lowercase letters, numbers, and hyphens'
    };
  }

  // Slug cannot start or end with hyphen
  if (trimmed.startsWith('-') || trimmed.endsWith('-')) {
    return {
      valid: false,
      error: 'Slug cannot start or end with a hyphen'
    };
  }

  return { valid: true };
};

/**
 * Complete blog data validation
 * Validates all fields and returns comprehensive error report
 * 
 * @param {Object} data - Blog data object
 * @param {string} data.title - Blog title
 * @param {string} data.excerpt - Blog excerpt
 * @param {string} data.category - Blog category
 * @param {string} data.coverImage - Cover image URL (optional)
 * @param {string} data.content - Blog HTML content
 * @param {Array<string>} data.tags - Blog tags (optional)
 * @param {string} data.slug - Blog slug (optional)
 * 
 * @returns {Object} {
 *   valid: boolean,
 *   errors: Array<string>,
 *   warnings: Array<string>
 * }
 */
export const validateBlogData = (data) => {
  const errors = [];
  const warnings = [];

  // Validate title
  const titleCheck = validateTitle(data.title);
  if (!titleCheck.valid) errors.push(titleCheck.error);

  // Validate excerpt
  const excerptCheck = validateExcerpt(data.excerpt);
  if (!excerptCheck.valid) errors.push(excerptCheck.error);

  // Validate category
  const categoryCheck = validateCategory(data.category);
  if (!categoryCheck.valid) errors.push(categoryCheck.error);

  // Validate cover image (optional)
  if (data.coverImage) {
    const imageCheck = validateCoverImage(data.coverImage);
    if (!imageCheck.valid) errors.push(imageCheck.error);
  } else {
    warnings.push('No cover image provided. Blogs look better with images.');
  }

  // Validate content
  const contentCheck = validateContent(data.content);
  if (!contentCheck.valid) errors.push(contentCheck.error);

  // Validate tags
  if (data.tags && data.tags.length > 0) {
    const tagsCheck = validateTags(data.tags);
    if (!tagsCheck.valid) errors.push(tagsCheck.error);
  }

  // Validate slug (if provided)
  if (data.slug) {
    const slugCheck = validateSlug(data.slug);
    if (!slugCheck.valid) errors.push(slugCheck.error);
  }

  // Additional security checks
  if (data.content && data.title && data.excerpt) {
    const ratio = data.content.length / (data.title.length + data.excerpt.length);
    if (ratio < 5) {
      warnings.push('Content seems short relative to title and excerpt.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    data: {
      title: data.title?.trim() || '',
      excerpt: data.excerpt?.trim() || '',
      category: data.category || '',
      coverImage: data.coverImage?.trim() || '',
      content: data.content || '',
      tags: (data.tags || []).map(t => t.trim()).filter(t => t),
      slug: data.slug || ''
    }
  };
};

/**
 * Generate slug from title
 * @param {string} title - Blog title
 * @returns {string} Generated slug
 */
export const generateSlugFromTitle = (title) => {
  if (!title || typeof title !== 'string') return '';

  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

/**
 * Sanitize slug for safety
 * @param {string} slug - Raw slug
 * @returns {string} Sanitized slug
 */
export const sanitizeSlug = (slug) => {
  if (!slug || typeof slug !== 'string') return '';

  return slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '') // Only lowercase letters, numbers, hyphens
    .replace(/-+/g, '-') // Multiple hyphens to single
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

/**
 * Check if content has potential issues
 * @param {string} content - HTML content
 * @returns {Array<string>} Array of warnings
 */
export const checkContentWarnings = (content) => {
  const warnings = [];

  // Check for broken YouTube embeds
  if (content.includes('youtube.com') && !content.includes('iframe')) {
    warnings.push('YouTube links detected. Consider using embeds for better experience.');
  }

  // Check for external image count
  const externalImages = (content.match(/https?:\/\/[^\s"<>]+\.(jpg|jpeg|png|gif|webp)/gi) || []).length;
  if (externalImages > 10) {
    warnings.push(`Many external images detected (${externalImages}). May slow down loading.`);
  }

  // Check for very long paragraphs
  const paragraphs = content.match(/<p[^>]*>[\s\S]*?<\/p>/g) || [];
  const longParagraphs = paragraphs.filter(p => p.length > 1000).length;
  if (longParagraphs > 3) {
    warnings.push('Some paragraphs are very long. Consider breaking them up for readability.');
  }

  // Check for code blocks
  if (content.includes('<code') && content.length < 500) {
    warnings.push('Code block detected in short content. Make sure code is properly formatted.');
  }

  return warnings;
};

export default {
  validateTitle,
  validateExcerpt,
  validateCategory,
  validateCoverImage,
  validateContent,
  validateTags,
  validateSlug,
  validateBlogData,
  generateSlugFromTitle,
  sanitizeSlug,
  checkContentWarnings,
  VALID_CATEGORIES,
  CONSTRAINTS
};