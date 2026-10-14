export function mergeChatMessages<T extends { id: string; clientMessageId?: string; createdAt?: string; updatedAt?: string; status?: string }>(stored: T[], incoming: T[]): T[] {
  const merged = [...stored];
  for (const message of incoming) {
    const index = merged.findIndex((item) => item.id === message.id || Boolean(message.clientMessageId && item.clientMessageId === message.clientMessageId));
    if (index < 0) merged.push(message);
    else {
      const previous = merged[index];
      if (previous.updatedAt && message.updatedAt && message.updatedAt < previous.updatedAt) continue;
      const next = { ...previous, ...message };
      if (previous.status === 'seen' && (message.status === 'sent' || message.status === 'delivered')) next.status = previous.status;
      merged[index] = next;
    }
  }
  return merged.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.id.localeCompare(b.id));
}
