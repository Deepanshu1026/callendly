require('dotenv').config();

const { sendEmail, getEmailConfigSummary } = require('./src/services/notificationService');

async function main() {
  const to = process.argv[2];

  if (!to) {
    console.error('Usage: node test_email.js <recipient-email>');
    process.exit(1);
  }

  const config = getEmailConfigSummary();
  console.log('Email config:', config);

  const result = await sendEmail({
    to,
    subject: 'Callendly email test',
    html: '<p>This is a test email from Callendly.</p>',
    text: 'This is a test email from Callendly.'
  });

  console.log('Send result:', JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error('Email test failed:', error);
  process.exit(1);
});
