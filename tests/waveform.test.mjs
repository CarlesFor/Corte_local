import test from 'node:test';
import assert from 'node:assert/strict';
import { createPeakAccumulator } from '../electron/waveform.mjs';
import { waveformColumns, waveformGain } from '../shared/waveform.mjs';

test('PCM envelope survives arbitrary byte chunks and preserves opposite-phase stereo',()=>{
  const samples=[10000,-10000,16000,-16000,0,0,0,0,8000,-8000];
  const bytes=Buffer.alloc(samples.length*2);
  samples.forEach((value,i)=>bytes.writeInt16LE(value,i*2));
  const accumulator=createPeakAccumulator(2,2);
  for(let i=0;i<bytes.length;i+=3)accumulator.write(bytes.subarray(i,i+3));
  assert.deepEqual(accumulator.finish(),[0.4883,0,0.2441]);
});

test('visible columns locate silence after a source trim, split and speed change',()=>{
  const peaks=[0.4,0.4,0,0,0.8,0.8,0,0];
  assert.deepEqual(waveformColumns(peaks,0.5,0,4,8),peaks);
  assert.deepEqual(waveformColumns(peaks,0.5,1,3,4),[0,0,0.8,0.8]);
  // Right half of a split must start in the source, not repeat its first half.
  assert.deepEqual(waveformColumns(peaks,0.5,2,4,4),[0.8,0.8,0,0]);
  // A 2x clip of two timeline seconds covers four source seconds.
  assert.deepEqual(waveformColumns(peaks,0.5,0,2*2,4),[0.4,0,0.8,0]);
  // Zooming in on a silent sub-bin must stay flat; zooming out preserves a burst.
  assert.deepEqual(waveformColumns(peaks,0.5,1.1,1.4,3),[0,0,0]);
  assert.deepEqual(waveformColumns(peaks,0.5,0,4,1),[0.8]);
  assert.deepEqual(waveformColumns(peaks,0.5,4,5,2),[0,0]);
});

test('normalization remains source-wide without turning very quiet noise into peaks',()=>{
  assert.equal(waveformGain([0,0]),1);
  assert.equal(waveformGain([0.001,0.002]),8);
  assert.equal(waveformGain([0.1,0.5,0]),1.8);
});
