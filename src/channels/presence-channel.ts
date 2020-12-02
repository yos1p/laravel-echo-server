import { RedisDatabase } from '../database/redis';
import { Database } from './../database';
import { Log } from './../log';
import { Server } from 'socket.io'
var _ = require("lodash");

export class PresenceChannel {
    /**
     * Database instance.
     */
    db: Database | RedisDatabase;

    /**
     * Create a new Presence channel instance.
     */
    constructor(private io: Server, private options: any) {
        this.db = new Database(options);
    }

    /**
     * Get the members of a presence channel.
     */
    async getMembers(channel: string): Promise<any> {
        return await this.db.get(channel + ":members");
    }

    /**
     * Check if a user is on a presence channel.
     */
    async isMember(channel: string, member: any): Promise<boolean> {
        let members = await this.getMembers(channel)
        members = await this.removeInactive(channel, members, member)

        let search = members.filter(
            (m) => m.user_id == member.user_id
        );

        if (search && search.length) {
            return true
        }

        return false
    }

    /**
     * Remove inactive channel members from the presence channel.
     */
    async removeInactive(channel: string, members: any[], member: any): Promise<any> {
        return new Promise((resolve, reject) => {
            this.io
                .of("/")
                .in(channel)
                .clients((error, clients) => {
                    members = members || [];
                    members = members.filter((member) => {
                        return clients.indexOf(member.socketId) >= 0;
                    });

                    this.db.set(channel + ":members", members);

                    resolve(members);
                });
        });
    }

    /**
     * Join a presence channel and emit that they have joined only if it is the
     * first instance of their presence.
     */
    async join(socket: any, channel: string, member: any): Promise<void> {
        if (!member) {
            if (this.options.devMode) {
                Log.error(
                    "Unable to join channel. Member data for presence channel missing"
                );
            }

            return;
        }

        let is_member = await this.isMember(channel, member)
        let members = await this.getMembers(channel)
        members = members || [];
        member.socketId = socket.id;
        members.push(member);

        this.db.set(channel + ":members", members);

        members = _.uniqBy(members.reverse(), "user_id");

        this.onSubscribed(socket, channel, members);

        if (!is_member) {
            await this.onJoin(socket, channel, member);
        }
    }

    /**
     * Remove a member from a presenece channel and broadcast they have left
     * only if not other presence channel instances exist.
     */
    async leave(socket: any, channel: string): Promise<void> {
        let members = await this.getMembers(channel)
        let member = members.find(
            (member) => member.socketId == socket.id
        );
        members = members.filter((m) => m.socketId != member.socketId);

        this.db.set(channel + ":members", members);

        let is_member = await this.isMember(channel, member)
        if (!is_member) {
            delete member.socketId;
            await this.onLeave(channel, member);
        }
    }

    /**
     * On join event handler.
     * 
     * Websocket also publish join channel here
     */
    async onJoin(socket: any, channel: string, member: any): Promise<void> {
        this.io.sockets.connected[socket.id].broadcast
            .to(channel)
            .emit("presence:joining", channel, member)
        if (this.db instanceof RedisDatabase) {
            await this.db.pub(`${channel}-join`, JSON.stringify(member))
        }
    }

    /**
     * On leave emitter.
     */
    async onLeave(channel: string, member: any): Promise<void> {
        this.io.to(channel).emit("presence:leaving", channel, member);
        if (this.db instanceof RedisDatabase) {
            await this.db.pub(`${channel}-leave`, JSON.stringify(member))
        }
    }

    /**
     * On subscribed event emitter.
     */
    onSubscribed(socket: any, channel: string, members: any[]) {
        this.io.to(socket.id).emit("presence:subscribed", channel, members);
    }
}
