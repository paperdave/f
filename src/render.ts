import { Runner } from "./job-runner";
import path from "path";
import chalk from "chalk";
import columnify from "columnify";
import filesize from "filesize";

export interface RenderJobListOptions {
  runners: Runner[];
  queued: number;
}

const formatSize = filesize.partial({
  unix: true
});

const boxChars = [" ", "▏", "▎", "▍", "▌", "▋", "▊", "▉"];

export function genProgressBar(progress: number, width: number) {
  if(progress >= 1) return chalk.hsv(progress * 120, 100, 100)("█".repeat(width));
  
  const wholeWidth = Math.floor(progress * width);
  const remainderWidth = (progress * width) % 1;
  const partWidth = Math.floor(remainderWidth * 8)
  let partChar = boxChars[partWidth]
  if (width - wholeWidth - 1 < 0) partChar = ""

  const fill = "█".repeat(wholeWidth);
  const empty = " ".repeat(width - wholeWidth - 1);
  
  return chalk.hsv(progress * 120, 100, 100).bgHsv(progress * 120, 100, 50)(`${fill}${partChar}${empty}`);
}

let lastHeight = 0;
export function renderJobList({
  runners,
  queued,
}: RenderJobListOptions) {
  process.stdout.write('\u001B[?25l');
  if(lastHeight > 0) {
    process.stdout.write('\u001B[F' + "\u001B[A".repeat(lastHeight));
  }
  const barWidth = process.stdout.columns - (runners.reduce((n, runner) => Math.max(n, runner.job.output.length), 0) + 2);

  let str = columnify(runners.map(runner => {
    return [
      chalk.magentaBright(path.basename(runner.job.output)),
      chalk.blueBright(`${(runner.progress * 100).toFixed(1)}%`),
      genProgressBar(runner.progress, barWidth)
    ];
  }), { showHeaders: false }) + '\n';
  if (queued) {
    str += `and ${queued} more files in queue.\n\n`;
  }
  lastHeight = str.split('\n').length - 1;
  console.log(str);
}

export function renderFinishedJob(runner: Runner) {
  process.stdout.write('\u001B[?25l');
  if(lastHeight > 0) {
    process.stdout.write('\u001B[F' + "\u001B[A".repeat(lastHeight));
    process.stdout.write('\u001B[2K');
  }
  lastHeight = 0;
  const sizeBefore = runner.sizeBefore;
  const sizeAfter = runner.sizeAfter;
  const percentSizeChange = sizeAfter / sizeBefore;
  console.log([
    chalk.greenBright(path.basename(runner.job.output)),
    chalk.greenBright(`DONE!`),
    chalk.green(`${formatSize(sizeBefore)} --> ${formatSize(sizeAfter)}`),
    chalk.white(`(${(percentSizeChange * 100).toFixed(1)}% size of original${sizeAfter > sizeBefore ? ', larger!!!' : ''})`)
  ].join(' '));
}

export function renderFailedJob(runner: Runner, code: number) {
  process.stdout.write('\u001B[?25l');
  if(lastHeight > 0) {
    process.stdout.write('\u001B[F' + "\u001B[A".repeat(lastHeight));
    process.stdout.write('\u001B[2K');
  }
  lastHeight = 0;
  console.log([
    chalk.redBright(path.basename(runner.job.output)),
    chalk.redBright(`FAILED!`),
    chalk.red(`FFmpeg exited with error code ${code}.`),
  ].join(' '));
}

export function renderEnd() {
  process.stdout.write('\u001B[?25h');
}
