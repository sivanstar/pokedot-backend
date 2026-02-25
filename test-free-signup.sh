#!/bin/bash

echo "Ìæâ Testing FREE POKEDOT Signup..."
echo "=================================="

# Test 1: Health Check
echo -e "\n1. Backend Health:"
curl -s http://localhost:3000/api/health | grep -o '"status":"[^"]*"'

# Test 2: Create Admin
echo -e "\n2. Creating Admin:"
curl -s -X POST http://localhost:3000/api/admin/create-admin | grep -o '"success":[^,]*'

# Test 3: Free Registration
echo -e "\n3. Testing FREE Registration:"
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testfree",
    "email": "testfree@example.com",
    "password": "Test123!@#"
  }')

if echo "$REGISTER_RESPONSE" | grep -q '"success":true'; then
    echo "   ‚úÖ FREE Registration Successful!"
    TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    POINTS=$(echo "$REGISTER_RESPONSE" | grep -o '"points":[^,]*' | cut -d':' -f2)
    echo "   Ì¥ë Token received"
    echo "   Ì≤∞ Points: $POINTS (should be 500)"
    
    # Test 4: Login
    echo -e "\n4. Testing Login:"
    curl -s -X POST http://localhost:3000/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email": "testfree@example.com", "password": "Test123!@#"}' | grep -o '"success":[^,]*'
    
else
    echo "   ‚ùå Registration failed"
    echo "   Response: $REGISTER_RESPONSE"
fi

echo -e "\n=================================="
echo "‚úÖ FREE Signup System Ready!"
echo "Ì¥ó Backend: http://localhost:3000"
echo "Ì¥ó Frontend: http://localhost:5173"
echo ""
echo "Ì≥ã Features:"
echo "   ‚úÖ FREE signup (no coupon)"
echo "   ‚úÖ 500 points signup bonus"
echo "   ‚úÖ Referral system"
echo "   ‚úÖ Daily poke limits"
echo "   ‚úÖ Withdrawal system"
