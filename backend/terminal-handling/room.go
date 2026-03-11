package terminalhandler

import (
	"log"
	"sync"
)

type TerminalRoom struct {
	id string

	mu sync.RWMutex

	clients         map[*terminalClient]bool
	sharedSessions  map[string]*terminalSession
	sharedOrder     []string
	privateSessions map[*terminalClient]map[string]*terminalSession
	privateOrder    map[*terminalClient][]string
}

func (room *TerminalRoom) addClient(client *terminalClient) {
	room.mu.Lock()
	defer room.mu.Unlock()

	room.clients[client] = true
	room.privateSessions[client] = make(map[string]*terminalSession)
	room.privateOrder[client] = []string{}
}

func (room *TerminalRoom) removeClient(client *terminalClient) {
	room.mu.Lock()
	privateSessions := room.privateSessions[client]
	delete(room.clients, client)
	delete(room.privateSessions, client)
	delete(room.privateOrder, client)
	room.mu.Unlock()

	for _, session := range privateSessions {
		session.close(true)
	}
}

func (room *TerminalRoom) handleMessage(
	client *terminalClient,
	manager *TerminalManager,
	message clientMessage,
) {
	switch message.Event {
	case "terminal_bootstrap":
		room.sendSnapshot(client)
	case "terminal_create":
		room.handleCreate(client, manager, normalizeScope(message.Scope))
	case "terminal_run":
		room.handleRun(client, normalizeScope(message.Scope), message.TerminalID, message.Command)
	case "terminal_draft":
		room.handleDraft(client, normalizeScope(message.Scope), message.TerminalID, message.Draft)
	case "terminal_resize":
		room.handleResize(
			client,
			normalizeScope(message.Scope),
			message.TerminalID,
			message.Cols,
			message.Rows,
		)
	case "terminal_close":
		room.handleClose(client, normalizeScope(message.Scope), message.TerminalID)
	default:
		client.send("terminal_error", map[string]any{
			"message": "Unknown terminal event.",
		})
	}
}

func (room *TerminalRoom) handleCreate(
	client *terminalClient,
	manager *TerminalManager,
	scope string,
) {
	if scope == "" {
		client.send("terminal_error", map[string]any{
			"message": "Unknown terminal scope.",
		})
		return
	}

	session, err := room.createSession(manager.nextTerminalID(), client, scope)
	if err != nil {
		client.send("terminal_error", map[string]any{
			"scope":   scope,
			"message": "Failed to start terminal session.",
		})
		return
	}

	room.publishCreated(session)
}

func (room *TerminalRoom) handleRun(
	client *terminalClient,
	scope string,
	terminalID string,
	command string,
) {
	session := room.getSession(client, scope, terminalID)
	if session == nil {
		client.send("terminal_error", map[string]any{
			"scope":      scope,
			"terminalId": terminalID,
			"message":    "Terminal session not found.",
		})
		return
	}

	if err := session.writeCommand(command); err != nil {
		client.send("terminal_error", map[string]any{
			"scope":      session.scope,
			"terminalId": session.id,
			"message":    "Failed to run terminal command.",
		})
		return
	}

	session.setDraft("")
	room.publishDraft(session)
}

func (room *TerminalRoom) handleDraft(
	client *terminalClient,
	scope string,
	terminalID string,
	draft string,
) {
	session := room.getSession(client, scope, terminalID)
	if session == nil {
		return
	}

	session.setDraft(draft)
	room.publishDraft(session)
}

func (room *TerminalRoom) handleResize(
	client *terminalClient,
	scope string,
	terminalID string,
	cols uint16,
	rows uint16,
) {
	session := room.getSession(client, scope, terminalID)
	if session == nil {
		return
	}

	if err := session.resize(cols, rows); err != nil {
		client.send("terminal_error", map[string]any{
			"scope":      session.scope,
			"terminalId": session.id,
			"message":    "Failed to resize terminal session.",
		})
	}
}

func (room *TerminalRoom) handleClose(
	client *terminalClient,
	scope string,
	terminalID string,
) {
	session := room.getSession(client, scope, terminalID)
	if session == nil {
		return
	}

	room.closeSession(session, true)
}

func (room *TerminalRoom) createSession(
	id string,
	client *terminalClient,
	scope string,
) (*terminalSession, error) {
	session, err := newTerminalSession(id, scope, room, client)
	if err != nil {
		return nil, err
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	if scope == "shared" {
		room.sharedSessions[id] = session
		room.sharedOrder = append(room.sharedOrder, id)
	} else {
		if room.privateSessions[client] == nil {
			room.privateSessions[client] = make(map[string]*terminalSession)
		}
		room.privateSessions[client][id] = session
		room.privateOrder[client] = append(room.privateOrder[client], id)
	}

	session.start()
	return session, nil
}

func (room *TerminalRoom) sendSnapshot(client *terminalClient) {
	room.mu.RLock()
	defer room.mu.RUnlock()

	sharedTabs := make([]terminalSnapshot, 0, len(room.sharedOrder))
	for _, id := range room.sharedOrder {
		session := room.sharedSessions[id]
		if session == nil {
			continue
		}
		sharedTabs = append(sharedTabs, session.snapshot())
	}

	privateOrder := room.privateOrder[client]
	privateTabs := make([]terminalSnapshot, 0, len(privateOrder))
	for _, id := range privateOrder {
		session := room.privateSessions[client][id]
		if session == nil {
			continue
		}
		privateTabs = append(privateTabs, session.snapshot())
	}

	if err := client.send("terminal_snapshot", map[string]any{
		"privateTabs": privateTabs,
		"sharedTabs":  sharedTabs,
	}); err != nil {
		log.Println("failed to send terminal snapshot:", err)
	}
}

func (room *TerminalRoom) publishCreated(session *terminalSession) {
	payload := map[string]any{
		"scope": session.scope,
		"tab":   session.snapshot(),
	}

	room.publishScopedEvent(session, "terminal_created", payload)
}

func (room *TerminalRoom) publishOutput(session *terminalSession, chunk string) {
	payload := map[string]any{
		"scope":      session.scope,
		"terminalId": session.id,
		"chunk":      chunk,
	}

	room.publishScopedEvent(session, "terminal_output", payload)
}

func (room *TerminalRoom) publishDraft(session *terminalSession) {
	payload := map[string]any{
		"scope":      session.scope,
		"terminalId": session.id,
		"draft":      session.snapshot().CommandDraft,
	}

	room.publishScopedEvent(session, "terminal_draft", payload)
}

func (room *TerminalRoom) publishScopedEvent(
	session *terminalSession,
	event string,
	payload interface{},
) {
	if session.scope == "shared" {
		room.broadcast(event, payload)
		return
	}

	if session.owner != nil {
		if err := session.owner.send(event, payload); err != nil {
			log.Println("failed to send private terminal event:", err)
		}
	}
}

func (room *TerminalRoom) broadcast(event string, payload interface{}) {
	room.mu.RLock()
	clients := make([]*terminalClient, 0, len(room.clients))
	for client := range room.clients {
		clients = append(clients, client)
	}
	room.mu.RUnlock()

	for _, client := range clients {
		if err := client.send(event, payload); err != nil {
			log.Println("terminal broadcast failed:", err)
		}
	}
}

func (room *TerminalRoom) getSession(
	client *terminalClient,
	scope string,
	terminalID string,
) *terminalSession {
	if scope == "" || terminalID == "" {
		return nil
	}

	room.mu.RLock()
	defer room.mu.RUnlock()

	if scope == "shared" {
		return room.sharedSessions[terminalID]
	}

	return room.privateSessions[client][terminalID]
}

func (room *TerminalRoom) closeSession(session *terminalSession, notify bool) {
	if session == nil {
		return
	}

	if !session.close(true) {
		return
	}

	room.mu.Lock()
	if session.scope == "shared" {
		delete(room.sharedSessions, session.id)
		room.sharedOrder = removeFromOrder(room.sharedOrder, session.id)
	} else if session.owner != nil {
		delete(room.privateSessions[session.owner], session.id)
		room.privateOrder[session.owner] = removeFromOrder(
			room.privateOrder[session.owner],
			session.id,
		)
	}
	room.mu.Unlock()

	if !notify {
		return
	}

	payload := map[string]any{
		"scope":      session.scope,
		"terminalId": session.id,
	}

	room.publishScopedEvent(session, "terminal_closed", payload)
}
