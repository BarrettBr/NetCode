package roomhandler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	aireview "github.com/Xavanion/NetCode/backend/ai-review"
	codehandler "github.com/Xavanion/NetCode/backend/code-handling"
	rope "github.com/Xavanion/NetCode/backend/rope"
)

// This is the struct used for an individual room that people can connect to
type Room struct {
	ID                string
	activeConnections map[*websocket.Conn]bool
	connIDs           map[*websocket.Conn]int
	nextUID           int
	con_mu            sync.Mutex
	op_mu             sync.Mutex
	serverText        *rope.Rope
	text_mu           sync.RWMutex
	version           uint64
	historyBase       uint64
	history           []map[string]any
}

const maxHistoryOps = 4096

// This is used for tracking the history of operations for the operational transformations
type Operation struct {
	Type    string // "insert" or "delete"
	Version uint64
	// For insert
	Pos   int
	Value string
	// For Delete
	From   int
	To     int
	Author string
}

// This struct is for managing all active rooms
type RoomManager struct {
	Rooms map[string]*Room
	mu    sync.RWMutex
}

type ApiRequest struct {
	Event    string `json:"event"`
	Language string `json:"language"`
	Room     string `json:"room"`
}

// This struct is used mainly for rebroadcasting updates recieved from the front end
type sendUpdateJson struct {
	Event  string      `json:"event"`
	Update interface{} `json:"update"`
}

/* A func that's used to spin up a new room manager
* PARAMS: none
* RETURNS: the pointer to the created room manager
 */
func NewRoomManager() *RoomManager {
	return &RoomManager{
		Rooms: make(map[string]*Room),
	}
}

/* Used when a roommanager wants to initialize a new room
* PARAMS: The room id the user wants to create
* RETURNS: A pointer to the newly created room
 */
func (manager *RoomManager) CreateRoom(roomid string) *Room {
	room, exists := manager.GetRoom(roomid)
	if exists {
		return room
	}

	manager.mu.Lock()
	defer manager.mu.Unlock()

	manager.Rooms[roomid] = &Room{
		ID:                roomid,
		activeConnections: make(map[*websocket.Conn]bool),
		connIDs:           make(map[*websocket.Conn]int),
		serverText:        rope.New(""),
		history:           make([]map[string]any, 0),
		nextUID:           0,
	}
	return manager.Rooms[roomid]
}

/* This function is called on a manager and checks if the rool exists
* PARAMS: id: the relevant id that is being checked for
* RETURNS: The pointer to the relevant room if it exists, a boolean that is True iff the room exists
 */
func (manager *RoomManager) GetRoom(id string) (*Room, bool) {
	manager.mu.RLock()
	defer manager.mu.RUnlock()
	if manager.Rooms[id] == nil {
		return nil, false
	} else {
		room := manager.Rooms[id]
		return room, true
	}
}

/* returns the mainText parameter for a room in a safe way
*  PARAMS: none
*  RETURNS: The room's mainText paramenter
 */
func (room *Room) getText() string {
	room.text_mu.RLock()
	defer room.text_mu.RUnlock()
	if room.serverText == nil || room.serverText.Len() == 0 {
		return ""
	}
	return room.serverText.String()
}

func (room *Room) getTextLen() int {
	room.text_mu.RLock()
	defer room.text_mu.RUnlock()
	if room.serverText == nil {
		return 0
	}
	return room.serverText.Len()
}

/* This function is the entry point for any HTTP API requests we recieve such as running the code
* PARAMS: requestData: the relevant information from the request in struct form, the gin context so we can return status codes
* RETURNS: none
 */
func (room *Room) FileApiRequest(requestData ApiRequest, c *gin.Context) {
	switch requestData.Event {
	case "run_code":
		out, err := codehandler.Run_file(room.ID, string(requestData.Language), "main-", room.getText())

		room.broadcastUpdate(nil, "output_update", out, false)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Server Error Processing code"})
		} else {
			c.JSON(http.StatusOK, gin.H{"message": "Data processed successfully"})
		}
	case "code_save":
		fmt.Println("code_save switch case hit")
	case "code_review":
		// Create a gemini review using the server's copy of the stored text
		response, err := aireview.Gemini_Review(room.getText())
		if err != nil {
			log.Println(err)
			err_out := "internal server error"
			c.JSON(http.StatusInternalServerError, gin.H{"review": err_out})
		}
		c.JSON(http.StatusOK, gin.H{"review": response})
	}
}

/* This function is priamrly used to broadcast an update recieved from an active connection to every other user in the room
*  PARAMS: startconn (optional) the user sending the update, event: what type of update is being sent,
*  message: the content being sent (such as remove the character at x position), and isParsed which is if we need to unmarshall the message first
*  RETURNS: none
 */
func (room *Room) broadcastUpdate(startconn *websocket.Conn, event string, message string, isParsed bool) {
	// Lock any new connections out to avoid weird inconsistencies
	room.con_mu.Lock()
	defer room.con_mu.Unlock()
	for conn := range room.activeConnections {
		// Don't send an update to whoever spawned the update
		if conn == startconn {
			continue
		}
		var jsonData []byte
		var err error
		if isParsed {
			var parsed map[string]interface{}
			json.Unmarshal([]byte(message), &parsed)

			msg := sendUpdateJson{
				Event:  event,
				Update: parsed,
			}
			jsonData, err = json.Marshal(msg)
		} else {
			msg := sendUpdateJson{
				Event:  event,
				Update: message,
			}
			jsonData, err = json.Marshal(msg)
		}

		if err != nil {
			log.Println("Failed to marshall update message json: ", err)
		}

		if err := conn.WriteMessage(websocket.TextMessage, jsonData); err != nil {
			log.Println("Failed to send message ", err)
			conn.Close()                         // Close connection if it fails to send a message
			delete(room.activeConnections, conn) // Remove broken connection
		}
	}
}

func (room *Room) sendUpdateToConnection(conn *websocket.Conn, event string, update interface{}) {
	room.con_mu.Lock()
	defer room.con_mu.Unlock()

	msg := sendUpdateJson{
		Event:  event,
		Update: update,
	}
	jsonData, err := json.Marshal(msg)
	if err != nil {
		log.Println("Failed to marshal direct update message json:", err)
		return
	}
	if err := conn.WriteMessage(websocket.TextMessage, jsonData); err != nil {
		log.Println("Failed to send direct message:", err)
	}
}

/* This function applies operational transformations on 'incomingOp' by adjusting it based on the past 'historyOp' (Adjusts in place)
 * PARAMS: incomingOp: a map of the new operation, historyOp: a map of the old operation with a equal or higher than version than incoming
 * RETURNS: Nothing, adjusts incomingOp in place
 */
func transformOp(incomingOp map[string]any, historyOp map[string]any) {
	incomingType, incomingTypeOK := incomingOp["type"].(string)
	historyType, historyTypeOK := historyOp["type"].(string)
	if !incomingTypeOK || !historyTypeOK {
		return
	}

	// Handle OT operations
	switch {
	case incomingType == "insert" && historyType == "insert": // Insert | Insert
		incomingPos, incomingPosOK := getIntValue(incomingOp["pos"])
		historyPos, historyPosOK := getIntValue(historyOp["pos"])
		historyVal, historyValOK := historyOp["value"].(string)
		if !incomingPosOK || !historyPosOK || !historyValOK {
			return
		}
		historyLen := utf8.RuneCountInString(historyVal)

		// If other insert was before current adjust the current ops index
		if historyPos < incomingPos || (historyPos == incomingPos && authorPrecedes(historyOp["author"], incomingOp["author"])) {
			incomingOp["pos"] = float64(incomingPos + historyLen)
		}
	case incomingType == "insert" && historyType == "delete": // Insert | Delete
		incomingPos, incomingPosOK := getIntValue(incomingOp["pos"])
		historyFrom, historyFromOK := getIntValue(historyOp["from"])
		historyTo, historyToOK := getIntValue(historyOp["to"])
		if !incomingPosOK || !historyFromOK || !historyToOK {
			return
		}
		historyLen := historyTo - historyFrom

		if historyTo <= incomingPos {
			incomingOp["pos"] = float64(incomingPos - historyLen) // Snap to adjusted area
		} else if incomingPos >= historyFrom {
			incomingOp["pos"] = float64(historyFrom) // Snap to start of deleted area
		}
	case incomingType == "delete" && historyType == "insert": // Delete | Insert
		incomingFrom, incomingFromOK := getIntValue(incomingOp["from"])
		incomingTo, incomingToOK := getIntValue(incomingOp["to"])
		historyPos, historyPosOK := getIntValue(historyOp["pos"])
		historyVal, historyValOK := historyOp["value"].(string)
		if !incomingFromOK || !incomingToOK || !historyPosOK || !historyValOK {
			return
		}
		historyLen := utf8.RuneCountInString(historyVal)

		// Deleted after insert
		if historyPos <= incomingFrom {
			incomingOp["from"] = float64(incomingFrom + historyLen)
			incomingOp["to"] = float64(incomingTo + historyLen)
		} else if historyPos < incomingTo {
			incomingOp["to"] = float64(incomingTo + historyLen) // Insert in middle of delete
		}
	case incomingType == "delete" && historyType == "delete": // Delete | Delete
		incomingFrom, incomingFromOK := getIntValue(incomingOp["from"])
		incomingTo, incomingToOK := getIntValue(incomingOp["to"])
		historyFrom, historyFromOK := getIntValue(historyOp["from"])
		historyTo, historyToOK := getIntValue(historyOp["to"])
		if !incomingFromOK || !incomingToOK || !historyFromOK || !historyToOK {
			return
		}

		removedBefore := func(pos int) int {
			if pos <= historyFrom {
				return 0
			}
			if pos >= historyTo {
				return historyTo - historyFrom
			}
			return pos - historyFrom
		}

		newFrom := incomingFrom - removedBefore(incomingFrom)
		newTo := incomingTo - removedBefore(incomingTo)
		if newTo < newFrom {
			newTo = newFrom
		}

		incomingOp["from"] = float64(newFrom)
		incomingOp["to"] = float64(newTo)
	default:
		break
	}
}

func getIntValue(raw any) (int, bool) {
	switch value := raw.(type) {
	case float64:
		return int(value), true
	case int:
		return value, true
	case int64:
		return int(value), true
	case uint:
		return int(value), true
	case uint64:
		return int(value), true
	default:
		return 0, false
	}
}

func authorToInt64(raw any) (int64, bool) {
	switch value := raw.(type) {
	case float64:
		return int64(value), true
	case int:
		return int64(value), true
	case int64:
		return value, true
	case uint:
		return int64(value), true
	case uint64:
		return int64(value), true
	default:
		return 0, false
	}
}

func authorPrecedes(historyAuthor any, incomingAuthor any) bool {
	hID, hOK := authorToInt64(historyAuthor)
	iID, iOK := authorToInt64(incomingAuthor)
	if hOK && iOK {
		return hID < iID
	}
	return fmt.Sprintf("%v", historyAuthor) < fmt.Sprintf("%v", incomingAuthor)
}

func (room *Room) applyTextOperation(op map[string]any) bool {
	opType, ok := op["type"].(string)
	if !ok {
		return false
	}

	switch opType {
	case "insert":
		position, okPos := getIntValue(op["pos"])
		value, okValue := op["value"].(string)
		if !okPos || !okValue {
			return false
		}

		textLen := room.getTextLen()
		if position < 0 {
			position = 0
		} else if position > textLen {
			position = textLen
		}
		room.insertBytes(position, value)
		return true
	case "delete":
		from, okFrom := getIntValue(op["from"])
		to, okTo := getIntValue(op["to"])
		if !okFrom || !okTo {
			return false
		}

		if from > to {
			from, to = to, from
		}
		textLen := room.getTextLen()
		if from < 0 {
			from = 0
		}
		if to < from {
			to = from
		}
		if to > textLen {
			to = textLen
		}
		if from > textLen {
			from = textLen
		}

		if to > from {
			room.deleteByte(from, to-from)
		}
		return true
	default:
		return false
	}
}

func (room *Room) commitOperation(op map[string]any) {
	room.text_mu.Lock()
	room.version++
	op["version"] = room.version
	room.history = append(room.history, op)
	if len(room.history) > maxHistoryOps {
		excess := len(room.history) - maxHistoryOps
		room.history = room.history[excess:]
		room.historyBase += uint64(excess)
	}
	room.text_mu.Unlock()
}

/* This function goes through all past operations that are of equal or greater version than the current one and adjusts them to fit what it needs to be then sends out the broadcast
 * PARAMS: conn: the websocket connection, used to send out the message at the end ; json_mess: the incoming operation mapped as strings ;
 *	clientVersion: a uint64 value of the clients local version ; currentVersion: a uint64 value of the rooms most current version ; message: the operation as a string
 * RETURNS: Nothing, broadcasts message
 */
func (room *Room) versionMismatch(conn *websocket.Conn, json_mess map[string]any, clientVersion uint64, currentVersion uint64) {
	// Check for race Conditions
	if clientVersion > currentVersion {
		// Just apply the operation directly without transformation.
		if !room.applyTextOperation(json_mess) {
			log.Println("Invalid operation payload in version mismatch:", json_mess)
			return
		}

		// Update room version & history
		room.commitOperation(json_mess)

		// Convert the json_mess back to a JSON string
		updatedMessage, err := json.Marshal(json_mess)
		if err != nil {
			log.Println("Failed to marshal operation:", err)
			return
		}

		// Broadcast to other clients and send version acknowledgement to sender.
		room.broadcastUpdate(conn, "input_update", string(updatedMessage), true)
		room.sendUpdateToConnection(conn, "version_ack", map[string]any{"version": room.getVersion()})
		return
	}

	// Normal case: Client version is behind server version
	if clientVersion < room.historyBase {
		room.sendUpdateToConnection(conn, "resync_update", map[string]any{
			"text":    room.getText(),
			"version": room.getVersion(),
		})
		return
	}

	// Transform against history operations
	historyStart := clientVersion - room.historyBase
	if historyStart > uint64(len(room.history)) {
		historyStart = uint64(len(room.history))
	}
	for _, op := range room.history[historyStart:] {
		transformOp(json_mess, op)
	}

	// Apply transformed op
	if !room.applyTextOperation(json_mess) {
		log.Println("Invalid transformed operation payload:", json_mess)
		return
	}

	// Update room version & history
	room.commitOperation(json_mess)

	// Convert the transformed json_mess back to a JSON string
	updatedMessage, err := json.Marshal(json_mess)
	if err != nil {
		log.Println("Failed to marshal transformed operation:", err)
		return
	}

	// Broadcast transformed operation to others and only acknowledge version to sender.
	room.broadcastUpdate(conn, "input_update", string(updatedMessage), true)
	room.sendUpdateToConnection(conn, "version_ack", map[string]any{"version": room.getVersion()})
}

/* This function recieves a message from a websocket connection and dictates what we update/if we respond
*  PARAMS: message: the raw message we recieved from the webocket, conn: the socket connection that was the sender
*  RETURNS: none
 */
func (room *Room) handleMessages(message string, conn *websocket.Conn) {
	// Turn the raw text back into a usable type
	var json_mess map[string]any
	if err := json.Unmarshal([]byte(message), &json_mess); err != nil {
		log.Println("Invalid websocket message:", err)
		return
	}

	switch json_mess["event"] {
	case "text_update":
		room.op_mu.Lock()
		defer room.op_mu.Unlock()

		clientVersionInt, ok := getIntValue(json_mess["version"])
		if !ok || clientVersionInt < 0 {
			log.Println("Invalid version in incoming message:", json_mess["version"])
			return
		}
		clientVersion := uint64(clientVersionInt)
		currentVersion := room.getVersion()
		if clientVersion != currentVersion {
			room.versionMismatch(conn, json_mess, clientVersion, currentVersion)
			return
		}
		if !room.applyTextOperation(json_mess) {
			log.Println("Invalid text operation payload:", json_mess)
			return
		}
		room.commitOperation(json_mess)
		updatedMessage, err := json.Marshal(json_mess)
		if err != nil {
			log.Println("Failed to marshal operation for broadcast:", err)
			return
		}
		room.broadcastUpdate(conn, "input_update", string(updatedMessage), true)
		room.sendUpdateToConnection(conn, "version_ack", map[string]any{"version": room.getVersion()})
	default:
		log.Print("Invalid json event")
	}
}

/* This function gets the current version the room has
 * PARAMS: None
 * RETURNS: The room.version as a uint64
 */
func (room *Room) getVersion() uint64 {
	room.text_mu.RLock()
	defer room.text_mu.RUnlock()
	return room.version
}

func (room *Room) newUID() int {
	// generate id
	uid := room.nextUID
	room.nextUID++
	return uid
}

/* This is where we handle a new websocket connection after it has been upgraded and passes new messages to handleMessages()
* PARAMS: this function is called on the room we are adding to, conn: the new websocket connection
* RETURNS: none
 */
func (room *Room) NewConnection(conn *websocket.Conn) {
	// update our activeConnections so we can message persistently
	room.con_mu.Lock()
	room.activeConnections[conn] = true
	uid := room.newUID()
	room.connIDs[conn] = uid
	room.con_mu.Unlock()
	defer conn.Close()

	msg := sendUpdateJson{
		Event: "connection_update",
		Update: map[string]interface{}{
			"text":    room.getText(),
			"version": room.getVersion(),
			"uid":     uid,
		},
	}
	jsonData, err := json.Marshal(msg)
	// Catch the new connection up with the current state
	if err != nil {
		log.Println("Failed to marshall update message json: ", err)
	} else if err := conn.WriteMessage(websocket.TextMessage, jsonData); err != nil {
		conn.Close() // Close connection if it fails to send a message
		room.con_mu.Lock()
		delete(room.activeConnections, conn) // Remove broken connection
		room.con_mu.Unlock()
		return
	}

	// Listen for incoming messages from this specific connection
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway, websocket.CloseNoStatusReceived) {
				break
			}
			log.Println("Error reading message:", err)
			break
		}
		room.handleMessages(string(message), conn)
	}

	// Once the connection is closed, remove it from the active connections map
	room.con_mu.Lock()
	delete(room.activeConnections, conn)
	room.con_mu.Unlock()
}

/* Used to add text to the server's copy of a room's content
*  PARAMS: the index to add the text at, the text to add
*  RETURNS: none
 */

func (room *Room) insertBytes(index int, data string) {
	room.text_mu.Lock()
	defer room.text_mu.Unlock()

	// Ensure index is valid, idk if this is necessary
	if index < 0 || index > room.serverText.Len() {
		log.Printf("\nIndex out of range:\nIndex:%d\nLen:%d", index, room.serverText.Len())
		return
	} else {
		room.serverText = room.serverText.Insert(index, data)
	}
}

/* Deletes text from the server's copy of a room's content
*  PARAMS: the index to start deletion from, the number of characters to remove
*  RETURNS: none
 */
func (room *Room) deleteByte(index int, num_chars int) {
	room.text_mu.Lock()
	defer room.text_mu.Unlock()

	// Ensure index is valid
	if index < 0 || index > room.serverText.Len() {
		log.Println("Index out of range: ", index, " ", num_chars)
		return
	}
	newText, err := room.serverText.Delete(index+1, num_chars)
	if err != nil {
		fmt.Println("error", err)
		return
	}

	room.serverText = newText
}
