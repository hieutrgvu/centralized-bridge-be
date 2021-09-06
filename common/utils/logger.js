function createLogger() {
    const logLevel = process.env.LOG_LEVEL || 'info'
    const defaultLogger = require('tracer').colorConsole({
        format: '{{timestamp}} <{{title}}> {{file}}:{{line}} {{message}}',
        dateformat: 'HH:MM:ss.L',
        level: logLevel,
    })
    return defaultLogger
}

module.exports.logger = createLogger();
