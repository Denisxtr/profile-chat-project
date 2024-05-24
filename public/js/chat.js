document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  const userId = localStorage.getItem('userId'); // Retrieve the user ID from local storage
  let currentChatUserId = null; // The ID of the user you are currently chatting with

  // Notification sound
  const notificationSound = new Audio('/js/notification.mp3');

  // Join room on connect
  socket.emit('joinRoom', userId);

  const searchInput = document.getElementById('searchInput');
  const userList = document.getElementById('userList');
  const chatBox = document.getElementById('chatBox');
  const chatInput = document.getElementById('chatInput');
  const sendButton = document.getElementById('sendButton');
  const typingIndicator = document.getElementById('typingIndicator');

  let typingTimeout;

  // Fetch and display the list of users
  async function fetchUsers() {
    const response = await fetch('/api/users');
    const users = await response.json();
    userList.innerHTML = '';
    users.forEach(user => {
      const userElement = document.createElement('li');
      userElement.textContent = user.name;
      userElement.dataset.userId = user._id;

      const statusIndicator = document.createElement('span');
      statusIndicator.className = 'status-indicator';
      userElement.appendChild(statusIndicator);

      if (user.unreadMessageCount > 0) {
        const unreadNotification = document.createElement('span');
        unreadNotification.className = 'unread-notification';
        unreadNotification.textContent = ` (${user.unreadMessageCount > 9 ? '9+' : user.unreadMessageCount})`;
        userElement.appendChild(unreadNotification);
      }

      userElement.addEventListener('click', () => {
        currentChatUserId = user._id;
        localStorage.setItem('receiverId', currentChatUserId);
        chatBox.innerHTML = '';
        fetchMessages(); // Fetch and display messages between the current user and the selected user

        // Clear unread count when starting to chat with a user
        const unreadNotification = userElement.querySelector('.unread-notification');
        if (unreadNotification) {
          unreadNotification.remove();
        }
      });

      userList.appendChild(userElement);
    });

    // Emit an event to request online statuses
    socket.emit('requestUserStatuses');
  }

  fetchUsers();

  // Filter users based on search input
  searchInput.addEventListener('input', () => {
    const filter = searchInput.value.toLowerCase();
    const users = userList.getElementsByTagName('li');
    for (let i = 0; i < users.length; i++) {
      const txtValue = users[i].textContent || users[i].innerText;
      if (txtValue.toLowerCase().indexOf(filter) > -1) {
        users[i].style.display = '';
      } else {
        users[i].style.display = 'none';
      }
    }
  });

  // Send message
  const sendMessage = () => {
    const content = chatInput.value;
    if (content && currentChatUserId) {
      socket.emit('sendMessage', { senderId: userId, receiverId: currentChatUserId, content });
      chatInput.value = '';
      socket.emit('stopTyping', { senderId: userId, receiverId: currentChatUserId });
    } else {
      alert('Please select a user to chat with and enter a message');
    }
  };

  sendButton.addEventListener('click', sendMessage);

  chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault(); // Prevent newline in input
      sendMessage();
    } else {
      socket.emit('typing', { senderId: userId, receiverId: currentChatUserId });
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        socket.emit('stopTyping', { senderId: userId, receiverId: currentChatUserId });
      }, 1000);
    }
  });

  // Receive message
  socket.on('receiveMessage', (data) => {
    const { senderId, senderName, receiverId: messageReceiverId, receiverName, content, timestamp } = data;

    // Check if the message is from the currently chatting user
    if ((senderId === userId && messageReceiverId === localStorage.getItem('receiverId')) ||
        (messageReceiverId === userId && senderId === localStorage.getItem('receiverId'))) {
      const messageElement = document.createElement('div');
      messageElement.textContent = `${new Date(timestamp).toLocaleTimeString()} - ${senderName}: ${content}`;
      chatBox.appendChild(messageElement);
      chatBox.scrollTop = chatBox.scrollHeight;
    } else {
      // Play notification sound for messages from other users
      notificationSound.play();
    }

    // Update unread message count only for the recipient
    if (messageReceiverId === userId && senderId !== currentChatUserId) {
      fetchUsers(); // Refresh the user list to update the unread count
    }

    // Mark messages as read if the current user is in the chat with the sender
    if (messageReceiverId === userId && senderId === currentChatUserId) {
      markMessagesAsRead(senderId);
    }
  });

  // Function to mark messages as read
  async function markMessagesAsRead(senderId) {
    await fetch(`/api/messages/read?senderId=${senderId}&receiverId=${userId}`, {
      method: 'POST'
    });
    fetchUsers(); // Refresh the user list to update the unread count
  }

  // Handle typing indicator
  socket.on('typing', (data) => {
    if (data.receiverId === userId && data.senderId === currentChatUserId) {
      typingIndicator.textContent = `${data.senderName} is typing...`;
    }
  });

  socket.on('stopTyping', (data) => {
    if (data.receiverId === userId && data.senderId === currentChatUserId) {
      typingIndicator.textContent = '';
    }
  });

  // Handle online status updates
  socket.on('updateUserStatuses', (users) => {
    const userElements = userList.getElementsByTagName('li');
    for (let i = 0; i < userElements.length; i++) {
      const userElement = userElements[i];
      const userId = userElement.dataset.userId;
      const statusIndicator = userElement.querySelector('.status-indicator');
      if (users[userId] === 'online') {
        statusIndicator.textContent = ' (Online)';
        statusIndicator.style.color = 'green';
      } else {
        statusIndicator.textContent = ' (Offline)';
        statusIndicator.style.color = 'red';
      }
    }
  });

  // Fetch and display messages between the current user and the selected user
  async function fetchMessages() {
    if (currentChatUserId) {
      const response = await fetch(`/api/messages?senderId=${userId}&receiverId=${currentChatUserId}`);
      const messages = await response.json();
      chatBox.innerHTML = '';
      messages.forEach(message => {
        const messageElement = document.createElement('div');
        messageElement.textContent = `${new Date(message.timestamp).toLocaleTimeString()} - ${message.sender.name}: ${message.content}`;
        chatBox.appendChild(messageElement);
      });
      chatBox.scrollTop = chatBox.scrollHeight;

      // Mark messages as read
      await markMessagesAsRead(currentChatUserId);

      // Update unread message count
      fetchUsers();
    }
  }

  // Handle page unload event
  window.addEventListener('beforeunload', () => {
    socket.disconnect();
  });
});