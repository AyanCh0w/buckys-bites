# Bucky’s Bites · App Store submission

English (U.S.) · first release · App Store Connect draft 1.0 · prepared November 19, 2026

Start with Product page for paste-ready listing fields, Description for the public copy, and Notes for Review for Apple’s private reviewer notes. Media lists each upload. Complete the remaining account and release checks before choosing Add for Review.

## Product page

| App Store Connect field | Copy or selection |
| --- | --- |
| Name | Bucky's Bites (preferred public spelling). The existing record shown is Buckys Bites. Confirm the intended spelling in General → App Information. |
| Subtitle | Menus and meals at Benson |
| Promotional text | Meet Bucky’s Bites, the campus dining guide for Broncos. Check what’s cooking at Benson, see how students rate each dish, and leave your own review after a meal. |
| Keywords | campus,dining,college,student,lunch,dinner,bakery,ingredients,calories,macros,food,tracker,ratings |
| Primary category | Food & Drink |
| Secondary category | Health & Fitness, suggested for meal logging and nutrient goals |
| Marketing URL | https://bucky.eat/ · verified as the app’s public waitlist |
| Support URL | https://bucky.eat/support/ |
| Privacy Policy URL | https://bucky.eat/privacy/ |
| Version | 1.0 is the current App Store Connect draft. The Expo project declares 1.0.0. Use the version under which Apple processes the release binary. |
| Copyright | 2026 Ayan Chowdhary |
| What’s New | Omit for the initial release. |

Apple adds the © symbol to the Copyright field. The public [copyright notice](https://bucky.eat/copyright/) credits Ayan Chowdhary. Public support and privacy requests go to bucky@redbot.pro. [Apple’s field definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/)

### Description

Is the smash burger worth another trip to The Fire? What’s for dinner at Benson? Bucky’s Bites helps Santa Clara University students decide where to eat and gives every Bronco a say in what’s worth ordering again.

See what other Broncos think
Open a dish to see its average rating and read what students liked, what surprised them, and what they’d order differently. In the Ratings feed, choose New for the latest reviews, browse For You, or see which reviews rose to the top today, this week, or over all time.

Rate the dishes you’ve tried
Log a dish you ate in the past 72 hours, then pick one of five Bucky faces to give it 1 to 5 stars. Leave a quick score or add a written review. You can review the same dish again after seven days, and your latest score is the one that counts toward its average. Once you’ve logged a dish, you can also vote on whether another diner’s written review was helpful.

Plan your next meal
Check kitchen hours, browse today’s specials, and star the kitchens you visit most. Switch between vegetarian, vegan, and all meals, or open Mission Bakery to pick out a pastry and see drink prices before class.

Know what’s in your bowl
Open the Nutrition tab on a dish to see its published ingredients, serving size, calories, protein, carbs, and fat where available. Log the portion you ate, set nutrient goals, and explore your food history by day, week, or month.

Browse menus and public reviews as a guest. Sign in with Apple to keep a food log, rate dishes, and write reviews. Your ratings and reviews are public. Only you and the developer can see your food log.

Bucky’s Bites is an independent student app. Menu information comes from SCU Dining and may change. Food images are illustrations.

## Media

Under **App Previews and Screenshots → iPhone with Dynamic Island (large display)**, upload the five individual PNGs in the [iphone folder](iphone/) in filename order. They are 1320 × 2868 portrait, opaque sRGB, captured from the native app in Expo Go on an iPhone 17 Pro Max simulator running iOS 26.3. The web gallery shows the upload order. [View the screenshot set](https://bucky.eat/#screenshots).

| Order | Filename | Native screen |
| --- | --- | --- |
| 1 | 01-benson.png | The Fire lunch menu |
| 2 | 02-reviews.png | Ratings feed with fictional sample reviews displayed in simulator memory |
| 3 | 03-kitchens.png | Menu with kitchen hours and stars |
| 4 | 04-nutrition.png | Teriyaki Chicken Bowl, Nutrition tab |
| 5 | 05-coffee.png | Mission Bakery, Hot Drinks |

These dimensions fit Apple’s large iPhone display slot. An app preview video is optional. The iOS build supplies the App Store icon from composer-icon/buckysbites.icon. Confirm the processed build shows the intended icon. [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/) · [Version fields and optional previews](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/)

### Header and Search Results

| Placement | File | Dimensions |
| --- | --- | --- |
| Header | [Product page header](creative-assets/product-page-header.png) | 3840 × 1646 PNG |
| Search Results | [Search results artwork](creative-assets/search-results.png) | 3840 × 2560 PNG |

These placements are optional. Select the corresponding tab to upload each image, then use Preview to check the crop and text placement on each device. The five portrait images belong in the screenshots tab. For a November 2026 launch, dedicated iPhone Duo screenshots are optional. [Creative asset specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications/) · [Managing creative assets](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-your-app-store-assets/) · [Device screenshot requirements](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)

**Device-family decision.** This packet covers iPhone only. The current Expo configuration enables tablet support. A build that retains iPad support also needs a 13-inch iPad screenshot. For an iPhone-only launch, set the supported device family before building and verify the uploaded binary in App Store Connect. [Apple device requirements](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)

## App record and release

| Field | Value or decision |
| --- | --- |
| Platform, primary language | iOS · English (U.S.) |
| Bundle ID | com.buckysbites.app |
| App Store draft / project release version | 1.0 / 1.0.0. Check which version train contains the processed build before selecting it. |
| SKU / Apple ID | Keep the existing record’s SKU and Apple-assigned numeric ID. Both are visible under App Information. |
| Build | The linked EAS project returned zero iOS builds on November 19. Check TestFlight for an upload from Xcode or another service. If none is available, create a signed App Store distribution build and upload it. Select the processed build matching this version. |
| Price and availability | Suggested launch settings are Free and United States. Confirm price, territories, and tax category in the account. |
| Release | Manual release suggested so launch timing stays with the owner. |
| License agreement | Apple’s standard EULA unless the owner has a custom agreement. |
| Seller and rights | Use the developer account’s legal identity. Confirm rights to display the SCU Dining content and use the supplied brand/artwork before answering the content-rights question. |
| Encryption | app.json sets ITSAppUsesNonExemptEncryption to false. Confirm the archived binary and its shipped dependencies support that declaration. |
| Accessibility | Claim only features tested across the release app. |
| Regional declarations | Complete any storefront-specific questions presented for the chosen territories, including EU trader status if distributing there. |

### Remaining fields on the version screen

| Field | Entry |
| --- | --- |
| Routing App Coverage File | Leave empty. Bucky’s Bites does not provide routing directions. |
| App Clip / iMessage App | Leave empty. The project contains neither extension. |
| Game Center | Leave off. |
| Attachment | Optional. Include a short walkthrough if helpful or substantiating documents if Apple requests them. |
| App Store Version Release | Suggested choice: Manually release this version. After approval, use Release This Version when ready. |
| Previews, In-App Events, Custom Product Pages, Product Page Optimization, Nominations, Promo Codes | Optional marketing features. |
| In-App Purchases / Subscriptions | No products identified for this release. |

### Availability and the two China mainland banners

For this Santa Clara campus launch, the suggested availability is United States only, at Free. In Pricing and Availability, choose specific countries or regions and confirm that United States is the selected storefront. This is a recommendation for the owner to apply. The two banners you pasted concern China mainland distribution.

If you intend to launch in China mainland, open General → App Compliance before submitting. Check ICP filing requirements and complete the applicable AIGC declaration and security-assessment sections. The app ships pre-generated illustrations. I found no customer-facing feature that generates AI content. Apple also identifies distribution of synthetic content as a possible security-assessment trigger. Check the actual questionnaire against the shipped features and provide genuine filing details, proof of assessment, and the report wherever required. The January 31, 2027 deadline in your notice is for existing apps. [Apple compliance field reference](https://developer.apple.com/help/app-store-connect/reference/app-information/app-and-compliance-information/)

## App Review

| Review field | Entry |
| --- | --- |
| Sign-in required | Yes for full access. Guests can browse menus and reviews. Adding food and reviewing require an account. |
| User name / Password | **Owner action.** Supply working, dedicated reviewer access for the shipped app in App Store Connect. The app currently offers only Sign in with Apple. A generic email/password pair cannot sign in to this build. If you cannot provide a demo account, agree a fully featured demo-mode alternative with Apple and include precise instructions. Keep personal Apple credentials out of this packet. |
| First name / Last name | Ayan / Chowdhary |
| Email | bucky@redbot.pro, if monitored for review questions. |
| Phone number | **Owner action.** Enter a reachable number, including country code, directly in App Store Connect. |
| Notes | Paste the text below. Add the tested demo-access instructions that apply to the submitted binary. |

[Apple’s App Review access guidance](https://developer.apple.com/app-store/review/) · [Guideline 2.1](https://developer.apple.com/app-store/review/guidelines/#app-completeness)

### Notes for Review

Bucky’s Bites is an independent student dining app for Santa Clara University. Complete the introduction to browse as a guest. In Menu, select a kitchen and then a dish. The Nutrition tab on a dish shows available ingredients and nutrients. Ratings shows written dish reviews.

To test contributions, open a dish and tap “Add to today’s food.” Sign in with Apple and save a portion. Return to the dish and tap “Write a review.” A new review requires a meal logged for that dish within the last 72 hours and is limited to one per dish in a rolling seven-day period. Nutrition shows the user’s private food log and totals.

A signed-in user can open Me → Privacy to export data or initiate an account deletion request. The artwork for the Ratings screen uses fictional sample data.

### Release-build checks

- Make the published privacy policy readily accessible inside the release app. The local settings screen explains data handling, but I found no link to https://bucky.eat/privacy/ in the app source. [Apple guideline 5.1.1](https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage)
- Verify the full Apple sign-in, food logging, and review flow with the production backend. The captures demonstrate browsing and the Ratings interface.
- Verify the public-review safeguards in the shipped UI. The code includes a report-writing service and moderation language. The current review cards expose voting, and I could not find a wired report or block-author action. Confirm filtering, reporting, blocking, a reachable contact, and an operational response process before submission. [Apple guideline 1.2](https://developer.apple.com/app-store/review/guidelines/#user-generated-content)
- Verify that a deletion request reaches an operator, completes within the period communicated to the user, and covers the account and associated data. Check the Sign in with Apple token-revocation flow. [Apple account deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/)

## App Privacy questionnaire draft

The app sends account-linked information to Supabase. The selections below reflect the implementation. Confirm production logging, analytics use, SDK behavior, retention, and third-party practices before publishing the label. [Apple data definitions and purposes](https://developer.apple.com/app-store/app-privacy-details/)

| Data type to review | Evidence | Suggested purpose |
| --- | --- | --- |
| Email Address | Sign in with Apple requests email. Apple may supply a relay address. | App Functionality |
| User ID | Account identifier connects a profile to meals, ratings, and reviews. | App Functionality |
| Name or User ID | A public display name or handle appears on reviews. Classify it according to the identifier actually collected. | App Functionality |
| Health | Food logs include portions, meal times, and dietary information. Profiles can hold nutrient goals. The estimator calculates on-device and saves the resulting goals. | App Functionality. Also select Analytics for meal data used in the developer usage dashboard. |
| Other User Content | Optional written dish reviews, ratings, and report reasons. | App Functionality. Also select Analytics for ratings used in the dashboard. |
| Product Interaction | Review votes, starred kitchens, and other saved preferences drive app features. | App Functionality and Product Personalization where used to tailor the experience. |

Treat account-associated entries above as linked to the user. No ad network or cross-company tracking integration was identified in the reviewed app code. Confirm this with the release dependencies before choosing the tracking answer. Review server diagnostics and identifiers for any additional retained data. The web waitlist is a separate collection flow and should also have appropriate disclosures on the website.

## Age rating questionnaire draft

Select user-generated content for public reviews and health or wellness topics for nutrition tracking and goal estimation. The app lets users post dish reviews and vote. No direct messaging, unrestricted in-app browser, ads, gambling, loot boxes, purchases, or parental controls were identified in the reviewed features. The About screen opens specific external sources. Assess the frequency of each content descriptor against the actual production feed. Apple calculates regional ratings from the completed questionnaire. [Apple age rating setup](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/)

## From draft to submission

1. In General → App Information, confirm the public name, subtitle, categories, age questionnaire, and rights to any third-party content. In Trust & Safety → App Privacy, confirm and publish the privacy answers for the release build and enter the public policy URL. Confirm any agreements or applicable declarations flagged in your account.
2. In Pricing and Availability, choose the launch price and storefronts. Address any applicable requests in App Compliance. Choose accessibility labels only for capabilities tested throughout the release app.
3. Once the release build is ready, upload it using your existing EAS or Xcode workflow. For EAS, the project has a production build profile. The commands are `eas build --platform ios --profile production` and, after that build succeeds, `eas submit --platform ios --id <build-id>`. Select the existing app record during submission. Build upload and App Review submission are separate actions.
4. In the iOS version, paste the listing, upload the device screenshots, select the processed build, and resolve its export-compliance questions. The current configuration declares exempt encryption. Confirm the binary and all included libraries before relying on that declaration. Supply documentation only if Apple’s workflow requires it.
5. Complete reviewer access and contact information, paste the review notes, and choose the release option. Save, choose **Add for Review**, then open the App Review submission and choose **Submit for Review** when ready.

[Apple’s submission workflow](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app-for-review/)
