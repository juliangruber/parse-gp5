
const versions = [
  'FICHIER GUITAR PRO v5.00',
  'FICHIER GUITAR PRO v5.10'
];

module.exports = buf => {
  let version;
  let versionIndex;

  const readVersion = () => {
    /*if (version === null)*/ version = readStringByte(30);
  };

  const isSupportedVersion = (version) => {
    for (let i = 0; i < versions.length; i++) {
      if (versions[i] === version) {
        versionIndex = i;
        return true;
      }
    }
    return false;
  };

  const readUnsignedByte = () => {
    const num = buf.readUInt8();
    buf = buf.slice(1);
    return num;
  };

  const readByte = () => {
    const num = buf.readInt8();
    buf = buf.slice(1);
    return num;
  };

  const readInt = () => {
    const num = buf.readInt32LE();
    buf = buf.slice(4); 
    return num;
  };

  const readString = (size, len) => {
    if (typeof len == 'undefined') len = size;
    const bytes = buf.slice(0, size > 0
      ? size
      : len);
    buf = buf.slice(bytes.length);
    return bytes.toString('utf8', 0, len >= 0 && len <= bytes.length
      ? len
      : size);
  };

  const readStringByte = (size) => {
    return readString(size, readUnsignedByte());
  };

  const readStringByteSizeOfInteger = () => {
    return readStringByte(readInt() - 1);
  };

  const readStringInteger = () => {
    return readString(readInt());
  };

  const skip = (n) => {
    buf = buf.slice(n);
  };

  readVersion();
  if (!isSupportedVersion(version)) throw new Error('unsupported version');

  const [, major, minor] = /v(\d+)\.(\d+)/.exec(version);

  const title = readStringByteSizeOfInteger();
  const subtitle = readStringByteSizeOfInteger();
  const artist = readStringByteSizeOfInteger();
  const album = readStringByteSizeOfInteger();
  const lyricsAuthor = readStringByteSizeOfInteger();
  const musicAuthor = readStringByteSizeOfInteger();
  const copyright = readStringByteSizeOfInteger();
  const tab = readStringByteSizeOfInteger();
  const instructions = readStringByteSizeOfInteger();

  const commentsLen = readInt();
  const comments = [];
  for (let i = 0; i < comments; i++) {
    comments.push(readStringByteSizeOfInteger());
  }

  const lyricTrack = readInt();
  const lyricFrom = readInt();
  const lyricText = readStringInteger();
  for (let i = 0; i < 4; i++) {
    readInt();
    readStringInteger();
  }

  // page setup
  skip(versionIndex > 0
    ? 49
    : 30);
  for (let i = 0; i < 11; i++) {
    skip(4);
    readStringByte(0);
  }

  const tempoValue = readInt();

  if (versionIndex > 0) skip(1);

  let keySignature = readByte();
  if (keySignature < 0) keySignature = 7 - keySignature;
  skip(3);

  // octave
  readByte();

  const channels = [];
  for (let i = 0; i < 64; i++) {
    let channel = {};
    channel.program = readInt();
    channel.volume = readByte();
    channel.balance = readByte();
    channel.chorus = readByte();
    channel.reverb = readByte();
    channel.phaser = readByte();
    channel.tremolo = readByte();
    channel.bank = i == 9
      ? 'default percussion bank'
      : 'default bank'
    if (channel.program < 0) channel.program = 0;
    skip(2);
    channels.push(channel);
  };
  skip(42);

  const measures = readInt();
  const tracks = readInt();

  return {
    version: { major, minor },
    title,
    subtitle,
    artist,
    album,
    lyricsAuthor,
    musicAuthor,
    copyright,
    tab,
    instructions,
    comments,
    lyrics: { track: lyricTrack, from: lyricFrom, text: lyricText },
    tempoValue,
    keySignature,
    channels,
    measures,
    tracks
  };
};

if (!module.parent) {
  console.log(module.exports(require('fs').readFileSync(`${process.env.HOME}/Desktop/fekdich.gp5`)));
}
