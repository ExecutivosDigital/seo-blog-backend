/**
 * Centralized API error messages (English only).
 */
export const ERROR_MESSAGES = {
  // 400
  BAD_REQUEST: 'Bad request',
  VALIDATION_FAILED: 'Validation failed',
  MISSING_REQUIRED_FIELDS: 'Missing required fields',
  INVALID_PARAMETERS: 'Invalid parameters provided',
  FILE_REQUIRED: 'File is required',
  FILE_UPLOAD_FAILED: 'Failed to upload file',

  // 401
  UNAUTHORIZED: 'Authorization required',
  TOKEN_NOT_FOUND: 'Authorization token not found',
  TOKEN_INVALID: 'Token is not valid',
  INVALID_CREDENTIALS: 'Invalid credentials',
  LOGIN_FAILED: 'Login failed',

  // 403
  FORBIDDEN: 'Forbidden',
  ADMIN_ACCESS_REQUIRED: 'Admin access required',

  // 404
  NOT_FOUND: 'Resource not found',
  ADMIN_NOT_FOUND: 'Admin not found',
  SITE_NOT_FOUND: 'Site not found',
  CONTENT_NOT_FOUND: 'Content not found',
  IDEA_NOT_FOUND: 'Idea not found',

  // 409
  CONFLICT: 'Resource already exists',

  // 500
  INTERNAL_SERVER_ERROR: 'Internal server error',
} as const;
