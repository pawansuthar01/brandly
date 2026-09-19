import { useState } from 'react';
import { MediaAttachment, selectFileAttachment, selectMediaAttachment } from '../services/mediaPicker.service';

export function useMediaAttachments() {
  const [attachments, setAttachments] = useState<MediaAttachment[]>([]);
  const addMedia = async () => {
    const items = await selectMediaAttachment();
    if (items.length) setAttachments((current) => [...current, ...items]);
  };
  const addFile = async () => { const item = await selectFileAttachment(); if (item) setAttachments((current) => [...current, item]); };
  const removeAttachment = (id: string) => setAttachments((current) => current.filter((item) => item.id !== id));
  return { attachments, addMedia, addFile, removeAttachment };
}
