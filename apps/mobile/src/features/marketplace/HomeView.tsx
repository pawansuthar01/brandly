import { ScrollView, Text, View } from "react-native";
import { AppButton, AppCard, AppIcon, Pill, SectionTitle } from "../../components/ui";
import { useDemoMarketplace } from "../../hooks/useDemoMarketplace";
import { useTheme } from "../../providers/ThemeProvider";
import type { Influencer } from "../../types/marketplace";
import { CampaignCard, InfluencerCard, MarketplaceSkeleton } from "./MarketplaceCards";
import { makeStyles } from "./marketplaceStyles";

export function HomeView({
  role,
  onDiscover,
  onInfluencer,
}: {
  role: "Brand" | "Influencer";
  onDiscover: () => void;
  onInfluencer: (item: Influencer) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { influencers, campaigns, isLoading } = useDemoMarketplace();
  return (
    <ScrollView
      style={styles.viewport}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      <View style={styles.hero}>
        <Pill label={`${role.toUpperCase()} ACCOUNT`} accent />
        <Text style={styles.heroTitle}>Good morning, Maya.</Text>
        <Text style={styles.heroBody}>
          {role === "Brand"
            ? "Your next campaign deserves creators who feel like the perfect fit."
            : "Explore campaign opportunities that match your audience and content style."}
        </Text>
        <AppButton
          label={role === "Brand" ? "Find influencers" : "Explore campaigns"}
          onPress={onDiscover}
        />
      </View>
      <SectionTitle
        title="Top matches"
        action="View all"
        onAction={onDiscover}
      />
      {isLoading ? (
        <MarketplaceSkeleton />
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontal}
          >
            {influencers.slice(0, 3).map((item) => (
              <InfluencerCard
                key={item.id}
                item={item}
                compact
                onPress={() => onInfluencer(item)}
              />
            ))}
          </ScrollView>
          <SectionTitle title="Your campaigns" action="Manage" />
          {campaigns.slice(0, 2).map((item) => (
            <CampaignCard key={item.id} item={item} />
          ))}
        </>
      )}
      <SectionTitle title="Explore by category" />
      <View style={styles.categoryGrid}>
        {(
          [
            { label: "Beauty", icon: "color-palette-outline" },
            { label: "Fashion", icon: "shirt-outline" },
            { label: "Food", icon: "restaurant-outline" },
            { label: "Tech", icon: "phone-portrait-outline" },
            { label: "Fitness", icon: "barbell-outline" },
            { label: "Travel", icon: "airplane-outline" },
          ] as const
        ).map((item) => (
          <AppCard key={item.label} style={styles.categoryCard}>
            <AppIcon name={item.icon} size={23} color={theme.colors.primary} />
            <Text style={styles.categoryText}>{item.label}</Text>
          </AppCard>
        ))}
      </View>
    </ScrollView>
  );
}
