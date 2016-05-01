'use strict';

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

  const readColor = () => {
    let color = {};
    color.r = readUnsignedByte();
    color.g = readUnsignedByte();
    color.b = readUnsignedByte();
    skip(1);
    return color;
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
    const num = buf[0] & 0xff;
    buf = buf.slice(1);
    return num;
  };

  const readByte = () => {
    const byte = buf[0];
    buf = buf.slice(1);
    return byte;
  };

  const readInt = () => {
    const bytes = buf.slice(0, 4);
    buf = buf.slice(4);
    return ((bytes[3] & 0xff) << 24) | ((bytes[2] & 0xff) << 16) | ((bytes[1] & 0xff) << 8) | (bytes[0] & 0xff);
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

  const readKeySignature = () => {
    let keySignature = readByte();
    if (keySignature < 0) keySignature = 7 - keySignature;
    return keySignature;
  };

  const readLyrics = () => {
    let lyric = {};
    lyric.from = readInt(); 
    lyric.lyric = readStringInteger();
    for (let i = 0; i < 4; i++) {
      readInt();
      readStringInteger();
    }
    return lyric;
  };

  const readPageSetup = () => {
    skip(versionIndex > 0
      ? 49
      : 30);
    for (let i = 0; i < 11; i++) {
      skip(4);
      readStringByte(0);
    }
  };

  const readChannels = () => {
    let channels = [];
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
      channels.push(channel);
      skip(2);
    };
    return channels;
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
  const lyric = readLyrics();

  readPageSetup();

  const tempoValue = readInt();

  if (versionIndex > 0) skip(1);

  let keySignature = readKeySignature();
  skip(3);

  // octave
  readByte();

  const channels = readChannels();

  skip(42);

  const measures = readInt();
  const trackCount = readInt();

  const measureHeaders = [];
  let timeSignature = {};
  for (let i = 0; i < measures; i++) {
    if (i > 0) skip(1);
    let flags = readUnsignedByte();
    let header = {};
    header.number = i+1;
    header.start = 0;
    header.tempo = 120;
    header.repeatOpen = (flags & 0x04) != 0;
    if ((flags & 0x01) != 0) timeSignature.numerator = readByte();
    if ((flags & 0x02) != 0) timeSignature.denominator = readByte();
    header.timeSignature = JSON.parse(JSON.stringify(timeSignature));
    if ((flags & 0x08) != 0) header.repeatClose = (readByte() & 0xff) - 1;
    if ((flags & 0x20) != 0) {
      let marker = header.marker = {};
      marker.measure = header.number;
      marker.title = readStringByteSizeOfInteger();
      marker.color = readColor();
    }
    if ((flags & 0x10) != 0) header.repeatAlternative = readUnsignedByte();
    if ((flags & 0x40) != 0) {
      keySignature = readKeySignature();
      skip(1);
    }
    if ((flags & 0x01) != 0 || (flags & 0x02) != 0) skip(4);
    if ((flags & 0x10) == 0) skip(1);
    let tripletFeel = readByte();
    if (tripletFeel === 1) header.tripletFeel = 'eigth';
    else if (tripletFeel === 2) header.tripletFeel = 'sixteents';
    else header.tripletFeel = 'none';
    measureHeaders.push(header);
  }

  const readChannel = (track) => {
    const gmChannel1 = readInt() -1;
    const gmChannel2 = readInt() -1;
    if (gmChannel1 === 0 && gmChannel1 < channels.length) {
      const gmChannel1Param = {};
      gmChannel1Param.key = 'gm channel 1';
      gmChannel1Param.Value = String(gmChannel1);
      const gmChannel2Param = {};
      gmChannel2Param.key = 'gm channel 2';
      gmChannel2Param.Value = String(gmChannel1 != 9 ? gmChannel2 : gmChannel1);
      const channel = channels[gmChannel1];

      /* TODO
      for (let i = 0; i < channels.length; i++) {
        let channelAux = channels[i];
        for (let n = 0; n < channelAux.)
      } */
    }
  }

  const tracks = [];
  for (let number = 1; number <= trackCount; number++) {
    let track = {};
    readUnsignedByte();
    if (number === 1 || versionIndex === 0) skip(1);
    track.number = number;
    track.lyrics = number == lyricTrack
      ? lyric
      : {};
    track.name = readStringByte(40);
    track.strings = [];
    let stringCount = readInt();
    for (let i = 0; i < 7; i++) {
      let tuning = readInt();
      if (stringCount > i) {
        let string = {};
        string.number = i + 1;
        string.value = tuning;
        track.strings.push(string);
      }
    }
    readInt();
    // TODO
    readChannel(track);
    readInt();
    track.offset = readInt();
    track.color = readColor();
    skip(versionIndex > 0 ? 49 : 44);
    if (versionIndex > 0) {
      readStringByteSizeOfInteger();
      readStringByteSizeOfInteger();
    }
    tracks.push(track);
  }
  skip(versionIndex == 0 ? 2 : 1);

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
    lyric,
    tempoValue,
    keySignature,
    channels,
    measures,
    trackCount,
    measureHeaders,
    tracks
  };
};

if (!module.parent) {
  console.log(JSON.stringify(module.exports(require('fs').readFileSync(`${process.env.HOME}/Desktop/fekdich.gp5`)), null, '  '));
}
