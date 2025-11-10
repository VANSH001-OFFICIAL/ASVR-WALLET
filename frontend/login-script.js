// IMPORTANT: Set this to your actual Backend Login API URL
const BACKEND_LOGIN_URL = 'YOUR_BACKEND_API_URL/login'; 

// 1. Get elements
const loginForm = document.getElementById('login-form'); 
const mobileInput = document.getElementById('mobile');
const passwordInput = document.getElementById('password');
const messageDisplay = document.getElementById('message');
const loginButton = document.getElementById('login-btn');


// 2. Add form submission listener
loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const mobile = mobileInput.value.trim();
    const password = passwordInput.value;

    if (mobile.length !== 10 || password.length === 0) {
        messageDisplay.style.color = '#dc3545';
        messageDisplay.textContent = 'Please enter a valid mobile number and password.';
        messageDisplay.style.display = 'block';
        return;
    }

    messageDisplay.textContent = 'Logging in...';
    messageDisplay.style.color = '#007bff';
    messageDisplay.style.display = 'block';
    loginButton.disabled = true;

    const loginData = { mobile, password };

    try {
        // 3. Send data to the Backend
        const response = await fetch(BACKEND_LOGIN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(loginData)
        });

        const result = await response.json();

        // 4. Handle the response
        if (response.ok) {
            messageDisplay.style.color = '#28a745'; 
            messageDisplay.textContent = `Login successful! Redirecting...`;
            
            // CRITICAL: Save the token received from the server securely!
            // We use localStorage for simplicity, but better methods exist.
            localStorage.setItem('auth_token', result.token); 
            
            // Redirect to the main dashboard
            setTimeout(() => {
                window.location.href = 'index.html'; 
            }, 500); 

        } else {
            messageDisplay.style.color = '#dc3545';
            messageDisplay.textContent = `Login failed: ${result.message || 'Invalid credentials.'}`;
        }

    } catch (error) {
        console.error('Network Error:', error);
        messageDisplay.style.color = '#dc3545';
        messageDisplay.textContent = 'Could not connect to the server.';
    } finally {
        loginButton.disabled = false;
    }
});