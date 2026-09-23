// Sri Lankan NIC Parser & KYC Demographic Extraction Utility
// Sri Lankan NIC formats:
// 1. Old NIC: 9 digits followed by 'V' or 'X' (e.g. 842100452V)
//    - Digits 1-2: Year of birth (1900 + YY)
//    - Digits 3-5: Day of year (001-366 for Male, 501-866 for Female)
// 2. New NIC: 12 numeric digits (e.g. 198421004521)
//    - Digits 1-4: Year of birth (YYYY)
//    - Digits 5-7: Day of year (001-366 for Male, 501-866 for Female)

export function parseSriLankanNic(nic) {
  if (!nic || typeof nic !== 'string') return null;
  const clean = nic.trim().toUpperCase();

  let birthYear = null;
  let dayOfYear = null;
  let format = '';

  const oldRegex = /^([0-9]{2})([0-9]{3})[0-9]{4}[VX]$/;
  const newRegex = /^([0-9]{4})([0-9]{3})[0-9]{5}$/;

  const oldMatch = clean.match(oldRegex);
  if (oldMatch) {
    format = 'Old (9V/X)';
    birthYear = 1900 + parseInt(oldMatch[1], 10);
    dayOfYear = parseInt(oldMatch[2], 10);
  } else {
    const newMatch = clean.match(newRegex);
    if (newMatch) {
      format = 'New (12-Digit)';
      birthYear = parseInt(newMatch[1], 10);
      dayOfYear = parseInt(newMatch[2], 10);
    } else {
      return null;
    }
  }

  // Gender detection
  let gender = 'Male';
  let adjustedDay = dayOfYear;
  if (dayOfYear > 500) {
    gender = 'Female';
    adjustedDay = dayOfYear - 500;
  }

  // Approximate Age
  const currentYear = new Date().getFullYear();
  const approximateAge = currentYear - birthYear;

  // Basic sanity check on birth year (reasonable adult age 18-100)
  const isValidAge = approximateAge >= 18 && approximateAge <= 100;

  return {
    nic: clean,
    format,
    birthYear,
    approximateAge,
    gender,
    dayOfYear: adjustedDay,
    isValidAge
  };
}
