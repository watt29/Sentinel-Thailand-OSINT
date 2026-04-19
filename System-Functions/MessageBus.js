const EventEmitter = require('events');

/**
 * MessageBus: หัวใจการประสานงานแบบ Event-Driven
 * ช่วยให้ Agents สื่อสารกันได้โดยไม่ต้องรู้จัก Object ของกันและกัน (Decoupling)
 */
class MessageBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(20);
    }

    // มาตรฐานชื่อ Event: agent:action (เช่น trader:bet_placed, scout:bonus_found)
    publish(event, data) {
        this.emit(event, data);
    }

    subscribe(event, callback) {
        this.on(event, callback);
    }
}

module.exports = new MessageBus();
