'use strict';

const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;
describe('amqp', () => {
  const amqp = require('../src/amqp');
  it('should call a remote procedure', cb => {
    amqp.createCaller({
      queue: {
        name: 'rpc_test'
      }
    }).then(caller => caller.call({
      operation: 'test',
      message: 'test message'
    }).then(reply => {
      const now = new Date().getTime();
      assert(now - new Date(reply.payload.ts) < 100);
      expect(reply.result).to.equal('test executed');
      cb();
    }));

    amqp.createExecutor({
      queue: {
        name: 'rpc_test'
      }
    }).then(executor => executor.listen(payload => ({
      payload,
      result: 'test executed'
    })));
  });
});
