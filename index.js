'use strict';

const versions = [
  'FICHIER GUITAR PRO v5.00',
  'FICHIER GUITAR PRO v5.10'
];

const QUARTER_TIME = 960;
const QUARTER = 4;

module.exports = buf => {
  let version;
  let versionIndex;

  const readVersion = () => {
    version = readStringByte(30);
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
  for (let i = 0; i < commentsLen; i++) {
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
  let timeSignature = { numerator: 4, denominator: {
    value: QUARTER,
    division: { enters: 1, times: 1 }
  }};
  for (let i = 0; i < measures; i++) {
    if (i > 0) skip(1);
    let flags = readUnsignedByte();
    let header = {};
    header.number = i+1;
    header.start = 0;
    header.tempo = 120;
    header.repeatOpen = (flags & 0x04) != 0;
    if ((flags & 0x01) != 0) timeSignature.numerator = readByte();
    if ((flags & 0x02) != 0) timeSignature.denominator.value = readByte();
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
    if (gmChannel1 >= 0 && gmChannel1 < channels.length) {
      const gmChannel1Param = {};
      const gmChannel2Param = {};

      gmChannel1Param.key = 'gm channel 1';
      gmChannel1Param.value = String(gmChannel1);
      gmChannel2Param.key = 'gm channel 2';
      gmChannel2Param.value = String(gmChannel1 != 9 ? gmChannel2 : gmChannel1);

      const channel = JSON.parse(JSON.stringify(channels[gmChannel1]));

      for (let i = 0; i < channels.length; i++) {
        let channelAux = channels[i];
        // TODO
        /*for (let n = 0; n < channelAux.; i++) {
        
        }*/
      }
      if (channel.id === 0) {
        channel.id = channels.length + 1;
        channel.name = 'TODO';
        channel.parameters.push(gmChannel1Param);
        channel.parameters.push(gmChannel2Param);
        channels.push(channel);
      }
      track.channelId = channel.id;
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
    readChannel(track);
    readInt();
    track.offset = readInt();
    track.color = readColor();
    track.measures = [];
    skip(versionIndex > 0 ? 49 : 44);
    if (versionIndex > 0) {
      readStringByteSizeOfInteger();
      readStringByteSizeOfInteger();
    }
    tracks.push(track);
  }
  skip(versionIndex == 0 ? 2 : 1);

  const readBeat = (start, measure, track, tempo, voiceIndex) => {
    const flags = readUnsignedByte();

    const beat = getBeat(measure, start);
    const voice = beat.voices[voiceIndex];
    if ((flags & 0x40) != 0) {
      const beatType = readUnsignedByte();
      voice.empty = (beatType & 0x02) === 0;
    }
    const duration = readDuration(flags);
    const effect = {};
    if ((flags & 0x02) != 0) readChord(track.strings, beat);
    if ((flags & 0x04) != 0) readText(beat);
    if ((flags & 0x08) != 0) readBeatEffects(beat, effect);
    if ((flags & 0x10) != 0) readMixChange(tempo);
    const stringFlags = readUnsignedByte();
    for (let i = 6; i>= 0; i--) {
      if ((stringFlags & (1 << i)) != 0 && (6 - i) < track.strings.length) {
        let string = JSON.parse(JSON.stringify(track.strings[6 - i]));
        let note = readNote(string, track, JSON.parse(JSON.stringify(effect)));
        voice.notes.push(note);
      }
      voice.duration = JSON.parse(JSON.stringify(duration));
    }

    skip(1);

    const read = readByte();
    if ((read & 0x02) != 0) skip(1);

    return (voice.notes.length ? duration : 0);
  };

  const readNote = (string, track, effect) => {
    const flags = readUnsignedByte();
    const note = {};
    note.string = string.number;
    note.effect = effect;
    note.effect.accentuatedNote = (flags & 0x40) != 0;
    note.effect.heavyAccentuatedNote = (flags & 0x02) != 0;
    note.effect.ghostNote = (flags & 0x04) != 0;
    if ((flags & 0x20) != 0) {
      const noteType = readUnsignedByte();
      note.tiedNote = noteType === 0x02;
      note.effect.deadNote = noteType === 0x03;
    }
    if ((flags & 0x10) != 0) {
      note.velocity = 'TGVelocities.MIN_VELOCITY' + ('TGVElocities.VELOCITY_INCREMENT' * readByte()) - 'TGVelocities.VELOCITY_INCREMENT'; // TODO
    }
    if ((flags & 0x20) != 0) {
      const fret = readByte();
      const value = note.tiedNote
        ? getTiedNoteValue(string.number, track)
        : fret;
      note.value = value >= 0 && value < 100
        ? value
        : 0;
    }
    if ((flags & 0x80) != 0) skip(2);
    if ((flags & 0x01) != 0) skip(8);
    skip(1);
    if ((flags & 0x08) != 0) readNoteEffects(note.effect);
    return note;
  };

  const readNoteEffects = noteEffect => {
    const flags1 = readUnsignedByte();
    const flags2 = readUnsignedByte();
    if ((flags1 & 0x01) != 0) readBend(noteEffect);
    if ((flags1 & 0x10) != 0) readGrace(noteEffect);
    if ((flags2 & 0x04) != 0) readTremoloPicking(noteEffect);
    if ((flags2 & 0x08) != 0) {
      noteEffect.slide = true;
      readByte();
    }
    if ((flags2 & 0x10) != 0) readArtificialHarmonic(noteEffect);
    if ((flags2 & 0x20) != 0) readTrill(noteEffect);
    noteEffect.hammer = (flags1 & 0x02) != 0;
    noteEffect.letRing = (flags1 & 0x08) != 0;
    noteEffect.vibrato = (flags2 & 0x40) != 0;
    noteEffect.palmMute = (flags2 & 0x02) != 0;
    noteEffect.staccato = (flags2 & 0x01) != 0;
  };

  const readTrill = effect => {
    const fret = readByte();
    const period = readByte();
    const trill = { fret: fret, duration: {} };
    if (period === 1) {
      trill.duration.value = 'sixteenth';
      effect.trill = trill;
    } else if (period === 2) {
      trill.duration.value = 'thirty_second';
      effect.trill = trill;
    } else if (period === 3) {
      trill.duration.value = 'sixty_fourth';
      effect.trill = trill;
    }
  };

  const readArtificialHarmonic = effect => {
    const type = readByte();
    const harmonic = { data: 0 };
    if (type === 1) {
      harmonic.type = 'natural';
      effect.harmonic = harmonic;
    } else if (type === 2) {
      skip(3);
      harmonic.type = 'artificial';
      effect.harmonic = harmonic;
    } else if (type === 3) {
      skip(1);
      harmonic.type = 'tapped';
      effect.harmonic = harmonic;
    } else if (type === 4) {
      harmonic.type = 'pinch';
      effect.harmonic = harmonic;
    } else if (type === 5) {
      harmonic.type = 'semi';
      effect.harmonic = harmonic;
    }
  };

  const readTremoloPicking = effect => {
    const value = readUnsignedByte();
    const tp = {};
    if (value === 1) {
      tp.duration.value = 'eigth';
      effect.tremoloPicking = tp;
    } else if (value === 2) {
      tp.duration.value = 'sixteenth';
      effect.tremoloPicking = tp;
    } else if (value === 3) {
      tp.duration.value = 'thirty_second';
      effect.tremoloPicking = tp;
    }
  };

  const readGrace = effect => {
    const fret = readUnsignedByte();
    const dynamic = readUnsignedByte();
    const transition = readByte();
    const duration = readUnsignedByte();
    const flags = readUnsignedByte();
    const grace = {};
    grace.fret = fret;
    grace.dynamic = ('TGVelocities.MIN_VELOCITY' + ('TGVelocities.VELOCITY_INCREMENT' * dynamic)) - 'TGVelocities.VELOCITY_INCREMENT';
    grace.duration = duration;
    grace.dead = (flags & 0x01) != 0;
    grace.onBeat = (flags & 0x02) != 0;
    if (transition === 0) grace.transition = 'none';
    else if (transition === 1) grace.transition = 'slide';
    else if (transition === 2) grace.transition = 'bend';
    else if (transition === 3) grace.transition = 'hammer';
    effect.grace = grace;
  };

  const readBend = effect => {
    skip(5);
    const bend = { points: [] };
    const numPoints = readInt();
    for (let i = 0; i < numPoints; i++) {
      let bendPosition = readInt();
      let bendValue = readInt();
      readByte(); 

      let pointPosition = Math.round(bendPosition * 'TGEffectBend.MAX_POSITION_LENGTH / GP_BEND_POSITION');
      let pointValue = Math.round(bendValue * 'TGEffectBend.SEMITONE_LENGHT' / 'GP_BEND_SEMITONE');
      bend.points.push({ pointPosition, pointValue });
    }
    if (bend.points.length) effect.bend = bend;
  };

  const getTiedNoteValue = (string, track) => {
    const measureCount = track.measures.length;
    if (measureCount > 0) {
      for (let m = measureCount - 1; m >= 0; m--) {
        let measure = track.measures[m];
        for (let b = measure.beats.length - 1; b >= 0; b--) {
          let beat = measure.beats[b];
          for (let v = 0; v < beat.voices.length; v++) {
            let voice = beat.voices[v];
            if (!voice.empty) {
              for (let n = 0; n < voice.notes.length; n++) {
                let note = voice.notes[n];
                if (note.string === string) return note.value;
              }
            }
          }
        }
      }
    }
  };

  const readMixChange = tempo => {
    readByte(); // instrument

    skip(16);
    const volume = readByte();
    const pan = readByte();
    const chorus = readByte();
    const reverb = readByte();
    const phaser = readByte();
    const tremolo = readByte();
    readStringByteSizeOfInteger(); // tempoName
    const tempoValue = readInt();
    if (volume >= 0) readByte();
    if (pan >= 0) readByte();
    if (chorus >= 0) readByte();
    if (reverb >= 0) readByte();
    if (phaser >= 0) readByte();
    if (tremolo >= 0) readByte();
    if (tempoValue >= 0) {
      tempo.value = tempoValue;
      skip(1);
      if (versionIndex > 0) skip(1);
    }
    readByte();
    skip(1);
    if (versionIndex > 0) {
      readStringByteSizeOfInteger();
      readStringByteSizeOfInteger();
    }
  };

  const readTremoloBar = effect => {
    skip(5);
    const tremoloBar = { points: [] };
    const numPoints = readInt();
    for (let i = 0; i < numPoints; i++) {
      let position = readInt();
      let value = readInt();
      readByte();

      let pointPosition = Math.round(position * 'max position length' / 'bend position'); // TODO
      let pointValue = Math.round(value / ('GP_BEND_SEMITONE' * 0x2f)); //TODO
      tremoloBar.points.push({ pointPosition, pointValue });
    }
    if (tremoloBar.points.length > 0) effect.tremoloBar = tremoloBar;
  };

  const readBeatEffects = (beat, noteEffect) => {
    const flags1 = readUnsignedByte();
    const flags2 = readUnsignedByte();
    noteEffect.fadeIn = (flags1 & 0x10) != 0;
    noteEffect.vibrato = (flags1 & 0x02) != 0;
    if ((flags1 & 0x20) != 0) {
      const effect = readUnsignedByte();
      noteEffect.tapping = effect === 1;
      noteEffect.slapping = effect === 2;
      noteEffect.popping = effect === 3;
    }
    if ((flags2 & 0x04) != 0) readTremoloBar(noteEffect);
    if ((flags1 & 0x40) != 0) {
      const strokeUp = readByte();
      const strokeDown = readByte();
      // TODO
      if (strokeUp > 0) {
        beat.stroke.direction = 'stroke_up';
        beat.stroke.value = 'stroke_down';
      } else if (strokeDown > 0) {
        beat.stroke.direction = 'stroke_down';
        beat.stroke.value = 'stroke_down';
      }
    }
    if ((flags2 & 0x02) != 0) readByte();
  };

  const readText = beat => {
    const text = {};
    text.value = readStringByteSizeOfInteger();
    beat.text = text;
  };

  const readChord = (strings, beat) => {
    const chord = { strings, frets: [] };
    skip(17);
    chord.name = readStringByte(21);
    skip(4);
    chord.frets[0] = readInt();
    for (let i = 0; i < 7; i++) {
      let fret = readInt();
      if (i < chord.strings.length) {
        chord.frets[i] = fret;
      }
    }
    skip(32);
    if (chord.strings.length > 0) beat.chord = chord;
  }

  const readDuration = (flags) => {
    const duration = {};
    duration.value = (Math.pow(2, (readByte() + 4)) / 4);
    duration.dotted = (flags & 0x01) != 0;
    duration.division = {};
    if ((flags & 0x20) != 0) {
      const divisionType = readInt();
      switch (divisionType) {
        case 3:
          duration.division.enters = 3;
          duration.division.times = 2;
          break;
        case 5:
          duration.division.enters = 5;
          duration.division.times = 5;
          break;
        case 6:
          duration.division.enters = 6;
          duration.division.times = 4;
          break;
        case 7:
          duration.division.enters = 7;
          duration.division.times = 4;
          break;
        case 9:
          duration.division.enters = 9;
          duration.division.times = 8;
          break;
        case 10:
          duration.division.enters = 10;
          duration.division.times = 8;
          break;
        case 11:
          duration.division.enters = 11;
          duration.division.times = 8;
          break;
        case 12:
          duration.division.enters = 12;
          duration.division.times = 8;
          break;
        case 13:
          duration.division.enters = 13;
          duration.division.times = 8;
          break;
      }
    }
    if (!('enters' in duration.division)) {
      duration.division.enters = 1;
      duration.division.times = 1;
    }
    return getTime(duration);
  };

  const getTime = duration => {
    let time = QUARTER_TIME * 4.0 / duration.value;
    if (duration.dotted) {
      time += time / 2;
    } else if (duration.doubleDotted) {
      time += (time / 4) * 3;
    }
    return time * duration.division.times / duration.division.enters;
  };

  const getBeat = (measure, start) => {
    for (let beat of measure.beats) {
      if (beat.start === start) return beat;
    }
    const beat = { start: start, voices: [{notes:[]},{notes:[]}] };
    measure.beats.push(beat);
    return beat;
  }

  const readMeasure = (measure, track, tempo) => {
    for (let voice = 0; voice < 2; voice++) {
      let start = measure.start;
      let beats = readInt();
      for (let k = 0; k < beats; k++) {
        start += readBeat(start, measure, track, tempo, voice);
      }
    };

    const emptyBeats = [];
    for (let i = 0; i < measure.beats.length; i++) {
      let beat = measure.beats[i];
      let empty = true;
      for (let v = 0; v < beat.voices.length; v++) {
        if (beat.voices[v].notes.length) empty = false;
      }
      if (empty) emptyBeats.push(beat);
    }
    for (let beat of emptyBeats) {
      measure.beats.splice(measure.beats.indexOf(beat), 1);
    }
    measure.clef = getClef(track);
    measure.keySignature = keySignature;
  }

  const getClef = track => {
    if (!isPercussionChannel(track.channelId)) {
      for (let string of track.strings) {
        if (string.value <= 34) return 'CLEF_BASS';
      }
    }
    return 'CLEF_TREBLE';
  }

  const isPercussionChannel = channelId => {
    for (let channel of channels) {
      if (channel.id === channelId) return channel.isPercussionChannel;
    }
  };

  const getLength = (header) => {
    return header.timeSignature.numerator * getTime(header.timeSignature.denominator);
  };

  let tempo = { value: tempoValue };
  let start = QUARTER_TIME;
  for (let i = 0; i < measures; i++) {
    let header = measureHeaders[i];
    header.start = start;
    for (let j = 0; j < trackCount; j++) {
      let track = tracks[j];
      let measure = { header: header, start: start, beats: [] };
      track.measures.push(measure);
      readMeasure(measure, track, tempo);
      skip(1);
    }
    header.tempo = JSON.parse(JSON.stringify(tempo));
    start += getLength(header);
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
  console.log(JSON.stringify(module.exports(require('fs').readFileSync(process.argv[1])), null, '  '));
}
