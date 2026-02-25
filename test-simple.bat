@echo off
echo COMPLETE POKEDOT BACKEND TEST
echo =================================

set BASE_URL=http://localhost:3000/api

echo.
echo 1. SYSTEM STATUS
echo -----------------
curl %BASE_URL%/health

echo.
echo 2. DATABASE SEEDING
echo ---------------------
curl -X POST %BASE_URL%/admin/seed

echo.
echo 3. COUPON VALIDATION
echo ------------------------
curl -X POST %BASE_URL%/auth/check-coupon ^
  -H "Content-Type: application/json" ^
  -d "{\"couponCode\": \"WELCOME500\"}"

echo.
echo 4. USER REGISTRATION
echo ------------------------
echo Registering test user...
curl -X POST %BASE_URL%/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"username\": \"testuser_%time:~6,2%\", \"email\": \"test%time:~6,2%@example.com\", \"password\": \"Test123!@#\", \"couponCode\": \"WELCOME500\"}"

echo.
echo Note: Copy the token from above response and test manually:
echo.
echo To test profile: curl %BASE_URL%/auth/profile -H "Authorization: Bearer YOUR_TOKEN"
echo To test users: curl %BASE_URL%/users/available -H "Authorization: Bearer YOUR_TOKEN"
echo To test wallet: curl %BASE_URL%/wallet/balance -H "Authorization: Bearer YOUR_TOKEN"
echo.
echo 5. PUBLIC LEADERBOARD
echo ------------------------
curl %BASE_URL%/users/leaderboard

echo.
echo =================================
echo TEST COMPLETE!
echo Backend URL: http://localhost:3000
pause
