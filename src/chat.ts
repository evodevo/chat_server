
import { Message, Channel, User } from "./models";
import * as Debug from "debug";
import * as bcrypt from "bcrypt";
import { Socket as Client } from "socket.io";
import { Validator, ValidationError } from "jsonschema";

const debug = Debug("chat");

/**
 * Channel join command interface.
 */
export interface JoinCommand {
    channel: string;
    password: string;
}

/**
 * Channel leave command interface.
 */
export interface LeaveCommand {
    channel: string;
}

/**
 * Channel message command interface.
 */
export interface MessageCommand {
    channel: string;
    content: string;
}

/**
 * Command to get the number of users in a channel.
 */
export interface CountCommand {
    channel: string;
}

/**
 * Chat service.
 */
export class Chat {
    /**
     * Chat users array.
     * @type {Array}
     */
    private users: Map<string, User> = new Map();

    /**
     * Json schema validator.
     */
    private validator = new Validator();

    /**
     * Available channels array.
     * @type {[Channel , Channel]}
     */
    private channels: Map<string, Channel> = new Map([
        ["room-1", new Channel("room-1")],
        ["room-2", new Channel("room-2", "$2b$12$9V4EaTPYyA3TR6XcuwMfneciGkNjseikfN54ANZN8eXIXTxxAvkey")],
    ]);

    public onConnect(client: Client): void {
        this.registerCommandHandlers(client);
        this.registerClient(client);
    }

    /**
     * Regisgters chat command handlers.
     * @param client
     */
    public registerCommandHandlers(client: Client): void {
        client.on("join", (command: JoinCommand) => this.join(client, command) );
        client.on("leave", (command: LeaveCommand) => this.leave(client, command) );
        client.on("message", (command: MessageCommand) => this.sendMessage(client, command) );
        client.on("count", (command: CountCommand) => this.countUsers(client, command) );
    }

    /**
     * Adds new user to chat.
     * @param client
     */
    public registerClient (client: Client): void {
        debug(`Adding user with client id ${client.id}`);
        this.users.set(client.id, new User(client));
    }

    /**
     * Creates new chat message.
     * @param client
     * @param {MessageCommand} command
     * @returns {Message}
     */
    public sendMessage (client: Client, command: MessageCommand): Message {
        debug(`(message): ${JSON.stringify(command)}`);

        command.content = command.content.trim();

        const result = this.validator.validate(command, {
            "type": "object",
            "properties": {
                "channel": {
                    "type": "string",
                    "pattern": "^[a-z0-9-_]{1,30}$"
                },
                "content": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 8000
                },
            },
            "required": ["channel", "content"],
        });
        if (!result.valid) {
            this.sendValidationErrors(client, result.errors);
            return;
        }

        const user = this.getUserByClientId(client.id);
        if (!user) {
            debug(`User does not exist for client with id ${client.id}`);
            client.emit("commandFailed", {error: `User does not exist for client with id ${client.id}`});
            return;
        }

        const channel: Channel = this.getChannelByName(command.channel);
        if (!channel) {
            debug(`Channel does not exist with id ${command.channel}`);
            client.emit("commandFailed", {error: `Channel does not exist with name ${command.channel}`});
            return;
        }

        const message = new Message(command.content, channel, user);
        if (!message.canBeDelivered()) {
            debug("User is not joined to a channel");
            client.emit("commandFailed", {error: "You must be joined to the channel to post messages"});
            return;
        }

        debug(`Sending message to ${channel.name} from user ${user.username}`);

        // Send this message to all users in a channel.
        message.send();
    }

    /**
     * Returns users count in channel.
     * @param {Client} client
     * @param {CountCommand} command
     * @returns {number}
     */
    public countUsers (client: Client, command: CountCommand): number {
        debug(`(count): ${JSON.stringify(command)}`);

        const result = this.validator.validate(command, {
            "type": "object",
            "properties": {
                "channel": {
                    "type": "string",
                    "pattern": "^[a-z0-9-_]{1,30}$"
                },
            },
            "required": ["channel"],
        });
        if (!result.valid) {
            this.sendValidationErrors(client, result.errors);
            return;
        }

        const user = this.getUserByClientId(client.id);
        if (!user) {
            debug(`User does not exist for client with id ${client.id}`);
            client.emit("commandFailed", {error: `User does not exist for client with id ${client.id}`});
            return;
        }

        const channel = this.getChannelByName(command.channel);
        if (!channel) {
            client.emit("commandFailed", {error: `Channel does not exist with name ${command.channel}`});
            return;
        }

        if (!user.isJoined(channel)) {
            client.emit("commandFailed", {error: "You must be joined to the channel to execute commands"});
            return;
        }

        debug(`Sending channel ${channel.name} users count to user ${user.username}`);

        // Sends channel users count to this user.
        channel.sendUsersCountTo(user);
    }

    /**
     * Handles user join command.
     * @param client
     * @param {JoinCommand} command
     */
    public async join (client: Client, command: JoinCommand): Promise<any> {
        debug(`(join): ${JSON.stringify(command)}`);

        const result = this.validator.validate(command, {
            "type": "object",
            "properties": {
                "channel": {
                    "type": "string",
                    "pattern": "^[a-z0-9-_]{1,30}$"
                },
                "password": {
                    "type": "string",
                    "maxLength": 128
                },
            },
            "required": ["channel"],
        });
        if (!result.valid) {
            this.sendValidationErrors(client, result.errors);
            return;
        }

        const user: User = this.getUserByClientId(client.id);
        if (!user) {
            debug(`User does not exist for client with id ${client.id}`);
            client.emit("commandFailed", {error: `User does not exist for client with id ${client.id}`});
            return;
        }

        const channel: Channel = this.getChannelByName(command.channel);
        if (!channel) {
            debug(`Channel does not exist with id ${command.channel}`);
            client.emit("commandFailed", {error: `Channel does not exist with name ${command.channel}`});
            return;
        }

        if (channel.isPrivate()) {
            if (!command.password) {
                debug("No password provided for a private channel");
                client.emit("commandFailed", {error: "You must provide a password to join a private channel"});
                return;
            }

            const isValidPassword = await channel.verifyPassword(command.password, bcrypt.compare);
            if (!isValidPassword) {
                debug(`Invalid password ${command.password} for channel ${channel.name}`);
                client.emit("commandFailed", {error: "Invalid password"});
                return;
            }
        }

        user.join(channel);

        debug(`User ${user.username} joined channel ${channel.name}`);
    }

    /**
     * Handles user leave command.
     * @param client
     * @param {LeaveCommand} command
     */
    public leave (client: Client, command: LeaveCommand): void {
        debug(`(leave): ${JSON.stringify(command)}`);

        const result = this.validator.validate(command, {
            "type": "object",
            "properties": {
                "channel": {
                    "type": "string",
                    "pattern": "^[a-z0-9-_]{1,30}$"
                },
            },
            "required": ["channel"],
        });
        if (!result.valid) {
            this.sendValidationErrors(client, result.errors);
            return;
        }

        const user = this.getUserByClientId(client.id);
        if (!user) {
            debug(`User does not exist for client with id ${client.id}`);
            client.emit("commandFailed", {error: `User does not exist for client with id ${client.id}`});
            return;
        }

        const channel = this.getChannelByName(command.channel);
        if (!channel) {
            client.emit("commandFailed", {error: `Channel does not exist with name ${command.channel}`});
            return;
        }

        if (!user.isJoined(channel)) {
            client.emit("commandFailed", {error: `You are not joined to the channel ${command.channel}`});
            return;
        }

        user.leave(channel);

        debug(`User ${user.username} left channel ${channel.name}`);
    }

    /**
     * Removes user from chat.
     * @param client
     */
    public onDisconnect (client: Client): void {
        debug(`Client disconnected ${client.id}`);

        const user = this.getUserByClientId(client.id);
        if (!user) {
            client.emit("commandFailed", {error: `User does not exist for client with id ${client.id}`});
            return;
        }

        debug(`User ${user.username} leaving all channels`);

        user.leaveAllChannels();

        this.users.delete(client.id);
    }



    /**
     * Gets user by its client id.
     * @param {string} id
     * @returns {User}
     */
    private getUserByClientId(id: string): User {
        return this.users.get(id);
    }

    /**
     * Gets channel by name.
     * @param {string} name
     * @returns {Channel}
     */
    private getChannelByName(name: string): Channel {
        return this.channels.get(name);
    }

    /**
     * Sends validation errors to the client.
     * @param {Client} client
     * @param {ValidationError[]} errors
     */
    private sendValidationErrors(client: Client, errors: ValidationError[]): void {
        const errorMessages: string[] = [];
        errors.forEach((error: ValidationError) => {
            debug(`Command validation failed, errors: ${JSON.stringify(errors)}`);
            errorMessages.push(`${error.property} ${error.message}`);
        });
        client.emit("commandFailed", {validationErrors: errorMessages});
    }
}