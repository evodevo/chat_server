A Socket.io Chat Server
=========================================

## Building and running a server

To build a project:

```bash
$ cd server
$ npm install
$ npm run build
```

To run a server:

```bash
$ cd server
$ npm start
```

or in debug mode:

```bash
$ DEBUG=server,chat npm start
```

To run tests:

```bash
$ cd server
$ npm test
```

To run a linter:

```bash
$ cd server
$ npm run tslint
```

## Testing manually

To connect with `wscat`:

```bash
$ wscat -c wss://localhost:3000/socket.io/\?EIO=3\&transport=websocket -n
```

Commands:

| Command                                 | Description                   |
|-----------------------------------------|-------------------------------|
| `42["join", {"channel": "room-1"}]` | Join a public channel named "room-1" |
| `42["join", {"channel": "room-2", "password": "secret"}]` | Join a private channel named "room-2" |
| `42["message", {"channel": "room-1", "content": "Hello everyone from client 1 to channel 1!"}]` | Send a message to a channel "room-1" |
| `42["count", {"channel": "room-1"}]` | Get users count in channel "room-1" |
| `42["leave", {"channel": "room-1"}]` | Leave a channel named "room-1" |
