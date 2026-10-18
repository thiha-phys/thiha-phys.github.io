const SHEET_NAME = 'Profiles';
const HEADERS = ['Name', 'Job', 'Email', 'Phone', 'Paid'];
const PHONE_PATTERN = /^0\d{10}$/;
const FIREBASE_DATABASE_URL_ = 'https://thkapp-305-default-rtdb.firebaseio.com';
const FIREBASE_WEB_API_KEY_ = 'AIzaSyDOEqOTtBACp_IfxjntLsNF97JBiuQDkV8';
const FIREBASE_SERVICE_ACCOUNT_PROPERTY_ = 'FIREBASE_SERVICE_ACCOUNT_JSON';

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('A JSON request body is required.');
    }
    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    const recordId = requiredText_(request.recordId, 'Firebase record ID');
    const uid = verifyFirebaseIdToken_(request.idToken);
    const collection = action === 'syncFirebaseProfile'
      ? 'profiles'
      : action === 'syncFirebaseRecommendation'
        ? 'recommendations'
        : '';
    if (!collection) throw new Error('Unsupported sync action.');

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const record = firebaseAdminRequest_(collection + '/' + encodeURIComponent(recordId), 'get');
      if (!record || record.ownerUid !== uid) {
        throw new Error('Firebase record not found or not owned by this user.');
      }
      if (record.syncStatus === 'synced') {
        return jsonResponse_({ ok: true, action: 'synced', recordId: recordId });
      }
      if (collection === 'profiles') {
        syncFirebaseProfileToSheet_(recordId, record);
      } else {
        syncFirebaseRecommendationToSheet_(recordId, record);
      }
      return jsonResponse_({ ok: true, action: 'synced', recordId: recordId });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error(error);
    return jsonResponse_({ ok: false, error: error.message });
  }
}

function verifyFirebaseIdToken_(idToken) {
  const token = requiredText_(idToken, 'Firebase ID token');
  const response = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(FIREBASE_WEB_API_KEY_),
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ idToken: token }),
      muteHttpExceptions: true
    }
  );
  const result = JSON.parse(response.getContentText());
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 ||
      !result.users || !result.users[0] || !result.users[0].localId) {
    throw new Error('Firebase ID token is invalid or expired.');
  }
  return result.users[0].localId;
}

function firebaseAdminAccessToken_() {
  const cache = CacheService.getScriptCache();
  const cachedToken = cache.get('firebaseProfileSyncAccessToken');
  if (cachedToken) return cachedToken;

  const rawServiceAccount = PropertiesService.getScriptProperties()
    .getProperty(FIREBASE_SERVICE_ACCOUNT_PROPERTY_);
  if (!rawServiceAccount) {
    throw new Error('Set FIREBASE_SERVICE_ACCOUNT_JSON in Apps Script Script Properties.');
  }
  const serviceAccount = JSON.parse(rawServiceAccount);
  const issuedAt = Math.floor(Date.now() / 1000);
  const base64Url = function (value) {
    return Utilities.base64EncodeWebSafe(value).replace(/=+$/, '');
  };
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
    aud: 'https://oauth2.googleapis.com/token',
    iat: issuedAt,
    exp: issuedAt + 3600
  }));
  const unsignedToken = header + '.' + claims;
  const signature = base64Url(Utilities.computeRsaSha256Signature(
    unsignedToken,
    serviceAccount.private_key
  ));
  const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: unsignedToken + '.' + signature
    },
    muteHttpExceptions: true
  });
  const result = JSON.parse(response.getContentText());
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || !result.access_token) {
    throw new Error('Unable to authenticate Apps Script with Firebase: ' +
      (result.error_description || result.error || 'token request failed'));
  }
  cache.put('firebaseProfileSyncAccessToken', result.access_token, Math.min(Number(result.expires_in) - 60, 3300));
  return result.access_token;
}

function firebaseAdminRequest_(path, method, body) {
  const pathParts = String(path || '').replace(/^\/+/, '').split('?');
  const cleanPath = pathParts[0].replace(/\.json$/, '');
  const query = pathParts.length > 1 ? '?' + pathParts.slice(1).join('?') : '';
  const url = FIREBASE_DATABASE_URL_.replace(/\/$/, '') + '/' + cleanPath + '.json' + query;
  const options = {
    method: String(method || 'get').toLowerCase(),
    headers: { Authorization: 'Bearer ' + firebaseAdminAccessToken_() },
    muteHttpExceptions: true
  };
  if (body !== undefined) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(body);
  }
  const response = UrlFetchApp.fetch(url, options);
  const text = response.getContentText();
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Firebase request failed (' + response.getResponseCode() + '): ' + text);
  }
  return text ? JSON.parse(text) : null;
}

function installProfileRecommendationSyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'syncPendingProfileAndFeedback') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('syncPendingProfileAndFeedback').timeBased().everyMinutes(1).create();
}

function syncPendingProfileAndFeedback() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const profiles = firebaseAdminRequest_(
      'profiles.json?orderBy=%22syncStatus%22&equalTo=%22pending%22', 'get'
    ) || {};
    Object.keys(profiles).forEach(function (phoneKey) {
      try {
        syncFirebaseProfileToSheet_(phoneKey, profiles[phoneKey]);
      } catch (error) {
        recordFirebaseSyncFailure_('profiles', phoneKey, profiles[phoneKey], error);
      }
    });

    const recommendations = firebaseAdminRequest_(
      'recommendations.json?orderBy=%22syncStatus%22&equalTo=%22pending%22', 'get'
    ) || {};
    Object.keys(recommendations).forEach(function (recommendationId) {
      try {
        syncFirebaseRecommendationToSheet_(recommendationId, recommendations[recommendationId]);
      } catch (error) {
        recordFirebaseSyncFailure_(
          'recommendations', recommendationId, recommendations[recommendationId], error
        );
      }
    });
  } finally {
    lock.releaseLock();
  }
}

function syncFirebaseProfileToSheet_(phoneKey, record) {
  if (!record || typeof record !== 'object') throw new Error('Firebase profile is invalid.');
  const profile = normalizeProfile_(record);
  const previousPhone = normalizePhone_(record.syncPreviousPhone);
  const sheet = getProfilesSheet_();
  const currentRows = findPhoneRows_(sheet, normalizePhone_(profile.phone));
  const previousRows = previousPhone && previousPhone !== normalizePhone_(profile.phone)
    ? findPhoneRows_(sheet, previousPhone)
    : [];
  if (currentRows.length > 1 || previousRows.length > 1) {
    throw new Error('Duplicate phone rows found; profile sync was stopped.');
  }
  if (currentRows.length && previousRows.length && currentRows[0] !== previousRows[0]) {
    throw new Error('Both old and new phone rows exist; profile sync needs manual review.');
  }
  const targetRow = previousRows[0] || currentRows[0] || sheet.getLastRow() + 1;
  writeProfile_(sheet, targetRow, profile);

  const syncedRecord = Object.assign({}, record, {
    syncStatus: 'synced',
    sheetSyncedAt: new Date().toISOString()
  });
  delete syncedRecord.syncPreviousPhone;
  delete syncedRecord.syncError;
  delete syncedRecord.syncAttempts;
  firebaseAdminRequest_('profiles/' + encodeURIComponent(phoneKey), 'put', syncedRecord);
}

function syncFirebaseRecommendationToSheet_(recommendationId, record) {
  if (!record || typeof record !== 'object') {
    throw new Error('Firebase recommendation is invalid.');
  }
  const properties = PropertiesService.getScriptProperties();
  const rowProperty = 'RECOMMENDATION_SYNC_ROW_' + recommendationId;
  let rowNumber = Number(properties.getProperty(rowProperty));
  if (!rowNumber) {
    const sheet = getRecommendationsSheet_();
    rowNumber = sheet.getLastRow() + 1;
    properties.setProperty(rowProperty, String(rowNumber));
  }

  submitRecommendation_(record, { rowNumber: rowNumber, lockHeld: true });
  const syncedRecord = Object.assign({}, record, {
    syncStatus: 'synced',
    sheetSyncedAt: new Date().toISOString()
  });
  delete syncedRecord.syncError;
  delete syncedRecord.syncAttempts;
  firebaseAdminRequest_('recommendations/' + encodeURIComponent(recommendationId), 'put', syncedRecord);
  properties.deleteProperty(rowProperty);
}

function recordFirebaseSyncFailure_(collection, recordId, record, error) {
  try {
    if (!record || typeof record !== 'object') return;
    const failedRecord = Object.assign({}, record, {
      syncStatus: 'pending',
      syncAttempts: Number(record.syncAttempts || 0) + 1,
      syncError: String(error.message || error).slice(0, 500)
    });
    firebaseAdminRequest_(collection + '/' + encodeURIComponent(recordId), 'put', failedRecord);
    console.error('Firebase ' + collection + ' sync failed for ' + recordId + ': ' + error.message);
  } catch (updateError) {
    console.error('Unable to record Firebase sync failure: ' + updateError.message);
  }
}

function normalizeProfile_(profile) {
  const name = requiredText_(profile.name, 'Name');
  const job = requiredText_(profile.job || profile.occupation, 'Job');
  const email = profile.email == null ? '' : String(profile.email).trim();
  const phone = normalizePhone_(profile.phone);

  if (!PHONE_PATTERN.test(phone)) {
    throw new Error('Phone must contain 11 digits and start with 0.');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Email must be a valid email address or empty.');
  }

  return {
    name: name,
    job: job,
    email: email,
    phone: formatPhone_(phone)
  };
}

function requiredText_(value, fieldName) {
  const text = value == null ? '' : String(value).trim();
  if (!text) {
    throw new Error(fieldName + ' is required.');
  }
  return text;
}

function normalizePhone_(value) {
  const phone = value == null ? '' : String(value);
  return phone
    .replace(/[၀-၉]/g, function (digit) {
      return String(digit.charCodeAt(0) - '၀'.charCodeAt(0));
    })
    .replace(/\D/g, '');
}

function formatPhone_(digits) {
  return digits.slice(0, 2) + ' ' +
    digits.slice(2, 5) + ' ' +
    digits.slice(5, 8) + ' ' +
    digits.slice(8, 11);
}

function getProfilesSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('Bind this Apps Script project to the target Google Sheet.');
  }

  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    if (sheet.getMaxColumns() < HEADERS.length) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), HEADERS.length - sheet.getMaxColumns());
    }
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  } else {
    if (sheet.getMaxColumns() < HEADERS.length) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), HEADERS.length - sheet.getMaxColumns());
    }
    const actualHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
    if (HEADERS.slice(0, 4).some((header, index) => actualHeaders[index] !== header) ||
        (actualHeaders[4] && actualHeaders[4] !== 'Paid')) {
      throw new Error('The first row of the Profiles sheet must be: ' + HEADERS.join(', '));
    }
    if (!actualHeaders[4]) sheet.getRange(1, 5).setValue('Paid');
  }

  return sheet;
}

function findPhoneRows_(sheet, phone) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }

  return sheet.getRange(2, 4, lastRow - 1, 1).getDisplayValues()
    .reduce(function (rows, values, index) {
      if (normalizePhone_(values[0]) === phone) {
        rows.push(index + 2);
      }
      return rows;
    }, []);
}

function appendProfile_(sheet, profile) {
  const row = sheet.getLastRow() + 1;
  writeProfile_(sheet, row, profile);
}

function writeProfile_(sheet, row, profile) {
  const paid = row <= sheet.getLastRow() ? sheet.getRange(row, 5).getValue() : '';
  const range = sheet.getRange(row, 1, 1, HEADERS.length);
  range.setNumberFormat('@');
  range.setValues([[profile.name, profile.job, profile.email, profile.phone, paid]]);
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
const RECOMMENDATION_SHEET_NAME = 'Recommendations';
const RECOMMENDATION_BOOKS = [
  { id: 'special', name: 'သင်ရိုးကုန် အထူးထုတ်' },
  { id: 'practice', name: 'Practice Book' },
  { id: 'old-questions', name: 'မေးခွန်းဟောင်းစာအုပ်' },
  { id: 'solution', name: 'တွက်စာသီးသန့်စာအုပ်' },
  { id: 'g11-handbook', name: 'Grade 11 စာသင်ခန်းသုံး စာအုပ်' },
  { id: 'g11-objective', name: 'Grade 11 တစ်မှတ်တန် သီးသန့်စာအုပ်' },
  { id: 'g10-handbook', name: 'Grade 10 စာသင်ခန်းသုံး စာအုပ်' }
];
const RECOMMENDATION_HEADERS = [
  'Submitted At', 'Name', 'Phone', 'Job',
  ...RECOMMENDATION_BOOKS.reduce(function (headers, book) {
    headers.push(book.name + ' Rating', book.name + ' Suggestion');
    return headers;
  }, []),
  'Other Suggestion'
];

function getRecommendationsSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('Bind this Apps Script project to the target Google Sheet.');
  }
  let sheet = spreadsheet.getSheetByName(RECOMMENDATION_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(RECOMMENDATION_SHEET_NAME);
  if (sheet.getMaxColumns() < RECOMMENDATION_HEADERS.length) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      RECOMMENDATION_HEADERS.length - sheet.getMaxColumns()
    );
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, RECOMMENDATION_HEADERS.length)
      .setValues([RECOMMENDATION_HEADERS]);
    sheet.setFrozenRows(1);
  } else {
    const actualHeaders = sheet.getRange(1, 1, 1, RECOMMENDATION_HEADERS.length)
      .getDisplayValues()[0];
    if (RECOMMENDATION_HEADERS.some(function (header, index) {
      return actualHeaders[index] !== header;
    })) {
      throw new Error('The first row of the Recommendations sheet does not match the expected columns.');
    }
  }
  return sheet;
}

function submitRecommendation_(feedback, syncOptions) {
  syncOptions = syncOptions || {};
  if (!feedback || typeof feedback !== 'object' || Array.isArray(feedback)) {
    throw new Error('Feedback data is required.');
  }

  const name = requiredText_(feedback.name, 'Name');
  const phone = normalizePhone_(feedback.phone);
  if (!/^0\d{10}$/.test(phone)) {
    throw new Error('Log in with a registered account before submitting feedback.');
  }
  if (feedback.job !== 'teacher' && feedback.job !== 'student') {
    throw new Error('Job must be "teacher" or "student".');
  }
  if (!Array.isArray(feedback.books) || feedback.books.length !== RECOMMENDATION_BOOKS.length) {
    throw new Error('A rating is required for every book.');
  }
  const submittedAt = new Date(feedback.submittedAt || Date.now());
  if (Number.isNaN(submittedAt.getTime())) {
    throw new Error('Recommendation submission time is invalid.');
  }

  const entriesById = Object.create(null);
  feedback.books.forEach(function (entry) {
    if (!entry || typeof entry.id !== 'string' || entriesById[entry.id] !== undefined) {
      throw new Error('Book feedback is invalid or repeated.');
    }
    entriesById[entry.id] = entry;
  });

  const lock = syncOptions.lockHeld ? null : LockService.getScriptLock();
  if (lock) lock.waitLock(10000);
  try {
    const row = [
      Utilities.formatDate(submittedAt, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      sheetSafeText_(name),
      sheetSafeText_(formatPhone_(phone)),
      feedback.job === 'teacher' ? 'Teacher' : 'Student'
    ];
    RECOMMENDATION_BOOKS.forEach(function (book) {
      const entry = entriesById[book.id];
      const rating = Number(entry && entry.rating);
      if (!entry || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new Error('A valid 1-to-5 rating is required for ' + book.name + '.');
      }
      const suggestion = optionalRecommendationText_(
        entry.suggestion,
        book.name + ' suggestion',
        1000
      );
      row.push(String(rating), sheetSafeText_(suggestion));
    });
    if (Object.keys(entriesById).length !== RECOMMENDATION_BOOKS.length ||
        RECOMMENDATION_BOOKS.some(function (book) { return !entriesById[book.id]; })) {
      throw new Error('Book feedback contains an unknown or missing book.');
    }
    const otherSuggestion = optionalRecommendationText_(
      feedback.otherSuggestion,
      'Other suggestion',
      2000
    );
    row.push(sheetSafeText_(otherSuggestion));

    const sheet = getRecommendationsSheet_();
    const nextRow = Number(syncOptions.rowNumber) || sheet.getLastRow() + 1;
    const range = sheet.getRange(nextRow, 1, 1, RECOMMENDATION_HEADERS.length);
    range.setNumberFormat('@');
    range.setValues([row]);
    return jsonResponse_({
      ok: true,
      action: 'submitted',
      profile: { name: name, phone: formatPhone_(phone) }
    });
  } finally {
    if (lock) lock.releaseLock();
  }
}

function optionalRecommendationText_(value, fieldName, maxLength) {
  const text = value == null ? '' : String(value).trim();
  if (text.length > maxLength) {
    throw new Error(fieldName + ' is too long.');
  }
  return text;
}

function sheetSafeText_(value) {
  const text = String(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}
