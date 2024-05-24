const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const Message = require('./models/message');
const User = require('./models/user');
var cors = require('cors')
const onlineUsers = {};
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors())
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static('uploads')); // Serve the uploads directory

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', authRoutes);
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/index.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/signup.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/login.html'));
});

app.get('/profile', (req, res) => {
  if (!req.session.userId) return res.status(401).send('Unauthorized');
  res.sendFile(path.join(__dirname, 'views/profile.html'));
});

app.get('/chat', (req, res) => {
  if (!req.session.userId) return res.status(401).send('Unauthorized');
  res.sendFile(path.join(__dirname, 'views/chat.html'));
});

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('joinRoom', (userId) => {
    socket.userId = userId; // Attach userId to socket
    socket.join(userId); // Join the room with the userId
    onlineUsers[userId] = 'online';
    io.emit('updateUserStatuses', onlineUsers); // Notify all clients about the updated statuses
  });

  socket.on('sendMessage', async ({ senderId, receiverId, content }) => {
    try {
      const message = new Message({ sender: senderId, receiver: receiverId, content, timestamp: new Date() });
      await message.save();

      const sender = await User.findById(senderId);
      const receiver = await User.findById(receiverId);

      const messageData = {
        senderId,
        senderName: sender.name,
        receiverId,
        receiverName: receiver.name,
        content,
        timestamp: message.timestamp
      };

      // Emit to sender
      socket.emit('receiveMessage', messageData);

      // Emit to receiver
      io.to(receiverId).emit('receiveMessage', messageData);
    } catch (error) {
      console.error('Error saving message:', error);
    }
  });

  socket.on('typing', async ({ senderId, receiverId }) => {
    const sender = await User.findById(senderId);
    io.to(receiverId).emit('typing', { senderId, receiverId, senderName: sender.name });
  });

  socket.on('stopTyping', ({ senderId, receiverId }) => {
    io.to(receiverId).emit('stopTyping', { senderId, receiverId });
  });

  socket.on('requestUserStatuses', () => {
    socket.emit('updateUserStatuses', onlineUsers);
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      delete onlineUsers[socket.userId];
      io.emit('updateUserStatuses', onlineUsers); // Notify all clients about the updated statuses
    }
    console.log('user disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});