# mq-node-rabbitmq

Message Queue Layer for Node.JS over RabbitMQ

### Requirements

- node: >5.10
- npm: >3.3
- RabbitMQ: >3.6.1

#### Install dependencies

```
npm install [--production]
```

## [mocha](https://mochajs.org/) Testing and [istanbul](https://github.com/gotwarlost/istanbul) Coverage

```
npm run test -s
```

Coverage reports will be generated at `./coverage`

## [eslint](http://eslint.org/) linting check

```
npm run lint -s

```
## [jsDoc](http://usejsdoc.org/) Documentation

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
