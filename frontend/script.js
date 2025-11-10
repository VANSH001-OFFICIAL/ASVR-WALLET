// Define the URL of your Backend API endpoint for withdrawals
// IMPORTANT: You MUST change this to your actual server address (e.g., http://localhost:3000/api/withdraw)
const BACKEND_WITHDRAW_URL = 'YOUR_BACKEND_API_URL/withdraw'; 

// 1. Get the necessary elements using their IDs
const withdrawButton = document.getElementById('withdraw-btn'); 
const amountInput = document.getElementById('amount');
const upiInput = document.getElementById('upi_id');
const messageDisplay = document.getElementById('message');

// 2. Add an event listener to the Withdraw button
withdrawButton.addEventListener('click', async (event) => {
    // Prevent the default browser action
    event.preventDefault(); 
    
    const amount = amountInput.value.trim();
    const upiId = upiInput.value.trim();

    // Basic client-side validation
    if (!amount || !upiId || parseFloat(amount) <= 0) {
        alert('Please enter a valid Amount and UPI ID.');
        return;
    }

    // Show processing message and disable the button
    messageDisplay.textContent = 'Processing withdrawal...';
    messageDisplay.style.display = 'block';
    withdrawButton.disabled = true;

    // Prepare the data
    const withdrawalData = {
        amount: parseFloat(amount),
        upi_id: upiId,
        // In a real application, a secure token/session ID would be included here
    };

    try {
        // 3. Send the data to the Backend using the Fetch API
        const response = await fetch(BACKEND_WITHDRAW_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 'Authorization': 'Bearer YOUR_AUTH_TOKEN' // For security
            },
            body: JSON.stringify(withdrawalData)
        });

        const result = await response.json();

        // 4. Handle the response
        if (response.ok) {
            messageDisplay.style.color = '#28a745'; // Green for success
            messageDisplay.textContent = `Success! Transaction ID: ${result.transaction_id || 'N/A'}. New Balance: ₹${result.new_balance || 'N/A'}`;
            
            // Clear the form fields upon success
            amountInput.value = '';
            upiInput.value = '';
            
            // Optional: You would also update the balance displayed in the topbar here
        } else {
            // Error handling from the server
            messageDisplay.style.color = '#dc3545'; // Red for error
            messageDisplay.textContent = `Withdrawal failed: ${result.message || 'Server error occurred.'}`;
        }

    } catch (error) {
        // Handle network errors
        console.error('Network Error:', error);
        messageDisplay.style.color = '#dc3545';
        messageDisplay.textContent = 'Could not connect to the server. Please check your connection.';
    } finally {
        // Re-enable the button
        withdrawButton.disabled = false;
    }
});