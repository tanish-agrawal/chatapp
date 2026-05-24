# SleekChat - Real-Time Chat Application

SleekChat is a high-performance, real-time chatting application built using a Java Full Stack architecture. It features a responsive, glassmorphic dark-mode Single-Page Application (SPA) frontend and a secure, event-driven Spring Boot backend.

## Tech Stack & Highlights

- **Backend**: Spring Boot 3.4.x, Spring Web (REST API), Spring Security (Stateless JWT Authentication), Spring WebSocket (STOMP Broker).
- **Database**: H2 Database (File-based storage. Persists data inside a `./data` directory in the project root so chat history and users are saved across restarts).
- **Frontend**: Single-Page Application (SPA) using HTML5, Vanilla CSS, and Vanilla JavaScript (SockJS + STOMP clients for real-time messaging).

---

## Features

1. **User Authentication & Authorization**:
   - Clean Log In and Sign Up pages.
   - Password hashing via Spring Security's `BCryptPasswordEncoder`.
   - Token-based JWT authorization for REST APIs and WebSocket handshakes.
2. **Real-Time Messaging**:
   - Integrated STOMP over WebSocket broker.
   - Message history persisted and retrieved dynamically when logging in.
3. **Online Status Checking**:
   - Real-time connection and disconnection listeners monitor user presence.
   - Dynamic user listing with live status badges.
   - Clean, disappearing system notifications for online/offline events.

---

## Project Structure

```text
ChatApp/
├── pom.xml
├── README.md
├── data/ (Created automatically on startup to save database records)
└── src/
    └── main/
        ├── java/
        │   └── com/
        │       └── example/
        │           └── chat/
        │               ├── ChatApplication.java
        │               ├── config/
        │               │   ├── SecurityConfig.java
        │               │   ├── WebSocketConfig.java
        │               │   └── WebSocketEventListener.java
        │               ├── controller/
        │               │   ├── AuthController.java
        │               │   └── ChatController.java
        │               ├── filter/
        │               │   └── JwtAuthenticationFilter.java
        │               ├── model/
        │               │   ├── ChatMessage.java
        │               │   ├── User.java
        │               │   └── UserStatusMessage.java
        │               ├── repository/
        │               │   ├── ChatMessageRepository.java
        │               │   └── UserRepository.java
        │               └── service/
        │                   ├── JwtService.java
        │                   └── UserService.java
        └── resources/
            ├── application.properties
            └── static/
                ├── index.html
                ├── style.css
                └── app.js
```

---

## How to Run the Application

You have Java 21 installed. Here are the two easiest ways to build and run the application:

### Option A: Import into an IDE (Recommended)
Since this is a standard Maven project:
1. Open your favorite Java IDE (e.g., **IntelliJ IDEA**, **Eclipse**, or **VS Code**).
2. Select **Open** and choose the `C:\Users\swadi\Downloads\ChatApp` directory.
3. The IDE will automatically read the `pom.xml` file, download the required dependencies, and configure the project.
4. Open [ChatApplication.java](file:///C:/Users/swadi/Downloads/ChatApp/src/main/java/com/example/chat/ChatApplication.java) and click **Run** (or `Shift + F10` in IntelliJ).

### Option B: Run via command line (Maven)
If you have Maven installed locally:
1. Open PowerShell or Command Prompt in the project folder.
2. Build the project:
   ```bash
   mvn clean package
   ```
3. Run the Spring Boot application:
   ```bash
   mvn spring-boot:run
   ```

---

## Testing the Chat Flow

1. Once the application starts, open your browser and navigate to:
   [http://localhost:8080](http://localhost:8080)
2. Open a second browser tab (or incognito window) at [http://localhost:8080](http://localhost:8080).
3. **Register/Login User A** in Tab 1, and **Register/Login User B** in Tab 2.
4. Verify that User A shows up in User B's "Online Members" list in the sidebar, and vice versa.
5. Send messages and watch them deliver instantly.
6. Close Tab 1 (User A) and observe User A's status change to "Offline" for User B in real-time.
7. Re-login or refresh to see chat history load successfully.
