import WebSocket from "ws";
import { NostrMessage } from "../types/protocol";
import EventEmitter from "events";

export class RelayConnection extends EventEmitter {
  private ws: WebSocket;
  private messageHandlers: ((data: string) => void)[] = [];
  private url: string;

  constructor(url: string) {
    super();
    this.url = url;
    this.ws = new WebSocket(url);

    this.ws.on("open", () => {
      this.emit("open");
    });

    this.ws.on("error", (error) => {
      this.emit("error", error);
    });

    this.ws.on("close", () => {
      this.emit("close");
    });

    this.ws.on("message", (data: WebSocket.Data) => {
      const message = data.toString();
      this.messageHandlers.forEach((handler) => handler(message));
    });
  }

  public get readyState(): number {
    return this.ws.readyState;
  }

  public send(message: NostrMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.send(JSON.stringify(message), (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  public onMessage(handler: (data: string) => void): void {
    this.messageHandlers.push(handler);
  }

  public removeMessageHandler(handler: (data: string) => void): void {
    const index = this.messageHandlers.indexOf(handler);
    if (index !== -1) {
      this.messageHandlers.splice(index, 1);
    }
  }

  public close(): void {
    this.ws.close();
  }

  public on(event: "open" | "close", listener: () => void): this;
  public on(event: "error", listener: (error: Error) => void): this;
  public on(
    event: "open" | "error" | "close",
    listener: (() => void) | ((error: Error) => void),
  ): this {
    return super.on(event, listener);
  }

  public removeListener(event: "open" | "close", listener: () => void): this;
  public removeListener(event: "error", listener: (error: Error) => void): this;
  public removeListener(
    event: "open" | "error" | "close",
    listener: (() => void) | ((error: Error) => void),
  ): this {
    return super.removeListener(event, listener);
  }

  public getUrl(): string {
    return this.url;
  }
}
