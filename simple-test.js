const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

async function simpleTest() {
  console.log('Ì∑™ Simple Backend Test\n');
  
  try {
    // 1. Test health endpoint
    console.log('1. Testing health endpoint...');
    const health = await axios.get(`${API_URL}/health`);
    console.log(`   Status: ${health.data.status}`);
    console.log(`   Database: ${health.data.database}`);
    
    // 2. Test registration
    console.log('\n2. Testing registration...');
    try {
      const register = await axios.post(`${API_URL}/auth/register`, {
        username: `testuser_${Date.now()}`,
        email: `test_${Date.now()}@example.com`,
        password: 'Test123!'
      });
      console.log(`   Success: ${register.data.success}`);
      console.log(`   Message: ${register.data.message}`);
      console.log(`   Points: ${register.data.user?.points}`);
      
      // 3. Test login
      console.log('\n3. Testing login...');
      const login = await axios.post(`${API_URL}/auth/login`, {
        email: register.data.user?.email,
        password: 'Test123!'
      });
      console.log(`   Success: ${login.data.success}`);
      console.log(`   Token: ${login.data.token ? 'Received' : 'Missing'}`);
      
      if (login.data.token) {
        const token = login.data.token;
        
        // 4. Test profile
        console.log('\n4. Testing profile...');
        const profile = await axios.get(`${API_URL}/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`   Username: ${profile.data.user?.username}`);
        console.log(`   Points: ${profile.data.user?.points}`);
        
        // 5. Test daily limits
        console.log('\n5. Testing daily limits...');
        const limits = await axios.get(`${API_URL}/users/daily-limits`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`   Remaining sends: ${limits.data.limits?.remainingSends}`);
        console.log(`   Remaining receives: ${limits.data.limits?.remainingReceives}`);
        
        // 6. Test available users
        console.log('\n6. Testing available users...');
        const users = await axios.get(`${API_URL}/users/available`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`   Available users: ${users.data.users?.length || 0}`);
        
        if (users.data.users && users.data.users.length > 0) {
          // 7. Test poke (if users available)
          console.log('\n7. Testing poke...');
          const targetUser = users.data.users[0];
          try {
            const poke = await axios.post(
              `${API_URL}/poke/users/${targetUser._id}/poke`,
              { adTaskId: 'test-ad-123' },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log(`   Success: ${poke.data.success}`);
            console.log(`   Message: ${poke.data.message}`);
            console.log(`   Points earned: ${poke.data.pointsEarned}`);
          } catch (pokeError) {
            console.log(`   Poke failed: ${pokeError.response?.data?.message || pokeError.message}`);
          }
        }
      }
      
    } catch (regError) {
      console.log(`   Registration/Login failed: ${regError.response?.data?.message || regError.message}`);
    }
    
    // 8. Test leaderboard (public)
    console.log('\n8. Testing leaderboard (public)...');
    const leaderboard = await axios.get(`${API_URL}/users/leaderboard`);
    console.log(`   Total users in leaderboard: ${leaderboard.data.users?.length || 0}`);
    
    console.log('\n‚úÖ All tests completed!');
    
  } catch (error) {
    console.error('\n‚ùå Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

simpleTest();
