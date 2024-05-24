const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Message = require('../models/message');

// Create a new user
router.post('/users', async (req, res) => {
  try {
    const { name, surname, birthYear, email, password } = req.body;
    const user = new User({ name, surname, birthYear, email, password });
    await user.save();
    res.status(201).send({ message: 'User created successfully', user });
  } catch (error) {
    res.status(500).send({ error: 'Error creating user', details: error });
  }
});

router.get('/users', async (req, res) => {
  if (!req.session.userId) return res.status(401).send('Unauthorized');

  try {
    const users = await User.find({ _id: { $ne: req.session.userId } }).select('_id name');

    const usersWithUnreadCount = await Promise.all(users.map(async (user) => {
      const unreadMessageCount = await Message.countDocuments({
        sender: user._id,
        receiver: req.session.userId,
        isRead: false
      });
      return { ...user.toObject(), unreadMessageCount };
    }));

    res.json(usersWithUnreadCount);
  } catch (error) {
    res.status(500).send('Server error');
  }
});

router.get('/messages', async (req, res) => {
  const { senderId, receiverId } = req.query;
  if (!req.session.userId || (req.session.userId !== senderId && req.session.userId !== receiverId)) {
    return res.status(401).send('Unauthorized');
  }

  try {
    const messages = await Message.find({
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId }
      ]
    }).sort({ timestamp: 1 }).populate('sender', 'name').populate('receiver', 'name');

    res.json(messages);
  } catch (error) {
    res.status(500).send('Server error');
  }
});

router.post('/messages/read', async (req, res) => {
  const { senderId, receiverId } = req.query;
  if (!req.session.userId || req.session.userId !== receiverId) {
    return res.status(401).send('Unauthorized');
  }

  try {
    await Message.updateMany(
      { sender: senderId, receiver: receiverId, isRead: false },
      { $set: { isRead: true } }
    );
    res.status(200).send('Messages marked as read');
  } catch (error) {
    res.status(500).send('Server error');
  }
});

router.post('/messages', async (req, res) => {
  if (!req.session.userId) return res.status(401).send('Unauthorized');

  try {
    const { senderId, receiverId, content } = req.body;
    const message = new Message({ sender: senderId, receiver: receiverId, content, isRead: false });
    await message.save();
    res.status(201).send('Message sent');
  } catch (error) {
    res.status(500).send('Server error');
  }
});

module.exports = router;