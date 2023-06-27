import ws, { EventEmitter } from "ws";
import dgram, { Socket } from "dgram";

export default class StuntFetcher extends EventEmitter {
  private ws: ws;
  private client: Socket;
  private debug: boolean;
  private masterServerHost: string;
  private masterServerPort: number;
  private hardCodedServerHost: string;
  private hardCodedServerPort: number;

  /**
   * Creates a new StuntFetcher instance
   * @param port default 38019
   * @param host default localhost
   * @param options default { debug: false }
   */
  constructor(
    port: number = 38019,
    host: string = "localhost",
    options?: {
      debug?: boolean;
      masterServerHost?: string;
      masterServerPort?: number;
      hardCodedServerHost?: string;
      hardCodedServerPort?: number;
    }
  ) {
    if (!options) options = {};

    super();
    this.ws = new ws(host ?? "localhost", { port: port ?? 38019 });
    this.client = dgram.createSocket("udp4");

    this.debug = options.debug ?? false;

    this.masterServerHost = options.masterServerHost ?? "66.226.72.227";
    this.masterServerPort = options.masterServerPort ?? 29969;

    this.hardCodedServerHost = options.hardCodedServerHost ?? "66.226.72.227";
    this.hardCodedServerPort = options.hardCodedServerPort ?? 29960;

    let clientConnected = false;

    const isConnectionOpen = () => {
      return this.ws.readyState === ws.OPEN && clientConnected;
    };

    this.client.bind({
      exclusive: true,
      address: this.masterServerHost,
      port: this.masterServerPort,
    });

    this.ws.on("message", (data) => {
      if (this.debug) console.log(data);
    });

    this.ws.on("open", () => {
      if (isConnectionOpen()) this.emit("open");
    });

    this.ws.on("error", (err) => {
      this.emit("error", err);
    });

    this.client.on("error", (err) => {
      this.emit("error", err);
    });

    this.client.on("connect", () => {
      clientConnected = true;
      if (isConnectionOpen()) this.emit("open");
    });
  }

  public async getServers(includeDedicated: boolean = true) {
    const buffer = await this.getMasterServerBuffer(
      this.client,
      this.masterServerHost,
      this.masterServerPort
    );
    const servers = this.parseMasterServerBuffer(buffer);

    let serverInfos: StuntServerInfo[] = [];
    for (const server of servers) {
      const buffer = await this.getServerInfo(server);
      const serverInfo = this.parseServerInfoBuffer(buffer);
      serverInfos.push(serverInfo);
    }

    if (includeDedicated) {
      const buffer = await this.getHardCodedServerInfo();
      const serverInfo = this.parseServerInfoBuffer(buffer);
      serverInfos.push(serverInfo);
    }

    return serverInfos;
  }

  private getMasterServerBuffer(client: Socket, address: string, port: number) {
    const buffer = Buffer.from("StuPJ", "ascii");
    client.send(buffer, port, address);

    return new Promise<Buffer>((resolve, reject) => {
      client.on("message", (msg, rinfo) => {
        resolve(msg);
      });

      client.on("error", (err) => {
        reject(err);
      });
    });
  }

  private parseMasterServerBuffer(buffer: Buffer) {
    const servers: bigint[] = [];
    const serverCount = buffer.readUInt32LE(5);

    for (let i = 0; i < serverCount; i++) {
      servers.push(buffer.readBigUint64LE(9 + i * 8));
    }

    return servers;
  }

  private async getServerInfo(server: bigint) {
    return new Promise<Buffer>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject("Timeout");
      });

      this.ws.send(Buffer.from(server.toString()));

      const messageHandler = (data: Buffer) => {
        resolve(data);
        this.ws.off("message", messageHandler);
        clearTimeout(timeout);
      };

      this.ws.on("message", messageHandler);
    });
  }

  private async getHardCodedServerInfo() {
    return new Promise<Buffer>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject("Timeout");
      });

      this.client.send(Buffer.from("StuP\x00\x1C\x00"), this.hardCodedServerPort, this.hardCodedServerHost);

      const messageHandler = (data: Buffer) => {
        resolve(data);
        this.client.off("message", messageHandler);
        clearTimeout(timeout);
      };

      this.client.on("message", messageHandler);
    });
  }

  private parseServerInfoBuffer(buffer: Buffer) {
    const type: number = buffer.readUInt8(0);
    const version: number = buffer.readUInt8(1);
    const subVersion: number = buffer.readUInt8(2);
    const currentPlayers: number = buffer.readUInt8(3);
    const maxPlayers: number = buffer.readUInt8(5);
    const serverType: number = buffer.readUInt8(6);
    const serverName: string = buffer.toString("ascii", 7, 7 + 32);

    return {
      type,
      version,
      subVersion,
      currentPlayers,
      maxPlayers,
      serverType,
      serverName,
    };
  }
}

interface StuntServerInfo {
  type: number;
  version: number;
  subVersion: number;
  currentPlayers: number;
  maxPlayers: number;
  serverType: number;
  serverName: string;
}

export { StuntFetcher };
