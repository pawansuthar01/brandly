import {
  AppCard,
  AppIcon,
  Avatar,
  IconButton,
  Pill,
  AppButton,
  ConfirmModal,
  SearchField,
  Skeleton,
} from "../../components/ui";
import { useTheme } from "../../providers/ThemeProvider";
import type { MarketplaceApplication, MarketplaceConversation } from "../../types/marketplace";
import type { NotificationSettings } from "./FlowScreens";
import {
  type AppNotification,
  type ScrollHandler,
} from "./marketplaceDomain";
import { makeStyles } from "./marketplaceStyles";
import { useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, Text, View, type ImageStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image as ExpoImage } from "expo-image";


export function NotificationView({
  onScroll,
  notifications,
  notificationSettings,
  onMarkRead,
  onMarkAllRead,
  onOpenNotification,
  loading = false,
  error = "",
  onRetry,
}: {
  onScroll: ScrollHandler;
  notifications: AppNotification[];
  notificationSettings: NotificationSettings;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onOpenNotification?: (notification: AppNotification) => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const visibleNotifications = notifications.filter(
    (notification) =>
      !notification.read && (notification.category === "reminders" || notificationSettings[notification.category]),
  );
  return (
    <ScrollView
      style={styles.viewport}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      <View style={styles.pageRow}>
        <View style={styles.flex}>
          <Text style={styles.pageIntro}>
            Updates about proposals, messages and your profile.
          </Text>
        </View>
        <View style={styles.notificationHeaderActions}>
          {visibleNotifications.length ? (
            <IconButton
              name="checkmark-done-outline"
              label="Mark all notifications as read"
              onPress={onMarkAllRead}
              selected
            />
          ) : null}
          <View style={styles.creatorDiscoverIcon}>
            <AppIcon
              name="notifications-outline"
              size={20}
              color={theme.colors.primary}
            />
          </View>
        </View>
      </View>
      {error ? <AppCard flat style={styles.campaignEmpty}><Text accessibilityRole="alert" style={styles.emptyBody}>{error}</Text>{onRetry ? <AppButton label="Try again" icon="refresh-outline" compact onPress={onRetry} /> : null}</AppCard> : null}
      <View style={styles.notificationList}>
        {error && !notifications.length ? null : loading && !notifications.length ? (
          <AppCard flat style={styles.campaignEmpty}><Text style={styles.emptyBody}>Loading notifications…</Text></AppCard>
        ) : visibleNotifications.length ? (
          visibleNotifications.map((notification) => (
          <Pressable
            key={notification.id}
            accessibilityRole="button"
            accessibilityLabel={`${notification.title}. ${notification.read ? "Read" : "Unread"}`}
            onPress={() => {
              onMarkRead(notification.id);
              onOpenNotification?.(notification);
            }}
            style={({ pressed }) => [
              styles.notificationRow,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.notificationIcon}>
              <AppIcon
                name={notification.icon}
                size={19}
                color={theme.colors.primary}
              />
            </View>
            <View style={styles.notificationCopy}>
              {notification.brandName ? <Text style={styles.notificationBrand}>{notification.brandName.toUpperCase()} UPDATE</Text> : null}
              <Text
                style={[
                  styles.notificationTitle,
                  notification.read && styles.notificationTitleRead,
                ]}
              >
                {notification.title}
              </Text>
              <Text style={styles.notificationBody}>{notification.body}</Text>
              {notification.mediaUri ? <View style={styles.notificationMediaPreview}>
                {notification.mediaType === "image" ? <ExpoImage source={{ uri: notification.mediaUri }} contentFit="cover" style={styles.notificationMediaImage as ImageStyle} accessibilityLabel={notification.mediaName || "Image attachment preview"} /> : <View style={styles.notificationMediaIcon}><AppIcon name={notification.mediaType === "video" ? "videocam-outline" : "document-text-outline"} size={21} color={theme.colors.primary} /></View>}
                <Text numberOfLines={2} style={styles.notificationMediaName}>{notification.mediaName || (notification.mediaType === "video" ? "Video attachment" : notification.mediaType === "file" ? "File attachment" : "Photo attachment")}</Text>
              </View> : null}
              {notification.actionLabel && notification.actionUrl ? <View style={styles.notificationCta}><AppIcon name="open-outline" size={14} color={theme.colors.primary} /><Text style={styles.notificationCtaText}>{notification.actionLabel}</Text></View> : null}
              <Text style={styles.notificationTime}>{notification.time}</Text>
            </View>
            <View style={styles.notificationActions}>
              {!notification.read ? (
                <View style={styles.notificationUnread} />
              ) : null}
              {!notification.read ? (
                <IconButton
                  name="checkmark-outline"
                  label={`Mark ${notification.title} as read`}
                  onPress={() => onMarkRead(notification.id)}
                />
              ) : (
                <AppIcon
                  name="checkmark-done-outline"
                  size={18}
                  color={theme.colors.textSecondary}
                />
              )}
            </View>
          </Pressable>
          ))
        ) : (
          <AppCard flat style={styles.campaignEmpty}>
            <AppIcon
              name="checkmark-done-outline"
              size={24}
              color={theme.colors.primary}
            />
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptyBody}>
              Read or disabled notifications will stay out of this inbox.
            </Text>
          </AppCard>
        )}
      </View>
    </ScrollView>
  );
}

export function InboxView({
  role,
  applications,
  conversations,
  onOpenApplication,
  onOpenConversation,
  onScroll,
  search = "", onSearch, loading = false, error = "", onRetry, hasMore = false, onLoadMore, onToggleFavorite, onToggleMute, onToggleBlock,
}: {
  role: "Brand" | "Influencer";
  applications: MarketplaceApplication[];
  conversations?: MarketplaceConversation[];
  onOpenApplication: (application: MarketplaceApplication) => void;
  onOpenConversation?: (conversation: MarketplaceConversation) => void;
  onScroll: ScrollHandler;
  search?: string;
  onSearch?: (value: string) => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onToggleFavorite?: (conversation: MarketplaceConversation) => void;
  onToggleMute?: (conversation: MarketplaceConversation) => void;
  onToggleBlock?: (conversation: MarketplaceConversation) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const [inboxFilter, setInboxFilter] = useState<"All" | "Unread" | "Chats" | "Requests">("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<MarketplaceConversation | null>(null);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const allIncomingRequests = applications.filter((application) =>
    application.status === "Pending" && (role === "Brand"
      ? application.direction === "creator-to-brand"
      : application.direction === "brand-to-creator"),
  );
  const query = search.trim().toLowerCase();
  const incomingRequests = query
    ? allIncomingRequests.filter((application) => `${application.creatorName} ${application.brandName} ${application.briefTitle}`.toLowerCase().includes(query))
    : allIncomingRequests;
  const inboxItems = conversations ?? applications;
  const acceptedChats = inboxItems.filter((item) => item.status === "Accepted");
  const visibleItems = inboxFilter === "Requests"
    ? incomingRequests
    : inboxFilter === "Chats"
      ? acceptedChats
      : inboxFilter === "Unread"
        ? inboxItems.filter((item) => "participantName" in item && Boolean(item.unreadCount))
        : inboxItems;
  const sortedItems = [...visibleItems].sort((left, right) => {
    const leftPinned = "participantName" in left && Boolean(left.favorite);
    const rightPinned = "participantName" in right && Boolean(right.favorite);
    if (leftPinned !== rightPinned) return leftPinned ? -1 : 1;
    const leftDate = new Date("participantName" in left ? left.updatedAt : left.submittedAt).getTime();
    const rightDate = new Date("participantName" in right ? right.updatedAt : right.submittedAt).getTime();
    return (Number.isFinite(rightDate) ? rightDate : 0) - (Number.isFinite(leftDate) ? leftDate : 0);
  });
  const closeActions = () => setSelectedConversation(null);
  const openConversation = (conversation: MarketplaceConversation) => {
    closeActions();
    onOpenConversation?.(conversation);
  };
  const runPreferenceAction = (action: (conversation: MarketplaceConversation) => void) => {
    if (!selectedConversation) return;
    action(selectedConversation);
    closeActions();
  };
  return (
    <>
    <FlatList<MarketplaceConversation | MarketplaceApplication>
      style={styles.viewport}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
      onScroll={onScroll}
      scrollEventThrottle={16}
      data={sortedItems}
      keyExtractor={(item) => item.id}
      initialNumToRender={12}
      windowSize={7}
      ListHeaderComponent={<>
      <View style={styles.pageRow}>
        <View style={styles.flex}>
          <Text style={styles.pageIntro}>
            {role === "Brand"
              ? "Review creator requests and continue accepted collaborations."
              : "Review brand invitations and continue accepted collaborations."}
          </Text>
        </View>
        <View style={styles.creatorDiscoverIcon}>
          <AppIcon
            name="chatbubbles-outline"
            size={20}
            color={theme.colors.primary}
          />
        </View>
      </View>
      {onSearch ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ flex: 1, minWidth: 0 }}><SearchField value={search} onChangeText={onSearch} placeholder="Search chats and requests" accessibilityLabel="Search chats and requests" /></View><Pressable accessibilityRole="button" accessibilityLabel={`Filter conversations: ${inboxFilter}`} onPress={() => setFilterOpen(true)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1, borderColor: inboxFilter === "All" ? theme.colors.border : theme.colors.primary, backgroundColor: inboxFilter === "All" ? theme.colors.surface : theme.colors.accent }}><AppIcon name="filter-outline" size={20} color={inboxFilter === "All" ? theme.colors.textSecondary : theme.colors.primary} /></Pressable></View> : null}
      </>}
      ListEmptyComponent={loading ? <View style={{ gap: 12 }}>{[0, 1, 2].map((key) => <Skeleton key={key} height={72} />)}</View> : <Text style={styles.pageIntro}>{search ? "No matching items" : inboxFilter === "Requests" ? "No pending requests. New creator applications will appear here." : inboxFilter === "Chats" ? "No accepted chats yet." : inboxFilter === "Unread" ? "You’re all caught up." : "No conversations yet."}</Text>}
      ListFooterComponent={<>
        {error ? <View><Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{error}</Text>{onRetry ? <AppButton label="Try again" compact onPress={onRetry} /> : null}</View> : null}
        {hasMore && onLoadMore ? <AppButton label="Load more chats" compact variant="secondary" loading={loading} onPress={onLoadMore} /> : null}
      </>}
      renderItem={({ item }) => {
        if ("participantName" in item) {
        const conversation = item;
        const application = applications.find((item) => item.id === conversation.applicationId);
        return <Pressable key={conversation.id} accessibilityRole="button" accessibilityLabel={`Open ${conversation.adminChat ? 'Brandly' : conversation.briefTitle} chat`} accessibilityHint={conversation.adminChat ? 'Open private Brandly chat' : 'Long press for chat actions'} onPress={() => { if (onOpenConversation) onOpenConversation(conversation); else if (application) onOpenApplication(application); }} onLongPress={conversation.adminChat ? undefined : () => setSelectedConversation(conversation)} delayLongPress={350} style={({ pressed }) => [styles.conversation, pressed && styles.pressed]}>
          <View style={styles.conversationAvatarWrap}>
            <Avatar initials={conversation.participantInitials} uri={conversation.participantAvatarUrl} />
            {conversation.online ? <View style={styles.conversationOnline} /> : null}
          </View>
          <View style={styles.flex}><View style={styles.conversationTop}><View style={styles.conversationNameRow}><Text numberOfLines={1} style={styles.conversationName}>{conversation.participantName}</Text>{conversation.favorite ? <AppIcon name="pin" size={14} color={theme.colors.secondary} /> : null}{conversation.muted ? <AppIcon name="notifications-off-outline" size={14} color={theme.colors.textSecondary} /> : null}</View><Pill label={conversation.adminChat ? "Open" : conversation.status === "Declined" ? "Rejected" : conversation.status} accent={conversation.adminChat || conversation.status === "Accepted"} /></View><Text numberOfLines={1} style={styles.message}>{conversation.preview || conversation.briefTitle}</Text></View>
          {conversation.unreadCount ? <View style={styles.conversationUnread}><Text style={styles.conversationUnreadText}>{conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}</Text></View> : null}
        </Pressable>;
        }
        const application = item;
        return <Pressable key={application.id} accessibilityRole="button" accessibilityLabel={`Open ${application.briefTitle} application chat`} onPress={() => onOpenApplication(application)} style={styles.conversation}>
        <Avatar initials={role === "Brand" ? application.creatorInitials : application.brandInitials} uri={role === "Brand" ? application.creatorProfile.avatarUrl : undefined} />
        <View style={styles.flex}><View style={styles.conversationTop}><Text style={styles.conversationName}>{role === "Brand" ? application.creatorName : application.brandName}</Text><Pill label={application.status === "Declined" ? "Rejected" : application.status} accent={application.status === "Accepted"} /></View><Text numberOfLines={1} style={styles.message}>{application.status === "Declined" ? application.rejectionReason || "Application declined" : application.briefTitle}</Text></View>
      </Pressable>;
      }}
    />
    <Modal transparent visible={filterOpen} animationType="slide" onRequestClose={() => setFilterOpen(false)}>
      <View style={styles.filterOverlay}><Pressable accessibilityRole="button" accessibilityLabel="Close filters" onPress={() => setFilterOpen(false)} style={styles.filterBackdrop} /><View accessibilityViewIsModal style={[styles.filterSheet, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View style={styles.sheetHeaderCopy}><Text style={styles.sheetTitle}>Filter conversations</Text><Text style={styles.sheetSubtitle}>Newest activity appears first.</Text></View><IconButton name="close" label="Close filters" onPress={() => setFilterOpen(false)} /></View><View style={styles.notificationList}>{(["All", "Unread", "Chats", "Requests"] as const).map((filter) => <Pressable key={filter} accessibilityRole="button" accessibilityState={{ selected: inboxFilter === filter }} onPress={() => { setInboxFilter(filter); setFilterOpen(false); }} style={({ pressed }) => [styles.notificationRow, pressed && styles.pressed]}><View style={styles.notificationIcon}><AppIcon name={filter === "All" ? "chatbubbles-outline" : filter === "Unread" ? "mail-unread-outline" : filter === "Chats" ? "chatbubble-outline" : "paper-plane-outline"} size={20} color={inboxFilter === filter ? theme.colors.primary : theme.colors.textSecondary} /></View><View style={styles.notificationCopy}><Text style={styles.notificationTitle}>{filter === "All" ? "All conversations" : filter}</Text></View>{inboxFilter === filter ? <AppIcon name="checkmark-circle" size={20} color={theme.colors.primary} /> : null}</Pressable>)}</View></View></View>
    </Modal>
    <Modal transparent visible={Boolean(selectedConversation)} animationType="slide" onRequestClose={closeActions}>
      <View style={styles.filterOverlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close chat actions" onPress={closeActions} style={styles.filterBackdrop} />
        <View accessibilityViewIsModal style={[styles.filterSheet, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderCopy}>
              <Text style={styles.sheetTitle}>Chat actions</Text>
              <Text numberOfLines={1} style={styles.sheetSubtitle}>{selectedConversation?.participantName ?? "Conversation"}</Text>
            </View>
            <IconButton name="close" label="Close chat actions" onPress={closeActions} />
          </View>
          <View style={styles.notificationList}>
            <Pressable accessibilityRole="button" accessibilityLabel={selectedConversation?.favorite ? "Remove from favorites" : "Add to favorites"} onPress={() => runPreferenceAction((conversation) => onToggleFavorite?.(conversation))} style={({ pressed }) => [styles.notificationRow, pressed && styles.pressed]}>
              <View style={styles.notificationIcon}><AppIcon name={selectedConversation?.favorite ? "pin" : "pin-outline"} size={20} color={theme.colors.secondary} /></View>
              <View style={styles.notificationCopy}><Text style={styles.notificationTitle}>{selectedConversation?.favorite ? "Unpin chat" : "Pin chat"}</Text><Text style={styles.notificationBody}>Keep this conversation at the top of your list.</Text></View>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={selectedConversation?.muted ? "Unmute chat notifications" : "Mute chat notifications"} onPress={() => runPreferenceAction((conversation) => onToggleMute?.(conversation))} style={({ pressed }) => [styles.notificationRow, pressed && styles.pressed]}>
              <View style={styles.notificationIcon}><AppIcon name={selectedConversation?.muted ? "notifications-outline" : "notifications-off-outline"} size={20} color={theme.colors.primary} /></View>
              <View style={styles.notificationCopy}><Text style={styles.notificationTitle}>{selectedConversation?.muted ? "Unmute notifications" : "Mute notifications"}</Text><Text style={styles.notificationBody}>Control push alerts for this chat.</Text></View>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Open chat" onPress={() => selectedConversation && openConversation(selectedConversation)} style={({ pressed }) => [styles.notificationRow, pressed && styles.pressed]}>
              <View style={styles.notificationIcon}><AppIcon name="chatbubble-ellipses-outline" size={20} color={theme.colors.primary} /></View>
              <View style={styles.notificationCopy}><Text style={styles.notificationTitle}>Open chat</Text><Text style={styles.notificationBody}>View messages and collaboration details.</Text></View>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={selectedConversation?.blockedBy.length ? "Unblock user" : "Block user"} onPress={() => { setBlockConfirmOpen(true); }} style={({ pressed }) => [styles.notificationRow, pressed && styles.pressed]}>
              <View style={[styles.notificationIcon, selectedConversation?.blockedBy.length ? undefined : { backgroundColor: theme.colors.surfaceBlush }]}><AppIcon name={selectedConversation?.blockedBy.length ? "lock-open-outline" : "ban-outline"} size={20} color={selectedConversation?.blockedBy.length ? theme.colors.primary : theme.colors.danger} /></View>
              <View style={styles.notificationCopy}><Text style={[styles.notificationTitle, !selectedConversation?.blockedBy.length && { color: theme.colors.danger }]}>{selectedConversation?.blockedBy.length ? "Unblock user" : "Block user"}</Text><Text style={styles.notificationBody}>{selectedConversation?.blockedBy.length ? "Allow messages from this user again." : "Stop messages and collaboration alerts from this user."}</Text></View>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
    <ConfirmModal
      visible={blockConfirmOpen}
      title={selectedConversation?.blockedBy.length ? `Unblock ${selectedConversation.participantName}?` : `Block ${selectedConversation?.participantName ?? "this user"}?`}
      message={selectedConversation?.blockedBy.length ? "This user will be able to message you again." : "You will stop receiving messages and push alerts from this chat."}
      confirmLabel={selectedConversation?.blockedBy.length ? "Unblock" : "Block"}
      confirmIcon={selectedConversation?.blockedBy.length ? "lock-open-outline" : "ban-outline"}
      destructive={!selectedConversation?.blockedBy.length}
      onCancel={() => setBlockConfirmOpen(false)}
      onConfirm={() => { if (selectedConversation) onToggleBlock?.(selectedConversation); setBlockConfirmOpen(false); closeActions(); }}
    />
    </>
  );
}
