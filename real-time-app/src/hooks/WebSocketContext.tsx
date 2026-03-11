// hooks/WebSocketContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { AppConfig } from "@/config";
import {
  createInitialEditorSessionState,
  type EditorSessionState,
} from "@/hooks/editorSessionState";

/* 
  Create a WebSocket context using React Context API.
  This allows components across the app to access a shared WebSocket connection.
*/
type MessageListener = (event: MessageEvent<string>) => void;

type WebSocketContextValue = {
  socketRef: React.MutableRefObject<WebSocket | null>;
  editorSessionRef: React.MutableRefObject<EditorSessionState>;
  subscribe: (listener: MessageListener) => () => void;
};

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

/* 
  WebSocketProvider Component:
    Provides a WebSocket connection scoped to the room ID in AppConfig.
    Wrap your application with this provider to make the socket accessible via useWS().
  
  Responsibilities:
    - Initializes the WebSocket on mount
    - Logs connection/disconnection events
    - Closes the socket on unmount
    - Supplies the socket via context to children
*/
export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const socketRef = useRef<WebSocket | null>(null);
  const editorSessionRef = useRef<EditorSessionState>(
    createInitialEditorSessionState(),
  );
  const listenersRef = useRef(new Set<MessageListener>());
  const backlogRef = useRef<MessageEvent<string>[]>([]);

  const contextValue = useMemo<WebSocketContextValue>(
    () => ({
      socketRef,
      editorSessionRef,
      subscribe: (listener) => {
        listenersRef.current.add(listener);

        if (backlogRef.current.length > 0) {
          const backlog = backlogRef.current;
          backlogRef.current = [];
          for (const event of backlog) {
            listener(event);
          }
        }

        return () => {
          listenersRef.current.delete(listener);
        };
      },
    }),
    [],
  );

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const hostname = window.location.hostname;
    const port = window.location.protocol === "https:" ? "" : ":9090";
    const url = `${protocol}//${hostname}${port}/api/ws?room=${AppConfig.roomId}`;
    const socket = new WebSocket(url);
    socket.addEventListener("message", (event) => {
      if (listenersRef.current.size === 0) {
        backlogRef.current.push(event as MessageEvent<string>);
        return;
      }
      for (const listener of listenersRef.current) {
        listener(event as MessageEvent<string>);
      }
    });
    socketRef.current = socket;

    return () => {
      backlogRef.current = [];
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, []);

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

/* 
  useWS Hook:
    Custom hook to access the shared WebSocket instance.
    Throws an error if used outside of a WebSocketProvider.
*/
export const useWS = () => {
  const context = useContext(WebSocketContext);
  if (!context)
    throw new Error("useWS must be used inside a WebSocketProvider");
  return context;
};
