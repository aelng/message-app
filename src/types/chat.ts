export interface Message {
  id: string;
  content: string;
  sender: string;
  timestamp: number;
}

export interface ChatRoom {
  id: string;
  name: string;
  createdAt: number;
  expiresAt: number;
  messages: Message[];
}

export interface CreateChatRoomData {
  name: string;
  duration: number; // duration in minutes
} 