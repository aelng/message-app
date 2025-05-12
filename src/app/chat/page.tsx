'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { Message } from '@/types/chat';

export default function ChatRoom() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomId = searchParams.get('roomId');
  const roomName = searchParams.get('name');
  const duration = searchParams.get('duration');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [showShareLink, setShowShareLink] = useState(false);
  const [roomLink, setRoomLink] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastServerTimeRef = useRef<number>(0);

  useEffect(() => {
    // Generate room link only on client side
    if (roomId && roomName && duration) {
      setRoomLink(`${window.location.origin}/chat?roomId=${roomId}&name=${encodeURIComponent(roomName)}&duration=${duration}`);
    }
  }, [roomId, roomName, duration]);

  const copyToClipboard = () => {
    if (roomLink) {
      navigator.clipboard.writeText(roomLink);
    }
  };

  useEffect(() => {
    if (!roomId || !roomName || !duration) {
      setError('Invalid room parameters');
      return;
    }

    // Initialize socket connection
    socketRef.current = io({
      path: '/api/socketio',
      addTrailingSlash: false,
    });

    socketRef.current.on('connect', () => {
      console.log('Connected to socket server');
      setIsConnected(true);
      
      // Join the room immediately
      socketRef.current?.emit('joinRoom', roomId);
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setError('Failed to connect to chat server');
    });

    socketRef.current.on('roomJoined', (data) => {
      console.log('Joined room:', data);
      const serverTime = Date.now();
      lastServerTimeRef.current = serverTime;
      const timeUntilExpiry = Math.floor((data.expiresAt - serverTime) / 1000);
      setTimeLeft(timeUntilExpiry);
    });

    socketRef.current.on('messageHistory', (history: Message[]) => {
      console.log('Received message history:', history);
      setMessages(history);
    });

    socketRef.current.on('newMessage', (message: Message) => {
      console.log('Received new message:', message);
      setMessages((prev) => [...prev, message]);
    });

    socketRef.current.on('error', (error: string) => {
      setError(error);
    });

    socketRef.current.on('roomExpired', () => {
      setError('This chat room has expired');
      router.push('/');
    });

    // Sync timer with server every 30 seconds
    const syncInterval = setInterval(() => {
      socketRef.current?.emit('syncTime', roomId);
    }, 30000);

    return () => {
      clearInterval(syncInterval);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      socketRef.current?.disconnect();
    };
  }, [roomId, roomName, duration, router]);

  useEffect(() => {
    if (timeLeft > 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
            router.push('/');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timeLeft, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !username.trim() || !roomId) return;

    console.log('Sending message:', {
      roomId,
      content: newMessage,
      sender: username,
    });

    socketRef.current?.emit('sendMessage', {
      roomId: roomId,
      content: newMessage,
      sender: username,
    });

    setNewMessage('');
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
          <p>{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md">
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">{roomName}</h1>
              <p className="text-sm text-gray-600">
                Time remaining: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </p>
            </div>
            <button
              onClick={() => setShowShareLink(!showShareLink)}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              {showShareLink ? 'Hide Link' : 'Share Link'}
            </button>
          </div>
          {showShareLink && roomLink && (
            <div className="mt-4 p-4 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-600 mb-2">Share this link with someone to join your chat room:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomLink}
                  readOnly
                  className="flex-1 p-2 border rounded text-sm"
                />
                <button
                  onClick={copyToClipboard}
                  className="bg-gray-200 px-3 py-2 rounded hover:bg-gray-300"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="h-[60vh] overflow-y-auto p-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`mb-4 ${
                message.sender === username ? 'text-right' : 'text-left'
              }`}
            >
              <div
                className={`inline-block p-3 rounded-lg ${
                  message.sender === username
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
              >
                <p className="font-semibold text-sm">{message.sender}</p>
                <p>{message.content}</p>
                <p className="text-xs mt-1 opacity-75">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="p-4 border-t">
          <div className="flex gap-4">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your name"
              className="flex-1 p-2 border rounded"
              required
            />
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 p-2 border rounded"
              required
            />
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              disabled={!isConnected}
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 