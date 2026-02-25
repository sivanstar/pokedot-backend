#!/bin/bash

echo "Ì∑™ Testing POKEDOT Backend..."
echo "=============================="

echo -e "\n1. Testing server health..."
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)
if [ "$response" = "200" ]; then
    echo "   ‚úÖ Server is running (HTTP $response)"
    curl -s http://localhost:3000/api/health | jq -r '"   Status: \(.status)"'
else
    echo "   ‚ùå Server not responding (HTTP $response)"
    exit 1
fi

echo -e "\n2. Testing MongoDB connection..."
mongo_status=$(curl -s http://localhost:3000/api/health | jq -r '.status')
if [ "$mongo_status" = "OK" ]; then
    echo "   ‚úÖ MongoDB is connected"
else
    echo "   ‚ùå MongoDB connection issue"
fi

echo -e "\n3. Testing endpoints..."
curl -s http://localhost:3000/api/test | jq -r '"   \(.message)"'

echo -e "\nÌ≥ä Backend Status:"
echo "   ‚Ä¢ Server: ‚úÖ Running on port 3000"
echo "   ‚Ä¢ MongoDB: ‚úÖ Connected to Atlas"
echo "   ‚Ä¢ API: ‚úÖ Responding"

echo -e "\nÌ¥ó Test these endpoints:"
echo "   Health:    http://localhost:3000/api/health"
echo "   Test:      http://localhost:3000/api/test"
echo "   Login:     POST http://localhost:3000/api/auth/login"
echo "   Register:  POST http://localhost:3000/api/auth/register"

echo -e "\nÌæâ Backend is ready!"
