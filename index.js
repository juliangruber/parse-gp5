
module.exports = buf => {
  const readUnsignedByte = () => {
    const num = buf.readUInt8();
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
    const str = buf.toString('utf8', 0, len);
    buf = buf.slice(size);
    return str;
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

  const versionString = readStringByte(30);
  const [, major, minor] = /v(\d+)\.(\d+)/.exec(versionString);

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
    lyrics: { track: lyricTrack, from: lyricFrom, text: lyricText }
  };
};

if (!module.parent) {
  console.log(module.exports(require('fs').readFileSync(`${process.env.HOME}/Desktop/fekdich.gp5`)));
}
