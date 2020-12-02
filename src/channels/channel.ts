import { PresenceChannel } from './presence-channel';
import { PrivateChannel } from './private-channel';
import { Log } from './../log';
import io from 'socket.io'

export class Channel {
    /**
     * Channels and patters for private channels.
     */
    protected _privateChannels: string[] = ['private-*', 'presence-*'];

    /**
     * Allowed client events
     */
    protected _clientEvents: string[] = ['client-*'];

    /**
     * Private channel instance.
     */
    private: PrivateChannel;

    /**
     * Presence channel instance.
     */
    presence: PresenceChannel;

    /**
     * Create a new channel instance.
     */
    constructor(private io: io.Server, private options) {
        this.private = new PrivateChannel(options);
        this.presence = new PresenceChannel(io, options);

        if (this.options.devMode) {
            Log.success('Channels are ready.');
        }
    }

    /**
     * Join a channel.
     */
    async join(socket: io.Socket, data): Promise<void> {
        if (data.channel) {
            if (this.isPrivate(data.channel)) {
                await this.joinPrivate(socket, data);
            } else {
                socket.join(data.channel);
                this.onJoin(socket, data.channel);
            }
        }
    }

    /**
     * Trigger a client message
     */
    clientEvent(socket: io.Socket, data) {
        try {
            data = JSON.parse(data);
        } catch (e) {
            data = data;
        }

        if (data.event && data.channel) {
            if (this.isClientEvent(data.event) &&
                this.isPrivate(data.channel) &&
                this.isInChannel(socket, data.channel)) {
                this.io.sockets.connected[socket.id]
                    .broadcast.to(data.channel)
                    .emit(data.event, data.channel, data.data);
            }
        }
    }

    /**
     * Leave a channel.
     */
    async leave(socket: io.Socket, channel: string, reason: string): Promise<void> {
        if (channel) {
            if (this.isPresence(channel)) {
                await this.presence.leave(socket, channel)
            }

            socket.leave(channel);

            if (this.options.devMode) {
                Log.info(`[${new Date().toISOString()}] - ${socket.id} left channel: ${channel} (${reason})`);
            }
        }
    }

    /**
     * Check if the incoming socket connection is a private channel.
     */
    isPrivate(channel: string): boolean {
        let isPrivate = false;

        this._privateChannels.forEach(privateChannel => {
            let regex = new RegExp(privateChannel.replace('\*', '.*'));
            if (regex.test(channel)) isPrivate = true;
        });

        return isPrivate;
    }

    /**
     * Join private channel, emit data to presence channels.
     */
    async joinPrivate(socket: io.Socket, data: any): Promise<void> {
        try {
            let res = await this.private.authenticate(socket, data)
            socket.join(data.channel)

            if (this.isPresence(data.channel)) {
                var member = res.channel_data;
                try {
                    member = JSON.parse(res.channel_data);
                } catch (e) { }

                await this.presence.join(socket, data.channel, member);
            }

            this.onJoin(socket, data.channel);
        } catch (error) {
            if (error instanceof ChannelError) {
                if (this.options.devMode) {
                    Log.error(error.reason);
                }
    
                this.io.sockets.to(socket.id)
                    .emit('subscription_error', data.channel, error.statusCode);
            } else {
                if (this.options.devMode) {
                    Log.error(error.message);
                }

                this.io.sockets.to(socket.id)
                    .emit('subscription_error', data.channel, 500);
            }
            
        }
    }

    /**
     * Check if a channel is a presence channel.
     */
    isPresence(channel: string): boolean {
        return channel.lastIndexOf('presence-', 0) === 0;
    }

    /**
     * On join a channel log success.
     */
    onJoin(socket: any, channel: string): void {
        if (this.options.devMode) {
            Log.info(`[${new Date().toISOString()}] - ${socket.id} joined channel: ${channel}`);
        }
    }

    /**
     * Check if client is a client event
     */
    isClientEvent(event: string): boolean {
        let isClientEvent = false;

        this._clientEvents.forEach(clientEvent => {
            let regex = new RegExp(clientEvent.replace('\*', '.*'));
            if (regex.test(event)) isClientEvent = true;
        });

        return isClientEvent;
    }

    /**
     * Check if a socket has joined a channel.
     */
    isInChannel(socket: any, channel: string): boolean {
        return !!socket.rooms[channel];
    }
}

export class ChannelError extends Error {

    reason: string
    statusCode: number 

    constructor(reason: string, statusCode: number) {
        super(reason)
        this.reason = reason
        this.statusCode = statusCode
    }
}