@echo off
echo í·ª SIMPLE BACKEND TEST
echo ======================

echo.
echo 1. Testing Backend Health...
curl http://localhost:3000/api/health

echo.
echo 2. Testing Registration...
curl -X POST http://localhost:3000/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"simpletest\",\"email\":\"simple@test.com\",\"password\":\"Test123!\"}"

echo.
echo 3. Testing Login...
curl -X POST http://localhost:3000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"simple@test.com\",\"password\":\"Test123!\"}"

echo.
echo 4. Testing Leaderboard (Public)...
curl http://localhost:3000/api/users/leaderboard

echo.
echo âœ… Simple test complete!
echo Check above responses for success messages.
