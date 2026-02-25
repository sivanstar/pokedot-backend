@echo off
echo Testing POKEDOT Backend...
echo ============================

echo.
echo 1. Testing Health Check...
curl http://localhost:3000/api/health
echo.

echo.
echo 2. Testing API Endpoint...
curl http://localhost:3000/api/test
echo.

echo.
echo 3. Testing Coupon Check...
curl -X POST http://localhost:3000/api/auth/check-coupon ^
  -H "Content-Type: application/json" ^
  -d "{\"couponCode\": \"WELCOME500\"}"
echo.

echo.
echo 4. Testing Registration...
curl -X POST http://localhost:3000/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"username\": \"windows_user\", \"email\": \"windows@example.com\", \"password\": \"Test123!@#\", \"couponCode\": \"WELCOME500\"}"
echo.

echo.
echo ============================
echo Test Complete!
pause
