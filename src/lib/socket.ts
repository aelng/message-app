import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { ChatRoom, Message } from '@/types/chat';

const chatRooms = new Map<string, ChatRoom>();

export function initializeSocketServer(httpServer: NetServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('createRoom', (data: { name: string; duration: number }) => {
      const roomId = uuidv4();
      const now = Date.now();
      const expiresAt = now + data.duration * 60 * 1000; // Convert minutes to milliseconds

      const newRoom: ChatRoom = {
        id: roomId,
        name: data.name,
        createdAt: now,
        expiresAt,
        messages: [],
      };

      chatRooms.set(roomId, newRoom);
      socket.emit('roomCreated', { roomId, ...newRoom });
    });

    socket.on('joinRoom', (roomId: string) => {
      const room = chatRooms.get(roomId);
      
      if (!room) {
        socket.emit('error', 'Room not found');
        return;
      }

      if (Date.now() > room.expiresAt) {
        socket.emit('error', 'Room has expired');
        return;
      }

      socket.join(roomId);
      socket.emit('roomJoined', room);
      socket.emit('messageHistory', room.messages);
    });

    socket.on('sendMessage', (data: { roomId: string; content: string; sender: string }) => {
      const room = chatRooms.get(data.roomId);
      
      if (!room || Date.now() > room.expiresAt) {
        socket.emit('error', 'Room not found or has expired');
        return;
      }

      const message: Message = {
        id: uuidv4(),
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

  // Clean up expired rooms periodically
  setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of chatRooms.entries()) {
      if (now > room.expiresAt) {
        chatRooms.delete(roomId);
        io.to(roomId).emit('roomExpired');
      }
    }
  }, 60000); // Check every minute

  return io;
} 