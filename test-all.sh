#!/bin/bash

echo "í·ª COMPLETE POKEDOT BACKEND TEST"
echo "================================"

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5NzllMjQwZTZjMGMwMDJiN2U4MTljYiIsImlhdCI6MTc2OTU5NTQ1NywiZXhwIjoxNzcwMjAwMjU3fQ.N3VFJr_HSMQLFIbC_17vxbEYVg0PSOiCZUFWczGGA5Q"

echo -e "\n1. Testing Health Check..."
curl -s http://localhost:3000/api/health | grep -o '"status":"[^"]*"'

echo -e "\n2. Testing Profile..."
curl -s http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer $TOKEN" | grep -o '"success":[^,]*'

echo -e "\n3. Testing Available Users..."
curl -s http://localhost:3000/api/users/available \
  -H "Authorization: Bearer $TOKEN" | grep -o '"success":[^,]*'

echo -e "\n4. Testing Wallet Balance..."
curl -s http://localhost:3000/api/wallet/balance \
  -H "Authorization: Bearer $TOKEN" | grep -o '"success":[^,]*'

echo -e "\n5. Testing Daily Limits..."
curl -s http://localhost:3000/api/users/daily-limits \
  -H "Authorization: Bearer $TOKEN" | grep -o '"success":[^,]*'

echo -e "\n6. Testing Leaderboard (public)..."
curl -s http://localhost:3000/api/users/leaderboard | grep -o '"success":[^,]*'

echo -e "\n7. Testing Bank Details Update..."
curl -s -X PUT http://localhost:3000/api/users/account-details \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bankName": "Zenith Bank",
    "accountName": "John Doe",
    "accountNumber": "1234567890"
  }' | grep -o '"success":[^,]*'

echo -e "\n8. Testing Registration (new user)..."
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newtestuser",
    "email": "newtest@example.com",
    "password": "NewTest123!",
    "couponCode": "WELCOME500"
  }' | grep -o '"success":[^,]*'

echo -e "\n9. Testing Poke System..."
# First get a user to poke
USER_TO_POKE=$(curl -s http://localhost:3000/api/users/available \
  -H "Authorization: Bearer $TOKEN" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$USER_TO_POKE" ]; then
  echo "   Found user to poke: $USER_TO_POKE"
  curl -s -X POST http://localhost:3000/api/poke/users/$USER_TO_POKE/poke \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"adTaskId": "ad123"}' | grep -o '"success":[^,]*'
else
  echo "   No users available to poke"
fi

echo -e "\n================================"
echo "âœ… ALL TESTS COMPLETED!"
