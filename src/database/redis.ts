import { DatabaseDriver } from './database-driver'
import Redis from "ioredis"

export class RedisDatabase implements DatabaseDriver {
    /**
     * Redis client.
     */
    private _redis: Redis.Redis

    /**
     * Create a new cache instance.
     */
    constructor(private options) {
        this._redis = new Redis(options.databaseConfig.redis)
    }

    /**
     * Retrieve data from redis.
     */
    async get(key: string): Promise<any> {
        let value = await this._redis.get(key)
        if (value != null)
            return JSON.parse(value)
        else 
            return null
    }

    /**
     * Store data to cache.
     */
    async set(key: string, value: any): Promise<void> {
        this._redis.set(key, JSON.stringify(value))
        if (this.options.databaseConfig.publishPresence === true && /^presence-.*:members$/.test(key)) {
            await this._redis.publish('PresenceChannelUpdated', JSON.stringify({
                "event": {
                    "channel": key,
                    "members": value
                }
            }))
        }
    }

    /**
     * Publish data to Redis in channel so that other Subscriber can receive message
     */
    async pub(channel: string, message: string): Promise<void> {
        await this._redis.publish(channel, message)
        if (this.options.devMode) {
            console.log(`Publishing message to channel: ${channel}, with message: ${message}`)
        }
    }
}
