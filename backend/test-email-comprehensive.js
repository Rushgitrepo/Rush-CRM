require('dotenv').config();
const emailService = require('./src/services/emailService');

async function comprehensiveTest() {
  console.log('🧪 Running comprehensive email service tests...\n');
  
  let allPassed = true;
  
  // Test 1: Connection verification
  console.log('Test 1: Email connection verification');
  try {
    await emailService.testConnection();
    console.log('✅ PASSED: Email connection verified\n');
  } catch (error) {
    console.log('❌ FAILED: Email connection failed:', error.message, '\n');
    allPassed = false;
  }
  
  // Test 2: verifyConnection alias
  console.log('Test 2: verifyConnection alias');
  try {
    await emailService.verifyConnection();
    console.log('✅ PASSED: verifyConnection works\n');
  } catch (error) {
    console.log('❌ FAILED: verifyConnection failed:', error.message, '\n');
    allPassed = false;
  }
  
  // Test 3: verifySMTP with config
  console.log('Test 3: verifySMTP with config');
  try {
    const result = await emailService.verifySMTP({
      smtp_host: process.env.SMTP_HOST,
      smtp_port: process.env.SMTP_PORT,
      smtp_username: process.env.SMTP_USER,
      encrypted_password: process.env.SMTP_PASS,
    });
    
    if (result.verified) {
      console.log('✅ PASSED: SMTP verification successful\n');
    } else {
      console.log('❌ FAILED: SMTP verification failed:', result.error, '\n');
      allPassed = false;
    }
  } catch (error) {
    console.log('❌ FAILED: verifySMTP threw error:', error.message, '\n');
    allPassed = false;
  }
  
  // Test 4: sendPasswordResetEmail
  console.log('Test 4: sendPasswordResetEmail');
  try {
    await emailService.sendPasswordResetEmail(
      'test@example.com',
      'test-token-12345',
      'Test User'
    );
    console.log('✅ PASSED: Password reset email sent\n');
  } catch (error) {
    console.log('❌ FAILED: Password reset email failed:', error.message, '\n');
    allPassed = false;
  }
  
  // Test 5: sendEmail generic method
  console.log('Test 5: sendEmail generic method');
  try {
    await emailService.sendEmail({
      from: `"Rush RMS Test" <${process.env.SMTP_USER}>`,
      to: 'test@example.com',
      subject: 'Test Email',
      html: '<p>This is a test email</p>',
    });
    console.log('✅ PASSED: Generic email sent\n');
  } catch (error) {
    console.log('❌ FAILED: Generic email failed:', error.message, '\n');
    allPassed = false;
  }
  
  // Test 6: sendCampaign
  console.log('Test 6: sendCampaign');
  try {
    const campaign = {
      from_name: 'Rush RMS',
      from_email: process.env.SMTP_USER,
      subject: 'Test Campaign',
      content: '<p>This is a test campaign</p>',
    };
    
    const contacts = [
      { email: 'test1@example.com' },
      { email: 'test2@example.com' },
    ];
    
    const results = await emailService.sendCampaign(campaign, contacts);
    const successCount = results.filter(r => r.success).length;
    
    console.log(`✅ PASSED: Campaign sent to ${successCount}/${contacts.length} contacts\n`);
  } catch (error) {
    console.log('❌ FAILED: Campaign sending failed:', error.message, '\n');
    allPassed = false;
  }
  
  // Summary
  console.log('═'.repeat(60));
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED! Email service is fully functional.');
  } else {
    console.log('⚠️  SOME TESTS FAILED. Please check the errors above.');
  }
  console.log('═'.repeat(60));
  
  process.exit(allPassed ? 0 : 1);
}

comprehensiveTest();