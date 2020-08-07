#!/usr/bin/env node
import Yargs from 'yargs';
import path from 'path';
import chalk from 'chalk';
import wrap from 'wrap-ansi';
import * as glob from 'glob';
import os from 'os';
import { presetList, getPresetFromString, PresetName } from './presets';
import { Job, createRunner, Runner } from './job-runner';
import { renderJobList, renderFinishedJob, renderEnd, renderFailedJob } from './render';
import { existsSync, unlinkSync, moveSync } from 'fs-extra';
import { prompt } from 'inquirer';

const argv = process.argv.slice(2).map(arg => {
  const array = glob.sync(arg);
  return array.length === 0 ? arg : array;
}).flat();

const width = Math.min(Yargs.terminalWidth(), 80);

function getStrName(name: PresetName|PresetName[]): string {
  if(Array.isArray(name)) {
    return name.map(x => getStrName(x)).join(', ');
  } else {
    if (typeof name === 'string') {
      return chalk.greenBright(name);
    } else {
      return chalk.greenBright(colorPlaceholders(name.display));
    }
  }
}
function colorPlaceholders(string: string): string {
  return string.replace(/\{[a-zA-Z0-9_\.-]+\}/g, (chunk) => {
    return chalk.green(chunk);
  })
}

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
    ...presetList.map(({ name, desc }) => {
      return wrap(`${getStrName(name)} - ${colorPlaceholders(desc)}`, width - 4).replace(/^/gm, x => '    ').slice(2).replace(/^ */gm, x => chalk.black(x));
    }),
    chalk.black(' '),
  ].join('\n'));

(async() => {
  const args = yargs.argv;
  const positional = args._;

  let overwriteOption: false | string = false;

  if(positional.length === 0) {
    yargs.showHelp();
    process.exit(1);
  }

  const jobs: Job[] = [];
  let currentFiles: string[] = [];
  let currentPresets: string[] = [];
  let lastArgType = 'unknown' as ('preset' | 'file' | 'unknown');
  async function pushJobs() {
    for (let i = 0; i < currentFiles.length; i++) {
      let file = path.resolve(currentFiles[i]);
      const basename = path.relative(process.cwd(), path.resolve(file)).slice(0, -path.extname(file).length);
      const ext = currentPresets.map(key => getPresetFromString(key).extension).filter(Boolean).pop() || path.extname(file).slice(1);

      const output = path.resolve(args.output.replace(/\[name\]/g, basename).replace(/\[ext\]/g, ext))
      const relativeOutput = path.relative(process.cwd(), output);

      if (!output.endsWith('.' + ext)) {
        console.log(chalk.redBright(`Error: path ${chalk.red(relativeOutput)} has incorrect extension, expected ${chalk.red(ext)}.`));
        console.log();
        console.log(chalk.redBright('Make sure you specify the --output argument correctly'));
        console.log(chalk.redBright('with [ext] to automatically fill the correct extension.'));
        process.exit(1);
      }

      let deleteSourceWhenDone = false;
      let backupName: undefined|string = undefined;

      if (existsSync(output)) {
        let response: string = overwriteOption ? overwriteOption : (await prompt({
          name: 'response',
          type: 'expand',
          message: file === output
            ? `The file ${chalk.green(relativeOutput)} is targeted to save over itself. Overwrite?`
            : `The file ${chalk.green(relativeOutput)} already exists. Select outcome:`,
          choices: [
            { key: 'E', name: 'Exit', value: 'no' },
            { key: 'O', name: 'Overwrite', value: 'overwrite' },
            { key: 'B', name: 'Backup', value: 'backup' },
            { key: 'A', name: 'Overwrite All', value: 'overwrite-all' },
            { key: 'C', name: 'Backup All', value: 'backup-all' },
          ]
        })).response;
        if(response === 'no') process.exit();
        if(response.startsWith('overwrite')) {
          if(file === output) {
            deleteSourceWhenDone = true;
            response = 'backup';
          } else {
            unlinkSync(output);
          }
        }
        if(response.startsWith('backup')) {
          const name = file === output ? 'old' : 'backup';
          let suffix = 1;
          backupName = `${basename}.${name}.${path.extname(file).slice(1)}`;
          while(existsSync(backupName)) {
            suffix += 1;
            backupName = `${basename}.${name}${suffix}.${path.extname(file).slice(1)}`;
          }
          moveSync(output, backupName);
          if(name === 'old') {
            file = backupName;
          } else {
            backupName = undefined;
          }
        }
        if(response.includes('all')) {
          overwriteOption = response.replace('-all', '');
        }
      }

      jobs.push({
        file,
        presets: currentPresets.concat(),
        output,
        backupName,
        deleteSourceWhenDone
      });
    }
    currentFiles = [];
    currentPresets = [];
  }
  for (let i = 0; i < positional.length; i++) {
    const arg = positional[i];
    if (getPresetFromString(arg)) {
      if (currentPresets.length && currentFiles.length && lastArgType === 'file') {
        await pushJobs();
      }
      currentPresets.push(arg);
    } else {
      if (currentPresets.length && currentFiles.length && lastArgType === 'preset') {
        await pushJobs();
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
    await pushJobs();
  }

  let queue = jobs.map(x => createRunner(args.ffmpeg, x))
  let running: Runner[] = [];

  console.log(`f media converter, ${queue.length} job${queue.length === 1 ? '' : 's'} queued.\n`);

  queue.forEach((runner) => {
    function nextJob() {
      running = running.filter(x => runner !== x);
      const next = queue.pop();
      if (next) {
        next.start(1);
        running.push(next);
      }
      if (running.length > 0) {
        renderJobList({
          runners: running,
          queued: queue.length,
        });
      } else {
        renderEnd();
        console.log('Done Encoding!');
        console.log('');
      }
    }
    runner.on('progress', () => {
      renderJobList({
        runners: running,
        queued: queue.length,
      });
    })
    runner.on('success', () => {
      renderFinishedJob(runner);
      nextJob();
    })
    runner.on('failure', (code) => {
      renderFailedJob(runner, code);
      nextJob();
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
})();
