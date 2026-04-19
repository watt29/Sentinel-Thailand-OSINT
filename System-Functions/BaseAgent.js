const AI = require('./AIProvider');
const MessageBus = require('./MessageBus');
const logger = require('./Logger');
const db = require('./Database');

/**
 * BaseAgent: The foundation for all AI Agents in the Paperclip ecosystem.
 * Following ADK principles (Instruction, Tools, Memory).
 */
class BaseAgent {
    constructor(config = {}) {
        this.name = config.name || 'AnonymousAgent';
        this.role = config.role || 'Assistant';
        this.instructions = config.instructions || 'You are a helpful assistant.';
        this.model = config.model || 'gemini-2.0-flash';
        this.tools = new Map();
        this.history = [];
        this.maxHistory = config.maxHistory || 20;
    }

    /**
     * Register a JavaScript function as a tool for the AI.
     * @param {string} name 
     * @param {string} description 
     * @param {object} parameters JSON Schema of parameters
     * @param {function} fn The actual JS function to execute
     */
    registerTool(name, description, parameters, fn) {
        this.tools.set(name, {
            definition: {
                name,
                description,
                parameters
            },
            execute: fn
        });
        logger.info(`Agent [${this.name}]: Tool registered - ${name}`);
    }

    /**
     * Run the agent with a user prompt.
     * @param {string} userInput 
     */
    async ask(userInput) {
        this.history.push({ role: 'user', parts: [{ text: userInput }] });
        
        let retryCount = 0;
        const maxRetries = 5;

        while (retryCount < maxRetries) {
            const toolDefinitions = Array.from(this.tools.values()).map(t => t.definition);
            
            // Prepare the system instruction as the first message or specialized instruction
            const systemPrompt = `Role: ${this.role}\nInstructions: ${this.instructions}`;
            
            // Note: Gemini v1beta supports system instructions separately, but here we prepending.
            // For simplicity in this implementation, we use history.
            
            try {
                const response = await AI.call(null, {
                    history: [
                        { role: 'user', parts: [{ text: systemPrompt }] },
                        ...this.history
                    ],
                    tools: toolDefinitions.length > 0 ? toolDefinitions : null,
                    model: this.model,
                    full_response: true
                });

                if (response.type === 'text') {
                    this.history.push({ role: 'model', parts: [{ text: response.content }] });
                    this._trimHistory();
                    return response.content;
                }

                if (response.type === 'tool_call') {
                    const { name, args } = response.function_call;
                    logger.info(`Agent [${this.name}]: Calling tool ${name} with args: ${JSON.stringify(args)}`);
                    
                    const tool = this.tools.get(name);
                    if (!tool) {
                        throw new Error(`Tool ${name} not found`);
                    }

                    let result;
                    try {
                        result = await tool.execute(args);
                    } catch (e) {
                        result = { error: e.message };
                        logger.error(`Agent [${this.name}]: Tool ${name} failed: ${e.message}`);
                    }

                    // Push the tool call and response back to history
                    this.history.push({
                        role: 'model',
                        parts: [{ functionCall: { name, args } }]
                    });
                    
                    this.history.push({
                        role: 'user', // In Gemini v1beta, function response is usually under role 'user' or 'function'
                        // Actually it should be 'function' in some versions, but 'user' with response parts also works.
                        // Let's use the format Gemini expects for function responses.
                        parts: [{
                            functionResponse: {
                                name: name,
                                response: { content: JSON.stringify(result) }
                            }
                        }]
                    });

                    retryCount++;
                    continue; // Loop again for the AI to process the tool result
                }
            } catch (e) {
                logger.error(`Agent [${this.name}]: Error during execution: ${e.message}`);
                throw e;
            }
        }
        
        throw new Error("Max tool call retries exceeded");
    }

    _trimHistory() {
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(-this.maxHistory);
        }
    }

    publish(event, data) {
        MessageBus.publish(`${this.name.toLowerCase()}:${event}`, data);
    }

    subscribe(event, callback) {
        MessageBus.subscribe(event, callback);
    }

    saveState() {
        db.saveAgentState(this.name, { history: this.history });
    }

    loadState() {
        const state = db.getAgentState(this.name);
        if (state && state.history) {
            this.history = state.history;
        }
    }
}

module.exports = BaseAgent;
