const express = require('express');
const router = express.Router();
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');

router.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

router.post('/signup', async (req, res) => {
  try {
    const { name, surname, birthYear, email, password } = req.body;
    const user = new User({ name, surname, birthYear, email, password });
    await user.save();
    res.redirect('/login');
  } catch (error) {
    res.status(500).send('Error signing up');
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user && await user.comparePassword(password)) {
    req.session.userId = user._id;
    const receiverId = 'ACTUAL_RECEIVER_ID'; // Replace with actual logic to get receiverId
    res.send(`<script>
                localStorage.setItem('userId', '${user._id}');
                localStorage.setItem('receiverId', '${receiverId}');
                window.location.href = '/profile';
              </script>`);
  } else {
    res.status(401).send('Invalid credentials');
  }
});

router.post('/profile', async (req, res) => {
  if (!req.session.userId) return res.status(401).send('Unauthorized');

  const { name, surname, birthYear } = req.body;
  await User.findByIdAndUpdate(req.session.userId, { name, surname, birthYear });
  res.redirect('/profile');
});

router.get('/profile', (req, res) => {
  if (!req.session.userId) return res.status(401).send('Unauthorized');
  res.sendFile(path.join(__dirname, '../views/profile.html'));  // Serve profile.html file
});

router.get('/logout', (req, res) => {
  if (req.session.userId) {
    const userId = req.session.userId;
    delete onlineUsers[userId]; // Remove the user from the onlineUsers object
    io.emit('updateUserStatuses', onlineUsers); // Notify all clients about the updated statuses
  }

  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;