import Redis from 'ioredis'
import { Log } from './../log';
import { Subscriber } from './subscriber';

export class RedisSubscriber implements Subscriber {
    /**
     * Redis pub/sub client.
     *
     * @type {Redis.Redis}
     */
    private _redis: Redis.Redis;

    /**
     *
     * KeyPrefix for used in the redis Connection
     *
     * @type {string}
     */
    private _keyPrefix: string;

    /**
     * Create a new instance of subscriber.
     *
     * @param {any} options
     */
    constructor(private options: any) {
        this._keyPrefix = options.databaseConfig.redis.keyPrefix || '';
        this._redis = new Redis(options.databaseConfig.redis);
    }

    /**
     * Subscribe to events to broadcast.
     *
     * @return {Promise<void>}
     */
    async subscribe(callback: Function): Promise<void> {
        this._redis.on('pmessage', (subscribed, channel, message) => {
            try {
                message = JSON.parse(message);

                if (this.options.devMode) {
                    Log.info("Channel: " + channel);
                    Log.info("Event: " + message.event);
                }

                callback(channel.substring(this._keyPrefix.length), message);
            } catch (e) {
                if (this.options.devMode) {
                    Log.info("No JSON message");
                }
            }
        });
        await this._redis.psubscribe(`${this._keyPrefix}*`);
        Log.success('Listening for redis events...')
    }

    /**
     * Unsubscribe from events to broadcast.
     *
     * @return {Promise<void>}
     */
    async unsubscribe(): Promise<void> {
        try {
            this._redis.disconnect();
        } catch(err) {
            throw new Error('Could not disconnect from redis -> ' + err);
        }
    }
}
