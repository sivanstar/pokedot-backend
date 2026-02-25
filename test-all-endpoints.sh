#!/bin/bash

echo "ÔøΩÔøΩ Testing POKEDOT Backend Endpoints..."
echo "========================================"

BASE_URL="http://localhost:3000/api"

# Test 1: Health Check
echo -e "\n1. Testing Health Check..."
response=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/health)
if [ "$response" = "200" ]; then
    curl -s $BASE_URL/health | jq -r '"   ‚úÖ Status: \(.status), Database: \(.database)"'
else
    echo "   ‚ùå Health check failed (HTTP $response)"
fi

# Test 2: Test Endpoint
echo -e "\n2. Testing API Endpoint..."
curl -s $BASE_URL/test | jq -r '"   ‚úÖ \(.message)"'

# Test 3: Check Coupon (Critical Business Rule)
echo -e "\n3. Testing Coupon Check..."
curl -s -X POST $BASE_URL/auth/check-coupon \
  -H "Content-Type: application/json" \
  -d '{"couponCode": "WELCOME500"}' | jq -r '"   ‚úÖ Valid: \(.valid), Code: \(.coupon.code)"'

# Test 4: Register a Test User
echo -e "\n4. Testing User Registration..."
REGISTER_RESPONSE=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_user_001",
    "email": "test001@example.com",
    "password": "Test123!@#",
    "couponCode": "WELCOME500"
  }')

if echo "$REGISTER_RESPONSE" | grep -q "success"; then
    echo "   ‚úÖ Registration successful!"
    TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.token')
    USERNAME=$(echo "$REGISTER_RESPONSE" | jq -r '.user.username')
    POINTS=$(echo "$REGISTER_RESPONSE" | jq -r '.user.points')
    echo "   Ì±§ User: $USERNAME"
    echo "   Ì≤∞ Points: $POINTS"
    echo "   Ì¥ë Token: ${TOKEN:0:20}..."
    
    # Test 5: Get User Profile
    echo -e "\n5. Testing Profile Retrieval..."
    curl -s $BASE_URL/auth/profile \
      -H "Authorization: Bearer $TOKEN" | jq -r '"   ‚úÖ Username: \(.user.username), Points: \(.user.points)"'
    
else
    echo "   ‚ùå Registration failed"
    echo "   Response: $REGISTER_RESPONSE"
fi

echo -e "\n========================================"
echo "Ìæâ Backend API Testing Complete!"
echo "Ì¥ó Server: http://localhost:3000"
echo "Ì≥ö API Documentation:"
echo "   - GET  /api/health          - Health check"
echo "   - POST /api/auth/register   - Register user"
echo "   - POST /api/auth/login      - Login"
echo "   - POST /api/auth/check-coupon - Validate coupon"
