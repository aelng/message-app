'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

export default function Home() {
  const [roomName, setRoomName] = useState('');
  const [duration, setDuration] = useState(30);
  const [roomLink, setRoomLink] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io({
      path: '/api/socketio',
      addTrailingSlash: false,
    });

    socketRef.current.on('connect', () => {
      console.log('Connected to socket server');
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setError('Failed to connect to chat server');
    });

    socketRef.current.on('roomCreated', (data) => {
      console.log('Room created:', data);
      const link = `${window.location.origin}/chat?roomId=${data.id}&name=${encodeURIComponent(roomName)}&duration=${duration}`;
      setRoomLink(link);
      router.push(link);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [roomName, duration, router]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;

    setIsCreating(true);
    setError('');

    // Create room on the server
    socketRef.current?.emit('createRoom', {
      name: roomName,
      duration: duration,
    });
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Create Chat Room</h1>
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}
        <form onSubmit={handleCreateRoom} className="space-y-4">
          <div>
            <label htmlFor="roomName" className="block text-sm font-medium text-gray-700">
              Room Name
            </label>
            <input
              type="text"
              id="roomName"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Enter room name"
              required
            />
          </div>
          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700">
              Duration (minutes)
            </label>
            <input
              type="number"
              id="duration"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              min="1"
              max="1440"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            disabled={isCreating}
          >
            {isCreating ? 'Creating Room...' : 'Create Room'}
          </button>
        </form>
      </div>
    </main>
  );
}
