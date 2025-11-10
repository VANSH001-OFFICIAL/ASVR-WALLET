// Define the URL of your internal transfer API endpoint
const BACKEND_TRANSFER_URL = 'YOUR_BACKEND_API_URL/transfer-internal'; 

// 1. Get elements
const payUserForm = document.getElementById('pay-user-form');
const recipientMobileInput = document.getElementById('recipient-mobile');
const sendAmountInput = document.getElementById('send-amount');
const sendMoneyButton = document.getElementById('send-money-btn');
const messageDisplay = document.getElementById('message');


// 2. Add form submission listener
payUserForm.addEventListener('submit', async (event) => {
    event.preventDefault(); 

    const recipientMobile = recipientMobileInput.value.trim();
    const amount = parseFloat(sendAmountInput.value);

    // Client-side validation
    if (recipientMobile.length !== 10 || amount <= 0) {
        messageDisplay.style.color = '#dc3545';
        messageDisplay.textContent = 'Please enter a valid 10-digit mobile number and amount.';
        messageDisplay.style.display = 'block';
        return;
    }

    messageDisplay.textContent = 'Initiating transfer...';
    messageDisplay.style.color = '#007bff';
    messageDisplay.style.display = 'block';
    sendMoneyButton.disabled = true;

    // Prepare data
    const transferData = {
        recipient_mobile: recipientMobile,
        amount: amount,
        // The sender's ID must be sent from the client or determined by the server using an auth token
    };

    try {
        // 3. Send data to the Backend
        const response = await fetch(BACKEND_TRANSFER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // IMPORTANT: In a real app, an Authorization Token must be sent here
                // 'Authorization': 'Bearer YOUR_AUTH_TOKEN' 
            },
            body: JSON.stringify(transferData)
        });

        const result = await response.json();

        // 4. Handle the response
        if (response.ok) {
            messageDisplay.style.color = '#28a745'; // Green for success
            messageDisplay.textContent = `Success! ₹${amount} transferred to ${recipientMobile}. New Balance: ₹${result.new_balance}`;
            // Clear fields
            recipientMobileInput.value = '';
            sendAmountInput.value = '';
        } else {
            messageDisplay.style.color = '#dc3545'; // Red for error
            messageDisplay.textContent = `Transfer failed: ${result.message || 'Server error'}`;
        }

    } catch (error) {
        console.error('Network Error:', error);
        messageDisplay.style.color = '#dc3545';
        messageDisplay.textContent = 'Could not connect to the server.';
    } finally {
        sendMoneyButton.disabled = false;
    }
});