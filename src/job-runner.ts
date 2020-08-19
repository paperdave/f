import { EventEmitter } from "events";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { getPresetFromString } from "./presets";
import fs from "fs-extra";
import path from "path";

export interface Job {
  file: string;
  output: string;
  presets: string[];
  backupName?: string;
  deleteSourceWhenDone?: boolean;
  copyTimeMetaData?: boolean;
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
  if(str === 'N/A') return 0;
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

  e.start = async(threads) => {
    if (e.running) return;
    e.running = true;

    const args = [
      '-threads', `${threads}`,
      '-i', `${job.file}`,
      ...job.presets.map(key => getPresetFromString(key).args || []).flat(),
      `${job.output}`
    ];

    await fs.ensureDir(path.dirname(job.output));
    
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

        let progress = Math.min(1, Math.max(0, parseTime(state.time) / parseTime(state.duration)));
        if(!isNaN(progress)) {
          e.progress = progress;
        }
        
        e.emit('progress', e.progress);
      } else {
        if (line.startsWith('  Duration')) {
          try {
            duration = (line.match(/Duration: (N\/A|[0-9\.\:]+)/) as any)[1];
          } catch (error) {
            console.log('no duration!!')
            console.log(line);
            throw error;
          }
        }
      }
    }
    let log = '';
    log += 'f media converter log\n';
    log += 'job:\n';
    log += JSON.stringify(job, null, 2) + '\n';
    log += 'command line:\n';
    log += `ffmpeg ${args.join(' ')}\n\n`;
    let buf = '';
    proc.stderr.on('data', (data) => {
      log += data;
      let str = buf + data.toString();
      const split = str.replace(/\r/g, '\n').split('\n');
      buf = split.pop() || '';
      split.forEach(x => processLine(x));
    })
    proc.on('exit', (code) => {
      try {
        if(code === 0) {
          e.progress = 1;
          e.sizeAfter = fs.statSync(job.output).size;
          if (job.copyTimeMetaData) {
            const stat = fs.statSync(job.file);
            fs.utimesSync(job.output, new Date(), stat.mtime);
          }
          if(job.deleteSourceWhenDone) {
            fs.unlinkSync(job.file);
          }
          e.emit('success');
        } else {
          if(job.backupName) {
            fs.moveSync(job.backupName, job.output);
          }
          fs.writeFileSync(job.output + '.error-log', log);
          if(fs.pathExistsSync(job.output))fs.removeSync(job.output);
          e.emit('failure', code);
        }
      } catch (error) {
        log += '\n\nJavascript Error:';
        log += error.stack;
        if(fs.pathExistsSync(job.output))fs.removeSync(job.output);
        e.emit('failure', 1000);
        if(job.backupName) {
          fs.moveSync(job.backupName, job.output);
        }
        fs.writeFileSync(job.output + '.error-log', log);  
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
