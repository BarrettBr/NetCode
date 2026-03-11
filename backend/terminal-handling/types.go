package terminalhandler

type envelope struct {
	Event  string      `json:"event"`
	Update interface{} `json:"update"`
}

type clientMessage struct {
	Event      string `json:"event"`
	Scope      string `json:"scope"`
	TerminalID string `json:"terminalId"`
	Command    string `json:"command"`
	Draft      string `json:"draft"`
	Cols       uint16 `json:"cols"`
	Rows       uint16 `json:"rows"`
}

type terminalSnapshot struct {
	ID           string `json:"id"`
	Scope        string `json:"scope"`
	Status       string `json:"status"`
	Buffer       string `json:"buffer"`
	CommandDraft string `json:"commandDraft"`
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
