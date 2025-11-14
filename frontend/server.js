require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();

// CORS Setup
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:8080";

app.use(
  cors({
    origin: FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json());

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Database Connected Successfully!"))
  .catch((err) => console.error("Database Connection Failed:", err.message));

// User Model
const UserSchema = new mongoose.Schema({
  name: String,
  mobile: { type: String, unique: true },
  password: String,
  balance: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
});

const User = mongoose.model("User", UserSchema);

// Transaction Model
const TransactionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  related_mobile: String,
  amount: Number,
  type: {
    type: String,
    enum: ["INTERNAL_TRANSFER", "WITHDRAW", "DEPOSIT", "API_PAYOUT"],
  },
  status: {
    type: String,
    enum: ["COMPLETED", "PENDING", "FAILED"],
    default: "COMPLETED",
  },
  created_at: { type: Date, default: Date.now },
});

const Transaction = mongoose.model("Transaction", TransactionSchema);

// Auth Middleware
function protect(req, res, next) {
  let token;
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ message: "Session expired. Please login again." });
  }
}

// Register
app.post("/register", async (req, res) => {
  const { name, mobile, password } = req.body;

  try {
    let user = await User.findOne({ mobile });
    if (user) {
      return res
        .status(409)
        .json({ message: "User already exists with this mobile." });
    }

    user = new User({
      name,
      mobile,
      password,
      balance: 1000,
    });

    await user.save();
    res.status(201).json({ message: "Registration successful." });
  } catch (err) {
    res.status(500).json({ message: "Server error during registration." });
  }
});

// Login
app.post("/login", async (req, res) => {
  const { mobile, password } = req.body;

  try {
    const user = await User.findOne({ mobile });
    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const payload = { user: { id: user.id, mobile: user.mobile } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ message: "Login successful", token, userId: user.id });
  } catch (err) {
    res.status(500).json({ message: "Server error during login." });
  }
});

// Check Balance
app.get("/profile/balance", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("balance");
    res.json({ balance: user.balance });
  } catch (err) {
    res.status(500).json({ message: "Error fetching balance." });
  }
});

// Internal Transfer
app.post("/transfer-internal", protect, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { recipient_mobile, amount } = req.body;

    const sender = await User.findById(req.user.id).session(session);
    const recipient = await User.findOne({ mobile: recipient_mobile }).session(
      session
    );

    if (!recipient) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Recipient not found." });
    }

    const transferAmount = parseFloat(amount);

    if (sender.balance < transferAmount) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Insufficient balance." });
    }

    sender.balance -= transferAmount;
    recipient.balance += transferAmount;

    await sender.save({ session });
    await recipient.save({ session });

    await Transaction.create(
      [
        {
          user_id: sender.id,
          related_mobile: recipient_mobile,
          amount: -transferAmount,
          type: "INTERNAL_TRANSFER",
        },
        {
          user_id: recipient.id,
          related_mobile: sender.mobile,
          amount: transferAmount,
          type: "INTERNAL_TRANSFER",
        },
      ],
      { session }
    );

    await session.commitTransaction();

    res.json({
      message: "Transfer successful.",
      new_balance: sender.balance,
    });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ message: "Transaction failed." });
  } finally {
    session.endSession();
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
