# Firebase Order Setup

## Firebase

1. In Firebase Console, enable **Authentication > Sign-in method > Anonymous**.
2. Publish the repository's `database.rules.json` in **Realtime Database > Rules**.
3. Keep the Web API key in `page/firebase-order-api.js`. It is a public client configuration value, not a password or service-account secret.

## Apps Script

1. Copy the updated `Code.gs` into the Apps Script project bound to the existing order spreadsheet. Keep the existing deployment URL used by `page/order-api.js`.
2. In Firebase Project settings, create/download a service-account JSON key and grant that service account access to the Realtime Database.
3. In Apps Script **Project Settings > Script properties**, add `FIREBASE_SERVICE_ACCOUNT_JSON` with the entire service-account JSON as its value. Do not put this key in the repository or send it through chat.
4. In **Deploy > Manage deployments**, edit the existing Web App deployment and select a new version, keeping its current URL. Set **Execute as: Me** and access so anonymous website visitors can call it. The `syncFirebaseOrder` action verifies the Firebase ID token before syncing an order.
5. In the Apps Script editor, run `seedFirebaseOrderMasterData` once. It creates `masterData/order` from the current book prices/weights, discount thresholds, 223 city fees, Royal service fee, and COD limit. The function refuses to overwrite existing master data.
6. Run `installFirebaseOrderSyncTrigger` once to install the one-minute retry trigger for orders left pending after a temporary Sheet/API failure.

## Profiles and Recommendations

1. Copy the updated `sms.gs` into the Apps Script project bound to the separate Profiles/Recommendations spreadsheet, not the order spreadsheet.
2. The customer profile API uses the supplied Profiles/Recommendations Web App URL from `page/profile-api.js`; edit that existing deployment to a new version after copying `sms.gs`, keeping the URL unchanged.
3. Add the same `FIREBASE_SERVICE_ACCOUNT_JSON` value in that project's Script Properties. Keep the private key out of the repository and chat.
4. Run `syncPendingProfileAndFeedback` manually once and approve the Apps Script permissions. It will also process existing Firebase records with `syncStatus: pending`.
5. Run `installProfileRecommendationSyncTrigger` once. It retries pending records every minute. If trigger creation still fails, new submissions continue trying immediate sync through the Web App, and the manual function remains available for retry.
6. The Profiles tab uses `Name`, `Job`, `Email`, `Phone`, `Paid`. The script adds `Paid` if it is missing, leaves it blank for new profiles, and preserves it when a profile is updated. Fill `Paid` manually in the Sheet.
7. The Recommendations tab uses `Submitted At`, `Name`, `Phone`, `Job`, each book's `Rating` and `Suggestion` columns, then `Other Suggestion`, matching the existing tab layout.

## Data Flow

- Customer reads catalog/settings from `masterData/order` and writes an authenticated pending record to `orders/{orderId}`.
- Customer asks Apps Script to sync only that Firebase order ID. Apps Script verifies the Firebase user, recalculates totals from Firebase master data, writes the configured order columns to the bound spreadsheet, and marks the Firebase record synced with its receipt.
- The trigger retries pending records. Orders remain stored in Firebase if the Sheet is temporarily unavailable.

The Admin app is not in this workspace yet, so its catalog editor should later write to `masterData/order` using an authenticated admin identity. Do not grant customer clients write access to `masterData`.
