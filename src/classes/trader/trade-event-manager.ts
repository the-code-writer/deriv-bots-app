import { TradingEventType, TradingEventHandler, TradingEvent, EventHandlersMap, TradingEventPayloads } from './types';
export class TradingEventManager {
    private handlers: EventHandlersMap = {};
  
    /**
     * Register an event handler
     */
    on<T extends TradingEventType>(
      eventType: T,
      handler: TradingEventHandler<T>
    ): void {
      if (!this.handlers[eventType]) {
        this.handlers[eventType] = [];
      }
      (this.handlers[eventType] as TradingEventHandler<T>[]).push(handler);
    }
  
    /**
     * Emit an event
     */
    emit<T extends TradingEventType>(event: TradingEvent<T>): void;
    emit<T extends TradingEventType>(
      eventType: T,
      payload: TradingEventPayloads[T]
    ): void;
    emit<T extends TradingEventType>(
      eventOrType: TradingEvent<T> | T,
      payload?: TradingEventPayloads[T]
    ): void {
      let type: T;
      let actualPayload: TradingEventPayloads[T];
  
      if (typeof eventOrType === 'string') {
        type = eventOrType;
        actualPayload = payload!;
      } else {
        type = eventOrType.type;
        actualPayload = eventOrType.payload;
      }
  
      const handlers = this.handlers[type] as TradingEventHandler<T>[] | undefined;
      if (handlers) {
        handlers.forEach(handler => handler(actualPayload));
      }
    }
  
    /**
     * Remove all handlers for an event type
     */
    off<T extends TradingEventType>(eventType: T): void {
      delete this.handlers[eventType];
    }
  
    /**
     * Remove a specific handler
     */
    offHandler<T extends TradingEventType>(
      eventType: T,
      handler: TradingEventHandler<T>
    ): void {
      const handlers = this.handlers[eventType];
      if (handlers) {
        this.handlers[eventType] = handlers.filter(h => h !== handler) as any;
      }
    }
  }
  
  export const defaultEventManager = new TradingEventManager();

  /*

  // Registering handlers with full type safety
defaultEventManager.on(TradingEvent.StopTrading.type, (data) => {
  // data is automatically inferred as { reason: string; timestamp: number; profit: number }
  console.log('Trading stopped:', data.reason, data.profit);
});

// Emitting events - approach 1
defaultEventManager.emit(TradingEvent.StopTrading.type, {
  reason: "Market closed",
  timestamp: Date.now(),
  profit: 1250.50
});

// Emitting events - approach 2 (using creator function)
const stopEvent = TradingEvent.StopTrading.create({
  reason: "Daily profit target reached",
  timestamp: Date.now(),
  profit: 2500.75
});
defaultEventManager.emit(stopEvent);

*/