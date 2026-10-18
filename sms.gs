const SHEET_NAME = 'Profiles';
const HEADERS = ['Name', 'Job', 'Email', 'Phone'];
const PHONE_PATTERN = /^0\d{10}$/;

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('A JSON request body is required.');
    }

    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    const profile = request.profile;

    if (action === 'submitFeedback') {
      return submitRecommendation_(profile);
    }
    if (action !== 'create' && action !== 'update' && action !== 'lookup') {
      throw new Error('Action must be "create", "update", or "lookup".');
    }
    if (!profile || typeof profile !== 'object') {
      throw new Error('Profile data is required.');
    }

    if (action === 'lookup') {
      const phone = normalizePhone_(profile.phone);
      if (!PHONE_PATTERN.test(phone)) {
        throw new Error('Phone must contain 11 digits and start with 0.');
      }

      const sheet = getProfilesSheet_();
      const phoneRows = findPhoneRows_(sheet, phone);
      if (phoneRows.length === 0) {
        return jsonResponse_({
          ok: false,
          error: 'PHONE_NOT_FOUND',
          message: 'No profile was found for this phone number.'
        });
      }
      if (phoneRows.length > 1) {
        throw new Error('More than one row has this phone number; lookup was stopped.');
      }

      const values = sheet.getRange(phoneRows[0], 1, 1, HEADERS.length).getDisplayValues()[0];
      return jsonResponse_({
        ok: true,
        action: 'found',
        profile: {
          name: values[0],
          job: values[1],
          email: values[2],
          phone: formatPhone_(normalizePhone_(values[3]))
        }
      });
    }

    const normalizedProfile = normalizeProfile_(profile);
    const lookupPhone = action === 'update' && profile.lookupPhone
      ? normalizePhone_(profile.lookupPhone)
      : normalizedProfile.phone;

    if (action === 'update' && !PHONE_PATTERN.test(lookupPhone)) {
      throw new Error('A valid lookupPhone is required for profile updates.');
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const sheet = getProfilesSheet_();
      const phoneRows = findPhoneRows_(sheet, lookupPhone);

      if (action === 'create') {
        if (phoneRows.length > 0) {
          return jsonResponse_({
            ok: false,
            error: 'PHONE_EXISTS',
            message: 'A profile with this phone number already exists.'
          });
        }

        appendProfile_(sheet, normalizedProfile);
        return jsonResponse_({ ok: true, action: 'created', profile: normalizedProfile });
      }

      if (phoneRows.length === 0) {
        return jsonResponse_({
          ok: false,
          error: 'PHONE_NOT_FOUND',
          message: 'No profile was found for this phone number.'
        });
      }
      if (phoneRows.length > 1) {
        throw new Error('More than one row has the lookup phone number; update was stopped.');
      }

      const newPhoneRows = findPhoneRows_(sheet, normalizedProfile.phone);
      if (normalizePhone_(normalizedProfile.phone) !== lookupPhone &&
          newPhoneRows.some((row) => row !== phoneRows[0])) {
        return jsonResponse_({
          ok: false,
          error: 'PHONE_EXISTS',
          message: 'Another profile already uses the new phone number.'
        });
      }

      writeProfile_(sheet, phoneRows[0], normalizedProfile);
      return jsonResponse_({ ok: true, action: 'updated', profile: normalizedProfile });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error(error);
    return jsonResponse_({ ok: false, error: error.message });
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
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  } else {
    const actualHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
    if (HEADERS.some((header, index) => actualHeaders[index] !== header)) {
      throw new Error('The first row of the Profiles sheet must be: ' + HEADERS.join(', '));
    }
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
  const range = sheet.getRange(row, 1, 1, HEADERS.length);
  range.setNumberFormat('@');
  range.setValues([[profile.name, profile.job, profile.email, profile.phone]]);
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

function sheetSafeText_(value) {
  const text = String(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}
