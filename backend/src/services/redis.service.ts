import EventEmitter from 'events';
import Redis from 'ioredis';

class RedisService {
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private localEmitter: EventEmitter = new EventEmitter();
  private isRedisConnected: boolean = false;
  private channelSubscribers: Map<string, Set<(message: any) => void>> = new Map();

  constructor() {
    this.localEmitter.setMaxListeners(200);
    this.init();
  }

  private init() {
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
      try {
        this.pubClient = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          retryStrategy: () => null // don't loop endlessly if redis is not running locally
        });

        this.subClient = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          retryStrategy: () => null
        });

        this.pubClient.on('connect', () => {
          this.isRedisConnected = true;
          console.log('[Redis] Connected to Redis server successfully');
        });

        this.pubClient.on('error', () => {
          this.isRedisConnected = false;
        });

        this.subClient.on('error', () => {
          this.isRedisConnected = false;
        });

        this.subClient.on('message', (ch, msg) => {
          const subscribers = this.channelSubscribers.get(ch);
          if (subscribers) {
            let parsed = msg;
            try {
              parsed = JSON.parse(msg);
            } catch {}
            subscribers.forEach((cb) => {
              try {
                cb(parsed);
              } catch (e) {
                console.error('[Redis] Subscriber callback error:', e);
              }
            });
          }
        });
      } catch (err: any) {
        this.isRedisConnected = false;
      }
    }
  }

  public async publish(channel: string, message: any): Promise<void> {
    const serialized = typeof message === 'string' ? message : JSON.stringify(message);

    if (this.isRedisConnected && this.pubClient) {
      try {
        await this.pubClient.publish(channel, serialized);
        return;
      } catch (err: any) {
        // Fallback to local on error
      }
    }

    // High performance local fallback
    this.localEmitter.emit(channel, serialized);
  }

  public subscribe(channel: string, callback: (message: any) => void): void {
    if (!this.channelSubscribers.has(channel)) {
      this.channelSubscribers.set(channel, new Set());
      if (this.isRedisConnected && this.subClient) {
        try {
          this.subClient.subscribe(channel);
        } catch {}
      }

      this.localEmitter.on(channel, (msg: string) => {
        let parsed = msg;
        try {
          parsed = JSON.parse(msg);
        } catch {}
        const subscribers = this.channelSubscribers.get(channel);
        if (subscribers) {
          subscribers.forEach((cb) => {
            try {
              cb(parsed);
            } catch (e) {
              console.error('[Redis/Local] Subscriber callback error:', e);
            }
          });
        }
      });
    }

    this.channelSubscribers.get(channel)!.add(callback);
  }

  public unsubscribe(channel: string, callback?: (message: any) => void): void {
    const subscribers = this.channelSubscribers.get(channel);
    if (subscribers) {
      if (callback) {
        subscribers.delete(callback);
      } else {
        subscribers.clear();
      }

      if (subscribers.size === 0) {
        this.channelSubscribers.delete(channel);
        if (this.isRedisConnected && this.subClient) {
          try {
            this.subClient.unsubscribe(channel);
          } catch {}
        }
        this.localEmitter.removeAllListeners(channel);
      }
    }
  }
}

export const redisService = new RedisService();
