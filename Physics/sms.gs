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

function submitRecommendation_(feedback) {
  if (!feedback || typeof feedback !== 'object' || Array.isArray(feedback)) {
    throw new Error('Feedback data is required.');
  }

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

  const entriesById = Object.create(null);
  feedback.books.forEach(function (entry) {
    if (!entry || typeof entry.id !== 'string' || entriesById[entry.id] !== undefined) {
      throw new Error('Book feedback is invalid or repeated.');
    }
    entriesById[entry.id] = entry;
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const profilesSheet = getProfilesSheet_();
    const profileRows = findPhoneRows_(profilesSheet, phone);
    if (profileRows.length === 0) {
      throw new Error('No account was found for the signed-in phone number.');
    }
    if (profileRows.length > 1) {
      throw new Error('More than one account has this phone number; feedback was not saved.');
    }
    const profile = profilesSheet
      .getRange(profileRows[0], 1, 1, HEADERS.length)
      .getDisplayValues()[0];

    const row = [
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      sheetSafeText_(profile[0]),
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

    const nextRow = sheet.getLastRow() + 1;
    const range = sheet.getRange(nextRow, 1, 1, RECOMMENDATION_HEADERS.length);
    range.setNumberFormat('@');
    range.setValues([row]);
    return jsonResponse_({
      ok: true,
      action: 'submitted',
      profile: { name: profile[0], phone: formatPhone_(phone) }
    });
  } finally {
    lock.releaseLock();
  }
}

function optionalRecommendationText_(value, fieldName, maxLength) {
  const text = value == null ? '' : String(value).trim();
  if (text.length > maxLength) {
    throw new Error(fieldName + ' is too long.');
  }
  return text;
}
