import type { AddressInfo } from "node:net";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { startServer } from "../../src/server.js";

export interface TestServerHandle {
    url: string;
    close: () => Promise<void>;
}

export async function bootTestServer(): Promise<TestServerHandle> {
    // port 0 -> OS assigns a free ephemeral port. Required (not just tidy): node --test runs
    // multiple test files concurrently in separate processes by default, so a fixed port would
    // race across integration test files.
    const { httpServer, io } = await startServer(0);
    const address = httpServer.address();
    if (address === null || typeof address === "string") {
        throw new Error("Server is not listening on a TCP port");
    }
    const port = (address as AddressInfo).port;

    return {
        url: `http://localhost:${port}`,
        // io.close() already closes the underlying httpServer too (confirmed against the
        // installed socket.io source) -- calling httpServer.close() afterward is redundant
        // and errors.
        close: async () => {
            await io.close();
        },
    };
}

export function connectClient(url: string): Promise<ClientSocket> {
    return new Promise((resolve) => {
        const socket = ioClient(url, { transports: ["websocket"] });
        socket.on("connect", () => resolve(socket));
    });
}

export function waitForEvent<T = unknown>(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeoutMs);
        socket.once(event, (payload: T) => {
            clearTimeout(timer);
            resolve(payload);
        });
    });
}

export function emitWithAck<T = unknown>(socket: ClientSocket, event: string, payload: unknown): Promise<T> {
    return new Promise((resolve) => {
        socket.emit(event, payload, (response: T) => resolve(response));
    });
}
