import { Log } from './../log';
import { Subscriber } from './subscriber';
import express from 'express'

export class HttpSubscriber implements Subscriber {
    /**
     * Create new instance of http subscriber.
     *
     */
    constructor(private app: express.Application, private options: any) { }

    /**
     * Subscribe to events to broadcast.
     *
     * @return {Promise<void>}
     */
    async subscribe(callback: Function): Promise<void> {
        this.app.post('/apps/:appId/events', (req, res) => {
            let body: any = [];
            res.on('error', (error) => {
                if (this.options.devMode) {
                    Log.error(error);
                }
            });

            req.on('data', (chunk) => body.push(chunk))
                .on('end', () => this.handleData(req, res, body, callback));
        });

        Log.success('Listening for http events...');
    }

    /**
     * Unsubscribe from events to broadcast.
     *
     * @return {Promise<void>}
     */
    async unsubscribe(): Promise<void> {
        try {
            this.app.post('/apps/:appId/events', (req, res) => {
                res.status(404).send();
            });
        } catch(e) {
            throw new Error('Could not overwrite the event endpoint -> ' + e);
        }
    }

    /**
     * Handle incoming event data.
     *
     * @param  {any} req
     * @param  {any} res
     * @param  {any} body
     * @param  {Function} broadcast
     * @return {boolean}
     */
    handleData(req: any, res: any, body: any, broadcast: Function): boolean | void {
        body = JSON.parse(Buffer.concat(body).toString());

        if ((body.channels || body.channel) && body.name && body.data) {

            var data = body.data;
            try {
                data = JSON.parse(data);
            } catch (e) { }

            var message = {
                event: body.name,
                data: data,
                socket: body.socket_id
            }
            var channels = body.channels || [body.channel];

            if (this.options.devMode) {
                Log.info("Channel: " + channels.join(', '));
                Log.info("Event: " + message.event);
            }

            channels.forEach(channel => broadcast(channel, message));
        } else {
            return this.badResponse(
                req,
                res,
                'Event must include channel, event name and data'
            );
        }

        res.json({ message: 'ok' })
    }

    /**
     * Handle bad requests.
     *
     * @param  {any} req
     * @param  {any} res
     * @param  {string} message
     * @return {boolean}
     */
    badResponse(req: any, res: any, message: string): boolean {
        res.statusCode = 400;
        res.json({ error: message });

        return false;
    }
}
