import mqtt, { type MqttClient as MqttJsClient, type IClientOptions } from 'mqtt';

export interface MqttConnectionOptions {
  host: string;
  port: number;
  clientId?: string;
}

export class SimulatorMqttClient {
  private client: MqttJsClient | undefined;

  constructor(private readonly options: MqttConnectionOptions) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `mqtt://${this.options.host}:${String(this.options.port)}`;

      const connectOptions: IClientOptions = {
        clientId: this.options.clientId,
        reconnectPeriod: 2000, // retry every 2s on disconnect
      };

      const client = mqtt.connect(url, connectOptions);
      this.client = client;

      client.once('connect', () => {
        resolve();
      });

      client.once('error', (err: Error) => {
        reject(err);
      });
    });
  }

  publish(topic: string, payload: string, qos: 0 | 1 | 2 = 1): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
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
}