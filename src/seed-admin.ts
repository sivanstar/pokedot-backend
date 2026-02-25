import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User';
import Coupon from './models/Coupon';

dotenv.config();

const ADMIN_EMAIL = 'admin@pokedot.com';
const ADMIN_PASSWORD = 'Admin123!@#';

async function seedDatabase() {
  try {
    console.log('Ìº± Starting database seeding...');
    
    // Connect to MongoDB
    console.log('Ì¥ó Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('‚úÖ Connected to MongoDB Atlas');

    // Create admin user
    let admin = await User.findOne({ email: ADMIN_EMAIL });
    
    if (admin) {
      console.log('‚úÖ Admin already exists:');
      console.log(`   Username: ${admin.username}`);
      console.log(`   Role: ${admin.role}`);
    } else {
      console.log('Ì±ë Creating admin user...');
      admin = new User({
        username: 'pokedot_admin',
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        role: 'admin',
        points: 10000,
        couponCodeUsed: 'ADMIN_SEED',
        isActive: true
      });
      
      await admin.save();
      console.log('‚úÖ Admin created!');
      console.log(`   Email: ${ADMIN_EMAIL}`);
      console.log(`   Password: ${ADMIN_PASSWORD}`);
      console.log(`   Referral Code: ${admin.referralCode}`);
    }

    // Create test coupons
    const coupons = [
      { code: 'WELCOME500', pointsValue: 0, maxUses: 100 },
      { code: 'POKE100', pointsValue: 100, maxUses: 50 },
      { code: 'TEST123', pointsValue: 0, maxUses: 10 },
    ];

    console.log('\nÌæüÔ∏è  Creating coupons...');
    for (const couponData of coupons) {
      let coupon = await Coupon.findOne({ code: couponData.code });
      if (!coupon) {
        coupon = new Coupon({
          ...couponData,
          createdBy: admin._id,
          isActive: true
        });
        await coupon.save();
        console.log(`   ‚úÖ Created: ${couponData.code}`);
      } else {
        console.log(`   ‚è© Exists: ${couponData.code}`);
      }
    }

    // Create test user
    const testEmail = 'test@example.com';
    let testUser = await User.findOne({ email: testEmail });
    
    if (!testUser) {
      testUser = new User({
        username: 'testuser',
        email: testEmail,
        password: 'Test123!@#',
        points: 5000,
        couponCodeUsed: 'WELCOME500',
        referredBy: admin._id,
        bankDetails: {
          bankName: 'Test Bank',
          accountName: 'TEST USER',
          accountNumber: '1234567890',
          verified: true
        }
      });
      
      await testUser.save();
      admin.referrals.push(testUser._id);
      await admin.save();
      
      console.log('\nÌ±§ Test user created:');
      console.log(`   Email: ${testEmail}`);
      console.log(`   Password: Test123!@#`);
    }

    console.log('\nÌæâ Seeding completed!');
    console.log('\nÌ∫Ä Next: Start server with: npm run dev');
    
    await mongoose.disconnect();
    
  } catch (error: any) {
    console.error('‚ùå Error:', error.message);
    process.exit(1);
  }
}

seedDatabase();
