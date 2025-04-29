const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// Enable CORS for all routes
app.use(cors());

const server = http.createServer(app);

// Use environment variables with fallbacks
const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(","),
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Add a simple health check endpoint
app.get('/', (req, res) => {
  res.send('Socket.io server is running');
});

// Track users by whiteboardId
let usersByWhiteboard = {};

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  socket.on('join', (data) => {
    // Handle both old format (just email) and new format (object with email & whiteboardId)
    let email, whiteboardId;
    
    if (typeof data === 'string') {
      // Old format - just email
      email = data;
      whiteboardId = 'global'; // Default room for backward compatibility
    } else {
      // New format - object with email and whiteboardId
      email = data.email;
      whiteboardId = data.whiteboardId;
    }
    
    // Join socket room for the whiteboard
    socket.join(whiteboardId);
    
    // Initialize whiteboard room if it doesn't exist
    if (!usersByWhiteboard[whiteboardId]) {
      usersByWhiteboard[whiteboardId] = [];
    }
    
    // Remove any existing instances of this user in this whiteboard
    usersByWhiteboard[whiteboardId] = usersByWhiteboard[whiteboardId].filter(u => u.email !== email);
    
    // Add the user with their new socket id to this whiteboard
    usersByWhiteboard[whiteboardId].push({ 
      id: socket.id, 
      email, 
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      whiteboardId
    });
    
    // Emit updated user list to everyone in this whiteboard
    io.to(whiteboardId).emit('userList', usersByWhiteboard[whiteboardId].map(u => u.email));
  });

  socket.on('cursorMove', (data) => {
    const whiteboardId = data.whiteboardId || 'global';
    let user;
    
    // Find user by email across all whiteboards if necessary
    if (usersByWhiteboard[whiteboardId]) {
      user = usersByWhiteboard[whiteboardId].find(u => u.email === data.email);
    }
    
    // Broadcast cursor position only to users in the same whiteboard
    // Include zoom level and canvas position data for better cursor sync
    socket.to(whiteboardId).emit('remoteCursor', {
      ...data,
      color: user?.color || '#000'
    });
  });

  socket.on('draw', (data) => {
    const whiteboardId = data.whiteboardId || 'global';
    // Ensure all drawing data is passed along, including eraser state
    socket.to(whiteboardId).emit('draw', data);
  });

  socket.on('updateTextBox', (textBox) => {
    const whiteboardId = textBox.whiteboardId || 'global';
    // Broadcast to all users in the same whiteboard
    socket.to(whiteboardId).emit('updateTextBox', textBox);
  });

  socket.on('addTextBox', (textBox) => {
    const whiteboardId = textBox.whiteboardId || 'global';
    // Broadcast to all users in the same whiteboard
    socket.to(whiteboardId).emit('addTextBox', textBox);
  });

  socket.on('disconnect', () => {
    // Find which whiteboard this socket belonged to
    let userWhiteboardId = null;
    let userEmail = null;
    
    // Search through all whiteboards to find this socket
    Object.keys(usersByWhiteboard).forEach(whiteboardId => {
      const userIndex = usersByWhiteboard[whiteboardId].findIndex(u => u.id === socket.id);
      if (userIndex !== -1) {
        userWhiteboardId = whiteboardId;
        userEmail = usersByWhiteboard[whiteboardId][userIndex].email;
        
        // Remove this socket instance
        usersByWhiteboard[whiteboardId].splice(userIndex, 1);
        
        // Check if this was the last session for the user in this whiteboard
        if (!usersByWhiteboard[whiteboardId].some(u => u.email === userEmail)) {
          io.to(whiteboardId).emit('userDisconnected', userEmail);
        }
        
        // Update the user list for this whiteboard
        io.to(whiteboardId).emit('userList', usersByWhiteboard[whiteboardId].map(u => u.email));
        
        // Clean up empty whiteboard rooms
        if (usersByWhiteboard[whiteboardId].length === 0) {
          delete usersByWhiteboard[whiteboardId];
        }
      }
    });
    
    console.log('User disconnected', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
});