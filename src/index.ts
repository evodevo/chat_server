import { ChatServer } from "./server";
import { Chat } from "./chat";

const chatServer = new ChatServer(new Chat());
const server = chatServer.getServer();
const port = chatServer.getPort();

// We call listen separately so that we can pass custom callback in tests.
server.listen(port, () => {
    console.log(`Running server on port ${port}`);
});

export { server };