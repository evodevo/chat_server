import { createServer, Server } from "https";
import * as express from "express";
import * as socketIO from "socket.io";
import { RateLimiter } from "limiter";
import * as fs from "fs";
import * as Debug from "debug";
import { Chat } from "./chat";

const debug = Debug("server");

/**
 * Socket.io chat server.
 */
export class ChatServer {
    /**
     * Default server port number.
     * @type {number}
     */
    public static readonly PORT: number = 3000;

    /**
     * Allowed commands per second.
     * @type {number}
     */
    public static readonly RATE_LIMIT_TOKENS_PER_INTERVAL = 20;

    /**
     * Rate limit interval.
     * @type {number}
     */
    public static readonly RATE_LIMIT_INTERVAL = 30000; // 30 seconds

    /**
     * Socket.io ping interval.
     * @type {number}
     */
    public static readonly SOCKETIO_PING_INTERVAL = 60000; // 1 minute.

    /**
     * Socket.io ping timeout.
     * @type {number}
     */
    public static readonly SOCKETIO_PING_TIMEOUT = 60000; // 1 minute.

    private app: express.Application;
    private server: Server;
    private io: socketIO.Server;

    /**
     * Listen port number.
     */
    private port: number;

    /**
     * Constructor.
     * @param {Chat} chat service
     */
    constructor(private chat: Chat) {
        this.port = Number(process.env.PORT) || ChatServer.PORT;
        this.app = express();

        const options = {
            key: fs.readFileSync("./cert/server.key"),
            cert: fs.readFileSync("./cert/server.crt"),
            requestCert: false,
            rejectUnauthorized: false
        };
        this.server = createServer(options, this.app);

        this.io = socketIO(this.server, {
            pingInterval: ChatServer.SOCKETIO_PING_INTERVAL,
            pingTimeout: ChatServer.SOCKETIO_PING_TIMEOUT,
        });

        this.io.on("connect", (client: socketIO.Socket) => { this.onConnect(client); });
    }

    /**
     * Rate limiting middleware for socketIO.
     * @param client
     * @returns {(packet: any, next: any) => any}
     */
    private createSocketRateLimiterMiddleware(client: socketIO.Socket) {
        const rateLimiter = new RateLimiter(
            ChatServer.RATE_LIMIT_TOKENS_PER_INTERVAL,
            ChatServer.RATE_LIMIT_INTERVAL
        );

        return (packet: any, next: any) => {
            // If rate limit is exceeded, connection is dropped.
            if (!rateLimiter.tryRemoveTokens(1)) {
                debug(`Too many requests from ${client.conn.remoteAddress}, disconnecting.`);
                client.emit("commandFailed", { error: "Too many requests, disconnecting." });
                client.disconnect();
                return;
            }
            next();
        };
    }

    /**
     * Handles connect event.
     * @param client
     */
    onConnect = (client: socketIO.Socket): void => {
        debug(`Connected client with id ${client.id}`);

        client.use(this.createSocketRateLimiterMiddleware(client));

        this.chat.onConnect(client);

        client.on("disconnect", () => this.chat.onDisconnect(client) );
    };

    /**
     * Returns server port number.
     * @returns {number}
     */
    public getPort(): number {
        return this.port;
    }

    /**
     * Returns server instance.
     * @returns {Server}
     */
    public getServer(): Server {
        return this.server;
    }
}