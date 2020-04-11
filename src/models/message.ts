
import { Channel } from "./channel";
import { User } from "./user";

/**
 * Chat message.
 */
export class Message {
    /**
     * Constructor.
     * @param {string} content
     * @param {Channel} channel
     * @param {User} user
     */
    constructor(public readonly content: string, public readonly channel: Channel, public readonly user: User) {}

    /**
     * Checks if message can be delivered to channel by user.
     * @returns {boolean}
     */
    public canBeDelivered(): boolean {
        return this.user.isJoined(this.channel);
    }

    /**
     * Sends this message to all users in a channel.
     */
    public send(): void {
        this.user.sendMessageToChannel(this.content, this.channel);
    }
}