import { EventEmitter } from "events";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { presetMap } from "./presets";
import fs from "fs";

export interface Job {
  file: string;
  output: string;
  presets: string[];
}

export interface Runner extends EventEmitter {
  start: (threads: number) => void;
  cancel: () => void;
  progress: number;
  job: Job;
  running: boolean;

  sizeBefore: number;
  sizeAfter: number;
}

function parseTime(str: string) {
  const [hr, min, sec] = str.split(':').map(x => parseFloat(x));
  return (hr * 60 + min) * 60 + sec;
}

export function createRunner(ffmpeg: string, job: Job) {
  const e = new EventEmitter() as any as Runner;
  
  e.job = job;
  e.progress = 0;

  e.running = false;

  let duration: string;
  let state: Record<string, string> = {};
  let proc: ChildProcessWithoutNullStreams;

  e.sizeBefore = fs.statSync(job.file).size;

  e.start = (threads) => {
    if (e.running) return;
    e.running = true;

    const args = [
      '-threads', `${threads}`,
      '-i', `${job.file}`,
      ...job.presets.map(key => presetMap[key].args || []).flat(),
      `${job.output}`
    ];
    
    proc = spawn(ffmpeg, args, { stdio: 'pipe' });
    function processLine(line: string) {
      if (line.startsWith('frame=')) {
        //
        state = Object.fromEntries(line
          .replace(/=\s*/g, '=')
          .replace(/\s\s+/g, ' ')
          .split(' ')
          .map(s => s.split('=')));
        state.duration = duration;

        e.progress = Math.min(1, Math.max(0, parseTime(state.time) / parseTime(state.duration)));

        e.emit('progress', e.progress);
      } else {
        if (line.startsWith('  Duration')) {
          try {
            duration = (line.match(/Duration: ([0-9\.\:]+)/) as any)[1];
          } catch (error) {
            console.log('no duration!!')
            console.log(line);
            throw error;
          }
        }
      }
    }
    let buf = '';
    proc.stderr.on('data', (data) => {
      let str = buf + data.toString();
      const split = str.replace(/\r/g, '\n').split('\n');
      buf = split.pop() || '';
      split.forEach(x => processLine(x));
    })
    proc.on('exit', (code) => {
      if(code === 0) {
        e.progress = 1;
        e.sizeAfter = fs.statSync(job.output).size;
        e.emit('success');
      } else {
        e.emit('failure');
      }
      e.running = false;
    })
  };
  e.cancel = () => {
    if(e.running && proc) {
      proc.kill();
    }
    e.running = false;
  };

  return e as Runner;
}
