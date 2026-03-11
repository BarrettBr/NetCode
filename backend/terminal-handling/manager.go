package terminalhandler

import (
	"fmt"
	"sync"
	"sync/atomic"
)

type TerminalManager struct {
	mu     sync.Mutex
	rooms  map[string]*TerminalRoom
	nextID atomic.Uint64
}

func NewTerminalManager() *TerminalManager {
	return &TerminalManager{
		rooms: make(map[string]*TerminalRoom),
	}
}

func (manager *TerminalManager) getOrCreateRoom(roomID string) *TerminalRoom {
	manager.mu.Lock()
	defer manager.mu.Unlock()

	room, exists := manager.rooms[roomID]
	if exists {
		return room
	}

	room = &TerminalRoom{
		id:              roomID,
		clients:         make(map[*terminalClient]bool),
		sharedSessions:  make(map[string]*terminalSession),
		privateSessions: make(map[*terminalClient]map[string]*terminalSession),
		privateOrder:    make(map[*terminalClient][]string),
	}
	manager.rooms[roomID] = room
	return room
}

func (manager *TerminalManager) nextTerminalID() string {
	return fmt.Sprintf("term-%d", manager.nextID.Add(1))
}
