"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

// WebSocket connects directly to the API (can't be proxied through Next.js rewrites)
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "";

interface WebSocketContextValue {
  socket: Socket | null;
  connected: boolean;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  socket: null,
  connected: false,
  joinRoom: () => {},
  leaveRoom: () => {},
});

export function useWebSocket() {
  return useContext(WebSocketContext);
}

export function useSocketEvent<T = unknown>(event: string, handler: (data: T) => void) {
  const { socket } = useWebSocket();

  useEffect(() => {
    if (!socket) return;
    socket.on(event, handler);
    return () => { socket.off(event, handler); };
  }, [socket, event, handler]);
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(`${WS_URL}/events`, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const joinRoom = useCallback((room: string) => {
    socketRef.current?.emit("join", room);
  }, []);

  const leaveRoom = useCallback((room: string) => {
    socketRef.current?.emit("leave", room);
  }, []);

  return (
    <WebSocketContext.Provider value={{ socket: socketRef.current, connected, joinRoom, leaveRoom }}>
      {children}
    </WebSocketContext.Provider>
  );
}
