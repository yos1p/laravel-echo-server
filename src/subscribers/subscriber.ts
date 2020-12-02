import { Channel } from "../channels";

export interface Subscriber {
    /**
     * Subscribe to incoming events.
     *
     * @param  {Function} callback
     * @return {void}
     */
    subscribe(callback: Function): Promise<void>;

    /**
     * Unsubscribe from incoming events
     *
     * @return {Promise}
     */
    unsubscribe(): Promise<void>;
}
