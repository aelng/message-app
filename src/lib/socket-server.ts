import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { Message } from '@/types/chat';

interface ChatRoom {
  id: string;
  name: string;
  messages: Message[];
  createdAt: number;
  expiresAt: number;
}

const chatRooms = new Map<string, ChatRoom>();

export function initializeSocketServer(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    path: '/api/socketio',
    addTrailingSlash: false,
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('createRoom', (data: { name: string; duration: number }) => {
      console.log('Creating room:', data);
      const roomId = crypto.randomUUID();
      const now = Date.now();
      const expiresAt = now + data.duration * 60 * 1000;

      const room: ChatRoom = {
        id: roomId,
        name: data.name,
        messages: [],
        createdAt: now,
        expiresAt,
      };

      chatRooms.set(roomId, room);
      socket.join(roomId);
      socket.emit('roomCreated', { id: roomId, expiresAt });
    });

    socket.on('joinRoom', (roomId: string) => {
      console.log('Joining room:', roomId);
      const room = chatRooms.get(roomId);

      if (!room) {
        socket.emit('error', 'Room not found');
        return;
      }

      if (Date.now() >= room.expiresAt) {
        socket.emit('error', 'Room has expired');
        return;
      }

      socket.join(roomId);
      socket.emit('roomJoined', {
        id: room.id,
        name: room.name,
        expiresAt: room.expiresAt,
      });
      socket.emit('messageHistory', room.messages);
    });

    socket.on('syncTime', (roomId: string) => {
      const room = chatRooms.get(roomId);
      if (room) {
        socket.emit('roomJoined', {
          id: room.id,
          name: room.name,
          expiresAt: room.expiresAt,
        });
      }
    });

    socket.on('sendMessage', (data: { roomId: string; content: string; sender: string }) => {
      console.log('Received message:', data);
      const room = chatRooms.get(data.roomId);

      if (!room) {
        socket.emit('error', 'Room not found');
        return;
      }

      if (Date.now() >= room.expiresAt) {
        socket.emit('error', 'Room has expired');
        return;
      }

      const message: Message = {
        id: crypto.randomUUID(),
        content: data.content,
        sender: data.sender,
        timestamp: Date.now(),
      };

      room.messages.push(message);
      io.to(data.roomId).emit('newMessage', message);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // Clean up expired rooms every second
  setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of chatRooms.entries()) {
      if (now >= room.expiresAt) {
        io.to(roomId).emit('roomExpired');
        chatRooms.delete(roomId);
      }
    }
  }, 1000);

  return io;
} 