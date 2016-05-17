# mq-node-amqp

Message Queue Layer for Node.JS over AMQP

The Message Queue layer services as a message bus between the API layer
instances and the Business Logic Module instances (N <-> M). It implements
a [Remote Procedural Call](https://www.rabbitmq.com/tutorials/tutorial-six-javascript.html)
  through a [work queue](https://www.rabbitmq.com/tutorials/tutorial-two-javascript.html).

* [Features](#features)
* [How to Install](#how-to-install)
* [RabbitMQ](#rabbitmq)
* [Usage](#usage)
  + [Remote Procedural Call](#remote-procedural-call)
    - [Create a caller and send payload](#create-a-caller-and-send-payload)
    - [Create a executor and process payloads](#create-a-executor-and-process-payloads)
    - [How does the caller react if there are no servers?](#how-does-the-caller-react-if-there-are-no-servers)
    - [Does the caller have some kind of timeout for the RPC?](#does-the-caller-have-some-kind-of-timeout-for-the-rpc)
    - [If the executor malfunctions and raises an exception, is it forwarded to the caller?](#if-the-executor-malfunctions-and-raises-an-exception-is-it-forwarded-to-the-caller)
    - [Payload generated fields](#payload-generated-fields)
    - [Debugging](#debugging)
* [Testing and Coverage](#testing-and-coverage)
* [Linting check](#linting-check)
* [API Reference](#api-reference)

## Features
- Integrates with the **3-layered architecture**:
    * Message Queue Layer [api-node-swagger](https://github.com/Cloudoki/api-node-swagger)
    * Business Logic Module [blm-node-sequelize](https://github.com/Cloudoki/blm-node-sequelize)
- **Remote Procedural Call** through a work queue

## How to Install

Requirements:

- node: >5.10
- npm: >3.3
- RabbitMQ: >3.6.1 (or equivalent AMQP broker)

Install dependencies:

```
npm install [--production]
```

## RabbitMQ

 - [Install RabbitMQ](https://www.rabbitmq.com/install-debian.html)
 - [Management Plugin](https://www.rabbitmq.com/management.html)

```
rabbitmq-plugins enable rabbitmq_management
```
 - How to create a adminstrator:

```
rabbitmqctl add_user admin yourpassword
rabbitmqctl set_user_tags admin administrator
rabbitmqctl set_permissions -p / admin ".*" ".*" ".*"
```
 - [Access Control](http://www.rabbitmq.com/access-control.html)
 - [Server Adminstration](https://www.rabbitmq.com/admin-guide.html)

## Usage

### Remote Procedural Call

#### Create a caller and send payload

```javascript
const amqp = require('mq-node-amqp');
amqp.createCaller({
  connection: {
    url: 'amqp://localhost'
  },
  queue: {
    name: 'rpc'
  }
}).then(caller => caller.call(payload)
    .then(response => console.log(response))
    .catch(err => console.log('Remote Procedural Call failed', err))
  ).catch(err => console.log('failed setting up the caller', err));
```

#### Create a executor and process payloads

```javascript
const amqp = require('mq-node-amqp');
amqp.createExecutor({
  connection: {
    url: 'amqp://localhost'
  },
  queue: {
    name: 'rpc'
  }
}).then(exec => {
    executor = exec;
    return executor.listen(function process(payload) {
      // do your processing here and return a promise of the result
      return Promise.resolve(payload)
    },
      err => console.log('failed to respond to a request', err);
    );
  }).then(() => {
    console.log('now listening');
  }).catch(err => {
    console.log('failed setting up the executor', err);
  });
```

#### How does the caller react if there are no servers?

If there's is no amqp server running it will fail to setup the caller.
If it's the executor service, it will attempt to execute the call but timeout.

#### Does the caller have some kind of timeout for the RPC?

Yes, the listener to the reply also times out on 5 seconds waiting for a
reply message. Also all messages are ephemeral, they stay only up to 5 seconds
on the generated queues.

#### If the executor malfunctions and raises an exception, is it forwarded to the caller?

No, if the process fails an reply message won't be sent and the caller
will timeout on waiting for it. If the message is sent but is not processed correctly
that is the client responsability to ensure if the message corresponds to what is expected.


#### Payload generated fields

If there is no id or ts fields on the payload sent to the caller through
 the `Caller.call(payload)` method it will auto fill them with a generated
 cuid for id and ISO string timestamp for ts.

```javascript
payload.id = payload.id || cuid();
payload.ts = payload.ts || new Date().toISOString();
```

However this id does not correspond to the id used to on the message
property `correlationId` which is generated

The executor will do something similar where: it will create a reply
object mixin of the response object received from the reply queue and
add in the id from the payload and timestamp on the `pts` field and the
`rts` for the reply timestamp.

```javascript
const reply = response || {};
reply.id = reply.id || payload.id;
reply.pts = reply.pts || payload.ts;
reply.rts = reply.rts || new Date().toISOString();
```

#### Debugging

For debugging this module you can use the debug `mq-node-amqp` DEBUG environment variable.

`DEBUG=mq-node-amqp`

As long as your are not doing a compute intensive task to produce the object to debug
you may leave the debug statment there since it will be converted to noop function
(`() => ()`) if not in debugging mode and shouldn't affect performance.


Coverage reports will be generated at `./coverage`

## Testing and Coverage

- [mocha](https://mochajs.org/)
- [istanbul](https://github.com/gotwarlost/istanbul)

```
npm run test -s
```

## Linting check

- [eslint](http://eslint.org/)

```
npm run lint -s

```
## API Reference

- [jsDoc](http://usejsdoc.org/)

```
npm run docs -s
```

Documentation will be generated at `./docs`


To inspect `./coverage` and `./docs` you may want to serve your local files.
You can use `http-server` for that:

```
npm install -g http-server
http-server
```
