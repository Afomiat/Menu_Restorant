import { apiClient, ensureStaffSession } from './apiClient';

export interface SignedUploadParams {
  signature: string;
  timestamp: number;
  api_key: string;
  cloud_name: string;
  folder: string;
}

/**
 * Uploads an image file directly to Cloudinary using backend-signed authorization (Approach B).
 * Automatically injects responsive f_auto,q_auto dynamic delivery parameters for fast food menu loading.
 */
export async function uploadImageToCloudinary(
  file: File,
  folder: 'dishes' | 'branding' = 'dishes'
): Promise<string> {
  // Ensure staff session exists in dev mode if not logged in
  await ensureStaffSession();

  // 1. Request cryptographic signature from Go backend
  const res = await apiClient.post<{ data: SignedUploadParams }>('/admin/uploads/cloudinary-sign', {
    folder,
  });

  const { signature, timestamp, api_key, cloud_name, folder: targetFolder } = res.data;

  // 2. Stream directly to Cloudinary edge servers (bypassing backend server load)
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', api_key);
  formData.append('timestamp', String(timestamp));
  formData.append('signature', signature);
  formData.append('folder', targetFolder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    const rawMsg = data?.error?.message || `Cloudinary upload failed with status ${response.status}`;
    if (rawMsg.toLowerCase().includes('permissions') || rawMsg.toLowerCase().includes('create')) {
      throw new Error('Cloudinary API Key is missing "upload/create" permissions. In your Cloudinary Dashboard under Settings > Access Keys, make sure this key has Upload permissions or use the Master Key.');
    }
    throw new Error(rawMsg);
  }

  let secureUrl = (data.secure_url || data.url) as string;

  // 3. Inject smart food delivery transformations (auto-WebP/AVIF format, auto-quality, max 800px width)
  if (secureUrl && secureUrl.includes('/image/upload/')) {
    secureUrl = secureUrl.replace('/image/upload/', '/image/upload/f_auto,q_auto,w_800,c_limit/');
  }

  return secureUrl;
}
