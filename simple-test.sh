#!/bin/bash

echo "í·ª Testing Backend (No jq Required)..."
echo "======================================"

BASE_URL="http://localhost:3000/api"

# Test 1: Health Check
echo -e "\n1. Testing Health Check..."
curl -s $BASE_URL/health
echo ""

# Test 2: Test Endpoint
echo -e "\n2. Testing API Endpoint..."
curl -s $BASE_URL/test
echo ""

# Test 3: Check Coupon
echo -e "\n3. Testing Coupon Check..."
curl -s -X POST $BASE_URL/auth/check-coupon \
  -H "Content-Type: application/json" \
  -d '{"couponCode": "WELCOME500"}'
echo ""

# Test 4: Register User
echo -e "\n4. Testing Registration..."
echo '{
  "username": "testuser2",
  "email": "test2@example.com",
  "password": "Test123!@#",
  "couponCode": "WELCOME500"
}' | curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d @-
echo ""

echo "======================================"
echo "âœ… Testing Complete!"
