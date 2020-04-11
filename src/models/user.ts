
import { Channel } from "./channel";
import { Socket as Client } from "socket.io";

/**
 * Chat user.
 */
export class User {
    /**
     * User channels collection.
     * @type {Map<string, Channel>}
     */
    private channels: Map<string, Channel> = new Map();

    /**
     * Constructor.
     * @param {Client} client
     * @param {string} username
     */
    constructor(public readonly client: Client, public username: string = User.generateUsername()) {}

    /**
     * Join a channel.
     * @param {Channel} channel
     */
    public join(channel: Channel): void {
        this.client.join(channel.name);
        this.channels.set(channel.name, channel);

        channel.onUserJoined(this);
    }

    /**
     * Leave a channel.
     * @param {Channel} channel
     */
    public leave(channel: Channel): void {
        this.client.leave(channel.name);
        channel.removeUser(this);

        this.channels.delete(channel.name);
    }

    /**
     * Leave all channels.
     */
    public leaveAllChannels(): void {
        this.channels.forEach((channel: Channel) => {
            channel.removeUser(this);
        });

        this.channels.clear();
    }

    /**
     * Checks if user is joined the channel.
     * @param {Channel} channel
     * @returns {boolean}
     */
    public isJoined(channel: Channel): boolean {
        return this.channels.has(channel.name);
    }

    /**
     * Send a message to a channel from this user.
     * @param {string} content
     * @param {Channel} channel
     */
    public sendMessageToChannel(content: string, channel: Channel): void {
        this.client.in(channel.name).emit("message", {
            channel: channel.name,
            username: this.username,
            content: content,
        });
    }

    /**
     * Send event to this user only.
     * @param {string} name
     * @param content
     */
    public sendEvent(name: string, content: any): void {
        this.client.emit(name, content);
    }

    /**
     * Generates random username.
     * @returns {string}
     */
    private static generateUsername() {
        return "user" + Math.random().toString(10).substr(2, 10);
    }
}