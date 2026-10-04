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
