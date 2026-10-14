import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton, AppIcon, Avatar, Pill, ProfilePhotoPicker } from "../../components/ui";
import { isAdminThemePreview, useTheme } from "../../providers/ThemeProvider";
import type { ApiUser, EmailOtpChallenge, OtpChallenge, SuspendedAuthResult } from "../../services/authApi.service";
import {
  requestEmailOtp,
  requestEmailSigninOtp,
  requestOtp,
  saveRemoteSocialAccount,
  restoreSession,
  withTimeout,
  updateRemoteProfile,
  verifyEmailOtp,
  verifyEmailSigninOtp,
  verifyOtp,
  submitReactivationRequest,
} from "../../services/authApi.service";
import type { ProfileDraft, SocialPlatform } from "../../types/marketplace";
import {
  AUDIENCE_SIZE_OPTIONS,
  CAMPAIGN_BUDGET_OPTIONS,
  CREATOR_CATEGORIES,
  CREATOR_RATE_OPTIONS,
  INDIA_LOCATION_OPTIONS,
  INDUSTRY_OPTIONS,
  NATIVE_LANGUAGE_OPTIONS,
  SOCIAL_PLATFORM_REGISTRY,
  TEAM_SIZE_OPTIONS,
  type AppIconName,
  type SocialAccountMap,
  getProfileInitials,
} from "./marketplaceDomain";
import { makeStyles } from "./marketplaceStyles";
import { useAuthDraft } from "./auth/useAuthDraft";
import type { AuthOnboardingStep, SignupProfileDraft, SignupRole } from "../../store/store";
import {
  AuthInput,
  AuthBackButton,
  AuthContent,
  AuthLandingIllustration,
  AuthProgress,
  AuthShell,
  AuthStepPill,
  AuthText,
  AuthTitle,
  DropdownPickerField,
  IndiaPhoneField,
  LocationPickerField,
  OtpBoxes,
} from "./auth/AuthPrimitives";

const fallbackOtpResendCooldownSeconds = 55;

export type OnboardingProgress = {
  onboardingStep: "profile" | "details" | "social" | "verifying" | "review";
  profile: ProfileDraft;
  locations: string[];
  languages: string[];
  socialAccounts: SocialAccountMap;
};

function IndiaLocationField({
  value,
  onChange,
  error = false,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
}) {
  return (
    <LocationPickerField
      selected={value ? [value] : []}
      locations={INDIA_LOCATION_OPTIONS}
      onApply={(locations) => onChange(locations[0] ?? "")}
      title="Choose your location"
      subtitle="Select one location for your profile"
      error={error}
      single
    />
  );
}

export function SplashScreen() {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <SafeAreaView style={styles.splash} edges={["top", "bottom"]}>
      <View
        accessible
        accessibilityLabel="Brandly. Creator partnerships, made clear."
        style={styles.splashContent}
      >
        <View style={styles.splashMark}>
          <AppIcon name="people-outline" size={30} color={theme.colors.primaryText} />
        </View>
        <Text style={styles.splashWordmark}>brandly</Text>
        <Text style={styles.splashCopy}>
          Creator partnerships, made clear.
        </Text>
        <View accessibilityRole="progressbar" accessibilityLabel="Loading Brandly" style={styles.splashLoader}>
          <View style={styles.splashLoaderFill} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function AuthLandingAction({
  label,
  icon,
  primary = false,
  onPress,
}: {
  label: string;
  icon: AppIconName;
  primary?: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.authLandingActionButton,
        primary ? styles.authLandingActionButtonPrimary : styles.authLandingActionButtonSecondary,
        pressed && styles.authLandingActionButtonPressed,
      ]}
    >
      <View style={[styles.authLandingActionIcon, primary && styles.authLandingActionIconPrimary]}>
        <AppIcon name={icon} size={20} color={primary ? theme.colors.primaryText : theme.colors.primary} />
      </View>
      <Text style={[styles.authLandingActionText, primary && styles.authLandingActionTextPrimary]}>{label}</Text>
      <View style={[styles.authLandingActionArrow, primary && styles.authLandingActionArrowPrimary]}>
        <AppIcon name="arrow-forward" size={17} color={primary ? theme.colors.primaryText : theme.colors.primary} />
      </View>
    </Pressable>
  );
}

function AccountTypeOption({
  selected,
  title,
  description,
  icon,
  iconStyle,
  cardStyle,
  onPress,
}: {
  selected: boolean;
  title: string;
  description: string;
  icon: AppIconName;
  iconStyle: object;
  cardStyle: object;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const selection = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const scale = useMemo(() => selection.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] }), [selection]);

  useEffect(() => {
    const animation = Animated.spring(selection, {
      toValue: selected ? 1 : 0,
      useNativeDriver: false,
      speed: 20,
      bounciness: 5,
    });
    animation.start();
    return () => animation.stop();
  }, [selected, selection]);

  return (
    <Animated.View
      style={{
        transform: [
          {
            scale,
          },
        ],
      }}
    >
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel={title}
        accessibilityState={{ selected }}
        onPress={onPress}
        style={({ pressed }) => [styles.authOption, cardStyle, selected && styles.authOptionSelected, pressed && styles.authOptionPressed]}
      >
        <View style={[styles.authOptionIcon, iconStyle]}>
          <AppIcon name={icon} size={26} color={theme.colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.authOptionTitle}>{title}</Text>
          <Text style={styles.authOptionText}>{description}</Text>
        </View>
        <View style={[styles.authOptionChoice, selected && styles.authOptionChoiceSelected]}>
          <AppIcon name={selected ? "checkmark" : "ellipse-outline"} size={selected ? 16 : 20} color={selected ? theme.colors.primaryText : theme.colors.textSecondary} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function AuthContinueButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const readiness = useRef(new Animated.Value(disabled ? 0.98 : 1)).current;

  useEffect(() => {
    Animated.spring(readiness, {
      toValue: disabled ? 0.98 : 1,
      useNativeDriver: false,
      speed: 20,
      bounciness: 4,
    }).start();
  }, [disabled, readiness]);

  return (
    <Animated.View style={{ transform: [{ scale: readiness }] }}>
      <AppButton
        label="Continue"
        icon="arrow-forward"
        iconAfter
        disabled={disabled}
        onPress={onPress}
        style={styles.authContinueButton}
      />
    </Animated.View>
  );
}

function socialUrlError(platform: SocialPlatform | "Other" | "Website", value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Add a social profile URL first.";
  if (!/^https?:\/\//i.test(trimmed)) {
    return "Use a full URL starting with https://";
  }
  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const allowed = SOCIAL_PLATFORM_REGISTRY.find(({ key }) => key === platform)?.hosts;
    if (allowed && !allowed.some((host) => hostname === host || hostname.endsWith("." + host))) {
      return "Use a valid " + platform + " profile URL.";
    }
    if (!parsed.pathname || parsed.pathname === "/") {
      return "Add the profile path or username to the URL.";
    }
  } catch {
    return "Enter a valid social profile URL.";
  }
  return null;
}

function SocialStatusBadge({ value, verified, pending = true, failed = false, checking = false }: { value: string; verified: boolean; pending?: boolean; failed?: boolean; checking?: boolean }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const hasValue = Boolean(value.trim());
  const isVerified = hasValue && verified;
  const isChecking = hasValue && checking && !isVerified && !failed;
  const isAwaitingReview = hasValue && (pending || (!isVerified && !failed));
  return (
    <View style={isVerified ? styles.verifiedStatusBadge : styles.verifyingStatusBadge}>
      <AppIcon
        name={isVerified ? "checkmark-circle" : failed ? "alert-circle-outline" : isChecking ? "sync-outline" : "time-outline"}
        size={14}
        color={isVerified ? "#16A34A" : failed ? "#DC2626" : isAwaitingReview ? "#4F46E5" : "#6B7280"}
      />
      <Text style={isVerified ? styles.statusBadgeTextVerified : styles.statusBadgeTextPending}>
        {isVerified ? "Verified" : failed ? "Review required" : isChecking ? "Verifying…" : isAwaitingReview ? "Review pending" : "Not added"}
      </Text>
    </View>
  );
}

const socialPlatformLabel = (platform: string) =>
  SOCIAL_PLATFORM_REGISTRY.find((config) => config.key === platform)?.label ?? platform;

const reviewPreview = (value: string | undefined, maxLength = 120) => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}…` : trimmed;
};

function ReviewDetailRow({
  icon,
  label,
  value,
  verified = false,
  lines,
  fullWidth = false,
}: {
  icon: AppIconName;
  label: string;
  value?: string;
  verified?: boolean;
  lines?: number;
  fullWidth?: boolean;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const multiline = Boolean(lines && lines > 1);
  return (
    <View style={[styles.reviewRowContainer, (multiline || fullWidth) && styles.reviewRowMultiline, fullWidth && styles.reviewRowExpanded]}>
      <View style={[styles.reviewRowIcon, fullWidth && styles.reviewRowExpandedIcon]}>
        <AppIcon name={icon} size={16} color={theme.colors.primary} />
      </View>
      {fullWidth ? (
        <View style={styles.reviewRowExpandedCopy}>
          <Text style={styles.reviewRowLabel}>{label}</Text>
          <Text style={styles.reviewRowExpandedText}>{value?.trim() || "Not added"}</Text>
          {verified ? <AppIcon name="checkmark-circle" size={15} color={theme.colors.success} /> : null}
        </View>
      ) : (
        <>
          <Text style={styles.reviewRowLabel}>{label}</Text>
          <View style={[styles.reviewRowValueWrap, multiline && styles.reviewRowMultilineValue]}>
            <Text
              numberOfLines={lines}
              ellipsizeMode={lines ? "tail" : undefined}
              style={[styles.reviewRowValue, multiline && styles.reviewRowMultilineText]}
            >
              {value?.trim() || "Not added"}
            </Text>
            {verified ? <AppIcon name="checkmark-circle" size={15} color={theme.colors.success} /> : null}
          </View>
        </>
      )}
    </View>
  );
}

function ReviewDetailsCard({
  role,
  name,
  email,
  phone,
  bio,
  focus,
  focusLabel,
  location,
  audienceLocations = [],
  audienceSize,
  teamSize,
  rate,
  rateLabel,
  profileImageUri,
  socialAccounts,
  website,
  languages = ["English"],
  verifiedSocialAccounts = [],
}: {
  role: "Brand" | "Influencer";
  name: string;
  email?: string;
  phone?: string;
  bio: string;
  focus: string;
  focusLabel: string;
  location: string;
  audienceLocations?: string[];
  audienceSize?: string;
  teamSize?: string;
  rate?: string;
  rateLabel: string;
  profileImageUri?: string | null;
  socialAccounts: SocialAccountMap;
  website?: string;
  languages?: string[];
  verifiedSocialAccounts?: SocialPlatform[];
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const locations = audienceLocations.map((item) => item.trim()).filter(Boolean);
  const verifiedSocialSet = new Set(verifiedSocialAccounts);
  const socialRows = [
    ...SOCIAL_PLATFORM_REGISTRY.map((config) => ({
      key: config.key,
      label: config.label,
      icon: config.icon,
      color: config.color,
      value: socialAccounts[config.key] ?? "",
    })),
    ...(role === "Brand" && website?.trim()
      ? [{ key: "Website", label: "Website", icon: "globe-outline" as AppIconName, color: theme.colors.primary, value: website }]
      : []),
  ].filter((item) => item.value.trim());

  return (
    <View style={styles.reviewCardContainer}>
      <View style={styles.reviewProfileHeader}>
        <View style={styles.reviewProfileHeaderBody}>
          <View style={styles.reviewProfileIdentity}>
            <View style={styles.reviewAvatarFrame}>
              <Avatar initials={getProfileInitials(name)} uri={profileImageUri ?? undefined} size="large" />
            </View>
            <View style={styles.reviewProfileNameRow}>
              <AppIcon name="person-circle-outline" size={16} color={theme.colors.primary} />
              <Text numberOfLines={2} style={styles.reviewProfileName}>{name.trim() || "Your profile"}</Text>
            </View>
          </View>
          <View style={styles.reviewProfileContactPanel}>
            <View style={styles.reviewIdentityFact}>
              <View style={styles.reviewIdentityFactCopy}>
                <Text numberOfLines={2} ellipsizeMode="middle" style={styles.reviewIdentityFactValue}>{email?.trim() || "Not added"}</Text>
              </View>
            </View>
            <View style={styles.reviewIdentityFact}>
              <View style={styles.reviewIdentityFactCopy}>
                <Text numberOfLines={2} style={styles.reviewIdentityFactValue}>{phone?.trim() ? `+91 ${phone.replace(/^\+91/, "")}` : "Not added"}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.reviewSectionHeader}>
        <AppIcon name="list-outline" size={17} color={theme.colors.primary} />
        <Text style={styles.reviewSectionTitle}>Profile details</Text>
      </View>
      <ReviewDetailRow icon="document-text-outline" label="Bio" value={bio} fullWidth />
      <ReviewDetailRow icon="pricetag-outline" label={focusLabel} value={focus} />
      <ReviewDetailRow icon="location-outline" label="Location" value={location} />
      <ReviewDetailRow icon="globe-outline" label="Languages" value={languages.filter(Boolean).join(", ")} />

      {role === "Influencer" ? (
        <View style={styles.reviewCollectionRow}>
          <View style={styles.reviewCollectionHeader}>
            <AppIcon name="map-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.reviewRowLabel}>Audience locations</Text>
          </View>
          {locations.length ? (
            <View style={styles.reviewChipWrap}>
              {locations.map((item) => (
                <View key={item} style={styles.reviewChip}>
                  <Text numberOfLines={1} style={styles.reviewChipText}>{item}</Text>
                </View>
              ))}
              {locations.length > 6 ? <Text style={styles.reviewMoreText}>+{locations.length - 6} more</Text> : null}
            </View>
          ) : <Text style={styles.reviewEmptyValue}>Not added</Text>}
        </View>
      ) : null}

      {role === "Influencer" ? <ReviewDetailRow icon="people-outline" label="Audience size" value={audienceSize} /> : <ReviewDetailRow icon="people-outline" label="Team size" value={teamSize} />}
      <ReviewDetailRow icon="cash-outline" label={rateLabel} value={rate} />

      <View style={styles.reviewSocialSection}>
        <View style={styles.reviewSectionHeader}>
          <AppIcon name="link-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.reviewSectionTitle}>Social access</Text>
        </View>
        {socialRows.length ? socialRows.map((item) => (
          <View key={item.key} style={styles.reviewSocialRow}>
            <View style={styles.reviewSocialIcon}>
              <AppIcon name={item.icon} size={16} color={item.color} />
            </View>
            <View style={styles.reviewSocialCopy}>
              <Text style={styles.reviewSocialPlatform}>{item.label}</Text>
              <Text numberOfLines={1} ellipsizeMode="middle" style={styles.reviewSocialValue}>{reviewPreview(item.value, 90)}</Text>
            </View>
            {item.key === "Website" || verifiedSocialSet.has(item.key as SocialPlatform) ? (
              <AppIcon name="checkmark-circle" size={16} color={theme.colors.success} />
            ) : (
              <AppIcon name="time-outline" size={16} color={theme.colors.warning} />
            )}
          </View>
        )) : <Text style={styles.reviewEmptyValue}>Not added</Text>}
      </View>
    </View>
  );
}

export function AuthScreen({
  onAuthenticated,
  onProgressSave,
}: {
  onAuthenticated: (user: ApiUser) => void;
  onProgressSave?: (progress: OnboardingProgress) => Promise<void> | void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { draft: signupDraft, setRole, setContact, setVerification, setStep: persistStep, setProfile: persistProfile } = useAuthDraft();
  const [selectedRole, setSelectedRole] = useState<SignupRole | null>(signupDraft.signupRole);
  const role = selectedRole;
  const profileDraft = signupDraft.signupProfile;
  const [step, setLocalStep] = useState<AuthOnboardingStep>(signupDraft.signupRole ? signupDraft.signupStep : "welcome");
  const setStep = (nextStep: AuthOnboardingStep) => {
    if (["profile", "details", "social", "verifying", "review"].includes(nextStep)) {
      void Promise.resolve(onProgressSave?.(getProgress(nextStep as OnboardingProgress["onboardingStep"]))).catch(() => undefined);
    }
    persistStep(nextStep);
    setLocalStep(nextStep);
  };

  const email = signupDraft.signupEmail;
  const phone = signupDraft.signupPhone;
  const [signinIdentifier, setSigninIdentifier] = useState("");
  const [signinEmail, setSigninEmail] = useState("");
  const [signinMethod, setSigninMethod] = useState<"phone" | "email">("phone");
  const [otpCode, setOtpCode] = useState("");
  const [otpChallenge, setOtpChallenge] = useState<OtpChallenge | null>(null);
  const [signinEmailChallenge, setSigninEmailChallenge] = useState<EmailOtpChallenge | null>(null);
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [emailChallenge, setEmailChallenge] = useState<EmailOtpChallenge | null>(null);
  const [pendingAuthenticatedUser, setPendingAuthenticatedUser] = useState<ApiUser | null>(null);
  const emailVerified = signupDraft.signupEmailVerified;
  const [resendSeconds, setResendSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [suspendedSignin, setSuspendedSignin] = useState<SuspendedAuthResult | null>(null);
  const [reactivationMessage, setReactivationMessage] = useState("");
  const [reactivationSent, setReactivationSent] = useState(false);
  const verificationAutoStarted = useRef(false);
  const selectAccountRole = (nextRole: SignupRole) => {
    setSelectedRole(nextRole);
    setRole(nextRole);
    setAuthError("");
  };

  const [displayName, setDisplayName] = useState(profileDraft.displayName);
  const [bio, setBio] = useState(profileDraft.bio);
  const [niche, setNiche] = useState(profileDraft.niche);
  const [brandName, setBrandName] = useState(profileDraft.brandName);
  const [industry, setIndustry] = useState(profileDraft.industry);
  const [teamSize, setTeamSize] = useState(profileDraft.teamSize);
  const [website, setWebsite] = useState(profileDraft.website);
  const [location, setLocation] = useState(profileDraft.location);
  const [audienceLocations, setAudienceLocations] = useState(profileDraft.audienceLocations ?? []);
  const [audienceSize, setAudienceSize] = useState(profileDraft.audienceSize);
  const [rate, setRate] = useState(profileDraft.rate);
  const [brandBio, setBrandBio] = useState(profileDraft.brandBio);
  const [brandBudget, setBrandBudget] = useState(profileDraft.brandBudget);
  const [profileImageUri, setProfileImageUri] = useState<string | null>(profileDraft.profileImageUri ?? null);

  // Social account inputs (matching image)
  const [instagramUrl, setInstagramUrl] = useState(profileDraft.instagramUrl);
  const [youtubeUrl, setYoutubeUrl] = useState(profileDraft.youtubeUrl);
  const [twitterUrl, setTwitterUrl] = useState(profileDraft.twitterUrl);
  const [otherUrl, setOtherUrl] = useState(profileDraft.otherUrl);
  const [linkedinUrl, setLinkedinUrl] = useState(profileDraft.linkedinUrl);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccountMap>(() => ({
    ...(profileDraft.socialAccounts ?? {}),
    Instagram: profileDraft.socialAccounts?.Instagram ?? profileDraft.instagramUrl,
    YouTube: profileDraft.socialAccounts?.YouTube ?? profileDraft.youtubeUrl,
    X: profileDraft.socialAccounts?.X ?? profileDraft.twitterUrl,
    LinkedIn: profileDraft.socialAccounts?.LinkedIn ?? profileDraft.linkedinUrl,
  }));

  const getProgress = (onboardingStep: OnboardingProgress["onboardingStep"]): OnboardingProgress => {
    const isBrand = role === "Brand";
    const currentLocation = location.trim();
    const profileLocations = isBrand ? (currentLocation ? [currentLocation] : []) : audienceLocations;
    return {
      onboardingStep,
      profile: {
        name: (isBrand ? brandName : displayName).trim(),
        city: currentLocation,
        focus: (isBrand ? industry : niche).trim(),
        bio: (isBrand ? brandBio : bio).trim(),
        audienceSize: audienceSize.trim() || undefined,
        rateRange: (isBrand ? brandBudget : rate).trim() || undefined,
        teamSize: teamSize.trim() || undefined,
        avatarUri: profileImageUri ?? undefined,
        websiteUrl: website.trim() || undefined,
        languages: ["English"],
        locations: profileLocations,
      },
      locations: profileLocations,
      languages: ["English"],
      socialAccounts,
    };
  };

  const updateDisplayName = (value: string) => { setDisplayName(value); persistProfile({ displayName: value }); setAuthError(""); };
  const updateBio = (value: string) => { setBio(value); persistProfile({ bio: value }); setAuthError(""); };
  const updateNiche = (value: string) => { setNiche(value); persistProfile({ niche: value }); setAuthError(""); };
  const updateBrandName = (value: string) => { setBrandName(value); persistProfile({ brandName: value }); setAuthError(""); };
  const updateIndustry = (value: string) => { setIndustry(value); persistProfile({ industry: value }); setAuthError(""); };
  const updateTeamSize = (value: string) => { setTeamSize(value); persistProfile({ teamSize: value }); setAuthError(""); };
  const updateWebsite = (value: string) => { setWebsite(value); persistProfile({ website: value }); setAuthError(""); };
  const updateLocation = (value: string) => { setLocation(value); persistProfile({ location: value }); setAuthError(""); };
  const updateAudienceLocations = (value: string[]) => { setAudienceLocations(value); persistProfile({ audienceLocations: value }); setAuthError(""); };
  const updateAudienceSize = (value: string) => { setAudienceSize(value); persistProfile({ audienceSize: value }); setAuthError(""); };
  const updateRate = (value: string) => { setRate(value); persistProfile({ rate: value }); setAuthError(""); };
  const updateBrandBio = (value: string) => { setBrandBio(value); persistProfile({ brandBio: value }); setAuthError(""); };
  const updateBrandBudget = (value: string) => { setBrandBudget(value); persistProfile({ brandBudget: value }); setAuthError(""); };
  const updateProfileImage = (value: string) => { setProfileImageUri(value); persistProfile({ profileImageUri: value }); setAuthError(""); };
  const updateInstagramUrl = (value: string) => { setInstagramUrl(value); persistProfile({ instagramUrl: value }); setAuthError(""); };
  const updateYoutubeUrl = (value: string) => { setYoutubeUrl(value); persistProfile({ youtubeUrl: value }); setAuthError(""); };
  const updateTwitterUrl = (value: string) => { setTwitterUrl(value); persistProfile({ twitterUrl: value }); setAuthError(""); };
  const updateOtherUrl = (value: string) => { setOtherUrl(value); persistProfile({ otherUrl: value }); setAuthError(""); };
  const updateLinkedinUrl = (value: string) => { setLinkedinUrl(value); persistProfile({ linkedinUrl: value }); setAuthError(""); };
  const updateSocialAccount = (platform: SocialPlatform, value: string) => {
    const next = { ...socialAccounts, [platform]: value };
    setSocialAccounts(next);
    persistProfile({ socialAccounts: next });
    setAuthError("");
  };

  const emailInputRef = useRef<TextInput>(null);
  const phoneInputRef = useRef<TextInput>(null);
  const resetAuthError = () => {
    setAuthError("");
    setAuthNotice("");
  };
  const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value.trim());
  const validPhone = (value: string) => value.replace(/\D/g, "").length === 10;
  const fullPhone = (value: string) => `+91${value.replace(/\D/g, "")}`;
  const socialEntries: { key: string; platform: SocialPlatform | "Website"; value: string }[] = [
    ...SOCIAL_PLATFORM_REGISTRY.map(({ key: platform }) => ({
      key: platform,
      platform,
      value: socialAccounts[platform] ?? "",
    })),
    ...(role === "Brand" ? [{ key: "website", platform: "Website" as const, value: website }] : []),
  ];

  // Resend OTP countdown
  useEffect(() => {
    if (step !== "signin-otp" && step !== "email-otp" && step !== "signup-otp") return;
    const timer = setInterval(() => {
      setResendSeconds((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  const submitSignup = async () => {
    if (isAdminThemePreview()) { setAuthError('Sign-in is disabled in the admin preview.'); return; }
    resetAuthError();
    if (!role) {
      setAuthError("Choose your account type to continue.");
      setStep("account-type");
      return;
    }
    if (!validEmail(email) || !validPhone(phone)) {
      setAuthError("Enter a valid email address and 10-digit phone number.");
      return;
    }
    if (emailVerified && signupDraft.signupVerifiedEmail === email.trim().toLowerCase()) {
      if (!emailChallenge?.signupToken) {
        setVerification({ emailVerified: false });
        setAuthError("Your email verification session expired. Please verify your email again.");
        return;
      }
      setIsSubmitting(true);
      try {
        await requestSignupPhoneOtp(emailChallenge.signupToken);
      } catch (error) {
        setAuthNotice("");
        setAuthError(error instanceof Error ? error.message : "Could not send WhatsApp verification code.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    setIsSubmitting(true);
    try {
      const challenge = await requestEmailOtp({
        email: email.trim().toLowerCase(),
        phone: fullPhone(phone),
        role: role === "Brand" ? "BRAND" : "CREATOR",
        intent: "signup",
      });
      setEmailOtpCode("");
      setResendSeconds(challenge.resendAfterSeconds ?? fallbackOtpResendCooldownSeconds);
      setEmailChallenge(challenge);
      setVerification({ emailVerified: false, phoneVerified: false });
      setAuthNotice("Email verification code sent.");
      setStep("email-otp");
    } catch (error) {
      setAuthNotice("");
      setAuthError(error instanceof Error ? error.message : "Could not send email verification code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestSignupPhoneOtp = async (signupToken: string | undefined) => {
    if (isAdminThemePreview()) { setAuthError('Sign-in is disabled in the admin preview.'); return; }
    if (!signupToken) throw new Error("Request a new email verification code.");
    setOtpCode("");
    setOtpChallenge(null);
    setResendSeconds(0);
    setStep("signup-otp");
    const challenge = await requestOtp({
      phone: fullPhone(phone),
      email: email.trim().toLowerCase(),
      role: role === "Brand" ? "BRAND" : "CREATOR",
      intent: "signup",
      signupToken,
    });
    setResendSeconds(challenge.resendAfterSeconds ?? fallbackOtpResendCooldownSeconds);
    setOtpChallenge(challenge);
    setAuthNotice("WhatsApp verification code sent.");
  };

  const verifyEmail = async () => {
    if (isAdminThemePreview()) { setAuthError('Sign-in is disabled in the admin preview.'); return; }
    if (emailOtpCode.length !== 6) {
      setAuthError("Enter the 6-digit email verification code.");
      return;
    }
    setIsSubmitting(true);
    resetAuthError();
    try {
      if (!emailChallenge?.signupToken) throw new Error("Request a new email verification code.");
      const verified = await verifyEmailOtp({
        challengeId: emailChallenge.challengeId,
        code: emailOtpCode,
        email: email.trim().toLowerCase(),
        signupToken: emailChallenge.signupToken,
      });
      setEmailChallenge({ ...emailChallenge, signupToken: verified.signupToken });
      setVerification({ emailVerified: true, phoneVerified: false });
      setEmailOtpCode("");
      await requestSignupPhoneOtp(verified.signupToken);
    } catch (error) {
      setAuthNotice("");
      setAuthError(error instanceof Error ? error.message : "Could not continue to WhatsApp verification.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitSignin = async () => {
    if (isAdminThemePreview()) { setAuthError('Sign-in is disabled in the admin preview.'); return; }
    resetAuthError();
    if (signinMethod === "email" && !validEmail(signinEmail)) {
      setAuthError("Enter a valid email address.");
      return;
    }
    if (signinMethod === "phone" && !validPhone(signinIdentifier)) {
      setAuthError("Enter a valid 10-digit phone number.");
      return;
    }
    setIsSubmitting(true);
    try {
      setOtpCode("");
      if (signinMethod === "email") {
        const challenge = await requestEmailSigninOtp({ email: signinEmail.trim().toLowerCase() });
        setSigninEmailChallenge(challenge);
        setResendSeconds(challenge.resendAfterSeconds ?? fallbackOtpResendCooldownSeconds);
        setOtpChallenge(null);
      } else {
        const challenge = await requestOtp({ phone: fullPhone(signinIdentifier), intent: "signin" });
        setOtpChallenge(challenge);
        setResendSeconds(challenge.resendAfterSeconds ?? fallbackOtpResendCooldownSeconds);
        setSigninEmailChallenge(null);
      }
      setAuthNotice(`${signinMethod === "email" ? "Email" : "WhatsApp"} verification code sent.`);
      setStep("signin-otp");
    } catch (error) {
      setAuthNotice("");
      setAuthError(error instanceof Error ? error.message : "Could not send WhatsApp code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifySignup = async () => {
    if (isAdminThemePreview()) { setAuthError('Sign-in is disabled in the admin preview.'); return; }
    if (otpCode.length !== 6) {
      setAuthError("Enter the 6-digit WhatsApp verification code.");
      return;
    }
    if (!otpChallenge) {
      setAuthError("Request a new WhatsApp verification code.");
      return;
    }
    setIsSubmitting(true);
    resetAuthError();
    try {
      const result = await verifyOtp({
        challengeId: otpChallenge.challengeId,
        code: otpCode,
        role: role === "Brand" ? "BRAND" : "CREATOR",
        email: email.trim().toLowerCase(),
        signupToken: emailChallenge?.signupToken,
      });
      if ("suspended" in result) throw new Error("This account is currently suspended. Sign in to request a review.");
      setPendingAuthenticatedUser(result.user);
      setVerification({ phoneVerified: true });
      setStep("profile");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not verify your phone.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifySignin = async () => {
    if (isAdminThemePreview()) { setAuthError('Sign-in is disabled in the admin preview.'); return; }
    setIsSubmitting(true);
    resetAuthError();
    try {
      if (otpCode.length !== 6) throw new Error("Enter the 6-digit verification code.");
      const result = signinMethod === "email"
        ? await verifyEmailSigninOtp({
            challengeId: signinEmailChallenge?.challengeId ?? (() => { throw new Error("Request a new email code."); })(),
            code: otpCode,
            email: signinEmail.trim().toLowerCase(),
          })
        : await verifyOtp({
            challengeId: otpChallenge?.challengeId ?? (() => { throw new Error("Request a new WhatsApp code."); })(),
            code: otpCode,
          });
      if ("suspended" in result) {
        setSuspendedSignin(result);
        setReactivationMessage("");
        setReactivationSent(false);
        setOtpCode("");
        return;
      }
      const freshUser = await restoreSession(10_000, false);
      onAuthenticated(freshUser ?? result.user);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not verify code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitAccountReactivation = async () => {
    if (!suspendedSignin || reactivationMessage.trim().length < 10) { setAuthError("Please explain your request in at least 10 characters."); return; }
    setIsSubmitting(true); setAuthError("");
    try {
      await submitReactivationRequest(suspendedSignin.reactivationToken, reactivationMessage.trim());
      setReactivationSent(true);
      setAuthNotice("Your support request was sent. The Brandly team will review it.");
    } catch (error) { setAuthError(error instanceof Error ? error.message : "Could not send your request."); }
    finally { setIsSubmitting(false); }
  };

  const resendOtp = async () => {
    if (isAdminThemePreview()) { setAuthError('Sign-in is disabled in the admin preview.'); return; }
    if (resendSeconds > 0 || isSubmitting || isResendingOtp) return;
    resetAuthError();
    setIsResendingOtp(true);
    try {
      if (step === "email-otp") {
        const challenge = await requestEmailOtp({
          email: email.trim().toLowerCase(),
          phone: fullPhone(phone),
          role: role === "Brand" ? "BRAND" : "CREATOR",
          intent: "signup",
        });
        setEmailChallenge(challenge);
        setResendSeconds(challenge.resendAfterSeconds ?? fallbackOtpResendCooldownSeconds);
      } else if (step === "signup-otp") {
        const challenge = await requestOtp({
          phone: fullPhone(phone),
          email: email.trim().toLowerCase(),
          role: role === "Brand" ? "BRAND" : "CREATOR",
          intent: "signup",
          signupToken: emailChallenge?.signupToken,
        });
        setOtpChallenge(challenge);
        setResendSeconds(challenge.resendAfterSeconds ?? fallbackOtpResendCooldownSeconds);
      } else if (step === "signin-otp") {
        if (signinMethod === "email") {
          const challenge = await requestEmailSigninOtp({ email: signinEmail.trim().toLowerCase() });
          setSigninEmailChallenge(challenge);
          setResendSeconds(challenge.resendAfterSeconds ?? fallbackOtpResendCooldownSeconds);
        } else {
          const challenge = await requestOtp({ phone: fullPhone(signinIdentifier), intent: "signin" });
          setOtpChallenge(challenge);
          setResendSeconds(challenge.resendAfterSeconds ?? fallbackOtpResendCooldownSeconds);
        }
      }
      setOtpCode("");
      setEmailOtpCode("");
      setAuthNotice(`${step === "email-otp" || (step === "signin-otp" && signinMethod === "email") ? "Email" : "WhatsApp"} verification code sent again.`);
    } catch (error) {
      setAuthNotice("");
      if (error instanceof Error && /please wait/i.test(error.message)) {
        setResendSeconds(fallbackOtpResendCooldownSeconds);
      }
      setAuthError(error instanceof Error ? error.message : "Could not resend the code.");
    } finally {
      setIsResendingOtp(false);
    }
  };

  const completeAccountCreation = async () => {
    if (isAdminThemePreview()) { setAuthError('Account creation is disabled in the admin preview.'); return; }
    if (!pendingAuthenticatedUser) {
      setAuthError("Your verification session has expired. Please start again.");
      setStep("signup");
      return;
    }
    const isBrand = role === "Brand";
    const finalName = (isBrand ? brandName : displayName).trim();
    const finalBio = (isBrand ? brandBio : bio).trim();
    const finalFocus = (isBrand ? industry : niche).trim();
    const finalLocation = location.trim();
    if (!finalName || !finalBio || !finalFocus || !finalLocation) {
      setAuthError(isBrand ? "Complete your brand profile before creating the account." : "Complete your creator profile before creating the account.");
      setStep("profile");
      return;
    }
    setAuthError("");
    setIsSubmitting(true);
    try {
      // Flush the last review draft before the final success write so an older
      // queued step can never overwrite the completed state.
      await onProgressSave?.(getProgress("review"));
      const updatedUser = await updateRemoteProfile({
        displayName: finalName,
        bio: finalBio,
        city: finalLocation,
        focus: finalFocus,
        ...(profileImageUri ? { avatarUrl: profileImageUri } : {}),
        ...(isBrand && website.trim() ? { websiteUrl: website.trim() } : {}),
        ...(!isBrand && audienceSize.trim() ? { audienceSize: audienceSize.trim() } : {}),
        ...(!isBrand && rate.trim() ? { rateRange: rate.trim() } : {}),
        ...(isBrand && brandBudget.trim() ? { rateRange: brandBudget.trim() } : {}),
        ...(isBrand && teamSize.trim() ? { teamSize: teamSize.trim() } : {}),
        visibility: "PUBLIC",
        languages: ["English"],
        locations: isBrand ? [finalLocation] : audienceLocations,
        onboardingStep: "success",
      });
      const socialInputs = [
        ...Object.entries(socialAccounts),
        ...(isBrand && website.trim() ? [["Website", website]] : []),
      ];
      const savedSocialAccounts = await Promise.all(
        socialInputs
          .filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()))
          .map(([platform, url]) => saveRemoteSocialAccount({ platform, handle: url.trim(), profileUrl: url.trim() })),
      );
      const completedUser = {
        ...updatedUser,
        socialAccounts: [...updatedUser.socialAccounts.filter((account) => !savedSocialAccounts.some((saved) => saved.platform === account.platform)), ...savedSocialAccounts],
      };
      const freshUser = await restoreSession(10_000, false);
      const authenticatedUser = freshUser ?? completedUser;
      setPendingAuthenticatedUser(authenticatedUser);
      onAuthenticated(authenticatedUser);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not create your account.");
      setStep("review");
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifySocialAccountsAutomatically = async () => {
    if (isAdminThemePreview()) { setAuthError('Social verification is disabled in the admin preview.'); return; }
    if (!pendingAuthenticatedUser || isSubmitting) return;
    const isBrand = role === "Brand";
    const socialInputs = [
      ...Object.entries(socialAccounts),
      ...(isBrand && website.trim() ? [["Website", website]] : []),
    ].filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()));
    setAuthError("");
    setIsSubmitting(true);
    try {
      const savedSocialAccounts = await withTimeout(
        Promise.all(socialInputs.map(([platform, url]) => saveRemoteSocialAccount({ platform, handle: url.trim(), profileUrl: url.trim() }))),
        10_000,
        "Social profile checks took too long. Please try again.",
      );
      setPendingAuthenticatedUser((current) => current ? {
        ...current,
        socialAccounts: [...current.socialAccounts.filter((account) => !savedSocialAccounts.some((saved) => saved.platform === account.platform)), ...savedSocialAccounts],
      } : current);
      let latestUser: ApiUser | null = {
        ...pendingAuthenticatedUser,
        socialAccounts: [...pendingAuthenticatedUser.socialAccounts.filter((account) => !savedSocialAccounts.some((saved) => saved.platform === account.platform)), ...savedSocialAccounts],
      };
      const deadline = Date.now() + 12_000;
      for (let attempt = 0; attempt < 8 && Date.now() < deadline && savedSocialAccounts.some((account) => account.syncStatus === "QUEUED" || account.syncStatus === "RUNNING"); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(1_500, Math.max(0, deadline - Date.now()))));
        const current = await restoreSession(Math.min(2_500, Math.max(1, deadline - Date.now())), false);
        if (!current) break;
        latestUser = current;
        setPendingAuthenticatedUser(current);
        const tracked = current.socialAccounts.filter((account) => socialInputs.some(([platform]) => platform === account.platform));
        if (tracked.every((account) => account.syncStatus !== "QUEUED" && account.syncStatus !== "RUNNING")) break;
      }
      const trackedAccounts = latestUser.socialAccounts.filter((account) => socialInputs.some(([platform]) => platform === account.platform));
      if (trackedAccounts.some((account) => account.syncStatus === "FAILED")) {
        setAuthError("Some profiles need admin review. You can continue while verification is completed.");
        return;
      }
      if (trackedAccounts.some((account) => account.syncStatus === "QUEUED" || account.syncStatus === "RUNNING")) {
        setAuthError("Verification is still pending. Try again in a moment.");
        return;
      }
      setStep("review");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Social profile checks could not start.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (step !== "verifying") {
      verificationAutoStarted.current = false;
      return;
    }
    if (pendingAuthenticatedUser && !verificationAutoStarted.current) {
      verificationAutoStarted.current = true;
      void verifySocialAccountsAutomatically();
    }
  }, [pendingAuthenticatedUser, step]);

  const verificationReviewRequired = Boolean(
    pendingAuthenticatedUser?.socialAccounts.some(
      (account) => account.syncStatus === "FAILED" && socialEntries.some((entry) => entry.platform === account.platform),
    ),
  );
  const verificationNeedsTeamReview = Boolean(
    pendingAuthenticatedUser &&
      !isSubmitting &&
      socialEntries.some(({ platform, value }) => {
        if (!value.trim()) return false;
        const account = pendingAuthenticatedUser.socialAccounts.find((item) => item.platform === platform);
        return !account || (account.verificationStatus !== "VERIFIED" && account.syncStatus !== "FAILED");
      }),
  );
  const verificationReviewPlatformNames = pendingAuthenticatedUser
    ? socialEntries
        .filter(({ platform, value }) => {
          if (!value.trim()) return false;
          const account = pendingAuthenticatedUser.socialAccounts.find((item) => item.platform === platform);
          return !account || account.verificationStatus !== "VERIFIED";
        })
        .map(({ platform }) => socialPlatformLabel(platform))
    : [];
  const verificationReviewLabel = verificationReviewPlatformNames.join(", ") || "Your social account";

  // ==========================================
  // STEP 1: AUTH LANDING
  // ==========================================
  if (suspendedSignin) return (
    <AuthShell><AuthContent>
      <AuthBackButton label="Back to sign in" onPress={() => { setSuspendedSignin(null); setAuthError(""); setAuthNotice(""); setStep("signin"); }} />
      <View style={styles.authFormIntro}><View style={[styles.authOtpIcon, { backgroundColor: theme.colors.danger + "18" }]}><AppIcon name="lock-closed-outline" size={28} color={theme.colors.danger} /></View><AuthTitle primary="Account" secondary=" suspended" /><AuthText style={styles.authBody}>{suspendedSignin.userName}, your account is currently suspended.</AuthText></View>
      <View style={{ padding: 14, borderRadius: 14, backgroundColor: theme.colors.surface }}><AuthText style={styles.authBody}>Reason: {suspendedSignin.reason}</AuthText></View>
      {suspendedSignin.reviewStatus && <AuthText style={styles.authBody}>{suspendedSignin.reviewStatus === "PENDING" ? "Your reactivation request is waiting for the support team." : `Your last request was declined.${suspendedSignin.resolutionNote ? ` ${suspendedSignin.resolutionNote}` : " You can send an updated request below."}`}</AuthText>}
      {!reactivationSent && <AuthInput icon="chatbubble-ellipses-outline" accessibilityLabel="Request account reactivation" value={reactivationMessage} onChangeText={setReactivationMessage} multiline textAlignVertical="top" placeholder="Tell us why you are requesting account reactivation" placeholderTextColor={theme.colors.inputPlaceholder} />}
      {authError ? <Text style={styles.authError}>{authError}</Text> : null}
      {authNotice ? <Text style={styles.authNotice}>{authNotice}</Text> : null}
      <View style={styles.authBottomAction}>{!reactivationSent ? <AppButton label="Send review request" icon="send-outline" loading={isSubmitting} disabled={isSubmitting || reactivationMessage.trim().length < 10} onPress={() => void submitAccountReactivation()} /> : <AppButton label="Back to sign in" icon="arrow-back" onPress={() => { setSuspendedSignin(null); setStep("signin"); }} />}</View>
    </AuthContent></AuthShell>
  );

  if (step === "welcome")
    return (
      <AuthShell landing>
        <AuthContent>
          <View style={styles.authLandingTop}>
            <Text style={styles.authLandingBrand}>Brandly</Text>
          </View>
          <View style={styles.authLandingHero}>
            <View style={styles.authLandingIntro}>
              <View style={styles.authLandingHeader}>
                <AuthText style={styles.authLandingTitle}>
                  <Text style={styles.authLandingTitlePrimary}>Build meaningful brand</Text>{`\n`}
                  <Text style={styles.authLandingTitleSecondary}>partnerships.</Text>
                </AuthText>
                <AuthText style={styles.authLandingBody}>
                  Connect with the right brands and creators.{`\n`}Build meaningful work together.
                </AuthText>
              </View>
            </View>
            <AuthLandingIllustration />
          </View>
          <View style={styles.authLandingFooter}>
            <View style={styles.authLandingActions}>
              <AuthLandingAction
                label="Create account"
                icon="person-add-outline"
                primary
                onPress={() => setStep("account-type")}
              />
              <AuthLandingAction
                label="Sign in"
                icon="log-in-outline"
                onPress={() => setStep("signin")}
              />
            </View>
            <Text style={styles.authLandingFootnote}>
              By continuing, you agree to the{`\n`}
              <Text style={styles.authLandingPolicyLink}>Terms</Text> and <Text style={styles.authLandingPolicyLink}>Privacy Policy</Text>.
            </Text>
          </View>
        </AuthContent>
      </AuthShell>
    );

  // ==========================================
  // STEP 2: CHOOSE ACCOUNT TYPE
  // ==========================================
  if (step === "account-type")
    return (
      <AuthShell>
        <View style={styles.stepperHeader}>
          <AuthBackButton
            label="Back"
            onPress={() => {
              resetAuthError();
              setStep("welcome");
            }}
          />
          <AuthProgress current={1} total={8} />
        </View>
        <AuthContent>
          <AuthStepPill label="GET STARTED" icon="bulb-outline" />
          <View style={styles.authFormIntro}>
            <View style={styles.authTitleBlock}>
              <AuthText style={[styles.authTitle, styles.authTitlePrimary]}>Choose your</AuthText>
              <AuthText style={[styles.authTitle, styles.authTitleSecondary, styles.authTitleIndented]}>Account type</AuthText>
            </View>
            <AuthText style={styles.authBody}>Choose the path that fits how you want to build partnerships.</AuthText>
          </View>
          <View style={styles.authOptions}>
            <AccountTypeOption
              selected={role === "Influencer"}
              title="I Am A Creator"
              description="Find campaigns that fit your audience."
              icon="person-circle-outline"
              iconStyle={styles.authOptionIconCreator}
              cardStyle={styles.authOptionCardCreator}
              onPress={() => selectAccountRole("Influencer")}
            />
            <AccountTypeOption
              selected={role === "Brand"}
              title="I Represent A Brand"
              description="Find creators for your next campaign."
              icon="business-outline"
              iconStyle={styles.authOptionIconBrand}
              cardStyle={styles.authOptionCardBrand}
              onPress={() => selectAccountRole("Brand")}
            />
          </View>
          <View style={styles.authBottomAction}>
            {authError ? <Text style={styles.authError}>{authError}</Text> : null}
            <AuthContinueButton
              disabled={!role}
              onPress={() => {
                if (!role) return;
                setStep("signup");
              }}
            />
          </View>
        </AuthContent>
      </AuthShell>
    );

  // ==========================================
  // STEP 3: ENTER EMAIL & PHONE
  // ==========================================
  if (step === "signup")
    return (
      <AuthShell keyboardAware>
        <View style={styles.stepperHeader}>
          <AuthBackButton
            label="Back"
            onPress={() => {
              resetAuthError();
              setStep("account-type");
            }}
          />
          <AuthProgress current={2} total={8} />
        </View>
        <AuthContent>
          <AuthStepPill label="CREATE ACCOUNT" icon="create-outline" />
          <View style={styles.authFormIntro}>
            <AuthTitle primary={<>Let&apos;s set up your{`\n`}</>} secondary="account" />
            <AuthText style={styles.authBody}>
              We&apos;ll use your email and phone number to keep your account secure.
            </AuthText>
          </View>
          <View style={styles.authContactFields}>
            <AuthInput
            inputRef={emailInputRef}
            icon="mail-outline"
            accessibilityLabel="Email address"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            value={email}
            onChangeText={(value) => {
              setContact({ email: value });
              resetAuthError();
            }}
            returnKeyType="next"
            onSubmitEditing={() => phoneInputRef.current?.focus()}
            placeholder="Email address"
            placeholderTextColor={theme.colors.inputPlaceholder}
            error={Boolean(authError) && !validEmail(email)}
            success={validEmail(email)}
          />
            <IndiaPhoneField
            value={phone}
            inputRef={phoneInputRef}
            error={Boolean(authError) && !validPhone(phone)}
            success={validPhone(phone)}
            onChange={(value) => {
              setContact({ phone: value });
              resetAuthError();
            }}
          />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 6 }}>
              <AppIcon name="checkmark-circle" size={18} color="#16A34A" />
              <Text style={{ fontSize: 13, color: theme.colors.textSecondary, flex: 1, lineHeight: 18 }}>
                We&apos;ll verify both your email and WhatsApp number. Both are required.
              </Text>
            </View>
          </View>
          <View style={styles.authBottomAction}>
            {authError ? <Text style={styles.authError}>{authError}</Text> : null}
            <AppButton
              label="Continue"
              icon="arrow-forward"
              iconAfter
              loading={isSubmitting}
              onPress={submitSignup}
              disabled={isSubmitting || !validEmail(email) || !validPhone(phone)}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                resetAuthError();
                setStep("signin");
              }}
            >
              <Text style={styles.authSwitch}>Already have an account? Sign in</Text>
            </Pressable>
          </View>
        </AuthContent>
      </AuthShell>
    );

  // ==========================================
  // STEP 4: VERIFY EMAIL OTP
  // ==========================================
  if (step === "email-otp")
    return (
      <AuthShell>
        <View style={styles.stepperHeader}>
          <AuthBackButton
            label="Back"
            onPress={() => {
              resetAuthError();
              setVerification({ emailVerified: false });
              setStep("signup");
            }}
          />
          <AuthProgress current={3} total={8} />
        </View>
        <AuthContent>
          <View style={[styles.authFormIntro, styles.authOtpIntro]}>
            <View style={[styles.authOtpIcon, { backgroundColor: "#EEF2FF" }]}>
              <AppIcon name="mail-outline" size={32} color={theme.colors.primary} />
            </View>
            <AuthTitle primary="Verify your" secondary=" email" style={[styles.authOtpTitle, { textAlign: "center" }]} />
            <AuthText style={[styles.authBody, styles.authOtpBody, { textAlign: "center" }]}>
              We&apos;ve sent a 6-digit code to{`\n`}{email}.
            </AuthText>
            <Pressable accessibilityRole="button" onPress={() => { resetAuthError(); setVerification({ emailVerified: false }); setEmailOtpCode(""); setStep("signup"); }}>
              <Text style={styles.resendText}>Change email</Text>
            </Pressable>
          </View>
          <OtpBoxes value={emailOtpCode} onChange={setEmailOtpCode} accessibilityLabel="Email verification code" channel="email" error={Boolean(authError)} />
          <View style={styles.resendRow}>
            <Text style={styles.authHint}>Didn&apos;t receive the code?</Text>
            <Pressable disabled={resendSeconds > 0 || isResendingOtp || isSubmitting} onPress={() => void resendOtp()} accessibilityRole="button" accessibilityState={{ disabled: resendSeconds > 0 || isResendingOtp || isSubmitting, busy: isResendingOtp }}>
              {isResendingOtp ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <Text style={[styles.resendText, resendSeconds > 0 && styles.resendTextDisabled]}>
                {resendSeconds > 0 ? `Resend in 00:${String(resendSeconds).padStart(2, "0")}` : "Resend code"}
              </Text>}
            </Pressable>
          </View>
          <View style={styles.authBottomAction}>
            {authNotice ? <Text style={styles.authNotice}>{authNotice}</Text> : null}
            {authError ? <Text style={styles.authError}>{authError}</Text> : null}
            <AppButton
              label="Verify email"
              icon="arrow-forward"
              iconAfter
              loading={isSubmitting}
              onPress={() => void verifyEmail()}
              disabled={emailOtpCode.length !== 6}
            />
          </View>
        </AuthContent>
      </AuthShell>
    );

  // ==========================================
  // STEP 5: VERIFY WHATSAPP OTP
  // ==========================================
  if (step === "signup-otp")
    return (
      <AuthShell>
        <View style={styles.stepperHeader}>
          <AuthBackButton
            label="Back"
            onPress={() => {
              resetAuthError();
              setStep("signup");
            }}
          />
          <AuthProgress current={3} total={8} />
        </View>
        <AuthContent>
          <View style={[styles.authFormIntro, styles.authOtpIntro]}>
            <View style={[styles.authOtpIcon, { backgroundColor: "#DCFCE7" }]}>
              <AppIcon name="logo-whatsapp" size={32} color="#16A34A" />
            </View>
            <AuthTitle primary="Verify your" secondary=" phone number" style={[styles.authOtpTitle, { textAlign: "center" }]} />
            <AuthText style={[styles.authBody, styles.authOtpBody, { textAlign: "center" }]}>
              We&apos;ve sent a 6-digit code to{`\n`}+91 {phone} on WhatsApp.
            </AuthText>
            <Pressable accessibilityRole="button" onPress={() => { resetAuthError(); setOtpCode(""); setStep("signup"); }}>
              <Text style={styles.resendText}>Change phone number</Text>
            </Pressable>
          </View>
          <OtpBoxes value={otpCode} onChange={setOtpCode} accessibilityLabel="WhatsApp verification code" error={Boolean(authError)} />
          <View style={styles.resendRow}>
            <Text style={styles.authHint}>Didn&apos;t receive the code?</Text>
            <Pressable disabled={resendSeconds > 0 || isResendingOtp || isSubmitting} onPress={() => void resendOtp()} accessibilityRole="button" accessibilityState={{ disabled: resendSeconds > 0 || isResendingOtp || isSubmitting, busy: isResendingOtp }}>
              {isResendingOtp ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <Text style={[styles.resendText, resendSeconds > 0 && styles.resendTextDisabled]}>
                {resendSeconds > 0 ? `Resend in 00:${String(resendSeconds).padStart(2, "0")}` : "Resend code"}
              </Text>}
            </Pressable>
          </View>
          <View style={styles.authBottomAction}>
            {authNotice ? <Text style={styles.authNotice}>{authNotice}</Text> : null}
            {authError ? <Text style={styles.authError}>{authError}</Text> : null}
            <AppButton label="Verify & continue" icon="arrow-forward" iconAfter loading={isSubmitting} onPress={() => void verifySignup()} disabled={otpCode.length !== 6} />
          </View>
        </AuthContent>
      </AuthShell>
    );

  // ==========================================
  // STEP 6: CREATOR PROFILE / BRAND PROFILE
  // ==========================================
  if (step === "profile")
    return (
      <AuthShell keyboardAware>
        <View style={styles.stepperHeader}>
          <AuthBackButton
            label="Back"
            onPress={() => setStep("signup-otp")}
          />
          <AuthProgress current={4} total={8} />
        </View>
        <AuthContent>
          <AuthStepPill
            label={role === "Brand" ? "BRAND PROFILE" : "CREATOR PROFILE"}
            icon={role === "Brand" ? "business-outline" : "person-circle-outline"}
          />
          <View style={styles.authFormIntro}>
          <AuthTitle
            primary={<>Create your{`\n`}</>}
            secondary={role === "Brand" ? "brand profile" : "profile"}
            style={styles.authTitle}
          />
          <AuthText style={styles.authBody}>
            {role === "Brand"
              ? "Set up your brand identity so creators can understand your partnership profile."
              : "Set up your profile so brands can quickly understand your work and fit."}
          </AuthText>
          </View>

          <ProfilePhotoPicker
          compact
          initials={getProfileInitials(role === "Brand" ? brandName : displayName)}
          uri={profileImageUri ?? undefined}
          onChange={updateProfileImage}
          title={role === "Brand" ? "Add brand logo" : "Add profile photo"}
          hint="PNG or JPG up to 5MB"
        />

        {/* Inputs */}
          <View style={{ gap: theme.spacing.sm }}>
          <Text style={styles.onboardingFieldLabel}>
            {role === "Brand" ? "Brand name *" : "Display name *"}
          </Text>
          <AuthInput
            icon={role === "Brand" ? "business-outline" : "person-outline"}
            value={role === "Brand" ? brandName : displayName}
            onChangeText={role === "Brand" ? updateBrandName : updateDisplayName}
            placeholder={role === "Brand" ? "Enter brand name" : "Enter your name"}
            error={Boolean(authError) && !(role === "Brand" ? brandName : displayName).trim()}
          />

          <Text style={styles.onboardingFieldLabel}>
            {role === "Brand" ? "Industry" : "Bio"}
          </Text>
          {role === "Brand" ? (
            <DropdownPickerField
              label="Industry"
              value={industry}
              placeholder="Select industry"
              icon="pricetag-outline"
              options={INDUSTRY_OPTIONS}
              onSelect={updateIndustry}
              error={Boolean(authError) && !industry.trim()}
            />
          ) : (
            <AuthInput
              icon="document-text-outline"
              value={bio}
              onChangeText={updateBio}
              placeholder="Tell brands about yourself"
              multiline
              maxLength={280}
              numberOfLines={4}
              style={styles.onboardingProfileBio}
              error={Boolean(authError) && !bio.trim()}
            />
          )}

          <Text style={styles.onboardingFieldLabel}>
            {role === "Brand" ? "Team size (optional)" : "Niche / Category"}
          </Text>
          {role === "Brand" ? (
            <DropdownPickerField
              label="Team size"
              value={teamSize}
              placeholder="Select team size"
              icon="people-outline"
              options={TEAM_SIZE_OPTIONS}
              onSelect={updateTeamSize}
            />
          ) : (
            <DropdownPickerField
              label="Niche / Category"
              value={niche}
              placeholder="Select category"
              icon="pricetag-outline"
              options={CREATOR_CATEGORIES}
              onSelect={updateNiche}
              error={Boolean(authError) && !niche.trim()}
            />
          )}

          {role === "Brand" ? (
            <>
              <Text style={styles.onboardingFieldLabel}>Website (optional)</Text>
              <AuthInput
                icon="link-outline"
                value={website}
                onChangeText={updateWebsite}
              placeholder="https://"
                autoCapitalize="none"
              />
            </>
          ) : null}
        </View>

          <View style={styles.authBottomAction}>
            {authError ? <Text style={styles.authError}>{authError}</Text> : null}
            <AppButton
            label="Continue"
            icon="arrow-forward"
            iconAfter
            onPress={() => {
              const validProfile = role === "Brand"
                ? Boolean(brandName.trim() && industry.trim())
                : Boolean(displayName.trim() && bio.trim() && niche.trim());
              if (!validProfile) {
                setAuthError(role === "Brand" ? "Enter your brand name and industry." : "Enter your name, bio, and niche.");
                return;
              }
              resetAuthError();
              setStep("details");
            }}
            />
          </View>
        </AuthContent>
      </AuthShell>
    );

  // ==========================================
  // STEP 7: ADDITIONAL DETAILS / BRAND DETAILS
  // ==========================================
  if (step === "details")
    return (
      <AuthShell keyboardAware>
        <View style={styles.stepperHeader}>
          <AuthBackButton
            label="Back"
            onPress={() => setStep("profile")}
          />
          <AuthProgress current={5} total={8} />
        </View>
        <AuthContent>
          <AuthStepPill
            label={role === "Brand" ? "BRAND DETAILS" : "ADDITIONAL DETAILS"}
            icon={role === "Brand" ? "business-outline" : "options-outline"}
          />
          <View style={styles.authFormIntro}>
          <AuthTitle primary={<>Complete your{`\n`}</>} secondary="profile details" />
          <AuthText style={styles.authBody}>
            {role === "Brand"
              ? "Add the details creators need to understand your location and campaign needs."
              : "Add your location, audience and rate so brands can find the right fit."}
          </AuthText>
          </View>
          <View style={{ gap: theme.spacing.sm }}>
          <Text style={styles.onboardingFieldLabel}>Your location</Text>
          <IndiaLocationField
            value={location}
            onChange={updateLocation}
            error={Boolean(authError) && !location.trim()}
          />

          {role === "Influencer" ? (
            <>
              <Text style={styles.onboardingFieldLabel}>Audience locations (optional)</Text>
              <LocationPickerField
                selected={audienceLocations}
                locations={INDIA_LOCATION_OPTIONS}
                onApply={updateAudienceLocations}
                title="Choose audience locations"
                subtitle="Select one or more cities or states where your audience is based"
                searchAccessibilityLabel="Search audience locations"
                placeholder="Select one or more locations"
              />
            </>
          ) : null}

          {role === "Brand" ? (
            <>
              <Text style={styles.onboardingFieldLabel}>About the brand</Text>
              <AuthInput
                icon="document-text-outline"
                value={brandBio}
                onChangeText={updateBrandBio}
                placeholder="Tell creators about your brand..."
                multiline
                maxLength={280}
                style={styles.onboardingProfileBio}
                error={Boolean(authError) && !brandBio.trim()}
              />
              <Text style={styles.onboardingFieldLabel}>Typical campaign budget (optional)</Text>
              <DropdownPickerField
                label="Typical campaign budget"
                value={brandBudget}
                placeholder="Select campaign budget"
                icon="cash-outline"
                options={CAMPAIGN_BUDGET_OPTIONS}
                onSelect={updateBrandBudget}
              />
            </>
          ) : (
            <>
              <Text style={styles.onboardingFieldLabel}>Audience size (optional)</Text>
              <DropdownPickerField
                label="Audience size"
                value={audienceSize}
                placeholder="Select audience size"
                icon="people-outline"
                options={AUDIENCE_SIZE_OPTIONS}
                onSelect={updateAudienceSize}
              />
              <Text style={styles.onboardingFieldLabel}>Your rate (optional)</Text>
              <DropdownPickerField
                label="Your rate"
                value={rate}
                placeholder="Select your rate"
                icon="cash-outline"
                options={CREATOR_RATE_OPTIONS}
                onSelect={updateRate}
              />
            </>
          )}
        </View>
          <View style={styles.authBottomAction}>
            {authError ? <Text style={styles.authError}>{authError}</Text> : null}
            <AppButton
            label="Continue"
            icon="arrow-forward"
            iconAfter
            onPress={() => {
              if (!location.trim() || (role === "Brand" && !brandBio.trim())) {
                setAuthError(role === "Brand" ? "Add your location and a short brand description." : "Add your location to continue.");
                return;
              }
              resetAuthError();
              setStep("social");
            }}
            />
          </View>
        </AuthContent>
      </AuthShell>
    );

  // ==========================================
  // STEP 8: SOCIAL ACCOUNTS (URL ONLY)
  // ==========================================
  if (step === "social")
    return (
      <AuthShell keyboardAware>
        <View style={styles.stepperHeader}>
          <AuthBackButton
            label="Back"
            onPress={() => setStep("details")}
          />
          <AuthProgress current={6} total={8} />
        </View>
        <AuthContent>
          <AuthStepPill label="SOCIAL ACCOUNTS" icon="link-outline" />
          <View style={styles.authFormIntro}>
          <AuthTitle
            primary="Build your"
            secondary={<>{" "}social{`\n`}presence</>}
            style={styles.authTitle}
          />
          <AuthText style={styles.authBody}>
            {role === "Brand"
              ? "Add your brand channels so creators can find and recognize you."
              : "Add your social links so brands can discover your work and audience."}
          </AuthText>
          </View>
          <View style={{ gap: theme.spacing.sm }}>
          {SOCIAL_PLATFORM_REGISTRY.map((config) => {
            const value = socialAccounts[config.key] ?? "";
            const invalid = value.trim() ? socialUrlError(config.key, value) : null;
            return (
              <View key={config.key} style={[styles.socialInputRow, Boolean(authError && invalid) && styles.socialInputRowError]}>
                <View style={[styles.socialInputIconBox, { backgroundColor: config.surface }]}>
                  <AppIcon name={config.icon} size={20} color={config.color} />
                </View>
                <TextInput
                  style={styles.socialInputField}
                  value={value}
                  onChangeText={(nextValue) => updateSocialAccount(config.key, nextValue)}
                  placeholder={config.placeholder}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor={theme.colors.inputPlaceholder}
                />
              </View>
            );
          })}

          {role === "Brand" ? (
            <View style={[styles.socialInputRow, Boolean(authError && website.trim() && socialUrlError("Website", website)) && styles.socialInputRowError]}>
              <View style={[styles.socialInputIconBox, { backgroundColor: "#EEF2FF" }]}>
                <AppIcon name="globe-outline" size={20} color="#4F46E5" />
              </View>
              <TextInput
                style={styles.socialInputField}
                value={website}
                onChangeText={updateWebsite}
                placeholder="https://your-brand.com"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={theme.colors.inputPlaceholder}
              />
            </View>
          ) : null}

          <Text style={[styles.authHint, { marginTop: 6 }]}>
            Follower and engagement data is never entered manually.
          </Text>
        </View>
          <View style={styles.authBottomAction}>
            {authError ? <Text style={styles.authError}>{authError}</Text> : null}
            <AppButton
            label="Continue"
            icon="arrow-forward"
            iconAfter
            onPress={() => {
              const entered = socialEntries.filter((entry) => entry.value.trim());
              const invalid = entered.find((entry) => socialUrlError(entry.platform, entry.value));
              if (!entered.length) {
                setAuthError("Add at least one social profile URL to continue.");
                return;
              }
              if (invalid) {
                setAuthError(socialUrlError(invalid.platform, invalid.value) ?? "Check the social profile URL.");
                return;
              }
              resetAuthError();
              setStep("verifying");
            }}
            />
          </View>
        </AuthContent>
      </AuthShell>
    );

  // ==========================================
  // STEP 9: LINK VERIFICATION
  // ==========================================
  if (step === "verifying")
    return (
      <AuthShell>
        <View style={styles.stepperHeader}>
          <AuthBackButton
            label="Back"
            onPress={() => setStep("social")}
          />
          <AuthProgress current={7} total={8} />
        </View>
        <AuthContent>
          <AuthStepPill label="VERIFYING LINKS" icon="checkmark-circle-outline" />
          <View style={styles.authFormIntro}>
            <AuthTitle primary="We&apos;re verifying your" secondary=" social accounts" />
            <AuthText style={styles.authBody}>
              {isSubmitting ? "Checking public profiles and loading live audience data…" : authError ? "Fix the profile URL and retry the verification check." : "Checks start automatically and update each profile status below."}
            </AuthText>
          </View>

          <View style={{ gap: 8, marginVertical: 8 }}>
            {SOCIAL_PLATFORM_REGISTRY.map((config) => (
              (() => {
                const account = pendingAuthenticatedUser?.socialAccounts.find((item) => item.platform === config.key);
                return <View key={config.key} style={styles.verifyingStatusRow}>
                  <View style={styles.verifyingStatusLeft}>
                    <AppIcon name={config.icon} size={22} color={config.color} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.verifyingStatusName}>{config.label}</Text>
                      {socialAccounts[config.key] ? <Text numberOfLines={1} ellipsizeMode="middle" style={styles.verifyingStatusUrl}>{socialAccounts[config.key]}</Text> : null}
                    </View>
                  </View>
                  <SocialStatusBadge
                    value={socialAccounts[config.key] ?? ""}
                    verified={account?.verificationStatus === "VERIFIED"}
                    pending={account?.syncStatus === "QUEUED" || account?.syncStatus === "RUNNING" || account?.verificationStatus === "PENDING"}
                    failed={account?.syncStatus === "FAILED"}
                    checking={isSubmitting || account?.syncStatus === "QUEUED" || account?.syncStatus === "RUNNING"}
                  />
                </View>;
              })()
            ))}
          </View>

          {verificationReviewRequired || verificationNeedsTeamReview ? (
            <View accessibilityRole="alert" style={styles.verificationReviewNotice}>
              <AppIcon name="information-circle-outline" size={18} color={theme.colors.danger} />
              <Text style={styles.verificationReviewNoticeText}>
                Verification for {verificationReviewLabel} is pending. Our team will review these profiles within 24 hours and notify you as soon as the review is complete.
              </Text>
            </View>
          ) : authError ? <AuthText style={styles.authBody}>{authError}</AuthText> : null}
          <View style={styles.authBottomAction}>
            <AppButton
              label={isSubmitting ? "Checking profiles…" : verificationReviewRequired ? "Continue to review" : authError ? "Retry verification" : "Continue"}
              icon={isSubmitting ? "sync-outline" : verificationReviewRequired ? "arrow-forward" : authError ? "refresh-outline" : "arrow-forward"}
              iconAfter={!isSubmitting}
              loading={isSubmitting}
              disabled={isSubmitting}
              onPress={verificationReviewRequired ? () => setStep("review") : verifySocialAccountsAutomatically}
            />
          </View>
        </AuthContent>
      </AuthShell>
    );

  // ==========================================
  // STEP 10: FINAL REVIEW
  // ==========================================
  if (step === "review")
    return (
      <AuthShell>
        <View style={styles.stepperHeader}>
          <AuthBackButton
            label="Back"
            onPress={() => setStep("verifying")}
          />
          <AuthProgress current={8} total={8} />
        </View>
        <AuthContent>
          <AuthStepPill label="FINAL REVIEW" icon="checkmark-done-outline" />
          <View style={styles.authFormIntro}>
          <AuthTitle primary="Review your" secondary={<>{" "}profile{`\n`}details</>} />
            <AuthText style={styles.authBody}>Check every detail before you create your Brandly profile.</AuthText>
          </View>

          <ReviewDetailsCard
            role={role === "Brand" ? "Brand" : "Influencer"}
            name={role === "Brand" ? brandName : displayName}
            email={email}
            phone={phone}
            bio={role === "Brand" ? brandBio : bio}
            focus={role === "Brand" ? industry : niche}
            focusLabel={role === "Brand" ? "Industry" : "Niche"}
            location={location}
            audienceLocations={audienceLocations}
            audienceSize={audienceSize}
            teamSize={teamSize}
            rate={role === "Brand" ? brandBudget : rate}
            rateLabel={role === "Brand" ? "Budget" : "Rate"}
            profileImageUri={profileImageUri}
            socialAccounts={socialAccounts}
            website={website}
            verifiedSocialAccounts={pendingAuthenticatedUser?.socialAccounts
              .filter((account) => account.verificationStatus === "VERIFIED")
              .map((account) => account.platform as SocialPlatform) ?? []}
          />

          <View style={styles.authBottomAction}>
            <AppButton label="Create account" icon="arrow-forward" iconAfter loading={isSubmitting} onPress={() => void completeAccountCreation()} />
          </View>
        </AuthContent>
      </AuthShell>
    );

  // ==========================================
  // SIGN IN FLOW
  // ==========================================
  if (step === "signin-otp")
    return (
      <AuthShell>
        <AuthContent>
          <AuthBackButton
            label="Back"
            onPress={() => {
              resetAuthError();
              setStep("signin");
            }}
          />
          <View style={[styles.authFormIntro, styles.authOtpIntro]}>
          <View style={[styles.authOtpIcon, signinMethod === "phone" && styles.authOtpIconWhatsApp]}>
            <AppIcon
              name={signinMethod === "email" ? "mail-outline" : "logo-whatsapp"}
              size={30}
              color={signinMethod === "email" ? theme.colors.primary : theme.colors.success}
            />
          </View>
          <AuthTitle primary="Enter" secondary=" the code" style={styles.authOtpTitle} />
          <AuthText style={[styles.authBody, styles.authOtpBody]}>
            {signinMethod === "email"
              ? <>We&apos;ve sent a 6-digit code to{`\n`}{signinEmail}.</>
              : <>We&apos;ve sent a 6-digit code to{`\n`}+91 {signinIdentifier} on WhatsApp.</>}
          </AuthText>
          <Pressable accessibilityRole="button" onPress={() => { resetAuthError(); setOtpCode(""); setStep("signin"); }}>
            <Text style={styles.resendText}>{signinMethod === "email" ? "Change email" : "Change phone number"}</Text>
          </Pressable>
          </View>
          <OtpBoxes value={otpCode} onChange={setOtpCode} accessibilityLabel="Sign in verification code" channel={signinMethod === "email" ? "email" : "sms"} error={Boolean(authError)} />
        <View style={styles.resendRow}>
          <Text style={styles.authHint}>Didn&apos;t receive the code?</Text>
          <Pressable disabled={resendSeconds > 0 || isResendingOtp || isSubmitting} onPress={() => void resendOtp()} accessibilityRole="button" accessibilityState={{ disabled: resendSeconds > 0 || isResendingOtp || isSubmitting, busy: isResendingOtp }}>
            {isResendingOtp ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <Text style={[styles.resendText, resendSeconds > 0 && styles.resendTextDisabled]}>
              {resendSeconds > 0 ? `Resend in 00:${String(resendSeconds).padStart(2, "0")}` : "Resend code"}
            </Text>}
          </Pressable>
        </View>
          <View style={styles.authBottomAction}>
            {authNotice ? <Text style={styles.authNotice}>{authNotice}</Text> : null}
            {authError ? <Text style={styles.authError}>{authError}</Text> : null}
            <AppButton label="Verify & sign in" icon="arrow-forward" iconAfter loading={isSubmitting} onPress={() => void verifySignin()} />
          </View>
        </AuthContent>
      </AuthShell>
    );

  // Sign in form
  return (
    <AuthShell>
      <AuthContent>
        <AuthBackButton
          label="Back"
          onPress={() => {
            resetAuthError();
            setStep("welcome");
          }}
        />
        <View style={styles.authFormIntro}>
          <Pill label="WELCOME BACK" accent />
          <AuthTitle primary="Welcome" secondary=" back" />
          <AuthText style={styles.authBody}>Sign in to manage your partnerships.</AuthText>
        </View>
        <View style={{ gap: theme.spacing.sm }}>
        <View style={styles.methodTabs} accessibilityRole="tablist">
          {(["phone", "email"] as const).map((method) => (
            <Pressable
              key={method}
              accessibilityRole="tab"
              accessibilityState={{ selected: signinMethod === method }}
              onPress={() => { resetAuthError(); setSigninMethod(method); }}
              style={[styles.methodTab, signinMethod === method && styles.methodTabActive]}
            >
              <AppIcon name={method === "email" ? "mail-outline" : "logo-whatsapp"} size={17} color={signinMethod === method ? theme.colors.primary : theme.colors.textSecondary} />
              <Text style={[styles.methodText, signinMethod === method && styles.methodTextActive]}>{method === "email" ? "Email" : "WhatsApp"}</Text>
            </Pressable>
          ))}
        </View>
        {signinMethod === "phone" ? (
          <>
            <Text style={styles.onboardingFieldLabel}>Phone number</Text>
            <IndiaPhoneField
              value={signinIdentifier}
              error={Boolean(authError) && !validPhone(signinIdentifier)}
              success={validPhone(signinIdentifier)}
              onChange={(value) => {
                setSigninIdentifier(value);
                resetAuthError();
              }}
            />
          </>
        ) : (
          <>
            <Text style={styles.onboardingFieldLabel}>Email address</Text>
            <AuthInput
              icon="mail-outline"
              accessibilityLabel="Email address for sign in"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              value={signinEmail}
              onChangeText={(value) => {
                setSigninEmail(value);
                resetAuthError();
              }}
              placeholder="Email address"
              placeholderTextColor={theme.colors.inputPlaceholder}
              error={Boolean(authError) && !validEmail(signinEmail)}
              success={validEmail(signinEmail)}
            />
          </>
        )}
        <Text style={styles.authHint}>
          We will send a one-time verification code. No password is required.
        </Text>
        </View>
        <View style={styles.authBottomAction}>
        {authError ? <Text style={styles.authError}>{authError}</Text> : null}
        <AppButton
          label="Send verification code"
          icon="arrow-forward"
          iconAfter
          loading={isSubmitting}
          onPress={submitSignin}
          disabled={isSubmitting || (signinMethod === "phone" ? !validPhone(signinIdentifier) : !validEmail(signinEmail))}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            resetAuthError();
            setStep("account-type");
          }}
        >
          <Text style={styles.authSwitch}>New here? Create an account</Text>
        </Pressable>
        </View>
      </AuthContent>
    </AuthShell>
  );
}

export type OnboardingProfile = {
  locations: string[];
  languages: string[];
  focus: string[];
  profile: ProfileDraft;
  socialAccounts: SocialAccountMap;
  verifiedSocialAccounts: SocialPlatform[];
};

export function OnboardingScreen({
  role,
  initialProfile,
  initialSignupProfile,
  initialStep = 0,
  email,
  phone,
  initialSocialAccounts,
  verifiedSocialAccounts,
  pendingSocialAccounts,
  socialAccountErrors,
  onSocialAccountsSave,
  onProgressSave,
  onComplete,
}: {
  role: "Brand" | "Influencer";
  initialProfile: ProfileDraft;
  initialSignupProfile?: SignupProfileDraft;
  initialStep?: 0 | 1 | 2 | 3 | 4;
  email?: string;
  phone?: string;
  initialSocialAccounts: SocialAccountMap;
  verifiedSocialAccounts: SocialPlatform[];
  pendingSocialAccounts: SocialPlatform[];
  socialAccountErrors: Partial<Record<SocialPlatform, string>>;
  onSocialAccountsSave: (accounts: SocialAccountMap, verifiedPlatforms: SocialPlatform[]) => Promise<void> | void;
  onProgressSave?: (progress: OnboardingProgress) => Promise<void> | void;
  onComplete: (profile: OnboardingProfile) => Promise<void> | void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { setStep: persistSignupStep, setProfile: persistSignupProfile } = useAuthDraft();
  const signup = initialSignupProfile;
  const [step, setLocalStep] = useState<0 | 1 | 2 | 3 | 4>(initialStep);

  useEffect(() => {
    setLocalStep(initialStep);
  }, [initialStep]);

  const goToStep = (nextStep: number) => {
    const safeStep = Math.max(0, Math.min(4, nextStep)) as 0 | 1 | 2 | 3 | 4;
    persistOnboardingProfile();
    persistSignupStep(([
      "profile",
      "details",
      "social",
      "verifying",
      "review",
    ] as const)[safeStep]);
    void Promise.resolve(onProgressSave?.(getProgress(([
      "profile",
      "details",
      "social",
      "verifying",
      "review",
    ] as const)[safeStep]))).catch(() => undefined);
    setLocalStep(safeStep);
  };

  const [displayName, setDisplayName] = useState((role === "Brand" ? signup?.brandName : signup?.displayName) || initialProfile.name || "");
  const [profileBio, setProfileBio] = useState((role === "Brand" ? signup?.brandBio : signup?.bio) || initialProfile.bio || "");
  const [profileImageUri, setProfileImageUri] = useState<string | null | undefined>(signup?.profileImageUri ?? initialProfile.avatarUri);
  const [websiteUrl, setWebsiteUrl] = useState(signup?.website || initialProfile.websiteUrl || "");
  const [location, setLocation] = useState(signup?.location || initialProfile.city || initialProfile.locations?.[0] || "");
  const [audienceLocations, setAudienceLocations] = useState(signup?.audienceLocations ?? initialProfile.locations ?? []);
  const [focus, setFocus] = useState((role === "Brand" ? signup?.industry : signup?.niche) || initialProfile.focus || "");
  const [audienceSize, setAudienceSize] = useState(signup?.audienceSize || initialProfile.audienceSize || "");
  const [rateRange, setRateRange] = useState((role === "Brand" ? signup?.brandBudget : signup?.rate) || initialProfile.rateRange || "");
  const [teamSize, setTeamSize] = useState(signup?.teamSize || initialProfile.teamSize || "");
  const [languages, setLanguages] = useState<string[]>(signup?.languages ?? initialProfile.languages ?? ["English"]);
  const [verificationPending, setVerificationPending] = useState(pendingSocialAccounts);
  const [verificationErrors, setVerificationErrors] = useState(socialAccountErrors);
  const [isVerifyingSocial, setIsVerifyingSocial] = useState(false);
  const verificationStarted = useRef(false);

  useEffect(() => {
    setVerificationPending(pendingSocialAccounts);
    setVerificationErrors(socialAccountErrors);
  }, [pendingSocialAccounts, socialAccountErrors]);

  // Social account inputs
  const [instagramUrl, setInstagramUrl] = useState(signup?.instagramUrl || initialSocialAccounts.Instagram || "");
  const [youtubeUrl, setYoutubeUrl] = useState(signup?.youtubeUrl || initialSocialAccounts.YouTube || "");
  const [twitterUrl, setTwitterUrl] = useState(signup?.twitterUrl || initialSocialAccounts.X || "");
  const [linkedinUrl, setLinkedinUrl] = useState(signup?.linkedinUrl || initialSocialAccounts.LinkedIn || "");
  const [otherUrl, setOtherUrl] = useState(signup?.otherUrl || "");
  const [socialAccounts, setSocialAccounts] = useState<SocialAccountMap>(() => ({
    ...(initialSocialAccounts ?? {}),
    ...(signup?.socialAccounts ?? {}),
    Instagram: signup?.socialAccounts?.Instagram ?? signup?.instagramUrl ?? initialSocialAccounts.Instagram ?? "",
    YouTube: signup?.socialAccounts?.YouTube ?? signup?.youtubeUrl ?? initialSocialAccounts.YouTube ?? "",
    X: signup?.socialAccounts?.X ?? signup?.twitterUrl ?? initialSocialAccounts.X ?? "",
    LinkedIn: signup?.socialAccounts?.LinkedIn ?? signup?.linkedinUrl ?? initialSocialAccounts.LinkedIn ?? "",
  }));

  useEffect(() => {
    setSocialAccounts((current) => {
      const next = { ...current };
      Object.entries(initialSocialAccounts).forEach(([platform, value]) => {
        if (value?.trim() && !next[platform as SocialPlatform]?.trim()) next[platform as SocialPlatform] = value;
      });
      return next;
    });
  }, [initialSocialAccounts]);

  const persistOnboardingProfile = () => {
    persistSignupProfile({
      ...(role === "Brand"
        ? { brandName: displayName, industry: focus, brandBio: profileBio, brandBudget: rateRange }
        : { displayName, niche: focus, bio: profileBio, rate: rateRange }),
      website: websiteUrl,
      location,
      audienceLocations,
      audienceSize,
      teamSize,
      languages,
      profileImageUri: profileImageUri ?? null,
      instagramUrl,
      youtubeUrl,
      twitterUrl,
      linkedinUrl,
      otherUrl,
      socialAccounts,
    });
  };

  const updateProfileDraft = <K extends keyof SignupProfileDraft>(key: K, value: SignupProfileDraft[K]) => {
    persistSignupProfile({ [key]: value } as Partial<SignupProfileDraft>);
    setError("");
  };
  const updateSocialAccount = (platform: SocialPlatform, value: string) => {
    const next = { ...socialAccounts, [platform]: value };
    setSocialAccounts(next);
    updateProfileDraft("socialAccounts", next);
  };

  const [error, setError] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);
  const getProgress = (onboardingStep: OnboardingProgress["onboardingStep"]): OnboardingProgress => {
    const savedLocations = role === "Brand" ? (location.trim() ? [location.trim()] : []) : audienceLocations;
    const savedLanguages = languages.length ? languages : ["English"];
    return {
      onboardingStep,
      profile: {
        ...initialProfile,
        name: displayName.trim(),
        city: location.trim(),
        focus: focus.trim(),
        bio: profileBio.trim(),
        audienceSize: audienceSize.trim() || undefined,
        rateRange: rateRange.trim() || undefined,
        teamSize: teamSize.trim() || undefined,
        avatarUri: profileImageUri ?? undefined,
        websiteUrl: websiteUrl.trim() || undefined,
        languages: savedLanguages,
        locations: savedLocations,
      },
      locations: savedLocations,
      languages: savedLanguages,
      socialAccounts,
    };
  };
  const hasSocialReviewPending = !isVerifyingSocial && SOCIAL_PLATFORM_REGISTRY.some((config) => {
    const value = socialAccounts[config.key]?.trim();
    return Boolean(value) && !verifiedSocialAccounts.includes(config.key);
  });
  const socialReviewPlatformNames = SOCIAL_PLATFORM_REGISTRY
    .filter((config) => Boolean(socialAccounts[config.key]?.trim()) && !verifiedSocialAccounts.includes(config.key))
    .map((config) => config.label)
    .join(", ");
  const socialReviewLabel = socialReviewPlatformNames || "Your social account";

  useEffect(() => {
    if (step !== 3) {
      verificationStarted.current = false;
      return;
    }
    if (verificationStarted.current) return;
    const socialMap = Object.fromEntries(
      Object.entries(socialAccounts)
        .map(([platform, value]) => [platform, value.trim()] as const)
        .filter(([, value]) => Boolean(value)),
    ) as SocialAccountMap;
    if (!Object.keys(socialMap).length) return;
    verificationStarted.current = true;
    setIsVerifyingSocial(true);
    void Promise.resolve(onSocialAccountsSave(socialMap, verifiedSocialAccounts.filter((platform) => Boolean(socialMap[platform]))))
      .catch((err) => setError(err instanceof Error ? err.message : "Social profile checks could not start."))
      .finally(() => setIsVerifyingSocial(false));
  }, [onSocialAccountsSave, socialAccounts, step, verifiedSocialAccounts]);

  const continueOnboarding = async () => {
    if (isCompleting) return;
    setError("");
    persistOnboardingProfile();

    if (step === 0 && (!displayName.trim() || !profileBio.trim() || !focus.trim())) {
      setError(role === "Brand" ? "Complete your brand name, description, and industry." : "Complete your name, bio, and niche.");
      return;
    }
    if (step === 1 && !location.trim()) {
      setError("Add your location to continue.");
      return;
    }
    if (step === 2) {
      const candidateLinks: [SocialPlatform | "Website", string][] = [
        ...SOCIAL_PLATFORM_REGISTRY.map(({ key }) => [key, socialAccounts[key] ?? ""] as [SocialPlatform, string]),
        ...(role === "Brand" ? [["Website", websiteUrl] as ["Website", string]] : []),
      ];
      const enteredLinks = candidateLinks.filter(([, value]) => value.trim());
      const invalidLink = enteredLinks.find(([platform, value]) => socialUrlError(platform, value));
      if (!enteredLinks.length) {
        setError("Add at least one social profile URL to continue.");
        return;
      }
      if (invalidLink) {
        setError(socialUrlError(invalidLink[0], invalidLink[1]) ?? "Check your social profile URLs.");
        return;
      }
    }

    if (step === 3) {
      setIsCompleting(true);
      try {
        const socialMap = Object.fromEntries(
          Object.entries(socialAccounts)
            .map(([platform, value]) => [platform, value.trim()] as const)
            .filter(([, value]) => Boolean(value)),
        ) as SocialAccountMap;
        const verifiedPlatforms = verifiedSocialAccounts.filter((platform) => Boolean(socialMap[platform]));
        await onSocialAccountsSave(socialMap, verifiedPlatforms);
        setIsCompleting(false);
        goToStep(4);
      } catch (err) {
        setIsCompleting(false);
        setError(err instanceof Error ? err.message : "Social profile checks could not start.");
      }
      return;
    }

    if (step === 4) {
      setIsCompleting(true);
      try {
        if (!displayName.trim() || !profileBio.trim() || !focus.trim() || !location.trim()) {
          throw new Error(role === "Brand" ? "Complete your brand name, description, industry, and location." : "Complete your name, bio, niche, and location.");
        }
        const socialMap = Object.fromEntries(
          Object.entries(socialAccounts)
            .map(([platform, value]) => [platform, value.trim()] as const)
            .filter(([, value]) => Boolean(value)),
        ) as SocialAccountMap;

        const socialEntries = Object.entries(socialMap).filter((entry): entry is [string, string] => Boolean(entry[1]));
        const invalidSocial = socialEntries.find(([platform, value]) => {
          const supported = platform as SocialPlatform;
          return socialUrlError(supported, value);
        });
        if (!socialEntries.length) throw new Error("Add at least one social profile URL.");
        if (invalidSocial) throw new Error(socialUrlError(invalidSocial[0] as SocialPlatform, invalidSocial[1]) ?? "Check your social profile URLs.");
        const verifiedPlatforms = verifiedSocialAccounts.filter((platform) => Boolean(socialMap[platform]));

        await onSocialAccountsSave(socialMap, verifiedPlatforms);

        const savedLocations = role === "Brand" ? [location.trim()] : audienceLocations;
        await onComplete({
          locations: savedLocations,
          languages: languages.length ? languages : ["English"],
          focus: [focus.trim() || "Travel, Lifestyle"],
          profile: {
            ...initialProfile,
            name: displayName.trim(),
            city: location.trim(),
            focus: focus.trim(),
            bio: profileBio.trim(),
            audienceSize: audienceSize.trim() || undefined,
            rateRange: rateRange.trim() || undefined,
            teamSize: teamSize.trim() || undefined,
            avatarUri: profileImageUri ?? undefined,
            websiteUrl: websiteUrl.trim() || undefined,
            languages: languages.length ? languages : ["English"],
            locations: savedLocations,
          },
          socialAccounts: socialMap,
          verifiedSocialAccounts: verifiedPlatforms,
        });
      } catch (err) {
        setIsCompleting(false);
        setError(err instanceof Error ? err.message : "Could not complete onboarding.");
      }
      return;
    }

    goToStep(step + 1);
  };

  return (
    <SafeAreaView style={styles.authShell} edges={["top", "bottom"]}>
      <View pointerEvents="none" style={styles.authBackdrop}>
        <View style={styles.authOrbPrimary} />
        <View style={styles.authOrbSecondary} />
        <View style={styles.authOrbTertiary} />
        <View style={styles.authOrbQuaternary} />
      </View>
      <KeyboardAvoidingView
        style={styles.authKeyboard}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.authScroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Stepper Header */}
          <View style={styles.stepperHeader}>
            {step > 0 ? (
              <AuthBackButton
                label="Back"
                onPress={() => {
                  setError("");
                  goToStep(step - 1);
                }}
              />
            ) : <View accessibilityLabel="Onboarding start" style={styles.authBackButtonPlaceholder} />}
            <AuthProgress current={step + 4} total={8} />
          </View>

          <AuthContent>
          {/* STEP 0 (Overall Step 6: Profile) */}
          {step === 0 ? (
            <>
              <AuthStepPill
                label={role === "Brand" ? "BRAND PROFILE" : "CREATOR PROFILE"}
                icon={role === "Brand" ? "business-outline" : "person-circle-outline"}
              />
              <View style={[styles.authFormIntro, styles.authFormIntroStart]}>
                  <AuthTitle
                  primary={<>Create your professional{`\n`}</>}
                  secondary={role === "Brand" ? "brand profile today" : "creator profile today"}
                  style={styles.authTitleStart}
                />
                <AuthText style={[styles.authBody, styles.authBodyStart]}>
                  {role === "Brand"
                    ? "Set up your brand identity so creators can understand your partnership profile."
                    : "Set up your profile so brands can quickly understand your work and fit."}
                </AuthText>
              </View>

              {/* Photo Upload Row */}
              <ProfilePhotoPicker
                compact
                initials={getProfileInitials(displayName)}
                uri={profileImageUri ?? undefined}
                onChange={(value) => { setProfileImageUri(value); updateProfileDraft("profileImageUri", value ?? null); }}
                title={role === "Brand" ? "Add brand logo" : "Add profile photo"}
                hint="PNG or JPG up to 5MB"
              />

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.onboardingFieldLabel}>
                  {role === "Brand" ? "Brand name *" : "Display name *"}
                </Text>
                <AuthInput
                  icon={role === "Brand" ? "business-outline" : "person-outline"}
                  value={displayName}
                  onChangeText={(value) => { setDisplayName(value); updateProfileDraft(role === "Brand" ? "brandName" : "displayName", value); }}
                  placeholder={role === "Brand" ? "Enter brand name" : "Enter your name"}
                  error={Boolean(error) && !displayName.trim()}
                />

                <Text style={styles.onboardingFieldLabel}>
                  {role === "Brand" ? "Industry" : "Bio"}
                </Text>
                {role === "Brand" ? (
                  <DropdownPickerField
                    label="Industry"
                    value={focus}
                    placeholder="Select industry"
                    icon="pricetag-outline"
                    options={INDUSTRY_OPTIONS}
                    onSelect={(value) => { setFocus(value); updateProfileDraft("industry", value); }}
                    error={Boolean(error) && !focus.trim()}
                  />
                ) : (
                  <AuthInput
                    icon="document-text-outline"
                    value={profileBio}
                    onChangeText={(value) => { setProfileBio(value); updateProfileDraft("bio", value); }}
                    placeholder="Travel & tech content creator"
                    multiline
                    maxLength={280}
                    numberOfLines={4}
                    style={styles.onboardingProfileBio}
                    error={Boolean(error) && !profileBio.trim()}
                  />
                )}

                <Text style={styles.onboardingFieldLabel}>
                  {role === "Brand" ? "Team size (optional)" : "Niche / Category"}
                </Text>
                {role === "Brand" ? (
                  <DropdownPickerField
                    label="Team size"
                    value={teamSize}
                    placeholder="Select team size"
                    icon="people-outline"
                    options={TEAM_SIZE_OPTIONS}
                    onSelect={(value) => { setTeamSize(value); updateProfileDraft("teamSize", value); }}
                  />
                ) : (
                  <DropdownPickerField
                    label="Niche / Category"
                    value={focus}
                    placeholder="Select category"
                    icon="pricetag-outline"
                    options={CREATOR_CATEGORIES}
                    onSelect={(value) => { setFocus(value); updateProfileDraft("niche", value); }}
                    error={Boolean(error) && !focus.trim()}
                  />
                )}

                <Text style={styles.onboardingFieldLabel}>Languages you speak</Text>
                <LocationPickerField
                  selected={languages}
                  locations={[...NATIVE_LANGUAGE_OPTIONS]}
                  onApply={(value) => { setLanguages(value); updateProfileDraft("languages", value); }}
                  title="Choose languages"
                  subtitle="Select every language you can speak with brands and creators"
                  searchAccessibilityLabel="Search Indian languages"
                  searchPlaceholder="Search languages"
                  emptyLabel="No languages found"
                  placeholder="Select one or more languages"
                  icon="globe-outline"
                  optionIcon="globe-outline"
                />

                {role === "Brand" ? (
                  <>
                    <Text style={styles.onboardingFieldLabel}>Website (optional)</Text>
                    <AuthInput
                      icon="link-outline"
                      value={websiteUrl}
                      onChangeText={(value) => { setWebsiteUrl(value); updateProfileDraft("website", value); }}
                      placeholder="https://"
                      autoCapitalize="none"
                    />
                  </>
                ) : null}
              </View>
            </>
          ) : null}

          {/* STEP 1 (Overall Step 7: Details) */}
          {step === 1 ? (
            <>
              <AuthStepPill
                label={role === "Brand" ? "BRAND DETAILS" : "ADDITIONAL DETAILS"}
                icon={role === "Brand" ? "business-outline" : "options-outline"}
              />
              <View style={[styles.authFormIntro, styles.authFormIntroStart]}>
                <AuthTitle primary={<>Complete your profile{`\n`}</>} secondary="details with purpose" style={styles.authTitleStart} />
                <AuthText style={[styles.authBody, styles.authBodyStart]}>
                  {role === "Brand"
                    ? "Add the details creators need to understand your location and campaign needs."
                    : "Add your location, audience and rate so brands can find the right fit."}
                </AuthText>
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Text style={styles.onboardingFieldLabel}>Your location</Text>
                <IndiaLocationField
                  value={location}
                  onChange={(value) => { setLocation(value); updateProfileDraft("location", value); }}
                  error={Boolean(error) && !location.trim()}
                />

                {role === "Influencer" ? (
                  <>
                    <Text style={styles.onboardingFieldLabel}>Audience locations (optional)</Text>
                    <LocationPickerField
                      selected={audienceLocations}
                      locations={INDIA_LOCATION_OPTIONS}
                      onApply={(value) => { setAudienceLocations(value); updateProfileDraft("audienceLocations", value); }}
                      title="Choose audience locations"
                      subtitle="Select one or more cities or states where your audience is based"
                      searchAccessibilityLabel="Search audience locations"
                      placeholder="Select one or more locations"
                    />
                  </>
                ) : null}

                {role === "Brand" ? (
                  <>
                    <Text style={styles.onboardingFieldLabel}>About the brand</Text>
                    <AuthInput
                      icon="document-text-outline"
                      value={profileBio}
                      onChangeText={(value) => { setProfileBio(value); updateProfileDraft("brandBio", value); }}
                      placeholder="Tell creators about your brand..."
                      multiline
                      maxLength={280}
                      style={styles.onboardingProfileBio}
                      error={Boolean(error) && !profileBio.trim()}
                    />
                    <Text style={styles.onboardingFieldLabel}>Typical campaign budget (optional)</Text>
                    <DropdownPickerField
                      label="Typical campaign budget"
                      value={rateRange}
                      placeholder="Select campaign budget"
                      icon="cash-outline"
                      options={CAMPAIGN_BUDGET_OPTIONS}
                      onSelect={(value) => { setRateRange(value); updateProfileDraft("brandBudget", value); }}
                    />
                  </>
                ) : (
                  <>
                    <Text style={styles.onboardingFieldLabel}>Audience size (optional)</Text>
                    <DropdownPickerField
                      label="Audience size"
                      value={audienceSize}
                      placeholder="Select audience size"
                      icon="people-outline"
                      options={AUDIENCE_SIZE_OPTIONS}
                      onSelect={(value) => { setAudienceSize(value); updateProfileDraft("audienceSize", value); }}
                    />
                    <Text style={styles.onboardingFieldLabel}>Your rate (optional)</Text>
                    <DropdownPickerField
                      label="Your rate"
                      value={rateRange}
                      placeholder="Select your rate"
                      icon="cash-outline"
                      options={CREATOR_RATE_OPTIONS}
                      onSelect={(value) => { setRateRange(value); updateProfileDraft("rate", value); }}
                    />
                  </>
                )}
              </View>
            </>
          ) : null}

          {/* STEP 2 (Overall Step 8: Social Accounts) */}
          {step === 2 ? (
            <>
              <AuthStepPill label="SOCIAL ACCOUNTS" icon="link-outline" />
              <View style={[styles.authFormIntro, styles.authFormIntroStart]}>
                <AuthTitle
                  primary={<>Build your social{`\n`}</>}
                  secondary="presence with purpose"
                  style={styles.authTitleStart}
                />
                <AuthText style={[styles.authBody, styles.authBodyStart]}>
                  {role === "Brand"
                    ? "Add your brand channels so creators can find and recognize you."
                    : "Add your social links so brands can discover your work and audience."}
                </AuthText>
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                {SOCIAL_PLATFORM_REGISTRY.map((config) => {
                  const value = socialAccounts[config.key] ?? "";
                  const invalid = value.trim() ? socialUrlError(config.key, value) : null;
                  return (
                    <View key={config.key} style={[styles.socialInputRow, Boolean(error && invalid) && styles.socialInputRowError]}>
                      <View style={[styles.socialInputIconBox, { backgroundColor: config.surface }]}>
                        <AppIcon name={config.icon} size={20} color={config.color} />
                      </View>
                      <TextInput
                        style={styles.socialInputField}
                        value={value}
                        onChangeText={(nextValue) => updateSocialAccount(config.key, nextValue)}
                        placeholder={config.placeholder}
                        autoCapitalize="none"
                        autoCorrect={false}
                        placeholderTextColor={theme.colors.inputPlaceholder}
                      />
                    </View>
                  );
                })}

                {role === "Brand" ? (
                  <View style={styles.socialInputRow}>
                    <View style={[styles.socialInputIconBox, { backgroundColor: "#EEF2FF" }]}>
                      <AppIcon name="globe-outline" size={20} color="#4F46E5" />
                    </View>
                    <TextInput
                      style={styles.socialInputField}
                      value={websiteUrl}
                      onChangeText={(value) => { setWebsiteUrl(value); updateProfileDraft("website", value); }}
                      placeholder="https://your-brand.com"
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholderTextColor={theme.colors.inputPlaceholder}
                    />
                  </View>
                ) : null}

                <Text style={[styles.authHint, { marginTop: 6 }]}>
                  We&apos;ll verify your links and fetch real data directly from the platform.
                </Text>
              </View>
            </>
          ) : null}

          {/* STEP 3 (Overall Step 9: Link Verification) */}
          {step === 3 ? (
            <>
              <AuthStepPill label="VERIFYING LINKS" icon="checkmark-circle-outline" />
              <View style={[styles.authFormIntro, styles.authFormIntroStart]}>
                <AuthTitle primary={<>Verify your social{`\n`}</>} secondary="accounts with confidence" style={styles.authTitleStart} />
                <AuthText style={[styles.authBody, styles.authBodyStart]}>
                  {isVerifyingSocial ? "Checking public profiles and loading live audience data…" : error ? "Fix the profile URL and retry the verification check." : Object.keys(verificationErrors).length ? "Automatic checks need review. Our team will complete verification within 24 hours." : "Checks start automatically and update each profile status below."}
                </AuthText>
              </View>

              <View style={{ gap: 8, marginVertical: 8 }}>
                {SOCIAL_PLATFORM_REGISTRY.map((config) => (
                  <View key={config.key} style={styles.verifyingStatusRow}>
                  <View style={styles.verifyingStatusLeft}>
                    <AppIcon name={config.icon} size={22} color={config.color} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.verifyingStatusName}>{config.label}</Text>
                      {socialAccounts[config.key] ? <Text numberOfLines={1} ellipsizeMode="middle" style={styles.verifyingStatusUrl}>{socialAccounts[config.key]}</Text> : null}
                    </View>
                    </View>
                    <SocialStatusBadge
                      value={socialAccounts[config.key] ?? ""}
                      verified={verifiedSocialAccounts.includes(config.key)}
                      pending={verificationPending.includes(config.key)}
                      failed={Boolean(verificationErrors[config.key])}
                      checking={isVerifyingSocial || verificationPending.includes(config.key)}
                    />
                  </View>
                ))}
              </View>
              {!isVerifyingSocial && (Object.keys(verificationErrors).length || hasSocialReviewPending) ? (
                <View accessibilityRole="alert" style={styles.verificationReviewNotice}>
                  <AppIcon name="information-circle-outline" size={18} color={theme.colors.danger} />
                  <Text style={styles.verificationReviewNoticeText}>
                    Verification for {socialReviewLabel} is pending. Our team will review these profiles within 24 hours and notify you as soon as the review is complete.
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}

          {/* STEP 4 (Overall Step 10: Final Review) */}
          {step === 4 ? (
            <>
              <AuthStepPill label="FINAL REVIEW" icon="checkmark-done-outline" />
              <View style={[styles.authFormIntro, styles.authFormIntroStart]}>
                <AuthTitle primary={<>Review your profile{`\n`}</>} secondary="details before launch" style={styles.authTitleStart} />
                <AuthText style={[styles.authBody, styles.authBodyStart]}>Check every detail before you create your Brandly profile.</AuthText>
              </View>

              <ReviewDetailsCard
                role={role}
                name={displayName}
                email={email}
                phone={phone}
                bio={profileBio}
                focus={focus}
                focusLabel={role === "Brand" ? "Industry" : "Niche"}
                location={location}
                audienceLocations={audienceLocations}
                audienceSize={audienceSize}
                teamSize={teamSize}
                rate={rateRange}
                rateLabel={role === "Brand" ? "Budget" : "Rate"}
                profileImageUri={profileImageUri}
                socialAccounts={socialAccounts}
                website={websiteUrl}
                languages={languages}
                verifiedSocialAccounts={verifiedSocialAccounts}
              />
            </>
          ) : null}

          {error ? <Text style={styles.onboardingError}>{error}</Text> : null}

          <View style={styles.authBottomAction}>
            <AppButton
              label={
                step === 3
                  ? isCompleting || isVerifyingSocial
                    ? "Saving links…"
                    : "Continue"
                  : isCompleting
                    ? "Creating account…"
                    : step === 4
                      ? "Create account"
                      : "Continue"
               }
               icon={isCompleting || isVerifyingSocial ? "sync-outline" : "arrow-forward"}
               iconAfter={!isCompleting && !isVerifyingSocial}
               loading={isCompleting || isVerifyingSocial}
              onPress={continueOnboarding}
              disabled={isCompleting}
            />
          </View>
          </AuthContent>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
