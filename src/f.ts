#!/usr/bin/node
import yargs from 'yargs';

const args = yargs
  .scriptName('f')
  .usage('Usage: $0 [options] <files> <preset>')
  .option('ffmpeg', { default: "ffmpeg", desc: "ffmpeg command to run" })
  .alias('ffmpeg', 'f')
  .help()
  .argv;

if(args._.length === 0) {
  yargs.showHelp();
  process.exit(1);
}
