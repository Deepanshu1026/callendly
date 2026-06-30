function escapeICS(text) {
  if (!text) return '';
  return text.replace(/[\\;,\n]/g, (match) => {
    if (match === '\n') return '\\n';
    return '\\' + match;
  });
}

function formatICSDate(dateStr) {
  const d = new Date(dateStr);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function generateICS({ title, description, startTime, endTime, location, organizerName, organizerEmail, attendeeName, attendeeEmail, timezone, uid }) {
  const dtStart = formatICSDate(startTime);
  const dtEnd = formatICSDate(endTime);
  const dtStamp = formatICSDate(new Date());
  const prodId = '-//Callendly//Callendly Scheduling//EN';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `DTSTAMP:${dtStamp}`,
    `UID:${uid || require('crypto').randomUUID()}`,
    `SUMMARY:${escapeICS(title)}`,
  ];

  if (description) {
    lines.push(`DESCRIPTION:${escapeICS(description)}`);
  }

  if (location) {
    lines.push(`LOCATION:${escapeICS(location)}`);
  }

  if (organizerName || organizerEmail) {
    lines.push(`ORGANIZER;CN=${escapeICS(organizerName || '')}:mailto:${organizerEmail || ''}`);
  }

  if (attendeeName || attendeeEmail) {
    lines.push(`ATTENDEE;CN=${escapeICS(attendeeName || '')}:mailto:${attendeeEmail || ''}`);
  }

  if (timezone) {
    lines.push(`X-MICROSOFT-CDO-TZID:${timezone}`);
  }

  lines.push('STATUS:CONFIRMED');
  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

module.exports = { generateICS };
