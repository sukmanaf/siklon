import fs from 'node:fs';

const file = process.argv[2];
const lines = fs.readFileSync(file, 'utf-8').split('\n');

// Find and fix the toCrlf function
const result = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes("return text.split('\\n').join('\\r\\n');")) {
    // Replace with a version that uses actual newline chars via String.fromCharCode
    result.push("  const LF = String.fromCharCode(10);");
    result.push("  const CRLF = String.fromCharCode(13, 10);");
    result.push("  return text.split(CRLF).join(LF).split(LF).join(CRLF);");
  } else {
    result.push(line);
  }
}

fs.writeFileSync(file, result.join('\n'), 'utf-8');
console.log('Fixed toCrlf function');
