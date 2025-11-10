// IMPORTANT: Set this to your actual Backend Registration API URL
const BACKEND_REGISTER_URL = 'YOUR_BACKEND_API_URL/register'; 

// 1. Get elements
const registerForm = document.getElementById('register-form'); 
const nameInput = document.getElementById('name');
const mobileInput = document.getElementById('mobile');
const passwordInput = document.getElementById('password');
const messageDisplay = document.getElementById('message');
const registerButton = document.getElementById('register-btn');


// 2. Add form submission listener
registerForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // Stop the browser from submitting the form

    const name = nameInput.value.trim();
    const mobile = mobileInput.value.trim();
    const password = passwordInput.value;

    // Client-side validation
    if (!name || mobile.length !== 10 || password.length < 6) {
        messageDisplay.style.color = '#dc3545';
        messageDisplay.textContent = 'Please check your inputs (Mobile must be 10 digits, Password min 6 chars).';
        messageDisplay.style.display = 'block';
        return;
    }

    // Prepare data
    const registrationData = {
        name: name,
        mobile: mobile,
        password: password
    };

    messageDisplay.textContent = 'Registering user...';
    messageDisplay.style.color = '#007bff';
    messageDisplay.style.display = 'block';
    registerButton.disabled = true;

    try {
        // 3. Send data to the Backend
        const response = await fetch(BACKEND_REGISTER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(registrationData)
        });

        const result = await response.json();

        // 4. Handle the response
        if (response.ok) {
            messageDisplay.style.color = '#28a745'; // Green for success
            messageDisplay.textContent = `Registration successful! Redirecting to login...`;
            // Redirect the user to the login page after a short delay
            setTimeout(() => {
                window.location.href = 'login.html'; 
            }, 2000); 

        } else {
            // Display error message from the server
            messageDisplay.style.color = '#dc3545'; // Red for error
            messageDisplay.textContent = `Registration failed: ${result.message || 'Server error'}`;
        }

    } catch (error) {
        console.error('Network Error:', error);
        messageDisplay.style.color = '#dc3545';
        messageDisplay.textContent = 'Could not connect to the server.';
    } finally {
        registerButton.disabled = false;
    }
});