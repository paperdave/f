#!/usr/bin/node
import Yargs from 'yargs';
import path from 'path';
import chalk from 'chalk';
import wrap from 'wrap-ansi';
import * as glob from 'glob';
import os from 'os';
import { presetMap, presetList } from './presets';
import { Job, createRunner, Runner } from './job-runner';
import { renderJobList, renderFinishedJob } from './render';

const argv = process.argv.slice(2).map(arg => {
  const array = glob.sync(arg);
  return array.length === 0 ? arg : array;
}).flat();

const width = Math.min(Yargs.terminalWidth(), 80);

const yargs = Yargs(argv)
  .scriptName('f')
  .usage('Usage: $0 [options] <files> <preset>')
  .option('ffmpeg', { default: "ffmpeg", desc: "ffmpeg command to run" })
  .alias('ffmpeg', 'f')
  .option('output', { default: "[name].[ext]", desc: "output path" })
  .alias('output', 'o')
  .option('threads', { type: 'number', default: os.cpus().length - 1, desc: "thread count. also controls max jobs at once." })
  .alias('threads', 't')
  .help()
  .epilogue([
    'Presets:',
    ...presetList.map(({ name, desc}) => {
      return wrap(`${typeof name === 'string' ? chalk.greenBright(name) : name.map(x => chalk.greenBright(x)).join(', ')} - ${desc}`, width - 4).replace(/^/gm, x => '    ').slice(2).replace(/^ */gm, x => chalk.black(x));
    }),
    chalk.black(' '),
  ].join('\n'));

const args = yargs.argv;
const positional = args._;

if(positional.length === 0) {
  yargs.showHelp();
  process.exit(1);
}

const jobs: Job[] = [];
let currentFiles: string[] = [];
let currentPresets: string[] = [];
let lastArgType = 'unknown' as ('preset' | 'file' | 'unknown');
function pushJobs() {
  jobs.push(...currentFiles.map(f => path.resolve(f)).map(file => {
    const basename = path.relative(process.cwd(), path.resolve(file)).slice(0, -path.extname(file).length);
    const ext = currentPresets.map(key => presetMap[key].extension).filter(Boolean).pop() || path.extname(file);
    
    return {
      file,
      presets: currentPresets.concat(),
      output: path.resolve(args.output.replace(/\[name\]/g, basename).replace(/\[ext\]/g, ext))
    }
  }));
  currentFiles = [];
  currentPresets = [];
}
for (let i = 0; i < positional.length; i++) {
  const arg = positional[i];
  if (presetMap[arg]) {
    if (currentPresets.length && currentFiles.length && lastArgType === 'file') {
      pushJobs();
    }
    currentPresets.push(arg);
  } else {
    if (currentPresets.length && currentFiles.length && lastArgType === 'preset') {
      pushJobs();
    }
    currentFiles.push(arg);
  }
}
if ((currentPresets.length !== 0) || (currentFiles.length !== 0)) {
  if ((currentPresets.length === 0)) {
    console.log(`Presets not specified! (files: ${currentFiles.join(', ')})`)
    process.exit();
  }
  if ((currentFiles.length === 0)) {
    console.log(`Files not specified! (presets: ${currentPresets.join(', ')})`)
    process.exit();
  }
  pushJobs();
}

let queue = jobs.map(x => createRunner(args.ffmpeg, x))
let running: Runner[] = [];

console.log(`f media converter, ${queue.length} job${queue.length === 1 ? '' : 's'} queued.\n`);

queue.forEach((runner) => {
  runner.on('progress', () => {
    renderJobList({
      runners: running,
      queued: queue.length,
    });
  })
  runner.on('success', () => {
    renderFinishedJob(runner);
    running = running.filter(x => runner !== x);
    const next = queue.pop();
    if (next) {
      next.start(1);
      running.push(next);
    }
    renderJobList({
      runners: running,
      queued: queue.length,
    });
  })
});

if(queue.length > args.threads) {
  // we need to do a different method
  for (let i = 0; i < args.threads; i++) {
    const element = queue.shift();
    if(element) {
      element.start(1);
      running.push(element);
    }
  }
} else {
  // we can push all jobs at once
  running = queue;
  
  const threads = Math.floor(args.threads / running.length);
  const threadRemainder = args.threads - (threads * running.length);

  running.forEach((runner, i) => {
    const t = (i === 0) ? threadRemainder + threads : threads;
    runner.start(t);
  });

  queue = [];
}

renderJobList({
  runners: running,
  queued: queue.length,
});
