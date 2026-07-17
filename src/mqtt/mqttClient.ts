import mqtt, { type MqttClient as MqttJsClient, type IClientOptions } from 'mqtt';

export interface MqttConnectionOptions {
  host: string;
  port: number;
  clientId?: string;
  maxReconnectPeriodMs?: number;
}

export interface MqttLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

const defaultLogger: MqttLogger = {
  /* eslint-disable no-console */
  info: (msg) => { console.log(msg); },
  warn: (msg) => { console.warn(msg); },
  error: (msg) => { console.error(msg); },
  /* eslint-enable no-console */
};

export class SimulatorMqttClient {
  private client: MqttJsClient | undefined;
  private droppedMessageCount = 0;
  private reconnectCount = 0;

  constructor(
    private readonly options: MqttConnectionOptions,
    private readonly logger: MqttLogger = defaultLogger
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `mqtt://${this.options.host}:${String(this.options.port)}`;

      const connectOptions: IClientOptions = {
        clientId: this.options.clientId,
        reconnectPeriod: 2000, // initial retry interval; mqtt.js handles the retry loop
      };

      const client = mqtt.connect(url, connectOptions);
      this.client = client;

      client.once('connect', () => {
        resolve();
      });

      client.once('error', (err: Error) => {
        reject(err);
      });

      client.on('reconnect', () => {
        this.reconnectCount += 1;
        this.logger.warn(
          `MQTT client attempting reconnection (attempt #${String(this.reconnectCount)})`
        );
      });

      client.on('connect', () => {
        if (this.reconnectCount > 0) {
          this.logger.info(
            `MQTT client reconnected successfully after ${String(this.reconnectCount)} attempt(s)`
          );
        }
      });

      client.on('offline', () => {
        this.logger.warn('MQTT client is offline - telemetry publishing is paused until reconnected');
      });

      client.on('error', (err: Error) => {
        this.logger.error(`MQTT client error: ${err.message}`);
      });
    });
  }

  publish(topic: string, payload: string, qos: 0 | 1 | 2 = 1): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client?.connected) {
        this.droppedMessageCount += 1;
        this.logger.warn(
          `Dropped message while disconnected (topic: ${topic}, total dropped: ${String(this.droppedMessageCount)})`
        );
        reject(new Error('Cannot publish: MQTT client is not connected'));
        return;
      }

      this.client.publish(topic, payload, { qos }, (err?: Error) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  onReconnect(handler: () => void): void {
    this.client?.on('reconnect', handler);
  }

  onError(handler: (err: Error) => void): void {
    this.client?.on('error', handler);
  }

  disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.client) {
        resolve();
        return;
      }
      this.client.end(false, {}, () => {
        resolve();
      });
    });
  }

  isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  getDroppedMessageCount(): number {
    return this.droppedMessageCount;
  }

  getReconnectCount(): number {
    return this.reconnectCount;
  }
}