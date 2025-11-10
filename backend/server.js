// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken'); 
// const bcrypt = require('bcryptjs'); // UNCOMMENT THIS FOR PRODUCTION (for password hashing)

const app = express();

// --- 1. Middleware Setup ---

// CRITICAL: Get FRONTEND_URL from Render Environment Variables for CORS
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';

app.use(cors({
    origin: FRONTEND_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
}));

// Body Parser: Allows server to read JSON data from the frontend
app.use(express.json());

// --- 2. Database Connection ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Database Connected Successfully!'))
    .catch(err => console.error('Database Connection Failed:', err.message));


// --- 3. Database Schemas (Models) ---

// A. User Model
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    mobile: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Should store HASHED password in production
    balance: { type: Number, default: 0.00 },
    created_at: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

// B. Transaction Model
const TransactionSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    related_mobile: { type: String, required: true }, 
    amount: { type: Number, required: true }, // Positive for credit, Negative for debit
    type: { type: String, enum: ['INTERNAL_TRANSFER', 'WITHDRAW', 'DEPOSIT', 'API_PAYOUT'], required: true },
    status: { type: String, enum: ['COMPLETED', 'PENDING', 'FAILED'], default: 'COMPLETED' },
    created_at: { type: Date, default: Date.now }
});
const Transaction = mongoose.model('Transaction', TransactionSchema);


// --- 4. Authentication Middleware ---
// Protects routes using JWT token
function protect(req, res, next) {
    let token;
    // Get token from header (Format: Bearer <token>)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, login required.' });
    }

    try {
        // Verify token using the JWT_SECRET
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user; // Attach user ID and mobile to the request
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Session expired or token invalid. Please log in again.' });
    }
}


// --- 5. API Endpoints ---

// A. Registration Endpoint
app.post('/register', async (req, res) => {
    const { name, mobile, password } = req.body;

    try {
        let user = await User.findOne({ mobile });
        if (user) {
            return res.status(409).json({ message: 'User already exists with this mobile number.' });
        }

        // TODO: In production, hash the password using bcryptjs before saving!
        
        user = new User({
            name,
            mobile,
            password: password, // WARNING: Store HASHED password in production!
            balance: 1000.00 // Testing: Giving initial balance
        });

        await user.save();
        res.status(201).json({ message: 'Registration successful. Please log in.' });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});


// B. Login Endpoint
app.post('/login', async (req, res) => {
    const { mobile, password } = req.body;

    try {
        const user = await User.findOne({ mobile });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // TODO: In production, use bcrypt.compare(password, user.password)
        if (password !== user.password) { // For testing: Plain text compare
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Create JWT Token
        const payload = { user: { id: user.id, mobile: user.mobile } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({
            message: 'Login successful',
            token: token,
            userId: user.id
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error during login.' });
    }
});


// C. Get User Balance Endpoint (Protected Route)
app.get('/profile/balance', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('balance');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json({ balance: user.balance });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Error fetching balance.' });
    }
});


// D. Internal Transfer Endpoint (Protected Route) - The core logic
app.post('/transfer-internal', protect, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction(); // Start database transaction for safety

    try {
        const { recipient_mobile, amount } = req.body;
        const senderId = req.user.id;
        const transferAmount = parseFloat(amount);

        // Find users within the transaction session
        const sender = await User.findById(senderId).session(session);
        const recipient = await User.findOne({ mobile: recipient_mobile }).session(session);

        if (!recipient) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Recipient mobile number not found in the system.' });
        }
        if (sender.balance < transferAmount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Insufficient balance.' });
        }
        
        // 1. Debit Sender
        sender.balance -= transferAmount;
        await sender.save({ session });

        // 2. Credit Recipient
        recipient.balance += transferAmount;
        await recipient.save({ session });

        // 3. Log Transactions (Atomic Operation)
        
        // Sender's Log (DEBIT)
        await Transaction.create([{
            user_id: senderId,
            related_mobile: recipient_mobile,
            amount: -transferAmount,
            type: 'INTERNAL_TRANSFER',
        }], { session });
        
        // Recipient's Log (CREDIT)
        await Transaction.create([{
            user_id: recipient.id,
            related_mobile: sender.mobile,
            amount: transferAmount,
            type: 'INTERNAL_TRANSFER',
        }], { session });

        
        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ 
            message: 'Internal transfer successful!',
            new_balance: sender.balance.toFixed(2)
        });

    } catch (err) {
        await session.abortTransaction(); // Revert changes if error occurs
        session.endSession();
        console.error('Transaction Failed:', err.message);
        res.status(500).json({ message: 'Transaction failed due to server error. Please try again.' });
    }
});


// --- 6. Server Start ---
// Render will provide the PORT environment variable
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
