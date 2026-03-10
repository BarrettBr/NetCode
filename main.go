package main

import (
	"log"
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/contrib/static"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	roomhandler "github.com/Xavanion/NetCode/backend/room-handling"
	terminalhandler "github.com/Xavanion/NetCode/backend/terminal-handling"
)

// Upgrade HTTP request to WS connection
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func main() {
	// Create a new manager to handler all rooms that get spun off later
	roomManager := roomhandler.NewRoomManager()
	terminalManager := terminalhandler.NewTerminalManager()

	router := gin.Default()

	router.Use(cors.New(cors.Config{
		AllowOrigins:  []string{"***"},
		AllowMethods:  []string{"POST", "PATCH"},
		AllowHeaders:  []string{"Origin", "Content-Type", "Accept"},
		ExposeHeaders: []string{"Content-Length"},
		AllowOriginFunc: func(origin string) bool {
			return origin == "https://github.com"
		},
	}))
	// Serve frontend static files
	router.Use(static.Serve("/", static.LocalFile("real-time-app/dist", true)))

	router.NoRoute(func(c *gin.Context) {
		c.File("real-time-app/dist/index.html")
	})

	// Setup route group for the API
	api := router.Group("/api")
	{
		api.POST("/", func(c *gin.Context) {
			var requestData roomhandler.ApiRequest
			if err := c.ShouldBindJSON(&requestData); err != nil {
				// If the binding fails, return an error
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			// Check if the room exists, if it does we tell that room to do the api request
			room, exists := roomManager.GetRoom(requestData.Room)
			if exists {
				room.FileApiRequest(requestData, c)
			}
		})
		// Websocket endpoint
		api.GET("/ws", func(c *gin.Context) {
			roomID := string(c.Query("room"))
			log.Println(roomID, c.Query("room"))
			if roomID == "" {
				//c.JSON(http.StatusBadRequest, gin.H{"error": "room ID required"})
				log.Print("Bad Request")
				return
			}
			// Upgrade GET request to a WebSocket
			conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
			if err != nil {
				return
			}
			log.Print("room: ", string(roomID))
			room, exists := roomManager.GetRoom(roomID)
			if exists {
				room.NewConnection(conn)
			} else {
				room := roomManager.CreateRoom(roomID)
				room.NewConnection(conn)
			}
		})
		api.GET("/terminal/ws", func(c *gin.Context) {
			roomID := string(c.Query("room"))
			if roomID == "" {
				log.Print("Bad terminal websocket request")
				return
			}

			conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
			if err != nil {
				return
			}

			terminalManager.HandleConnection(roomID, conn)
		})
	}
	router.Run("0.0.0.0:9090")
}
