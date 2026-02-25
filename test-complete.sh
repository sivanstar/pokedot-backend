#!/bin/bash

echo "Ì∑™ COMPLETE POKEDOT BACKEND TEST"
echo "================================="

BASE_URL="http://localhost:3000/api"

echo -e "\nÌ≥ä 1. SYSTEM STATUS"
echo "-----------------"
curl -s $BASE_URL/health | python -m json.tool

echo -e "\nÌº± 2. DATABASE SEEDING"
echo "---------------------"
SEED_RESPONSE=$(curl -s -X POST $BASE_URL/admin/seed)
echo "$SEED_RESPONSE" | python -m json.tool

echo -e "\nÌæüÔ∏è 3. COUPON VALIDATION"
echo "------------------------"
COUPON_TEST=$(curl -s -X POST $BASE_URL/auth/check-coupon \
  -H "Content-Type: application/json" \
  -d '{"couponCode": "WELCOME500"}')
echo "$COUPON_TEST" | python -m json.tool

echo -e "\nÔøΩÔøΩ 4. USER REGISTRATION"
echo "------------------------"
echo "Registering test user..."
REGISTER_DATA='{
  "username": "testuser_$(date +%s)",
  "email": "test_$(date +%s)@example.com",
  "password": "Test123!@#",
  "couponCode": "WELCOME500"
}'

REGISTER_RESPONSE=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d "$REGISTER_DATA")

echo "$REGISTER_RESPONSE" | python -m json.tool

# Extract token if registration was successful
if echo "$REGISTER_RESPONSE" | grep -q '"success":true'; then
  TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  
  echo -e "\nÌ¥ê 5. PROTECTED ENDPOINTS TEST"
  echo "-----------------------------"
  
  echo -e "\nÌ≥ã 5.1 User Profile:"
  curl -s $BASE_URL/auth/profile \
    -H "Authorization: Bearer $TOKEN" | python -m json.tool
  
  echo -e "\nÌ±• 5.2 Available Users:"
  curl -s $BASE_URL/users/available \
    -H "Authorization: Bearer $TOKEN" | python -m json.tool
  
  echo -e "\n‚è±Ô∏è 5.3 Daily Limits:"
  curl -s $BASE_URL/users/daily-limits \
    -H "Authorization: Bearer $TOKEN" | python -m json.tool
  
  echo -e "\nÌø¶ 5.4 Update Bank Details:"
  curl -s -X PUT $BASE_URL/users/account-details \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "bankName": "Test Bank",
      "accountName": "Test User",
      "accountNumber": "1234567890"
    }' | python -m json.tool
  
  echo -e "\nÌ≤∞ 5.5 Wallet Balance:"
  curl -s $BASE_URL/wallet/balance \
    -H "Authorization: Bearer $TOKEN" | python -m json.tool
  
else
  echo "‚ùå Registration failed, skipping protected endpoints"
fi

echo -e "\nÔøΩÔøΩ 6. PUBLIC LEADERBOARD"
echo "------------------------"
curl -s $BASE_URL/users/leaderboard | python -m json.tool

echo -e "\n================================="
echo "‚úÖ TEST COMPLETE!"
echo "Ì¥ó Backend URL: http://localhost:3000"
echo "Ì≥ö API Documentation available at /api/health"
