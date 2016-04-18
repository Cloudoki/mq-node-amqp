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
      assert(new Date(reply.rts) - new Date(reply.pts) < 100);
      expect(reply.result).to.equal('test executed');
      cb();
    }));

    amqp.createExecutor({
      queue: {
        name: 'rpc_test'
      }
    }).then(executor => executor.listen(() => ({
      result: 'test executed'
    })));
  });
});
