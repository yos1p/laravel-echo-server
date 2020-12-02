import { DatabaseDriver } from './database-driver'
import { SQLiteDatabase } from './sqlite'
import { RedisDatabase } from './redis'
import { Log } from './../log'

/**
 * Class that controls the key/value data store.
 */
export class Database implements DatabaseDriver {
    /**
     * Database driver.
     */
    private driver?: DatabaseDriver

    /**
     * Create a new database instance.
     */
    constructor(private options: any) {
        if (options.database == 'redis') {
            this.driver = new RedisDatabase(options)
        } else if (options.database == 'sqlite') {
            this.driver = new SQLiteDatabase(options)
        } else {
            Log.error('Database driver not set.')
        }
    }

    /**
     * Get a value from the database.
     */
    async get(key: string): Promise<any> {
        if (this.driver == null) {
            throw new Error('Database not initialized properly')
        }

        return await this.driver.get(key)
    }

    /**
     * Set a value to the database.
     */
    async set(key: string, value: any): Promise<void> {
        if (this.driver == null) {
            throw new Error('Database not initialized properly')
        }

        await this.driver.set(key, value)
    }
}
