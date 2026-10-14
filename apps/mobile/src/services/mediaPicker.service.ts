import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { uploadMediaFile, type MediaUploadCategory } from './authApi.service';

export type MediaAttachment = {
  id: string;
  name: string;
  type: 'image' | 'video' | 'file';
  uri: string;
  mimeType?: string;
  size?: number;
  uploadState?: 'pending' | 'uploading' | 'uploaded' | 'failed';
};

export type MediaUploadFeedback = { isUploading: boolean; error: string };

let uploadFeedback: MediaUploadFeedback = { isUploading: false, error: '' };
const uploadListeners = new Set<(state: MediaUploadFeedback) => void>();

const publishUploadFeedback = (state: MediaUploadFeedback) => {
  uploadFeedback = state;
  uploadListeners.forEach((listener) => listener(state));
};

export function subscribeMediaUpload(listener: (state: MediaUploadFeedback) => void) {
  uploadListeners.add(listener);
  listener(uploadFeedback);
  return () => {
    uploadListeners.delete(listener);
  };
}

export function clearMediaUploadError() {
  if (uploadFeedback.error) publishUploadFeedback({ isUploading: false, error: '' });
}

async function withUploadFeedback<T>(operation: () => Promise<T>): Promise<T> {
  publishUploadFeedback({ isUploading: true, error: '' });
  try {
    const result = await operation();
    publishUploadFeedback({ isUploading: false, error: '' });
    return result;
  } catch (error) {
    publishUploadFeedback({ isUploading: false, error: 'Your attachment could not be uploaded. Please try again.' });
    throw error;
  }
}

async function persistAttachment(item: MediaAttachment, category: MediaUploadCategory): Promise<MediaAttachment> {
  const type = item.mimeType ?? (item.type === 'image' ? 'image/jpeg' : item.type === 'video' ? 'video/mp4' : undefined);
  const uploaded = await uploadMediaFile(item.uri, { category, name: item.name, type });
  if (!uploaded) throw new Error('Sign in is required before uploading media.');
  return { ...item, uri: uploaded.url, uploadState: 'uploaded' };
}

let mediaLibraryPermissionGranted = false;

async function ensureMediaLibraryPermission() {
  if (mediaLibraryPermissionGranted) return true;
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  mediaLibraryPermissionGranted = permission.granted;
  return permission.granted;
}

export async function selectImageAttachment(): Promise<MediaAttachment | null> {
  if (!(await ensureMediaLibraryPermission())) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;
  const item = result.assets[0];
  return {
    id: `profile-${Date.now()}`,
    name: item.fileName ?? 'Profile photo',
    type: 'image',
    uri: item.uri,
    mimeType: item.mimeType,
    size: item.fileSize,
    uploadState: 'pending',
  };
}

export async function selectMediaAttachment(): Promise<MediaAttachment[]> {
  if (!(await ensureMediaLibraryPermission())) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    quality: 0.8,
  });
  if (result.canceled) return [];
  return result.assets.map((item, index) => ({
    id: `${Date.now()}-${index}`,
    name:
      item.fileName ??
      (item.type === 'video' ? 'Campaign-video.mp4' : 'Campaign-image.jpg'),
    type: item.type === 'video' ? 'video' : 'image',
    uri: item.uri,
    mimeType: item.mimeType,
    size: item.fileSize,
    uploadState: 'pending',
  }));
}

export async function selectFileAttachment(): Promise<MediaAttachment | null> {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return null;
  const item = result.assets[0];
  return { id: `${Date.now()}`, name: item.name, type: 'file', uri: item.uri, mimeType: item.mimeType, size: item.size, uploadState: 'pending' };
}

export function uploadMediaAttachments(items: MediaAttachment[], category: MediaUploadCategory) {
  if (!items.length) return Promise.resolve(items);
  return withUploadFeedback(async () => {
    const uploaded: MediaAttachment[] = [];
    for (const item of items) uploaded.push(await persistAttachment(item, category));
    return uploaded;
  });
}
