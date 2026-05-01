function serialize(obj) {
    const out = { timestamp: new Date().toISOString() };
    for (const [k, v] of Object.entries(obj ?? {}))
        out[k] = v instanceof Error ? { message: v.message, stack: v.stack } : v;
    return out;
}

const logger = {
    info:  (obj) => process.stdout.write(JSON.stringify(serialize(obj)) + '\n'),
    error: (obj) => process.stderr.write(JSON.stringify(serialize(obj)) + '\n'),
};

const logWithRequest = function (req, data) {
    if (typeof data === 'string') {
        data = { message: data };
    }

    const enriched = req && req.uuid ? { ...data, requestid: req.uuid } : data;

    if (enriched.err) {
        logger.error(enriched);
        return;
    }

    logger.info(enriched);
};

export { logWithRequest, logger };
