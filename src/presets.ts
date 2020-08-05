type PresetType = 'video' | 'audio';

export interface Preset {
  name: string | string[];
  desc: string;
  mixWith?: PresetType | PresetType[];
  extension?: string;
  args?: string[];
}

export const presetList: Preset[] = [
  {
    name: 'mp4',
    desc: 'Highly Optimized MP4 video with very small file size, however it is VERY SLOW.',
    extension: 'mp4',
    args: [
      '-c:v libx264 -preset veryslow -crf 20 -pix_fmt yuv420p',
      '-c:a aac -strict experimental'
    ]
  },
  {
    name: 'mp4-fast',
    desc: 'Optimized MP4 video. Faster than the default mp4 preset, but larger file size.',
    extension: 'mp4',
    args: [
      '-c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p',
      '-c:a aac -strict experimental'
    ]
  },
  {
    name: 'webm',
    desc: 'Optimized WEBM video.',
    extension: 'webm',
    args: [
      '-c:a libvorbis -quality good -qmin 0 -qmax 40 -b:v 400k',
      '-c:v libvpx-vp9'
    ]
  },
  {
    name: 'mp3',
    desc: 'MP3 Audio',
    extension: 'mp3',
    args: [
      '-ab 320k',
    ]
  },
  {
    name: 'png',
    desc: 'PNG Image',
    extension: 'png',
  },
  {
    name: 'jpeg',
    desc: 'JPEG Image',
    extension: 'jpeg',
  },
  {
    name: 'jpeg',
    desc: 'JPEG Image',
    extension: 'jpeg',
  },
  {
    name: ['4k', '3840x2160'],
    desc: 'Resizes video to 3840x2160 (keeps source aspect ratio)',
    args: [
      '-vf scale=3840:-1'
    ]
  },
  {
    name: ['1080p', '1920x1080'],
    desc: 'Resizes video to 1920x1080 (keeps source aspect ratio)',
    args: [
      '-vf scale=1920:-1'
    ]
  },
  {
    name: ['720p', '1280x720'],
    desc: 'Resizes video to 1280x720 (keeps source aspect ratio)',
    args: [
      '-vf scale=1280:-1'
    ]
  },
  {
    name: ['640', '640x360'],
    desc: 'Resizes video to 640x360 (keeps source aspect ratio)',
    args: [
      '-vf scale=640:-1'
    ]
  },
];

export const presetMap: Record<string, Preset> = {};

presetList.forEach((item) => {
  if (typeof item.name === 'string') {
    presetMap[item.name] = item;
  } else {
    item.name.forEach((name) => {
      presetMap[name] = item;
    })
  }
})
