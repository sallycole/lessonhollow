export interface Timezone {
  label: string
  value: string
  offset: number // UTC offset in minutes
}

export const timezones: Timezone[] = [
  { label: 'IDLW (UTC-12)', value: 'Etc/GMT+12', offset: -720 },
  { label: 'SST (UTC-11)', value: 'Pacific/Pago_Pago', offset: -660 },
  { label: 'HST (UTC-10)', value: 'Pacific/Honolulu', offset: -600 },
  { label: 'AKST (UTC-9)', value: 'America/Anchorage', offset: -540 },
  { label: 'PST (UTC-8)', value: 'America/Los_Angeles', offset: -480 },
  { label: 'MST (UTC-7)', value: 'America/Denver', offset: -420 },
  { label: 'CST (UTC-6)', value: 'America/Chicago', offset: -360 },
  { label: 'EST (UTC-5)', value: 'America/New_York', offset: -300 },
  { label: 'AST (UTC-4)', value: 'America/Halifax', offset: -240 },
  { label: 'ART (UTC-3)', value: 'America/Argentina/Buenos_Aires', offset: -180 },
  { label: 'GST (UTC-2)', value: 'Atlantic/South_Georgia', offset: -120 },
  { label: 'AZOT (UTC-1)', value: 'Atlantic/Azores', offset: -60 },
  { label: 'GMT (UTC+0)', value: 'Europe/London', offset: 0 },
  { label: 'CET (UTC+1)', value: 'Europe/Paris', offset: 60 },
  { label: 'EET (UTC+2)', value: 'Europe/Helsinki', offset: 120 },
  { label: 'MSK (UTC+3)', value: 'Europe/Moscow', offset: 180 },
  { label: 'GST (UTC+4)', value: 'Asia/Dubai', offset: 240 },
  { label: 'PKT (UTC+5)', value: 'Asia/Karachi', offset: 300 },
  { label: 'IST (UTC+5:30)', value: 'Asia/Kolkata', offset: 330 },
  { label: 'BST (UTC+6)', value: 'Asia/Dhaka', offset: 360 },
  { label: 'ICT (UTC+7)', value: 'Asia/Bangkok', offset: 420 },
  { label: 'CST (UTC+8)', value: 'Asia/Shanghai', offset: 480 },
  { label: 'JST (UTC+9)', value: 'Asia/Tokyo', offset: 540 },
  { label: 'AEST (UTC+10)', value: 'Australia/Sydney', offset: 600 },
  { label: 'SBT (UTC+11)', value: 'Pacific/Guadalcanal', offset: 660 },
  { label: 'NZST (UTC+12)', value: 'Pacific/Auckland', offset: 720 },
]

/**
 * Returns the timezone value that best matches the browser's current UTC offset.
 */
export function detectTimezone(browserOffsetMinutes: number): string {
  // Browser offset is inverted: getTimezoneOffset() returns minutes *behind* UTC
  const utcOffset = -browserOffsetMinutes

  let closest = timezones[0]
  let minDiff = Math.abs(closest.offset - utcOffset)

  for (const tz of timezones) {
    const diff = Math.abs(tz.offset - utcOffset)
    if (diff < minDiff) {
      minDiff = diff
      closest = tz
    }
  }

  return closest.value
}
