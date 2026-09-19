# India Influencer–Brand Deal Marketplace: V1 Plan

Technical stack, backend, database, security, deployment, and release architecture are defined in [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md).

## Summary

India-wide, OLX-style mobile marketplace for Android and iOS where:

- Influencers find relevant brand promotion opportunities.
- Brands/customers find verified influencers by location, niche, audience, and budget.
- No payment, wallet, escrow, or commission in V1—the app only facilitates discovery, proposals, chat, and approved contact sharing.
- UI/UX visual design will be finalized separately.

## Core Product Features

- Authentication with mobile OTP and email verification.
- Two account types in one app:
  - Influencer: seeks brand collaborations.
  - Brand/Customer: seeks promotion for a product, service, event, app, or business.
- Influencer profile: bio, city/state, languages, categories/niches, audience size, engagement metrics, promotion formats, availability, portfolio, multiple social accounts, and price range.
- Brand profile: company/individual name, category, city/state, campaign history, and phone/email verified status.
- MVP supports Instagram and YouTube profile links only, because they are the fastest relevant launch channels. Influencers can add both accounts; no strict KYC or automated social-account verification is required in V1. Admin may review or suspend suspicious accounts when needed.
- Structured campaign listing/brief: product/service, category, target city/state/all India, campaign goal, platform, content format, deliverables, budget range, desired audience, timeline, and requirements.
- Influencer opportunity listing: categories, preferred brand types, services offered, price range, location/service area, audience type, and social platforms.
- Advanced search and filters for both roles:
  - Location: city, state, pan-India
  - Promotion category/niche
  - Platform, follower/audience range, engagement range, language
  - Budget/price range, content format, availability, verified status, rating
- Smart matching and ranking: prioritize campaign/profile relevance, then verified status, location fit, rating, audience fit, price fit, and recent activity.
- Pricing: influencers publish a starting price or range; final price remains private and is negotiated in the proposal.
- Deal flow: `Campaign Brief → Influencer Proposal or Counter-offer → Brand Acceptance → In-app Chat → Deal Completed/Cancelled/Disputed → Review`.
- Contact information stays private until proposal acceptance and explicit influencer consent. The influencer chooses whether to share phone, email, or both with that accepted brand.
- Ratings and feedback: each party gets one rating and review only after the collaboration is marked completed. Reviews can be reported, moderated, and removed by admins if abusive or fake.
- Notifications for profile verification, new matching opportunities, proposal status, messages, reviews, and account actions.
- App update/version system: the app checks a centrally managed, platform-specific version configuration on launch and resume. It supports no update, optional update, and mandatory update states; mandatory updates block usage and redirect to the appropriate app store.

## UI System Rules

- Use a minimal visual system with no gradients anywhere.
- V1 palette: blue, white, neutral grays, and soft orange accent only.
- Support light and dark mode using one semantic-token system. Colors, typography, spacing, radii, shadows, and button variants are centrally defined, so an app-wide style change is made from one theme/configuration source.
- Use shared reusable components for all common UI; no duplicated card, button, input, modal, list, header, badge, or loading component implementations.
- Use global CSS only for resets, global theme variables, and base styles. Each page has its own scoped stylesheet/module; home and dashboard remain independently styleable without affecting other pages.

## Admin, Trust and Safety

- Admin dashboard to manage users, profiles, campaign listings, categories, reported content, reviews, account suspensions, and verification status.
- No strict KYC or business verification in V1. Admin can inspect reported/suspicious accounts and suspend them when required.
- Report/block tools for spam, fake profiles, misleading pricing, inappropriate listings, and harassment.
- Consent-based contact sharing, privacy controls, and audit logs for verification and moderation actions.

## Implementation Direction

- Build one cross-platform mobile codebase for Android and iOS, backed by a secure API and admin web portal.
- Core data entities: User, Role, InfluencerProfile, BrandProfile, SocialAccount, Category, CampaignBrief, Proposal, ContactShareConsent, Conversation, Message, Review, Report, Notification, LegalAcceptance.
- Public profile/listing APIs expose only safe discovery data; private contact data is released only after accepted proposal status and influencer consent.
- Design the location, currency, language, category, and platform models to support future international expansion, while V1 uses Indian locations and INR.
- Expose a secure version-config endpoint for Android and iOS with minimum supported version, latest version, update type, release notes, update message, and store URL.

## Test Plan

- Register/login and role-specific onboarding for both account types.
- Create/edit influencer profiles with Instagram/YouTube links and safe public visibility.
- Create campaign briefs; search, filter, sort, and match results by city/state, niche, platform, budget, and rating.
- Validate proposal, counter-offer, acceptance, chat, completed/cancelled/disputed states, and consent-based contact-release permissions.
- Ensure no payment or payout route exists in V1.
- Confirm reviews are available only after a completed proposal and only once per party.
- Test reporting, blocking, admin moderation, account suspension, and privacy/contact-data access controls.
- Test on Android and iOS devices, including low-network conditions and notification delivery.
- Test light/dark themes, responsive layouts, global theme changes, page-specific style isolation, and confirm no raw colors or gradients are introduced.
- Test no-update, optional-update, mandatory-update, invalid-config, and offline version-check behavior.

## Assumptions

- V1 launch is India-only, INR-based, and supports Instagram and YouTube links only.
- Payments and formal contract signing are outside V1.
- Exact final campaign pricing is negotiated privately.
- V1 is fully free for both influencers and brands; no subscription, commission, lead credits, or in-app purchase.
- Users must be at least 18. The app includes clear Terms, Privacy Policy, Community Guidelines, report/block controls, and account/data deletion.
- UI/UX design, branding, wireframes, and screen-level flows will be planned in the next phase.
