import { useMemo, useState } from "react";
import { Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { AppButton, AppCard, AppIcon, FilterChip, Pill, SectionTitle } from "../../components/ui";
import { useTheme } from "../../providers/ThemeProvider";
import { AppTheme } from "../../styles/theme";
import { createThemeStyles } from "../../styles/createThemeStyles";
import { Campaign, DemoProposal, MarketplaceApplication, ProposalStatus } from "../../types/marketplace";
import { parseCampaignBudgetValue } from "../../lib/marketplace";
import { formatCampaignDeadline } from "../../lib/dateTime";

type PaymentFilter = "All" | "Paid" | "Pending";

const formatCurrency = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;
const formatAmountLabel = (value: string) => {
  const matches = Array.from(value.matchAll(/([\d][\d,]*(?:\.\d+)?)\s*(k|l|m)?/gi));
  if (!matches.length) return value.trim() || "Amount not recorded";
  const amounts = matches.map((match) => {
    const base = Number(match[1].replace(/,/g, ""));
    const multiplier = match[2]?.toLowerCase() === "k" ? 1_000 : match[2]?.toLowerCase() === "l" ? 100_000 : match[2]?.toLowerCase() === "m" ? 1_000_000 : 1;
    return formatCurrency(base * multiplier);
  });
  return amounts.join(/\bto\b|[-–—]/i.test(value) ? " – " : " + ");
};
const isCommittedStatus = (status: ProposalStatus) => status === "Accepted" || status === "Completed";
const isPaidStatus = (status: ProposalStatus) => status === "Completed";

export function BudgetView({
  campaigns,
  proposals,
  currentBrandId,
  applications = [],
  onSavePayment,
  onScroll,
}: {
  campaigns: Campaign[];
  proposals: DemoProposal[];
  currentBrandId?: string;
  applications?: MarketplaceApplication[];
  onSavePayment?: (applicationId: string, amount: string, paid: boolean) => Promise<boolean>;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [filter, setFilter] = useState<PaymentFilter>("All");
  const [campaignFilter, setCampaignFilter] = useState("All");
  const [campaignPickerOpen, setCampaignPickerOpen] = useState(false);
  const [campaignSearch, setCampaignSearch] = useState("");
  const brandCampaigns = useMemo(
    () => campaigns.filter((campaign) => !currentBrandId || campaign.brandId === currentBrandId),
    [campaigns, currentBrandId],
  );
  const campaignIds = useMemo(() => new Set(brandCampaigns.map((campaign) => campaign.id)), [brandCampaigns]);
  const relevantProposals = useMemo(
    () => proposals.filter((proposal) => proposal.direction === "brand_to_creator" && campaignIds.has(proposal.campaignId) && proposal.status !== "Declined"),
    [campaignIds, proposals],
  );
  const paymentApplications = useMemo(
    () => applications.filter((application) => application.status === "Accepted" && campaignIds.has(application.campaignId ?? application.briefId)),
    [applications, campaignIds],
  );
  const selectedCampaign = brandCampaigns.find((campaign) => campaign.id === campaignFilter);
  const activeCampaignFilter = selectedCampaign?.id ?? "All";
  const campaignOptions = useMemo(() => {
    const search = campaignSearch.trim().toLowerCase();
    return brandCampaigns.filter((campaign) => !search || `${campaign.title} ${campaign.category}`.toLowerCase().includes(search));
  }, [brandCampaigns, campaignSearch]);
  const totalBudget = useMemo(
    () => brandCampaigns.filter((campaign) => campaign.status !== "Archived").reduce((total, campaign) => total + parseCampaignBudgetValue(campaign.budget), 0),
    [brandCampaigns],
  );
  const committed = useMemo(
    () => paymentApplications.reduce((total, application) => total + parseCampaignBudgetValue(application.payment?.amount ?? "0"), 0) + relevantProposals.filter((proposal) => isCommittedStatus(proposal.status)).reduce((total, proposal) => total + parseCampaignBudgetValue(proposal.amount), 0),
    [paymentApplications, relevantProposals],
  );
  const paid = useMemo(
    () => paymentApplications.filter((application) => application.payment?.paidAt).reduce((total, application) => total + parseCampaignBudgetValue(application.payment?.amount ?? "0"), 0) + relevantProposals.filter((proposal) => isPaidStatus(proposal.status)).reduce((total, proposal) => total + parseCampaignBudgetValue(proposal.amount), 0),
    [paymentApplications, relevantProposals],
  );
  const pending = Math.max(0, committed - paid);
  const visiblePayments = relevantProposals.filter((proposal) =>
    (activeCampaignFilter === "All" || proposal.campaignId === activeCampaignFilter) &&
    (filter === "All" || (filter === "Paid" ? isPaidStatus(proposal.status) : isCommittedStatus(proposal.status) && !isPaidStatus(proposal.status))),
  );
  const visibleApplications = paymentApplications.filter((application) =>
    (activeCampaignFilter === "All" || (application.campaignId ?? application.briefId) === activeCampaignFilter) &&
    (filter === "All" || (filter === "Paid" ? Boolean(application.payment?.paidAt) : !application.payment?.paidAt)),
  );
  const visibleCampaigns = activeCampaignFilter === "All" ? brandCampaigns : brandCampaigns.filter((campaign) => campaign.id === activeCampaignFilter);
  const summaryCards = [
    { label: "Total budget", value: totalBudget, icon: "wallet-outline" as const },
    { label: "Committed", value: committed, icon: "briefcase-outline" as const },
    { label: "Paid", value: paid, icon: "checkmark-circle-outline" as const },
    { label: "Pending", value: pending, icon: "time-outline" as const },
  ];
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
      <View style={styles.intro}>
        <View style={styles.titleRow}>
          <View style={styles.titleIcon}><AppIcon name="wallet-outline" size={21} color={theme.colors.primary} /></View>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>FINANCE</Text>
            <Text style={styles.title}>Budget & payments</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>Track agreed creator payments and mark transfers as paid.</Text>
      </View>
      <View style={styles.summaryGrid}>
        {summaryCards.map((card, index) => (
          <AppCard key={card.label} style={[styles.summaryCard, [styles.summaryCardSky, styles.summaryCardMint, styles.summaryCardBlush, styles.summaryCardButter][index % 4]]}>
            <View style={styles.summaryIcon}><AppIcon name={card.icon} size={19} color={theme.colors.primary} /></View>
            <Text style={styles.summaryLabel}>{card.label}</Text>
            <Text style={styles.summaryValue}>{formatCurrency(card.value)}</Text>
          </AppCard>
        ))}
      </View>
      <SectionTitle title="Creator payments" />
      {brandCampaigns.length > 1 || activeCampaignFilter !== "All" ? <View style={styles.campaignFilterRow}>
        <View style={styles.flex}><Text style={styles.detailLabel}>Campaign</Text><Text numberOfLines={1} style={styles.cardMeta}>{selectedCampaign?.title ?? "All campaigns"}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Filter payments by campaign" onPress={() => setCampaignPickerOpen(true)} style={styles.campaignFilterButton}><AppIcon name="filter-outline" size={17} color={theme.colors.primary} /><Text numberOfLines={1} style={styles.campaignFilterButtonText}>Choose</Text><AppIcon name="chevron-down" size={15} color={theme.colors.textSecondary} /></Pressable>
      </View> : null}
      <View style={styles.filters}>
        {(["All", "Paid", "Pending"] as PaymentFilter[]).map((item) => <FilterChip key={item} label={item} selected={filter === item} onPress={() => setFilter(item)} />)}
      </View>
      {visibleApplications.map((application) => <ApplicationPaymentCard key={application.id} application={application} styles={styles} onSave={onSavePayment} />)}
      {visiblePayments.map((proposal) => <PaymentCard key={proposal.id} proposal={proposal} styles={styles} />)}
      {!visiblePayments.length && !visibleApplications.length ? (
        <AppCard style={styles.emptyCard}>
          <AppIcon name="wallet-outline" size={24} color={theme.colors.primary} />
          <Text style={styles.emptyTitle}>{activeCampaignFilter === "All" ? "No payment records yet" : "No payments for this campaign"}</Text>
          <Text style={styles.emptyText}>Accepted creator work appears here. Enter the agreed INR amount, then mark it paid after the transfer is complete.</Text>
        </AppCard>
      ) : null}
      <SectionTitle title="Campaign commitments" />
      {visibleCampaigns.length ? visibleCampaigns.map((campaign, index) => (
        <AppCard key={campaign.id} style={[styles.campaignCard, [styles.campaignCardSky, styles.campaignCardMint, styles.campaignCardBlush][index % 3]]}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>{campaign.title}</Text>
              <Text style={styles.cardMeta}>{campaign.category} · {campaign.city}</Text>
            </View>
            <Pill label={campaign.visibility === "private" ? "Private" : campaign.status} accent={campaign.visibility !== "private" && (campaign.status === "Published" || campaign.status === "Open")} />
          </View>
          <View style={styles.campaignBudgetRow}>
            <AppIcon name="wallet-outline" size={17} color={theme.colors.primary} />
            <Text style={styles.campaignAmount}>{formatAmountLabel(campaign.budget)}</Text>
          </View>
          <View style={styles.deadlineRow}><AppIcon name="calendar-outline" size={14} color={theme.colors.textSecondary} /><Text style={styles.cardMeta}>Deadline · {formatCampaignDeadline(campaign.deadlineAt ?? campaign.deadline)}</Text></View>
        </AppCard>
      )) : <AppCard style={styles.emptyCard}>
        <AppIcon name="folder-open-outline" size={24} color={theme.colors.primary} />
        <Text style={styles.emptyTitle}>No campaign budgets yet</Text>
        <Text style={styles.emptyText}>Create a campaign to start tracking its budget here.</Text>
      </AppCard>}
      <Modal visible={campaignPickerOpen} transparent animationType="slide" onRequestClose={() => setCampaignPickerOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.campaignPicker}>
          <View style={styles.pickerHeader}><View style={styles.flex}><Text style={styles.pickerTitle}>Choose campaign</Text><Text style={styles.cardMeta}>Filter payments and commitments</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close campaign filter" onPress={() => setCampaignPickerOpen(false)} style={styles.pickerClose}><AppIcon name="close" size={20} color={theme.colors.textSecondary} /></Pressable></View>
          <View style={styles.campaignSearch}><AppIcon name="search-outline" size={17} color={theme.colors.textSecondary} /><TextInput value={campaignSearch} onChangeText={setCampaignSearch} placeholder="Search campaigns" placeholderTextColor={theme.colors.inputPlaceholder} style={styles.campaignSearchInput} accessibilityLabel="Search campaigns" /></View>
          <ScrollView style={styles.campaignOptionList} keyboardShouldPersistTaps="handled">
            <Pressable accessibilityRole="button" accessibilityState={{ selected: campaignFilter === "All" }} onPress={() => { setCampaignFilter("All"); setCampaignPickerOpen(false); }} style={[styles.campaignOption, campaignFilter === "All" && styles.campaignOptionSelected]}><View style={styles.flex}><Text style={styles.cardTitle}>All campaigns</Text><Text style={styles.cardMeta}>{brandCampaigns.length} campaigns</Text></View>{campaignFilter === "All" ? <AppIcon name="checkmark-circle" size={20} color={theme.colors.primary} /> : null}</Pressable>
            {campaignOptions.map((campaign) => <Pressable key={campaign.id} accessibilityRole="button" accessibilityState={{ selected: campaignFilter === campaign.id }} onPress={() => { setCampaignFilter(campaign.id); setCampaignPickerOpen(false); }} style={[styles.campaignOption, campaignFilter === campaign.id && styles.campaignOptionSelected]}><View style={styles.flex}><Text numberOfLines={1} style={styles.cardTitle}>{campaign.title}</Text><Text style={styles.cardMeta}>{campaign.category} · {campaign.status}</Text></View>{campaignFilter === campaign.id ? <AppIcon name="checkmark-circle" size={20} color={theme.colors.primary} /> : null}</Pressable>)}
            {!campaignOptions.length ? <Text style={styles.emptyText}>No campaigns match this search.</Text> : null}
          </ScrollView>
        </View></View>
      </Modal>
    </ScrollView>
  );
}

function ApplicationPaymentCard({ application, styles, onSave }: { application: MarketplaceApplication; styles: ReturnType<typeof makeStyles>; onSave?: (applicationId: string, amount: string, paid: boolean) => Promise<boolean> }) {
  const { theme } = useTheme();
  const [amount, setAmount] = useState(application.payment?.amount ?? "");
  const [paid, setPaid] = useState(Boolean(application.payment?.paidAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const validAmount = /^\d{1,10}(?:\.\d{1,2})?$/.test(amount.trim());
  return <AppCard style={styles.paymentCard}>
    <View style={styles.row}><View style={styles.flex}><Text style={styles.cardTitle}>{application.creatorName}</Text><Text style={styles.cardMeta}>{application.briefTitle}</Text></View><Pill label={paid ? "Paid" : "Pending"} accent={paid} /></View>
    <Text style={styles.detailLabel}>Agreed amount · INR</Text>
    <TextInput accessibilityLabel={`Agreed amount for ${application.creatorName}`} value={amount} onChangeText={(value) => { setAmount(value); setError(""); }} keyboardType="decimal-pad" placeholder="e.g. 15000" placeholderTextColor={theme.colors.inputPlaceholder} style={styles.amountInput} />
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: paid }} onPress={() => setPaid((current) => !current)} style={styles.paidToggle}><AppIcon name={paid ? "checkbox" : "square-outline"} size={20} color={theme.colors.primary} /><Text style={styles.detailText}>Mark as paid</Text></Pressable>
    {error ? <Text accessibilityRole="alert" style={styles.paymentError}>{error}</Text> : null}
    <AppButton label={saving ? "Saving…" : "Save payment"} icon="save-outline" disabled={saving || !validAmount || !onSave} loading={saving} onPress={async () => { if (!validAmount || !onSave) return; setSaving(true); try { if (!(await onSave(application.id, amount.trim(), paid))) setError("Payment could not be saved."); } catch (cause) { setError(cause instanceof Error ? cause.message : "Payment could not be saved."); } finally { setSaving(false); } }} />
  </AppCard>;
}

function PaymentCard({ proposal, styles }: { proposal: DemoProposal; styles: ReturnType<typeof makeStyles> }) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const status: ProposalStatus = proposal.status;
  return (
    <AppCard onPress={() => setExpanded((current) => !current)} style={styles.paymentCard}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>{proposal.participantName}</Text>
          <Text style={styles.cardMeta}>{proposal.campaignTitle}</Text>
        </View>
        <View style={styles.paymentCardActions}>
          <Pill label={status === "Completed" ? "Paid" : "Pending"} accent={status === "Completed"} />
          <AppIcon name={expanded ? "chevron-up-outline" : "chevron-down-outline"} size={17} color={theme.colors.textSecondary} />
        </View>
      </View>
      <Text style={styles.paymentAmount}>{formatAmountLabel(proposal.amount)}</Text>
      {expanded ? <View style={styles.detailBlock}>
        <Text style={styles.detailLabel}>Deliverables</Text>
        <Text style={styles.detailText}>{proposal.deliverables || "Not specified"}</Text>
        <Text style={styles.detailLabel}>Notes</Text>
        <Text style={styles.detailText}>{proposal.message || "No payment notes recorded."}</Text>
      </View> : null}
    </AppCard>
  );
}

const makeStyles = (theme: AppTheme) => createThemeStyles(theme, {
  screen: { flex: 1, backgroundColor: theme.colors.transparent },
  page: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl + theme.spacing.xl, gap: theme.spacing.md },
  intro: { gap: theme.spacing.sm, marginBottom: theme.spacing.xs },
  titleRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  titleIcon: { width: 44, height: 44, borderRadius: theme.radius.md, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceLilac },
  eyebrow: { color: theme.colors.primary, fontSize: theme.type.caption, fontWeight: "800", letterSpacing: 1.2, fontFamily: theme.type.bodyFont },
  title: { color: theme.colors.textPrimary, fontSize: theme.type.display, lineHeight: theme.type.lineHeight.display, fontWeight: "900", fontFamily: theme.type.displayFont },
  subtitle: { color: theme.colors.textSecondary, fontSize: theme.type.body, lineHeight: theme.type.lineHeight.body, fontFamily: theme.type.bodyFont },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  summaryCard: { width: "48%", minHeight: 126, padding: theme.spacing.md, gap: theme.spacing.xs, alignItems: "center", justifyContent: "center" },
  summaryCardSky: { backgroundColor: theme.colors.surfaceSky },
  summaryCardMint: { backgroundColor: theme.colors.surfaceMint },
  summaryCardBlush: { backgroundColor: theme.colors.surfaceBlush },
  summaryCardButter: { backgroundColor: theme.colors.surfaceButter },
  summaryIcon: { width: 34, height: 34, borderRadius: theme.radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceRaised },
  summaryLabel: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontFamily: theme.type.bodyFont, textAlign: "center" },
  summaryValue: { color: theme.colors.textPrimary, fontSize: theme.type.title, lineHeight: theme.type.lineHeight.title, fontWeight: "900", fontFamily: theme.type.bodyFont, textAlign: "center", maxWidth: "100%" },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  campaignFilterRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.cardBorder, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface },
  campaignFilterButton: { maxWidth: "48%", minHeight: 40, flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, paddingHorizontal: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.cardBorder, borderRadius: theme.radius.control, backgroundColor: theme.colors.surfaceRaised },
  campaignFilterButtonText: { flexShrink: 1, color: theme.colors.primary, fontSize: theme.type.caption, fontWeight: "800", fontFamily: theme.type.bodyFont },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(25, 21, 45, 0.42)" },
  campaignPicker: { maxHeight: "82%", gap: theme.spacing.sm, padding: theme.spacing.lg, paddingBottom: theme.spacing.xl, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, backgroundColor: theme.colors.surface },
  pickerHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  pickerTitle: { color: theme.colors.textPrimary, fontSize: theme.type.title, fontWeight: "900", fontFamily: theme.type.bodyFont },
  pickerClose: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceMuted },
  campaignSearch: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.cardBorder, borderRadius: theme.radius.control, backgroundColor: theme.colors.surfaceRaised },
  campaignSearchInput: { flex: 1, minWidth: 0, color: theme.colors.textPrimary, fontSize: theme.type.body, fontFamily: theme.type.bodyFont },
  campaignOptionList: { flexGrow: 0 },
  campaignOption: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderBottomWidth: 1, borderBottomColor: theme.colors.cardBorder },
  campaignOptionSelected: { backgroundColor: theme.colors.surfaceLilac },
  paymentCard: { gap: theme.spacing.sm, backgroundColor: theme.colors.surfaceMint },
  paymentCardActions: { alignItems: "center", gap: theme.spacing.xs },
  campaignCard: { gap: theme.spacing.sm },
  campaignCardSky: { backgroundColor: theme.colors.surfaceSky },
  campaignCardMint: { backgroundColor: theme.colors.surfaceMint },
  campaignCardBlush: { backgroundColor: theme.colors.surfaceBlush },
  row: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  flex: { flex: 1, minWidth: 0 },
  cardTitle: { color: theme.colors.textPrimary, fontSize: theme.type.bodyLarge, lineHeight: theme.type.lineHeight.bodyLarge, fontWeight: "800", fontFamily: theme.type.bodyFont, flexShrink: 1 },
  cardMeta: { color: theme.colors.textSecondary, fontSize: theme.type.caption, lineHeight: theme.type.lineHeight.caption, fontFamily: theme.type.bodyFont },
  paymentAmount: { color: theme.colors.textPrimary, fontSize: theme.type.title, fontWeight: "900", fontFamily: theme.type.bodyFont },
  amountInput: { minHeight: 48, paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.control, borderWidth: 1, borderColor: theme.colors.cardBorder, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceRaised, fontSize: theme.type.body, fontFamily: theme.type.bodyFont },
  paidToggle: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  paymentError: { color: theme.colors.danger, fontSize: theme.type.caption, fontFamily: theme.type.bodyFont },
  detailBlock: { gap: theme.spacing.xs, paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.cardBorder },
  detailLabel: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontWeight: "700", fontFamily: theme.type.bodyFont },
  detailText: { color: theme.colors.textPrimary, fontSize: theme.type.body, lineHeight: theme.type.lineHeight.body, fontFamily: theme.type.bodyFont },
  campaignAmount: { color: theme.colors.primary, fontSize: theme.type.bodyLarge, fontWeight: "800", fontFamily: theme.type.bodyFont },
  campaignBudgetRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  deadlineRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  emptyCard: { gap: theme.spacing.sm, alignItems: "center", backgroundColor: theme.colors.surfaceLilac, paddingVertical: theme.spacing.lg },
  emptyTitle: { color: theme.colors.textPrimary, fontSize: theme.type.bodyLarge, fontWeight: "800", fontFamily: theme.type.bodyFont, textAlign: "center" },
  emptyText: { color: theme.colors.textSecondary, fontSize: theme.type.body, lineHeight: theme.type.lineHeight.body, fontFamily: theme.type.bodyFont, textAlign: "center" },
});
