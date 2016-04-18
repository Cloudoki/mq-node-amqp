'use strict';
const debug = require('debug')('mq-node-amqp');
const EventEmitter = require('events');
const amqplib = require('amqplib');
const Promise = require('bluebird');
const _ = require('lodash');
const cuid = require('cuid');

// socketOptions http://www.squaremobius.net/amqp.node/ssl.html
// consider purge channel, recover channel

// consider check if there are consumers for the
// queue

const createConnection = config => Promise.resolve(amqplib.connect(config.url,
  config.socketOptions));

const createChannel = conn => Promise.resolve(conn.createChannel());

const createSimpleQueue = (ch, name, options) =>
  Promise.resolve(ch.assertQueue(name, options)).then(q => {
    q.channel = ch;
    q.send = (msg, opts) => q.channel
      .sendToQueue(q.queue, new Buffer(msg), opts);
    return q;
  });

const createReqResQueue = (ch, name, options) => {
  const _opts = options || {};
  const requestQueue = createSimpleQueue(ch, name,
    _.defaults(_opts.request || {}));

  const responseQueue = createSimpleQueue(ch,
    _opts ? _opts.responseQueue : '',
    _.defaults(_opts.response || {}, {
      exclusive: true
    }));

  const events = new EventEmitter();

  const consumer = responseQueue.then(res => ch.consume(res.queue,
    msg => events.emit(msg.properties.correlationId || 'msg', msg),
    _.defaults(_opts.consumer || {}, {
      noAck: true
    }))
  );

  return Promise.join(requestQueue, responseQueue, consumer, (req, res) => ({
    name,
    req,
    res,
    events,
    channel: ch,
    request: (msg, opts) => {
      const corr = cuid();
      let listener;

      debug('request: ' + corr, msg);

      const request = req.send(msg, _.defaults({
        correlationId: corr,
        replyTo: res.queue
      }, opts));

      const reply = new Promise(resolve => {
        listener = resolve;
        events.once(corr, resolve);
      }).timeout(_opts.timeout || 5000, corr + ' response timed out');

      reply.catch(Promise.TimeoutError, () =>
        events.removeListener(corr, listener));

      return Promise.join(reply, request, message => message);
    }
  }));
};
/*
config.connection.url
config.connection.socketOptions
config.queue.name
config.queue.options
config.queue.options.consumer
config.queue.options.request
config.queue.options.timeout
*/
const createCaller = config => {
  const caller = {};
  if (!config.queue) {
    config.queue = {};
  }
  return createConnection(config.connection || { url: 'amqp://localhost'})
  .then(conn => {
    debug('connection created');
    caller.connection = conn;
    caller.close = conn.close.bind(conn);
    return createChannel(conn);
  }).then(chn => {
    debug('channel created');
    caller.channel = chn;
    return createReqResQueue(
      chn,
      config.queue.name || 'rpc',
      config.queue.options || {
        consumer: {
          durable: false,
          autoDelete: true,
          messageTtl: 5000
        },
        request: {
          durable: false,
          autoDelete: true,
          messageTtl: 5000
        },
        timeout: 5000
      });
  }).then(queue => {
    debug('queue created');
    caller.queue = queue;
    caller.call = payload => Promise.resolve().then(() => {
      payload.id = payload.id || cuid();
      payload.ts = payload.ts || new Date().toISOString();
      debug('call', payload);
      const msg = JSON.stringify(payload);
      return queue.request(msg);
    }).then(reply =>
      JSON.parse(reply.content.toString())
    );
    debug('caller created');
    return caller;
  });
};

/*
config.connection.url
config.connection.socketOptions
config.queue.name
config.queue.options
config.queue.options.consumer
config.queue.options.request
config.queue.options.emitter
config.prefetch
*/
const createExecutor = config => {
  const executor = {};
  if (!config.queue) {
    config.queue = {};
  }
  if (!config.queue.options) {
    config.queue.options = {};
  }
  return createConnection(config.connection || { url: 'amqp://localhost'})
  .then(conn => {
    debug('connection created');
    executor.connection = conn;
    executor.close = conn.close.bind(conn);
    return createChannel(conn);
  }).then(chn => {
    executor.channel = chn;
    debug('channel created');
    return chn.prefetch(config.prefetch || 10);
  }).then(() => createSimpleQueue(
    executor.channel,
    config.queue.name || 'rpc',
    config.queue.options.request || {
      durable: false,
      autoDelete: true,
      messageTtl: 5000
    })
  ).then(() => {
    debug('rpc queue asserted');
    const emitterOptions = _.defaults(config.queue.options.emitter || {
      durable: false,
      autoDelete: true,
      messageTtl: 5000
    }, {
      noAck: true
    });
    const buildEmitterOptions = msg => {
      const options = _.clone(emitterOptions);
      options.correlationId = msg.properties.correlationId;
      debug('listen: ' + options.correlationId);
      return options;
    };

    executor.listen = (handler, onError) =>
      executor.channel.consume(config.queue.name || 'rpc',
        msg => {
          let payload;
          return Promise.resolve(executor.channel.ack(msg))
          .then(() => {
            payload = JSON.parse(msg.content.toString());
            debug('consume', payload);
            return payload;
          }).then(handler)
          .then(response => {
            const reply = response || {};
            reply.id = reply.id || payload.id;
            reply.pts = reply.pts || payload.ts;
            reply.rts = reply.rts || new Date().toISOString();
            debug('reply', reply);
            return executor.channel.sendToQueue(msg.properties.replyTo,
            new Buffer(JSON.stringify(reply)),
            buildEmitterOptions(msg));
          }).catch(onError || (err => {
            throw err;
          }));
        }, _.defaults(config.queue.options.consumer || {
          durable: false,
          autoDelete: true,
          messageTtl: 5000
        }, {
          noAck: false
        })
      );
    debug('executor created');
    return executor;
  });
};

module.exports = {
  createConnection,
  createChannel,
  createSimpleQueue,
  createReqResQueue,
  createCaller,
  createExecutor
};
