package terminalhandler

import (
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"strings"
	"sync"

	"github.com/creack/pty"
)

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
	draft  string
	closed bool
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
		ID:           session.id,
		Scope:        session.scope,
		Status:       session.status,
		Buffer:       session.buffer.String(),
		CommandDraft: session.draft,
	}
}

func (session *terminalSession) setDraft(draft string) {
	session.mu.Lock()
	defer session.mu.Unlock()

	if session.closed {
		return
	}
	session.draft = draft
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
