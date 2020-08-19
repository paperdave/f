export type PresetName = string | { match: RegExp, args: string[], display: string };

export interface Preset {
  name: PresetName | PresetName[];
  desc: string;
  extension?: string;
  args?: string[];
}

export const presetList: Preset[] = [
  {
    name: 'mp4',
    desc: 'Highly Optimized MP4 video with very small file size, however it is VERY SLOW.',
    extension: 'mp4',
    args: [
      // video
      '-c:v', 'libx264',
      '-preset', 'veryslow',
      '-crf', '20',
      '-pix_fmt', 'yuv420p',
      // audio
      '-c:a', 'aac',
      '-strict', 'experimental'
    ]
  },
  {
    name: 'mp4-small',
    desc: 'Highly Compressed MP4 video with very small file size, however it is VERY SLOW.',
    extension: 'mp4',
    args: [
      // video
      '-c:v', 'libx264',
      '-preset', 'veryslow',
      '-crf', '22',
      '-pix_fmt', 'yuv420p',
      // audio
      '-c:a', 'aac',
      '-strict', 'experimental'
    ]
  },
  {
    name: 'mp4-fast',
    desc: 'Optimized MP4 video. Faster than the default mp4 preset, but larger file size.',
    extension: 'mp4',
    args: [
      // video
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '20',
      '-pix_fmt', 'yuv420p',
      // audio
      '-c:a', 'aac',
      '-strict', 'experimental'
    ]
  },
  {
    name: 'mp3',
    desc: 'MP3 Audio',
    extension: 'mp3',
    args: [
      '-ab', '320k',
    ]
  },
  {
    name: 'png-fast',
    desc: 'PNG Image',
    args: [
      '-compression_level', '100'
    ],
    extension: 'png',
  },
  {
    name: 'png',
    desc: 'PNG Image, optimized with palettegen',
    args: [
      '-compression_level', '100',
      '-filter_complex', 'palettegen[pal];[0][pal]paletteuse,format=pal8',
    ],
    extension: 'png',
  },
  {
    name: 'jpeg',
    desc: 'JPEG Image',
    extension: 'jpeg',
  },
  // preset sizes
  {
    name: ['4k'],
    desc: 'Resizes video to 3840x2160 (keeps source aspect ratio)',
    args: [
      '-vf', 'scale=3840:-1'
    ]
  },
  {
    name: ['1080p'],
    desc: 'Resizes video to 1920x1080 (keeps source aspect ratio)',
    args: [
      '-vf', 'scale=1920:-1'
    ]
  },
  {
    name: ['720p'],
    desc: 'Resizes video to 1280x720 (keeps source aspect ratio)',
    args: [
      '-vf', 'scale=1280:-1'
    ]
  },
  // custom sizes
  {
    name: {
      display: '{scale}x',
      match: /^(\d*\.?\d*)x$/,
      args: ['scale']
    },
    desc: 'Resizes video to be {scale} times the size of the orignal.',
    args: [
      '-vf', 'scale=\'(iw*{scale})\':\'(ih*{scale})\':flags=neighbor'
    ]
  },
  {
    name: {
      display: '{width}w',
      match: /^(\d*\.?\d*)w$/,
      args: ['width']
    },
    desc: 'Resizes video to be {width} pixels wide.',
    args: [
      '-vf', 'scale={width}:-1'
    ]
  },
  {
    name: {
      display: '{height}h',
      match: /^(\d*\.?\d*)h$/,
      args: ['height']
    },
    desc: 'Resizes video to be {height} pixels tall.',
    args: [
      '-vf', 'scale=-1:{height}'
    ]
  },
  {
    name: {
      display: '{width}x{height}',
      match: /^(\d*\.?\d*)x(\d*\.?\d*)$/,
      args: ['width', 'height']
    },
    desc: 'Resizes video to custom resolution {width}x{height}.',
    args: [
      '-vf', 'scale={width}:{height}'
    ]
  },
  {
    name: {
      display: 'max={width}x{height}',
      match: /^max=(\d*\.?\d*)x(\d*\.?\d*)$/,
      args: ['width', 'height']
    },
    desc: 'Resizes video to be {width}x{height} or smaller.',
    args: [
      '-vf', `scale='min({width},iw)':min'({height},ih)':force_original_aspect_ratio=decrease`
    ]
  },
  {
    name: {
      display: 'max={width}w',
      match: /^max=(\d*\.?\d*)w$/,
      args: ['width']
    },
    desc: 'Resizes video to be {width}x{height} or smaller.',
    args: [
      '-vf', `scale='min({width},iw)':-1`
    ]
  },
  {
    name: {
      display: 'max={height}h',
      match: /^max=(\d*\.?\d*)h$/,
      args: ['height']
    },
    desc: 'Resizes video to be {width}x{height} or smaller.',
    args: [
      '-vf', `scale=-1:min({height},ih)`
    ]
  },
  {
    name: 'crop-square',
    desc: 'Crops a video to be a square.',
    args: [
      '-vf', `crop='min(iw,ih)':'min(iw,ih)'`
    ]
  },
  {
    name: 'crop-mod-2',
    desc: 'Fix a bug with mp4',
    args: [
      '-vf', `crop='iw-mod(iw,2)':'ih-mod(ih,2)'`
    ]
  },
  // {
  //   name: 'crash',
  //   desc: 'Causes an ffmpeg error.',
  //   args: [
  //     '-c:v', 'crash_ok_thanks'
  //   ]
  // },
];

const presetMap: Record<string, Preset> = {};

presetList.forEach((item) => {
  if (typeof item.name === 'string') {
    presetMap[item.name] = item;
  } else if(Array.isArray(item.name)) {
    item.name.forEach((name) => {
      if(typeof name === 'string') {
        presetMap[name] = item;
      }
    })
  }
})

export function getPresetFromString(str: string): Preset {
  let v: Preset|null = null;
  return presetMap[str] || presetList.find(preset => {
    return (
      Array.isArray(preset.name)
        ? preset.name
        : [preset.name]
    ).find((name) => {
      if (typeof name !== 'string') {
        const match = str.match(name.match);
        if(match) {
          v = {
            ...preset,
            ...preset.args ? {
              args: preset.args.map(x => x.replace(/{[a-zA-Z0-9_\.-]+}/g, (str) => {
                const varName = str.slice(1, -1);
                if(name.args.includes(varName)) {
                  return match[name.args.indexOf(varName) + 1]
                } else {
                  return str;
                }
              }))
            } : {}
          }
          return true;
        }
      }      
    })
  }) && v || null;
}
