
import { User } from "./user";
import { Observable } from "rxjs";

/**
 * Chat channel.
 */
export class Channel {
    /**
     * Random number stream interval.
     * @type {number}
     */
    public static readonly DEFAULT_RANDOM_INTERVAL = 5000;

    /**
     * Channel users.
     * @type {Set<User>}
     */
    private users: Set<User> = new Set();

    /**
     * Constructor.
     * @param {string} name
     * @param {string} passwordHash
     */
    constructor(public name: string, public passwordHash: string = "") {
        this.randomNumberStream().subscribe((n: number): void => { this.sendRandom(n); });
    }

    /**
     * Returns true if channel is private.
     * @returns {boolean}
     */
    public isPrivate(): boolean {
        return this.passwordHash !== "";
    }

    /**
     * Adds user to channel.
     * @param {User} user
     */
    public addUser(user: User): void {
        this.users.add(user);
    }

    /**
     * Removes user from channel.
     * @param {User} user
     */
    public removeUser(user: User): void {
        this.users.delete(user);
    }

    /**
     * Gets users count in channel.
     * @returns {number}
     */
    public getUsersCount(): number {
        return this.users.size;
    }

    /**
     * Sends channel users count to a given user.
     * @param {User} user
     */
    public sendUsersCountTo(user: User): void {
        user.sendEvent("usersCount", {channel: this.name, count: this.getUsersCount()});
    }

    /**
     * Handles newly joined user.
     * @param {User} user
     */
    public onUserJoined(user: User): void {
        this.addUser(user);

        user.sendEvent("joined", {channel: this.name});

        if (!this.isPrivate()) {
            this.greet(user);
        }
    }

    /**
     * Sends a greeting to a joined user.
     * @param {User} user
     */
    public greet(user: User): void {
        user.sendEvent("greeting", {channel: this.name, content: `Hello ${user.username}`});
    }

    /**
     * Verifies password for this channel.
     * @param {string} candidatePassword
     * @param {Function} comparisonFunction
     * @returns {Promise<boolean>}
     */
    public async verifyPassword(candidatePassword: string, comparisonFunction: Function): Promise<boolean> {
        return await comparisonFunction(candidatePassword, this.passwordHash);
    }

    /**
     * Sends random number to all users in this channel.
     * @param {number} n
     */
    public sendRandom(n: number): void {
        this.users.forEach((user: User) => {
            user.sendEvent("random", {channel: this.name, number: n.toString()});
        });
    }

    /**
     * Creates random number stream.
     * @returns {Observable<number>}
     */
    public randomNumberStream(interval: number = Channel.DEFAULT_RANDOM_INTERVAL): Observable<number> {
        return new Observable(sub => {
            let timeout: NodeJS.Timer;

            // Send a random number to the subscriber.
            (function push() {
                timeout = setTimeout(
                    () => {
                        sub.next(Math.random());
                        push();
                    },
                    interval
                );
            })();

            // Clear any pending timeout.
            return () => clearTimeout(timeout);
        });
    }
}