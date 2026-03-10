package terminalhandler

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/creack/pty"
	"github.com/gorilla/websocket"
)

type envelope struct {
	Event  string      `json:"event"`
	Update interface{} `json:"update"`
}

type clientMessage struct {
	Event      string `json:"event"`
	Scope      string `json:"scope"`
	TerminalID string `json:"terminalId"`
	Command    string `json:"command"`
	Cols       uint16 `json:"cols"`
	Rows       uint16 `json:"rows"`
}

type terminalSnapshot struct {
	ID     string `json:"id"`
	Scope  string `json:"scope"`
	Status string `json:"status"`
	Buffer string `json:"buffer"`
}

type terminalClient struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

type terminalSession struct {
	id      string
	scope   string
	status  string
	cmd     *exec.Cmd
	ptyFile *os.File
	room    *TerminalRoom
	owner   *terminalClient

	mu     sync.Mutex
	buffer strings.Builder
	closed bool
}

type TerminalRoom struct {
	id string

	mu sync.RWMutex

	clients         map[*terminalClient]bool
	sharedSessions  map[string]*terminalSession
	sharedOrder     []string
	privateSessions map[*terminalClient]map[string]*terminalSession
	privateOrder    map[*terminalClient][]string
}

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

func (manager *TerminalManager) HandleConnection(roomID string, conn *websocket.Conn) {
	room := manager.getOrCreateRoom(roomID)
	client := &terminalClient{conn: conn}
	room.addClient(client)
	defer room.removeClient(client)
	defer conn.Close()

	for {
		_, payload, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway, websocket.CloseNoStatusReceived) {
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

func (room *TerminalRoom) handleMessage(client *terminalClient, manager *TerminalManager, message clientMessage) {
	switch message.Event {
	case "terminal_bootstrap":
		room.sendSnapshot(client)
	case "terminal_create":
		scope := normalizeScope(message.Scope)
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
	case "terminal_run":
		session := room.getSession(client, normalizeScope(message.Scope), message.TerminalID)
		if session == nil {
			client.send("terminal_error", map[string]any{
				"scope":      normalizeScope(message.Scope),
				"terminalId": message.TerminalID,
				"message":    "Terminal session not found.",
			})
			return
		}

		if err := session.writeCommand(message.Command); err != nil {
			client.send("terminal_error", map[string]any{
				"scope":      session.scope,
				"terminalId": session.id,
				"message":    "Failed to run terminal command.",
			})
		}
	case "terminal_resize":
		session := room.getSession(client, normalizeScope(message.Scope), message.TerminalID)
		if session == nil {
			return
		}
		if err := session.resize(message.Cols, message.Rows); err != nil {
			client.send("terminal_error", map[string]any{
				"scope":      session.scope,
				"terminalId": session.id,
				"message":    "Failed to resize terminal session.",
			})
		}
	case "terminal_close":
		session := room.getSession(client, normalizeScope(message.Scope), message.TerminalID)
		if session == nil {
			return
		}
		room.closeSession(session, true)
	default:
		client.send("terminal_error", map[string]any{
			"message": "Unknown terminal event.",
		})
	}
}

func (room *TerminalRoom) createSession(id string, client *terminalClient, scope string) (*terminalSession, error) {
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

func newTerminalSession(id string, scope string, room *TerminalRoom, client *terminalClient) (*terminalSession, error) {
	cmd := buildShellCommand()
	cmd.Env = buildTerminalEnv()

	workdir, err := os.Getwd()
	if err == nil {
		cmd.Dir = workdir
	}

	ptyFile, err := pty.Start(cmd)
	if err != nil {
		return nil, err
	}

	session := &terminalSession{
		id:      id,
		scope:   scope,
		status:  "idle",
		cmd:     cmd,
		ptyFile: ptyFile,
		room:    room,
		owner:   client,
	}

	return session, nil
}

func buildShellCommand() *exec.Cmd {
	shell := os.Getenv("SHELL")
	if strings.TrimSpace(shell) == "" {
		shell = "/bin/bash"
	}

	base := filepath.Base(shell)
	switch base {
	case "bash":
		return exec.Command(shell, "--noprofile", "--norc", "-i")
	case "zsh":
		return exec.Command(shell, "-f", "-i")
	default:
		return exec.Command(shell)
	}
}

func buildTerminalEnv() []string {
	ignoredPrefixes := []string{
		"PROMPT_COMMAND=",
		"TERM_PROGRAM=",
		"TERM_PROGRAM_VERSION=",
		"VTE_VERSION=",
		"ITERM_SESSION_ID=",
		"ZDOTDIR=",
	}

	filtered := make([]string, 0, len(os.Environ())+2)
	for _, entry := range os.Environ() {
		skip := false
		for _, prefix := range ignoredPrefixes {
			if strings.HasPrefix(entry, prefix) {
				skip = true
				break
			}
		}
		if skip {
			continue
		}
		filtered = append(filtered, entry)
	}

	filtered = append(filtered, "TERM=xterm-256color")
	filtered = append(filtered, "PS1=netcode:$ ")
	return filtered
}

func (session *terminalSession) start() {
	go session.readLoop()
}

func (session *terminalSession) readLoop() {
	buffer := make([]byte, 4096)
	for {
		n, err := session.ptyFile.Read(buffer)
		if n > 0 {
			chunk := string(buffer[:n])

			session.mu.Lock()
			if !session.closed {
				session.buffer.WriteString(chunk)
				session.status = "idle"
			}
			session.mu.Unlock()

			session.room.publishOutput(session, chunk)
		}

		if err != nil {
			if err != io.EOF {
				log.Println("terminal session read error:", err)
			}
			session.room.closeSession(session, true)
			return
		}
	}
}

func (session *terminalSession) writeCommand(command string) error {
	session.mu.Lock()
	defer session.mu.Unlock()

	if session.closed {
		return fmt.Errorf("terminal session closed")
	}

	if !strings.HasSuffix(command, "\n") {
		command += "\n"
	}

	session.status = "running"
	_, err := session.ptyFile.WriteString(command)
	return err
}

func (session *terminalSession) resize(cols uint16, rows uint16) error {
	session.mu.Lock()
	defer session.mu.Unlock()

	if session.closed {
		return fmt.Errorf("terminal session closed")
	}

	if cols == 0 {
		cols = 120
	}
	if rows == 0 {
		rows = 24
	}

	return pty.Setsize(session.ptyFile, &pty.Winsize{
		Cols: cols,
		Rows: rows,
	})
}

func (session *terminalSession) snapshot() terminalSnapshot {
	session.mu.Lock()
	defer session.mu.Unlock()

	return terminalSnapshot{
		ID:     session.id,
		Scope:  session.scope,
		Status: session.status,
		Buffer: session.buffer.String(),
	}
}

func (session *terminalSession) close(killProcess bool) bool {
	session.mu.Lock()
	if session.closed {
		session.mu.Unlock()
		return false
	}
	session.closed = true
	session.status = "closed"
	ptyFile := session.ptyFile
	cmd := session.cmd
	session.mu.Unlock()

	if ptyFile != nil {
		ptyFile.Close()
	}
	if killProcess && cmd != nil && cmd.Process != nil {
		cmd.Process.Kill()
		cmd.Wait()
	}

	return true
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

	if session.scope == "shared" {
		room.broadcast("terminal_created", payload)
		return
	}

	if session.owner != nil {
		if err := session.owner.send("terminal_created", payload); err != nil {
			log.Println("failed to send private terminal creation:", err)
		}
	}
}

func (room *TerminalRoom) publishOutput(session *terminalSession, chunk string) {
	payload := map[string]any{
		"scope":      session.scope,
		"terminalId": session.id,
		"chunk":      chunk,
	}

	if session.scope == "shared" {
		room.broadcast("terminal_output", payload)
		return
	}

	if session.owner != nil {
		if err := session.owner.send("terminal_output", payload); err != nil {
			log.Println("failed to send private terminal output:", err)
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

func (room *TerminalRoom) getSession(client *terminalClient, scope string, terminalID string) *terminalSession {
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
		room.privateOrder[session.owner] = removeFromOrder(room.privateOrder[session.owner], session.id)
	}
	room.mu.Unlock()

	if !notify {
		return
	}

	payload := map[string]any{
		"scope":      session.scope,
		"terminalId": session.id,
	}

	if session.scope == "shared" {
		room.broadcast("terminal_closed", payload)
		return
	}

	if session.owner != nil {
		if err := session.owner.send("terminal_closed", payload); err != nil {
			log.Println("failed to send private terminal close:", err)
		}
	}
}

func normalizeScope(scope string) string {
	switch scope {
	case "private", "shared":
		return scope
	default:
		return ""
	}
}

func removeFromOrder(order []string, terminalID string) []string {
	next := make([]string, 0, len(order))
	for _, id := range order {
		if id == terminalID {
			continue
		}
		next = append(next, id)
	}
	return next
}
