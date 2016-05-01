
# parse-gp5

Parser for the Guitar Pro 5 file format.

Work in progress! Pull requests welcome :)

## Example

```js
const parse = require('parse-gp5');
const fs = require('fs');

const buf = fs.readFileSync(__dirname + '/tab.gp5');
const tab = parse(buf);

console.log(tab);
```

# Kudos

  This is mostly a port of what TuxGuitar has implemented in Java.

# License

  MIT

