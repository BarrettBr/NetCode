package terminalhandler

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

type terminalClient struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

func (manager *TerminalManager) HandleConnection(roomID string, conn *websocket.Conn) {
	room := manager.getOrCreateRoom(roomID)
	client := &terminalClient{conn: conn}
	room.addClient(client)
	defer room.removeClient(client)
	defer conn.Close()

	for {
		_, payload, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsCloseError(
				err,
				websocket.CloseNormalClosure,
				websocket.CloseGoingAway,
				websocket.CloseNoStatusReceived,
			) {
				break
			}
			log.Println("terminal websocket read error:", err)
			break
		}

		var message clientMessage
		if err := json.Unmarshal(payload, &message); err != nil {
			client.send("terminal_error", map[string]any{
				"message": "Invalid terminal payload.",
			})
			continue
		}

		room.handleMessage(client, manager, message)
	}
}

func (client *terminalClient) send(event string, update interface{}) error {
	msg := envelope{
		Event:  event,
		Update: update,
	}
	jsonData, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	client.mu.Lock()
	defer client.mu.Unlock()
	return client.conn.WriteMessage(websocket.TextMessage, jsonData)
}
