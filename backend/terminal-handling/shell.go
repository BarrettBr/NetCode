package terminalhandler

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/creack/pty"
)

func newTerminalSession(
	id string,
	scope string,
	room *TerminalRoom,
	client *terminalClient,
) (*terminalSession, error) {
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

	return &terminalSession{
		id:      id,
		scope:   scope,
		status:  "idle",
		cmd:     cmd,
		ptyFile: ptyFile,
		room:    room,
		owner:   client,
	}, nil
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
