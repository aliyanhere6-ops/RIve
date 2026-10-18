import assert from 'node:assert/strict';
import {colorNumber} from './detail-tracking.mjs';
assert.equal(colorNumber('#123abc'),0xff123abc);
assert.equal(colorNumber('#FFFFFF'),0xffffffff);
assert.throws(()=>colorNumber('red'));
console.log('PASS: background colour conversion');
