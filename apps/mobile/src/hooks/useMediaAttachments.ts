import { useRef, useState } from 'react';
import { isLocalMediaUri, type MediaUploadCategory } from '../services/authApi.service';
import { MediaAttachment, selectFileAttachment, selectGifAttachment, selectMediaAttachment, uploadMediaAttachments } from '../services/mediaPicker.service';

const MAX_CHAT_ATTACHMENTS = 12;

export function useMediaAttachments(category: MediaUploadCategory = 'chat') {
  const [attachments, setAttachments] = useState<MediaAttachment[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const attachmentRef = useRef<MediaAttachment[]>([]);
  const uploadQueueRef = useRef<MediaAttachment[]>([]);
  const uploadRunnerRef = useRef<Promise<void> | null>(null);
  const selectionLockRef = useRef(false);

  const updateAttachment = (id: string, changes: Partial<MediaAttachment>) => {
    const next = attachmentRef.current.map((item) => item.id === id ? { ...item, ...changes } : item);
    attachmentRef.current = next;
    setAttachments(next);
  };

  const runUploadQueue = () => {
    if (uploadRunnerRef.current) return uploadRunnerRef.current;
    const runner = (async () => {
      setIsUploading(true);
      while (uploadQueueRef.current.length) {
        const item = uploadQueueRef.current.shift();
        if (!item || !isLocalMediaUri(item.uri)) continue;
        updateAttachment(item.id, { uploadState: 'uploading' });
        try {
          const [uploaded] = await uploadMediaAttachments([item], category);
          updateAttachment(item.id, uploaded ? { ...uploaded, uploadState: 'uploaded' } : { uploadState: 'failed' });
        } catch {
          updateAttachment(item.id, { uploadState: 'failed' });
          setUploadError('Your attachment could not be uploaded. You can remove it and try again.');
        }
      }
      setIsUploading(false);
    })().finally(() => {
      uploadRunnerRef.current = null;
      setIsUploading(false);
    });
    uploadRunnerRef.current = runner;
    return runner;
  };

  const enqueueUploads = (items: MediaAttachment[]) => {
    const queuedIds = new Set(uploadQueueRef.current.map((item) => item.id));
    uploadQueueRef.current.push(...items.filter((item) => isLocalMediaUri(item.uri) && !queuedIds.has(item.id)));
    void runUploadQueue();
  };

  const runSelection = async <T,>(operation: () => Promise<T>, onSuccess: (value: T) => void) => {
    if (selectionLockRef.current) return;
    if (category === 'chat' && attachmentRef.current.length >= MAX_CHAT_ATTACHMENTS) {
      setUploadError(`You can attach up to ${MAX_CHAT_ATTACHMENTS} files to one message. Remove a file to add another.`);
      return;
    }
    selectionLockRef.current = true;
    setUploadError('');
    setIsSelecting(true);
    try {
      const result = await operation();
      onSuccess(result);
    } catch {
      setUploadError('Your attachment could not be selected. Please try again.');
    } finally {
      selectionLockRef.current = false;
      setIsSelecting(false);
    }
  };

  const addMedia = async () => {
    await runSelection(
      () => selectMediaAttachment(),
      (items) => {
        if (!items.length) return;
        const remaining = category === 'chat' ? MAX_CHAT_ATTACHMENTS - attachmentRef.current.length : items.length;
        const acceptedItems = items.slice(0, remaining);
        if (acceptedItems.length < items.length) setUploadError(`Only ${remaining} more attachment${remaining === 1 ? '' : 's'} can be added. The message limit is ${MAX_CHAT_ATTACHMENTS}.`);
        if (!acceptedItems.length) return;
        const next = [...attachmentRef.current, ...acceptedItems];
        attachmentRef.current = next;
        setAttachments(next);
        enqueueUploads(acceptedItems);
      },
    );
  };

  const addFile = async () => {
    await runSelection(
      () => selectFileAttachment(),
      (item) => {
        if (!item) return;
        if (category === 'chat' && attachmentRef.current.length >= MAX_CHAT_ATTACHMENTS) {
          setUploadError(`You can attach up to ${MAX_CHAT_ATTACHMENTS} files to one message. Remove a file to add another.`);
          return;
        }
        const next = [...attachmentRef.current, item];
        attachmentRef.current = next;
        setAttachments(next);
        enqueueUploads([item]);
      },
    );
  };

  const addGif = async () => {
    await runSelection(
      () => selectGifAttachment(),
      (item) => {
        if (!item) return;
        if (category === 'chat' && attachmentRef.current.length >= MAX_CHAT_ATTACHMENTS) {
          setUploadError(`You can attach up to ${MAX_CHAT_ATTACHMENTS} files to one message. Remove a file to add another.`);
          return;
        }
        const next = [...attachmentRef.current, item];
        attachmentRef.current = next;
        setAttachments(next);
        enqueueUploads([item]);
      },
    );
  };

  const uploadAttachments = async () => {
    if (!attachmentRef.current.length) return [];
    if (uploadRunnerRef.current) await uploadRunnerRef.current;
    const pending = attachmentRef.current.some((item) => isLocalMediaUri(item.uri) || item.uploadState === 'pending' || item.uploadState === 'uploading');
    if (pending || attachmentRef.current.some((item) => item.uploadState === 'failed')) {
      throw new Error('Wait for each attachment to finish uploading, or remove the failed attachment.');
    }
    return attachmentRef.current;
  };

  const getUploadedAttachments = () => attachmentRef.current.filter((item) => !isLocalMediaUri(item.uri) && item.uploadState !== 'failed');
  const hasPendingUploads = () => attachmentRef.current.some((item) => isLocalMediaUri(item.uri) || item.uploadState === 'pending' || item.uploadState === 'uploading');
  const clearAttachments = () => {
    uploadQueueRef.current = [];
    attachmentRef.current = [];
    setAttachments([]);
    setUploadError('');
  };
  const removeAttachment = (id: string) => {
    uploadQueueRef.current = uploadQueueRef.current.filter((item) => item.id !== id);
    const next = attachmentRef.current.filter((item) => item.id !== id);
    attachmentRef.current = next;
    setAttachments(next);
  };

  return {
    attachments,
    addMedia,
    addFile,
    addGif,
    uploadAttachments,
    getUploadedAttachments,
    hasPendingUploads,
    clearAttachments,
    removeAttachment,
    isUploading,
    isBusy: isSelecting || isUploading,
    uploadError,
    clearUploadError: () => setUploadError(''),
  };
}
