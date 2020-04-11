
import { expect } from "chai";
import "mocha";
import { Server } from "https";
import * as socketIO from 'socket.io-client';
import { ChatServer } from "../src/server";
import { Chat } from "../src/chat";

let ioOptions = {
    transports: ['websocket'],
    forceNew: true,
    secure: true,
    rejectUnauthorized: false,
};

let client1: SocketIOClient.Socket;
let client2: SocketIOClient.Socket;

describe('Chat Events', () => {
    let server: Server;

    beforeEach((done) => {
        // Start the chat server.
        const chatServer = new ChatServer(new Chat());
        const port = chatServer.getPort();

        server = chatServer.getServer();

        server.listen(port, () => {
            client1 = socketIO.connect('https://localhost:3000/', ioOptions);
            client2 = socketIO.connect('https://localhost:3000/', ioOptions);

            done();
        });
    });

    afterEach((done) => {
        // Disconnect websocket clients after each test.
        client1.disconnect();
        client2.disconnect();

        // Shutdown the chat server.
        server.close(done);
    });

    describe('Join Channel', () => {
        it('should receive a greeting when joined to a public channel', (done) => {
            client1.on('greeting', (msg: any) => {
                expect(msg.content).to.contain("Hello");
                done();
            });
            client1.on("commandFailed", (msg: any) => {
                done();
            });
            client1.emit("join", {channel: "room-1"});
        });

        it('should require password for password protected channel', (done) => {
            client1.on('commandFailed', (msg: any) => {
                done();
            });
            client1.emit("join", {channel: "room-2"});
        });

        it('should allow joining password protected channel if password is valid', (done) => {
            client1.on('joined', (msg: any) => {
                expect(msg.channel).to.equal("room-2");
                done();
            });
            client1.emit("join", {channel: "room-2", password: 'secret'});
        });

        it('should not allow joining password protected channel if password is invalid', (done) => {
            client1.on('commandFailed', (msg: any) => {
                done();
            });
            client1.emit("join", {channel: "room-2", password: 'invalid'});
        });

        it('should not allow joining non-existing channel', (done) => {
            client1.on('commandFailed', (msg: any) => {
                done();
            });
            client1.emit("join", {channel: "room-3"});
        });
    });

    describe('Leave Channel', () => {
        it('should be able to leave a channel', (done) => {
            client1.on('greeting', (msg: any) => {
                if (msg.content.includes("Hello")) {
                    client1.emit("leave", {channel: "room-1"});
                    client1.emit("message", {channel: "room-1", content: "This should fail to deliver"});
                }
            });
            client1.on('commandFailed', (msg: any) => {
                done();
            });
            client1.emit("join", {channel: "room-1"});
        });

        it('should fail to leave a channel if not joined', (done) => {
            client1.on('commandFailed', (msg: any) => {
                done();
            });
            client1.emit("leave", {channel: "room-1"});
        });
    });

    describe('Send Message', () => {
        it('should deliver a message to all users in a channel', (done) => {
            client2.on('message', (msg: any) => {
                expect(msg.content).to.equal("Hello everyone");
                done();
            });
            client1.on('greeting', (msg: any) => {
                if (msg.content.includes("Hello")) {
                    client1.emit("message", {channel: "room-1", content: "Hello everyone"});
                }
            });

            client2.emit("join", {channel: "room-1"});
            client1.emit("join", {channel: "room-1"});
        });

        it('should fail to deliver a message when not joined to a channel', (done) => {
            client1.on("commandFailed", (msg: any) => {
                done();
            });
            client1.emit("message", {channel: "room-1", content: "This should fail to deliver"});
        });
    });

    describe('User Count', () => {
        it('should receive channel users count when joined to the channel', (done) => {
            client1.on('greeting', (msg: any) => {
                if (msg.content.includes("Hello")) {
                    client1.emit("count", {channel: "room-1"});
                }
            });
            client1.on('usersCount', (msg: any) => {
                expect(msg.channel).to.equal("room-1");
                expect(msg.count).to.equal(2);
                done();
            });

            client2.emit("join", {channel: "room-1"});
            client1.emit("join", {channel: "room-1"});
        });

        it('should fail to get users count if not joined to the channel', (done) => {
            client1.on("commandFailed", (msg: any) => {
                done();
            });

            client1.emit("count", {channel: "room-1"});
        });
    });

    describe('Random numbers', () => {
        it('should receive a random number no later than 6 seconds after joined to a channel', (done) => {
            client1.on("random", (msg: any) => {
                expect(msg.channel).to.equal("room-1");
                done();
            });

            client1.emit("join", {channel: "room-1"});
        }).timeout(6000);
    });
})