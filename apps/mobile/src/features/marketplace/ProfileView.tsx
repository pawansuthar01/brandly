import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import {
  AppButton,
  AppCard,
  AppIcon,
  Avatar,
  Pill,
  SectionTitle,
  Toggle,
} from "../../components/ui";
import { ReviewSummary } from "../../components/marketplace";
import { useTheme } from "../../providers/ThemeProvider";
import type {
  ProfileDraft,
  SocialPlatform,
} from "../../types/marketplace";
import type { MarketplaceFlow } from "./FlowScreens";
import {
  type ScrollHandler,
  type SocialAccountMap,
  getProfileInitials,
} from "./marketplaceDomain";
import { MenuItem } from "./MarketplaceCards";
import { makeStyles } from "./marketplaceStyles";


export function ProfileView({
  role,
  mode,
  onScroll,
  onTheme,
  onFlow,
  onOpenReminders,
  savedLocations,
  profile,
  profileCompletion,
  onOpenProfilePreview = () => undefined,
  profileIsPublic,
  isSavingProfileVisibility,
  isLoggingOut,
  phoneVerified,
  emailVerified,
  reviewRating,
  reviewCount,
  socialAccounts,
  verifiedSocialAccounts,
  onProfileVisibilitySave,
  onLogout,
}: {
  role: "Brand" | "Influencer";
  mode: "light" | "dark";
  onScroll: ScrollHandler;
  onTheme: () => void;
  onFlow: (flow: MarketplaceFlow) => void;
  onOpenReminders: () => void;
  savedLocations: string[];
  profile: ProfileDraft;
  profileCompletion: number;
  onOpenProfilePreview?: () => void;
  profileIsPublic: boolean;
  isSavingProfileVisibility: boolean;
  isLoggingOut: boolean;
  phoneVerified: boolean;
  emailVerified: boolean;
  reviewRating: number;
  reviewCount: number;
  socialAccounts: SocialAccountMap;
  verifiedSocialAccounts: SocialPlatform[];
  onProfileVisibilitySave: (isPublic: boolean) => Promise<void>;
  onLogout: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const connectedSocialPlatforms = Object.entries(socialAccounts)
    .filter(([, handle]) => Boolean(handle))
    .map(([platform]) => platform as SocialPlatform);
  return (
    <ScrollView
      style={styles.viewport}
      showsVerticalScrollIndicator={false}
      alwaysBounceVertical
      nestedScrollEnabled
      contentContainerStyle={[styles.scroll, styles.profileScroll]}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      <AppCard flat style={styles.profileCard}>
        <Avatar initials={getProfileInitials(profile.name)} uri={profile.avatarUri} size="large" />
        <View style={styles.profileInfo}>
          <View style={styles.profileNameRow}>
            <Text style={styles.profileName}>{profile.name}</Text>
            <AppIcon
              name={profileIsPublic ? "eye-outline" : "eye-off-outline"}
              size={18}
              color={theme.colors.primary}
            />
          </View>
          <Text style={styles.pageIntro}>
            {role === "Brand" ? "Finder account" : "Creator account"} · {profile.city || savedLocations[0] || "India"}
          </Text>
          <Pill label={phoneVerified && emailVerified ? "Phone & email verified" : "Verification incomplete"} />
        </View>
        <View style={styles.profileHeaderAction}>
          {isSavingProfileVisibility ? <ActivityIndicator size="small" color={theme.colors.primary} accessibilityLabel="Saving profile visibility" /> : null}
          <Toggle
            value={profileIsPublic}
            accessibilityLabel="Toggle profile visibility"
            disabled={isSavingProfileVisibility}
            onChange={(nextValue) => { void onProfileVisibilitySave(nextValue); }}
          />
        </View>
      </AppCard>
      <AppCard flat style={styles.profileDetailsCard}>
        <View style={styles.profileDetailsHeader}>
          <AppIcon name="person-outline" size={20} color={theme.colors.primary} />
          <Text style={styles.tipTitle}>Profile details</Text>
        </View>
        <Text style={styles.profileDetailsBio}>{profile.bio || "Add a short introduction to your profile."}</Text>
        <View style={styles.profileDetailsGrid}>
          <View style={styles.profileDetailItem}>
            <AppIcon name="location-outline" size={18} color={theme.colors.primary} />
            <View style={styles.flex}><Text style={styles.profileDetailLabel}>Your location</Text><Text style={styles.profileDetailValue}>{profile.city || "Not added"}</Text></View>
          </View>
          {role === "Influencer" ? (
            <View style={styles.profileDetailItem}>
              <AppIcon name="map-outline" size={18} color={theme.colors.primary} />
              <View style={styles.flex}><Text style={styles.profileDetailLabel}>Audience locations</Text><Text style={styles.profileDetailValue}>{profile.locations?.join(" · ") || "Not added"}</Text></View>
            </View>
          ) : null}
          <View style={styles.profileDetailItem}>
            <AppIcon name="globe-outline" size={18} color={theme.colors.primary} />
            <View style={styles.flex}><Text style={styles.profileDetailLabel}>Languages</Text><Text style={styles.profileDetailValue}>{profile.languages?.join(" · ") || "Not added"}</Text></View>
          </View>
          <View style={styles.profileDetailItem}>
            <AppIcon name="pricetag-outline" size={18} color={theme.colors.primary} />
            <View style={styles.flex}><Text style={styles.profileDetailLabel}>{role === "Brand" ? "Industry" : "Niche"}</Text><Text style={styles.profileDetailValue}>{profile.focus || "Not added"}</Text></View>
          </View>
          {role === "Influencer" ? (
            <>
              <View style={styles.profileDetailItem}>
                <AppIcon name="people-outline" size={18} color={theme.colors.primary} />
                <View style={styles.flex}><Text style={styles.profileDetailLabel}>Audience size</Text><Text style={styles.profileDetailValue}>{profile.audienceSize || "Not added"}</Text></View>
              </View>
              <View style={styles.profileDetailItem}>
                <AppIcon name="cash-outline" size={18} color={theme.colors.primary} />
                <View style={styles.flex}><Text style={styles.profileDetailLabel}>Rate range</Text><Text style={styles.profileDetailValue}>{profile.rateRange || "Not added"}</Text></View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.profileDetailItem}>
                <AppIcon name="people-outline" size={18} color={theme.colors.primary} />
                <View style={styles.flex}><Text style={styles.profileDetailLabel}>Team size</Text><Text style={styles.profileDetailValue}>{profile.teamSize || "Not added"}</Text></View>
              </View>
              <View style={styles.profileDetailItem}>
                <AppIcon name="cash-outline" size={18} color={theme.colors.primary} />
                <View style={styles.flex}><Text style={styles.profileDetailLabel}>Campaign budget</Text><Text style={styles.profileDetailValue}>{profile.rateRange || "Not added"}</Text></View>
              </View>
            </>
          )}
          {profile.websiteUrl ? (
            <View style={styles.profileDetailItem}>
              <AppIcon name="link-outline" size={18} color={theme.colors.primary} />
              <View style={styles.flex}><Text style={styles.profileDetailLabel}>Website</Text><Text numberOfLines={1} style={styles.profileDetailValue}>{profile.websiteUrl}</Text></View>
            </View>
          ) : null}
          <View style={styles.profileDetailItem}>
            <AppIcon name="logo-instagram" size={18} color={theme.colors.primary} />
            <View style={styles.flex}><Text style={styles.profileDetailLabel}>Social accounts</Text><Text style={styles.profileDetailValue}>{connectedSocialPlatforms.length ? connectedSocialPlatforms.join(" · ") : "Not added"}</Text></View>
          </View>
        </View>
      </AppCard>
      <SectionTitle title="Profile preview" />
      <AppCard
        flat
        onPress={onOpenProfilePreview}
        style={styles.profilePreviewCard}
      >
        <View style={styles.profilePreviewRow}>
          <View style={styles.profilePreviewIcon}>
            <AppIcon name="eye-outline" size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.tipTitle}>
              View as {role === "Brand" ? "a creator" : "a brand"}
            </Text>
            <Text style={styles.tipBody}>Read-only preview of your public profile.</Text>
          </View>
          <AppIcon name="chevron-forward" size={18} color={theme.colors.textSecondary} />
        </View>
      </AppCard>
      <ReviewSummary
        rating={reviewRating}
        reviewCount={reviewCount}
        onPress={() => onFlow("reviews-own")}
        note={
          !reviewCount
            ? "Reviews will appear here after a completed collaboration."
            : role === "Brand"
            ? "Creators describe this team as clear, respectful and easy to work with."
            : "Brands value clear communication, thoughtful content and reliable delivery."
        }
      />
      <AppCard
        flat
        onPress={() => onFlow("profile-form")}
        style={styles.profileProgress}
      >
        <View style={styles.profileProgressHeader}>
          <View style={styles.flex}>
            <Text style={styles.tipTitle}>Complete your profile</Text>
            <Text style={styles.tipBody}>
              A complete profile helps better matches find you.
            </Text>
          </View>
          <Text style={styles.profileProgressValue}>{profileCompletion}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${profileCompletion}%` }]} />
        </View>
      </AppCard>
      <SectionTitle title="Account" />
      <MenuItem
        label={role === "Brand" ? "Edit brand profile" : "Edit creator profile"}
        icon="create-outline"
        onPress={() => onFlow("profile-form")}
      />
      <MenuItem
        label="Social accounts"
        icon="link-outline"
        onPress={() => onFlow("social-accounts")}
      />
      <MenuItem
        label={role === "Brand" ? "Saved creators" : "Saved campaigns"}
        icon="bookmark-outline"
        onPress={() => onFlow("saved")}
      />
      <MenuItem
        label="Notification settings"
        icon="notifications-outline"
        onPress={() => onFlow("notification-settings")}
      />
      <MenuItem
        label="Delivery reminders"
        icon="alarm-outline"
        onPress={onOpenReminders}
      />
      <MenuItem
        label="Your reviews"
        icon="star-outline"
        onPress={() => onFlow("reviews-own")}
      />
      <MenuItem
        label="Review activity"
        icon="list-outline"
        onPress={() => onFlow("activity")}
      />
      <MenuItem
        label="Blocked users"
        icon="ban-outline"
        onPress={() => onFlow("blocked-users")}
      />
      <SectionTitle title="Preferences" />
      <Pressable onPress={onTheme} style={styles.menuItem}>
        <View style={styles.menuIcon}>
          <AppIcon
            name={mode === "light" ? "moon-outline" : "sunny-outline"}
            size={20}
            color={theme.colors.primary}
          />
        </View>
        <Text style={styles.menuLabel}>
          {mode === "light" ? "Switch to dark mode" : "Switch to light mode"}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      <MenuItem
        label="Privacy & data controls"
        icon="lock-closed-outline"
        onPress={() => onFlow("legal")}
      />
      <MenuItem
        label="Safety & community guidelines"
        icon="shield-checkmark-outline"
        onPress={() => onFlow("safety")}
      />
      <SectionTitle title="Help & support" />
      <MenuItem
        label="Support center"
        icon="help-circle-outline"
        onPress={() => onFlow("support")}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => onFlow("delete-account")}
        style={({ pressed }) => [styles.dangerZone, pressed && styles.pressed]}
      >
        <Text style={styles.dangerText}>Delete account</Text>
        <Text style={styles.pageIntro}>
          You can request deletion of your account and data.
        </Text>
      </Pressable>
      <AppButton
        label="Log out"
        variant="secondary"
        icon="log-out-outline"
        onPress={onLogout}
        loading={isLoggingOut}
        style={styles.logoutButton}
      />
    </ScrollView>
  );
}
