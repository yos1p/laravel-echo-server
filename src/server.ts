import fs from 'fs'
import url from 'url'
import http, { HttpBase } from 'http'
import https from 'https'
import { Log } from './log'
import io from 'socket.io'
import express from 'express'

export class Server {
    /**
     * The http server.
     *
     */
    public app?: express.Application;

    /**
     * Socket.io client.
     *
     */
    public io?: io.Server;

    /**
     * Create a new server instance.
     */
    constructor(private options: any) { }

    /**
     * Start the Socket.io server.
     *
     * @return {void}
     */
    async init(): Promise<io.Server | undefined> {
        await this.serverProtocol();
        let host = this.options.host || 'localhost';

        Log.success(`Running at ${host} on port ${this.getPort()}`);
        return this.io
    }

    /**
     * Sanitize the port number from any extra characters
     *
     * @return {number}
     */
    getPort(): number {
        let portRegex = /([0-9]{2,5})[\/]?$/;
        let portToUse = String(this.options.port).match(portRegex); // index 1 contains the cleaned port number only
        if (portToUse !== null) {
            return Number(portToUse[1]);
        }

        return 8080
    }

    /**
     * Select the http protocol to run on.
     *
     */
    async serverProtocol() {
        if (this.options.protocol == 'https') {
            await this.secure()
            this.httpServer(true)
        } else {
            this.httpServer(false)
        }
    }

    /**
     * Load SSL 'key' & 'cert' files if https is enabled.
     *
     */
    async secure() {
        if (!this.options.sslCertPath || !this.options.sslKeyPath) {
            throw new Error('SSL paths are missing in server config.');
        }

        Object.assign(this.options, {
            cert: fs.readFileSync(this.options.sslCertPath),
            key: fs.readFileSync(this.options.sslKeyPath),
            ca: (this.options.sslCertChainPath) ? fs.readFileSync(this.options.sslCertChainPath) : '',
            passphrase: this.options.sslPassphrase,
        });

        return this.options
    }

    /**
     * Create a socket.io server.
     *
     * @return {any}
     */
    httpServer(secure: boolean): void {
        this.app = express()
        this.app.use((req, res, next) => {
            for (var header in this.options.headers) {
                res.setHeader(header, this.options.headers[header]);
            }
            next();
        })

        let httpServer: http.Server
        if (secure) {
            httpServer = https.createServer(this.options, this.app);
        } else {
            httpServer = http.createServer(this.app);
        }        

        httpServer.listen(this.getPort(), this.options.host);

        this.authorizeRequests();

        this.io = io(httpServer, this.options.socketio);
    }

    /**
     * Attach global protection to HTTP routes, to verify the API key.
     */
    authorizeRequests(): void {
        this.app?.param('appId', (req, res, next) => {
            if (!this.canAccess(req)) {
                return this.unauthorizedResponse(req, res);
            }

            next();
        });
    }

    /**
     * Check is an incoming request can access the api.
     *
     * @param  {any} req
     * @return {boolean}
     */
    canAccess(req: any): boolean {
        let appId = this.getAppId(req);
        let key = this.getAuthKey(req);

        if (key && appId) {
            let client = this.options.clients.find((client) => {
                return client.appId === appId;
            });

            if (client) {
                return client.key === key;
            }
        }

        return false;
    }

    /**
     * Get the appId from the URL
     *
     * @param  {any} req
     * @return {string|boolean}
     */
    getAppId(req: any): (string | boolean) {
        if (req.params.appId) {
            return req.params.appId;
        }

        return false;
    }

    /**
     * Get the api token from the request.
     *
     * @param  {any} req
     * @return {string|boolean}
     */
    getAuthKey(req: any): (string | string[] | boolean) {
        if (req.headers.authorization) {
            return req.headers.authorization.replace('Bearer ', '');
        }

        if (url.parse(req.url, true).query.auth_key) {
            return url.parse(req.url, true).query.auth_key
        }

        return false;

    }

    /**
     * Handle unauthorized requests.
     *
     * @param  {any} req
     * @param  {any} res
     * @return {boolean}
     */
    unauthorizedResponse(req: any, res: any): boolean {
        res.statusCode = 403;
        res.json({ error: 'Unauthorized' });

        return false;
    }
}
