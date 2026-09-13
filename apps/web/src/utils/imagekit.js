/**
 * ImageKit Direct Upload Utility
 * 
 * Securely uploads files (images, PDFs, documents) directly from the browser
 * to ImageKit CDN using backend-signed authentication parameters.
 */

export async function uploadToImageKit(file, folder = '/general') {
  if (!file) {
    throw new Error('No file provided for upload');
  }

  // 1. Retrieve stored JWT from erp_auth in localStorage
  let token = null;
  try {
    const rawAuth = localStorage.getItem('erp_auth');
    if (rawAuth) {
      const parsed = JSON.parse(rawAuth);
      token = parsed?.token;
    }
  } catch {
    // Ignore storage parse error
  }

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  // 2. Fetch signed authentication parameters from notice-service via gateway
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const authResponse = await fetch(`${apiUrl}/api/notices/upload-auth`, {
    method: 'GET',
    headers,
  });

  if (!authResponse.ok) {
    const errorJson = await authResponse.json().catch(() => ({}));
    throw new Error(errorJson.error || errorJson.message || 'Failed to get upload authorization');
  }

  const authBody = await authResponse.json();
  const authData = authBody.data || authBody;

  const publicKey = authData.publicKey || import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY;
  const signature = authData.signature;
  const expire = authData.expire;
  const authToken = authData.token;

  if (!signature || !expire || !authToken) {
    throw new Error('Invalid signature returned by storage authorization service');
  }

  // 3. Upload file directly to ImageKit upload API
  const formData = new FormData();
  formData.append('file', file);
  formData.append('fileName', file.name || `upload_${Date.now()}`);
  formData.append('publicKey', publicKey);
  formData.append('signature', signature);
  formData.append('expire', expire);
  formData.append('token', authToken);
  formData.append('folder', folder);
  formData.append('useUniqueFileName', 'true');

  const uploadResponse = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    body: formData,
  });

  if (!uploadResponse.ok) {
    const uploadError = await uploadResponse.json().catch(() => ({}));
    throw new Error(uploadError.message || uploadError.error || 'ImageKit upload failed');
  }

  const result = await uploadResponse.json();

  return {
    url: result.url,
    fileId: result.fileId,
    name: result.name,
    filePath: result.filePath,
    thumbnailUrl: result.thumbnailUrl,
  };
}
