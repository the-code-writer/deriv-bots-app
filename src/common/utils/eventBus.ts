import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

/**
 * Represents a strongly-typed event with a payload.
 */
type EventType<T extends string, P> = {
  type: T;
  payload: P;
};

/**
 * A map of event types to their payloads.
 * Extend this interface to add custom events.
 */
// Helper type for symbol events
// Helper type for symbol events
type SymbolEventRecord = { [key: symbol]: any };

// Base event map (extend this)
interface BaseEventMap {
  error: Error;
  debug: string;
}

/**
 * Advanced EventManager with type safety, async support, and debugging.
 */
class EventManager<
  TEvents extends BaseEventMap & SymbolEventRecord & { [key: symbol]: any } = BaseEventMap & SymbolEventRecord
> extends EventEmitter {
  private debugMode: boolean = false;
  private trackedListeners: Map<string | symbol, Function[]> = new Map();

  /**
   * Enables/disables debug logging.
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * Registers an event listener.
   * @param event The event type.
   * @param listener The callback function.
   * @returns A function to unsubscribe.
   */
  // @ts-ignore
  on<T extends string | symbol>(
    event: T,
    listener: (
      payload: T extends keyof TEvents
        ? TEvents[T]
        : T extends symbol
        ? TEvents[T]
        : never
    ) => void | Promise<void>
  ): this {
    const eventKey = event;
    // @ts-ignore
    const wrappedListener = this.wrapListener(eventKey, listener);
    super.on(eventKey, wrappedListener);

    if (!this.trackedListeners.has(eventKey)) {
      this.trackedListeners.set(eventKey, []);
    }
    this.trackedListeners.get(eventKey)?.push(listener);

    return this;
  }

  /**
   * Emits an event with a payload.
   * @param event The event type.
   * @param payload The data to send with the event.
   */
  // @ts-ignore
  emit<T extends string | symbol>(
    event: T,
    payload: T extends keyof TEvents
      ? TEvents[T]
      : T extends symbol
      ? TEvents[T]
      : any
  ): boolean {
    if (this.debugMode) {
      const startTime = performance.now();
      console.log(`[EventManager] Emitting "${event.toString()}"`, payload);
      const result = super.emit(event, payload);
      const duration = performance.now() - startTime;
      console.log(`[EventManager] Event "${event.toString()}" completed in ${duration.toFixed(2)}ms`);
      return result;
    }
    return super.emit(event, payload);
  }

  /**
   * Removes a specific listener.
   */
  // @ts-ignore
  off<T extends keyof TEvents>(
    event: T,
    listener: (payload: TEvents[T]) => void
  ): this {
    const eventKey = event as string | symbol;
    super.off(eventKey, listener);
    const listeners = this.trackedListeners.get(eventKey);
    if (listeners) {
      this.trackedListeners.set(
        eventKey,
        listeners.filter((l) => l !== listener)
      );
    }
    return this;
  }

  /**
   * Removes all trackedListeners for an event (or all events if none specified).
   */
  removeAllListeners(event?: string | symbol): this {
    if (event) {
      super.removeAllListeners(event);
      this.trackedListeners.delete(event);
    } else {
      super.removeAllListeners();
      this.trackedListeners.clear();
    }
    return this;
  }

  /**
   * Wraps a listener to handle errors and async operations.
   */
  private wrapListener<T extends keyof TEvents>(
    event: string | symbol,
    listener: (payload: TEvents[T]) => void | Promise<void>
  ): (payload: TEvents[T]) => void {
    return async (payload: TEvents[T]) => {
      try {
        await listener(payload);
      } catch (error) {
        // @ts-ignore
        this.emit('error', error as Error);
        if (this.debugMode) {
          console.error(`[EventManager] Listener error for "${event.toString()}":`, error);
        }
      }
    };
  }

  /**
   * Cleans up all trackedListeners (prevents memory leaks).
   */
  destroy(): void {
    this.removeAllListeners();
  }
}

// Export a default singleton instance (optional)
const defaultEventManager = new EventManager();

export { EventManager, defaultEventManager };

/*

// Create unique symbols for your events
const systemEvent = Symbol('systemEvent');
const anotherSymbolEvent = Symbol('anotherEvent');

// Define your event types
interface AppEvents extends BaseEventMap {
  userCreated: { id: string; name: string };
  messageReceived: { text: string; from: string };
  // Symbol events must be explicitly declared
  [systemEvent]: { level: number };
  [anotherSymbolEvent]: { action: string };
}

// Type-safe instantiation
// @ts-ignore
const eventManager = new EventManager<AppEvents>();

// Usage examples
eventManager.on('userCreated', (user) => {
  console.log(`User created: ${user.name}`);
});

eventManager.on(systemEvent, (data) => {
  console.log(`System event level: ${data.level}`);
});

eventManager.emit('userCreated', { id: '1', name: 'Alice' });
eventManager.emit(systemEvent, { level: 5 });

defaultEventManager.on('appStarted', (data) => {
  console.log('App started globally!', data);
});

defaultEventManager.emit('STOP_TRADING', {reason: reason});

*/