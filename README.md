# A Collaborative Code Editor

A real-time collaborative code editor built with **React** and **Go**. Features markdown-rendered code reviews, and a responsive layout.


## Motivation
- This project began as a [Hackathon project at KU](https://hackku-2025.devpost.com/), with the goal of creating a fast, lightweight way for students to share and collaborate on code in real time. Rather than relying on Git repositories or complex setup, NetCode focuses on immediate collaboration with minimal overhead. It is designed specifically for small teams who want to jump straight into writing and running code together.


## Quick Start
- Requirements:
 - Go 1.23 or newer
 - Node.js 18+ (npm included)
- Afterwards feel free to run make or copy the commands inside for a quick and easy setup


## Usage
- Allows for code review / code execution inside of the site, for this the code review is powered by a markdown rendering engine for clean output
- Based on custom diffing operations to allow for an efficient lightweight ecosytem
 - Utilizes a rope data structure with OT rules on top of a WebSocket backbone to allow for a very lightweight editing experience

## Contributing
- If you'd like to contribute, please fork and open a pull request to `main`

## Project Structure
 - real-time-app: The front end of the code where the site communicates with the backend and displays the code to the user
 - backend: Where the websocket server lives and communicates with Gemini
