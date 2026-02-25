#!/bin/bash

echo "Ì∑™ Testing Enhanced POKEDOT Backend..."
echo "======================================"

BASE_URL="http://localhost:3000/api"

# Test 1: Health Check
echo -e "\n1. Testing Health Check..."
curl -s $BASE_URL/health | grep -o '"status":"[^"]*"' || echo "   ‚ùå Failed"

# Test 2: Seed Database
echo -e "\n2. Seeding Database..."
curl -s -X POST $BASE_URL/admin/seed | grep -o '"success":[^,]*' || echo "   ‚ùå Failed"

# Test 3: Check Coupon
echo -e "\n3. Testing Coupon Check..."
curl -s -X POST $BASE_URL/auth/check-coupon \
  -H "Content-Type: application/json" \
  -d '{"couponCode": "WELCOME500"}' | grep -o '"valid":[^,]*' || echo "   ‚ùå Failed"

# Test 4: Register User
echo -e "\n4. Testing Registration..."
REGISTER_RESPONSE=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "email": "new@example.com",
    "password": "Password123!",
    "couponCode": "WELCOME500"
  }')

if echo "$REGISTER_RESPONSE" | grep -q '"success":true'; then
    echo "   ‚úÖ Registration successful"
    TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo "   Ì¥ë Token received"
    
    # Test 5: Get Profile
    echo -e "\n5. Testing Profile..."
    curl -s $BASE_URL/auth/profile \
      -H "Authorization: Bearer $TOKEN" | grep -o '"success":[^,]*' || echo "   ‚ùå Failed"
    
    # Test 6: Get Available Users
    echo -e "\n6. Testing Available Users..."
    curl -s $BASE_URL/users/available \
      -H "Authorization: Bearer $TOKEN" | grep -o '"success":[^,]*' || echo "   ‚ùå Failed"
    
    # Test 7: Get Daily Limits
    echo -e "\n7. Testing Daily Limits..."
    curl -s $BASE_URL/users/daily-limits \
      -H "Authorization: Bearer $TOKEN" | grep -o '"success":[^,]*' || echo "   ‚ùå Failed"
    
    # Test 8: Update Bank Details
    echo -e "\n8. Testing Bank Details..."
    curl -s -X PUT $BASE_URL/users/account-details \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "bankName": "Test Bank",
        "accountName": "Test User",
        "accountNumber": "1234567890"
      }' | grep -o '"success":[^,]*' || echo "   ‚ùå Failed"
    
    # Test 9: Get Wallet Balance
    echo -e "\n9. Testing Wallet Balance..."
    curl -s $BASE_URL/wallet/balance \
      -H "Authorization: Bearer $TOKEN" | grep -o '"success":[^,]*' || echo "   ‚ùå Failed"
    
else
    echo "   ‚ùå Registration failed"
fi

# Test 10: Get Leaderboard (public)
echo -e "\n10. Testing Leaderboard..."
curl -s $BASE_URL/users/leaderboard | grep -o '"success":[^,]*' || echo "   ‚ùå Failed"

echo -e "\n======================================"
echo "‚úÖ Enhanced Backend Testing Complete!"
echo "Ì¥ó Server: http://localhost:3000"
